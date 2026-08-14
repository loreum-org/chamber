"""
Immunefi Audit Competition Reports Indexer

Parses findings from the official Immunefi GitHub repo:
https://github.com/immunefi-team/Past-Audit-Competitions

Each finding is a markdown file inside a competition subdirectory.
File naming convention:
    37295-sc-high-rewards-can-be-stolen-by-depositing-immediately-after-reward-tokens-get-sent-to-vault.md
    ^^^^^  ^^  ^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ID     type sev   title slug

This indexer is SEPARATE from immunefi.py (which indexes bug bounty writeups from a curated list).
"""

import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import quote as urlquote

import httpx
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
from rich.table import Table

from ..schema import (
    Vulnerability, Source, Severity, detect_category, detect_protocol_type,
    normalize_severity,
)
from ..database import get_db

import sys
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

console = Console(force_terminal=True, legacy_windows=False)

# ═══════════════════════════════════════════════════════════════════════════════
# PATHS & CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

DATA_DIR = Path(__file__).parent.parent.parent / "data"
CACHE_DIR = DATA_DIR / "immunefi_competitions_cache"

GITHUB_REPO = "immunefi-team/Past-Audit-Competitions"
GITHUB_API_BASE = f"https://api.github.com/repos/{GITHUB_REPO}"
GITHUB_RAW_BASE = f"https://raw.githubusercontent.com/{GITHUB_REPO}/main"

API_REQUEST_DELAY = 1.0  # seconds between GitHub API requests (rate-limited)
RAW_FETCH_DELAY = 0.2    # seconds between raw.githubusercontent.com fetches (no rate limit)

# Files to skip when listing competition directories
SKIP_FILES = {"README.md", "readme.md", "LICENSE", "LICENSE.md", ".gitignore", ".gitkeep", "SUMMARY.md"}

# Severity keywords in filenames
SEVERITY_MAP = {
    "critical": Severity.CRITICAL.value,
    "high": Severity.HIGH.value,
    "medium": Severity.MEDIUM.value,
    "low": Severity.LOW.value,
    "insight": Severity.INFO.value,
    "info": Severity.INFO.value,
    "informational": Severity.INFO.value,
    "gas": Severity.GAS.value,
}


# ═══════════════════════════════════════════════════════════════════════════════
# GITHUB API HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _github_headers() -> Dict[str, str]:
    """Build GitHub API headers, optionally with auth token."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "unified-vuln-db-indexer/1.0",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
    return headers


def _github_get(client: httpx.Client, url: str) -> Optional[Any]:
    """Make a GitHub API GET request with rate-limit awareness."""
    try:
        resp = client.get(url, headers=_github_headers(), timeout=30.0)

        # Handle rate limiting
        if resp.status_code == 403:
            remaining = resp.headers.get("X-RateLimit-Remaining", "?")
            reset_ts = resp.headers.get("X-RateLimit-Reset", "")
            if remaining == "0" and reset_ts:
                reset_time = datetime.fromtimestamp(int(reset_ts))
                wait_secs = max(0, (reset_time - datetime.now()).total_seconds()) + 1
                console.print(
                    f"[yellow]Rate limited. Waiting {wait_secs:.0f}s until reset "
                    f"({reset_time.strftime('%H:%M:%S')})...[/yellow]"
                )
                if wait_secs <= 900:  # max 15 min wait
                    time.sleep(wait_secs)
                    resp = client.get(url, headers=_github_headers(), timeout=30.0)
                else:
                    console.print("[red]Rate limit reset too far in the future. Set GITHUB_TOKEN env var.[/red]")
                    return None
            else:
                console.print(f"[red]GitHub 403: {resp.text[:200]}[/red]")
                return None

        if resp.status_code == 404:
            console.print(f"[dim]404: {url}[/dim]")
            return None

        if resp.status_code != 200:
            console.print(f"[red]GitHub API {resp.status_code}: {url}[/red]")
            return None

        return resp.json()

    except httpx.TimeoutException:
        console.print(f"[dim]Timeout: {url[:80]}...[/dim]")
        return None
    except Exception as e:
        console.print(f"[red]Error fetching {url[:80]}...: {type(e).__name__}: {e}[/red]")
        return None


def _fetch_raw_content(client: httpx.Client, path: str) -> Optional[str]:
    """Fetch raw file content from the repo (not API, no rate limit cost)."""
    # URL-encode path segments (preserving /) for special chars in competition/file names
    encoded_path = "/".join(urlquote(segment, safe='') for segment in path.split("/"))
    url = f"{GITHUB_RAW_BASE}/{encoded_path}"
    try:
        resp = client.get(url, timeout=30.0, headers={
            "User-Agent": "unified-vuln-db-indexer/1.0",
        })
        if resp.status_code == 200:
            return resp.text
        else:
            console.print(f"[dim]Raw fetch {resp.status_code}: {path}[/dim]")
            return None
    except Exception as e:
        console.print(f"[dim]Raw fetch error: {path}: {e}[/dim]")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# MARKDOWN PARSING
# ═══════════════════════════════════════════════════════════════════════════════

def parse_filename(filename: str) -> Optional[Dict[str, str]]:
    """
    Parse finding metadata from filename.

    Handles TWO formats:
    1. New: {id}-sc-{severity}-{title-slug}.md  (e.g., 37295-sc-high-rewards-can-be...)
    2. Old: {id} - [SC - {Severity}] {Title}....md  (e.g., 30555 - [SC - Low] Precision loss...)
    3. Prefixed: {prefix} {id} - [Smart Contract - {Severity}] {Title}.md  (e.g., Boost _ Lido_ ...)

    Returns dict with keys: id, report_type, severity, title_slug
    or None if not a finding file.
    """
    if not filename.endswith(".md"):
        return None
    if filename.lower() in SKIP_FILES:
        return None

    stem = filename[:-3]  # strip .md

    # ── FORMAT 2/3: Bracket format (with or without prefix) ──
    # Matches: "30555 - [SC - Low] Title...." or "Boost _ Lido 34756 - [Smart Contract - Insight] Title"
    # Key: find {digits} - [{type} - {severity}] anywhere in the string
    old_match = re.search(
        r'(\d+)\s*-\s*\[([^\]]+?)\s*-\s*(\w+)\]\s*(.+?)\.{0,4}$',
        stem
    )
    if old_match:
        report_id = old_match.group(1)
        report_type_raw = old_match.group(2).strip().lower()
        # Normalize "Smart Contract" -> "sc", "Blockchain" -> "bc", etc.
        report_type = "sc" if "smart contract" in report_type_raw else report_type_raw.split()[0][:3]
        severity_raw = old_match.group(3).lower()
        title_slug = old_match.group(4).strip()
        severity = SEVERITY_MAP.get(severity_raw, Severity.UNKNOWN.value)
        return {
            "id": report_id,
            "report_type": report_type,
            "severity": severity,
            "title_slug": re.sub(r'\s+', '-', title_slug.lower()),
        }

    # ── FORMAT 1: New dash format ──
    # Pattern: "37295-sc-high-title-slug"
    parts = stem.split("-", 3)  # split into at most 4 parts

    if len(parts) < 3:
        return None

    # First part should be numeric report ID
    report_id = parts[0].strip()
    if not report_id.isdigit():
        return None

    # Detect whether second part is report type (sc, bc, etc.) or severity
    idx = 1
    report_type = ""
    if parts[idx].lower() in ("sc", "bc", "web", "app"):
        report_type = parts[idx].lower()
        idx += 1

    if idx >= len(parts):
        return None

    # Severity part
    severity_part = parts[idx].lower()
    severity = SEVERITY_MAP.get(severity_part)
    if severity is None:
        # Try to find severity embedded in a longer slug
        for sev_key, sev_val in SEVERITY_MAP.items():
            if sev_key in severity_part:
                severity = sev_val
                break
    if severity is None:
        severity = Severity.UNKNOWN.value

    # Remaining parts form the title slug
    title_slug = "-".join(parts[idx + 1:]) if idx + 1 < len(parts) else ""

    return {
        "id": report_id,
        "report_type": report_type,
        "severity": severity,
        "title_slug": title_slug,
    }


def parse_finding_markdown(content: str) -> Dict[str, str]:
    """
    Parse the markdown content of a competition finding.

    Returns dict with keys:
        title, report_id, report_type, severity, target,
        impacts, description, vulnerability_details,
        impact_details, poc_code, submitted_info
    """
    result: Dict[str, str] = {
        "title": "",
        "report_id": "",
        "report_type": "",
        "severity": "",
        "target": "",
        "impacts": "",
        "description": "",
        "vulnerability_details": "",
        "impact_details": "",
        "poc_code": "",
        "submitted_info": "",
    }

    lines = content.split("\n")

    # ── Title from first heading ──────────────────────────────────────────────
    for line in lines:
        line_stripped = line.strip()
        if line_stripped.startswith("# "):
            result["title"] = line_stripped[2:].strip()
            break

    # ── Inline metadata fields ────────────────────────────────────────────────
    for line in lines:
        line_stripped = line.strip()

        if line_stripped.startswith("* Report ID:") or line_stripped.startswith("- Report ID:"):
            result["report_id"] = line_stripped.split(":", 1)[1].strip().lstrip("#").strip()

        elif line_stripped.startswith("* Report Type:") or line_stripped.startswith("- Report Type:"):
            result["report_type"] = line_stripped.split(":", 1)[1].strip()

        elif line_stripped.startswith("* Report severity:") or line_stripped.startswith("- Report severity:"):
            result["severity"] = line_stripped.split(":", 1)[1].strip()

        elif line_stripped.startswith("* Target:") or line_stripped.startswith("- Target:"):
            result["target"] = line_stripped.split(":", 1)[1].strip()

        elif line_stripped.startswith("* Impacts:") or line_stripped.startswith("- Impacts:"):
            # Impacts may be on the same line or following lines with sub-bullets
            result["impacts"] = line_stripped.split(":", 1)[1].strip()

        elif line_stripped.startswith("**Submitted on"):
            result["submitted_info"] = line_stripped.strip("*").strip()

    # ── Collect sub-bullet impacts ────────────────────────────────────────────
    in_impacts = False
    impact_lines: List[str] = []
    for line in lines:
        line_stripped = line.strip()
        if line_stripped.startswith("* Impacts:") or line_stripped.startswith("- Impacts:"):
            in_impacts = True
            continue
        if in_impacts:
            if line_stripped.startswith("* ") or line_stripped.startswith("- "):
                if line_stripped.startswith("  ") or line.startswith("\t") or line_stripped.startswith("* ") or line_stripped.startswith("- "):
                    impact_lines.append(line_stripped.lstrip("*- ").strip())
                    continue
            in_impacts = False
    if impact_lines:
        result["impacts"] = "; ".join(filter(None, [result["impacts"]] + impact_lines))

    # ── Section extraction ────────────────────────────────────────────────────
    sections = _extract_sections(content)

    result["description"] = sections.get("description", "") or sections.get("brief/intro", "")
    result["vulnerability_details"] = sections.get("vulnerability details", "")
    result["impact_details"] = sections.get("impact details", "")

    # PoC — extract code blocks from the "proof of concept" section
    poc_section = sections.get("proof of concept", "") or sections.get("poc", "")
    if poc_section:
        code_blocks = re.findall(r"```(?:\w+)?\n(.*?)```", poc_section, re.DOTALL)
        if code_blocks:
            result["poc_code"] = "\n\n".join(code_blocks)
        else:
            # The whole section might be code-like
            result["poc_code"] = poc_section

    # Fallback: if description is empty, use vulnerability_details
    if not result["description"] and result["vulnerability_details"]:
        result["description"] = result["vulnerability_details"]

    return result


def _extract_sections(content: str) -> Dict[str, str]:
    """
    Extract named sections from markdown (## Heading).
    Returns lowercased heading -> content mapping.
    """
    sections: Dict[str, str] = {}
    current_heading = ""
    current_lines: List[str] = []

    for line in content.split("\n"):
        heading_match = re.match(r"^##\s+(.+)$", line)
        if heading_match:
            # Save previous section
            if current_heading:
                sections[current_heading] = "\n".join(current_lines).strip()
            current_heading = heading_match.group(1).strip().lower()
            current_lines = []
        elif current_heading:
            current_lines.append(line)

    # Save last section
    if current_heading:
        sections[current_heading] = "\n".join(current_lines).strip()

    return sections


# ═══════════════════════════════════════════════════════════════════════════════
# VULNERABILITY CREATION
# ═══════════════════════════════════════════════════════════════════════════════

def _clean_title(raw_title: str) -> str:
    """
    Clean the markdown title.
    Input:  '#37295 [SC-High] Rewards can be stolen by depositing...'
    Output: 'Rewards can be stolen by depositing...'
    """
    # Strip leading # and report ID
    cleaned = re.sub(r"^#?\d+\s*", "", raw_title)
    # Strip [SC-High] or [BC-Medium] etc. bracketed severity tags
    cleaned = re.sub(r"\[[\w-]+\]\s*", "", cleaned)
    return cleaned.strip()


def _slug_to_title(slug: str) -> str:
    """Convert a dash-separated title slug to a readable title."""
    return slug.replace("-", " ").strip().capitalize()


def create_competition_vulnerability(
    competition: str,
    filename: str,
    file_meta: Dict[str, str],
    parsed: Dict[str, str],
) -> Optional[Vulnerability]:
    """Create a Vulnerability object from parsed competition finding data."""
    try:
        report_id = file_meta.get("id", "")
        source_id = f"immunefi-comp-{competition}-{report_id}"

        # Title: prefer parsed markdown title, fall back to filename slug
        title = ""
        if parsed.get("title"):
            title = _clean_title(parsed["title"])
        if not title and file_meta.get("title_slug"):
            title = _slug_to_title(file_meta["title_slug"])
        if not title:
            title = f"Finding #{report_id} in {competition}"

        # Severity: prefer parsed from file content, fall back to filename
        severity_raw = parsed.get("severity", "") or file_meta.get("severity", "")
        severity = normalize_severity(severity_raw) if severity_raw else file_meta.get("severity", Severity.UNKNOWN.value)
        # Handle "Insight" explicitly (normalize_severity won't catch it)
        if "insight" in severity_raw.lower():
            severity = Severity.INFO.value

        # Build description
        desc_parts: List[str] = []
        if parsed.get("description"):
            desc_parts.append(parsed["description"])
        if parsed.get("vulnerability_details"):
            desc_parts.append(parsed["vulnerability_details"])
        description = "\n\n".join(desc_parts)[:8000]

        # Impact
        impact_parts: List[str] = []
        if parsed.get("impacts"):
            impact_parts.append(parsed["impacts"])
        if parsed.get("impact_details"):
            impact_parts.append(parsed["impact_details"])
        impact = "\n\n".join(impact_parts)[:3000]

        # PoC
        poc_code = parsed.get("poc_code", "")[:5000]
        has_poc = bool(poc_code)

        # Target URL
        target_url = parsed.get("target", "")
        encoded_comp = urlquote(competition, safe='')
        encoded_file = urlquote(filename, safe='')
        finding_url = f"https://github.com/{GITHUB_REPO}/tree/main/{encoded_comp}/{encoded_file}"

        # Detect category and protocol type from combined text
        combined_text = f"{title} {description} {impact} {competition}"
        category = detect_category(combined_text)
        protocol_type = detect_protocol_type(combined_text)

        # Extract root cause hints
        root_cause = ""
        root_cause_patterns = [
            r"(?:root cause|the issue|the bug|the vulnerability|the problem)[:\s]+([^.]+\.)",
            r"(?:this happens because|this occurs because|this is because)[:\s]+([^.]+\.)",
        ]
        for pattern in root_cause_patterns:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                root_cause = match.group(1).strip()
                break

        # Extract vulnerable code from description (first code block)
        vulnerable_code = ""
        code_blocks = re.findall(r"```(?:\w+)?\n(.*?)```", description, re.DOTALL)
        if code_blocks:
            for block in code_blocks:
                if len(block.strip()) > 30:
                    vulnerable_code = block.strip()[:3000]
                    break

        # Date from submitted info
        date = ""
        if parsed.get("submitted_info"):
            date_match = re.search(
                r"(?:on|submitted)\s+(\w+\s+\d+(?:st|nd|rd|th)?\s+\d{4})",
                parsed["submitted_info"],
                re.IGNORECASE,
            )
            if date_match:
                date = date_match.group(1)

        vuln = Vulnerability(
            id=source_id,
            source=Source.IMMUNEFI.value,
            source_id=source_id,
            category=category,
            severity=severity,
            protocol_type=protocol_type,
            title=title[:200],
            description=description,
            impact=impact,
            root_cause=root_cause[:500],
            attack_vector="",
            vulnerable_code=vulnerable_code,
            has_poc=has_poc,
            poc_code=poc_code,
            protocol_name=competition,
            audit_firm="immunefi",
            auditor="",
            date=date,
            url=finding_url,
            amount_lost="",
            cvss_score=0.0,
            tags=[
                category,
                protocol_type,
                "audit-competition",
                "immunefi-competition",
                f"competition:{competition}",
                file_meta.get("report_type", ""),
            ],
            related_nodes=[
                f"protocol:{competition}",
                f"platform:immunefi",
            ],
        )

        # Clean up empty tags/nodes
        vuln.tags = [t for t in vuln.tags if t]
        vuln.related_nodes = [n for n in vuln.related_nodes if n]

        return vuln

    except Exception as e:
        console.print(f"[red]Error creating vulnerability for {filename}: {e}[/red]")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# CACHING
# ═══════════════════════════════════════════════════════════════════════════════

def _sanitize_for_path(name: str) -> str:
    """Sanitize a string for use as a file/directory name on all platforms.

    Replaces characters illegal on Windows (\\/:*?"<>|) and strips trailing
    dots/spaces (Windows silently strips them, causing path mismatches).
    """
    # Replace illegal Windows chars with underscore
    sanitized = re.sub(r'[\\/:*?"<>|]', '_', name)
    # Strip trailing dots and spaces (Windows strips these silently)
    sanitized = sanitized.rstrip('. ')
    return sanitized


def _cache_path(competition: str, filename: str) -> Path:
    """Return the local cache path for a finding file."""
    comp_dir = CACHE_DIR / _sanitize_for_path(competition)
    return comp_dir / _sanitize_for_path(filename)


def _read_cache(competition: str, filename: str) -> Optional[str]:
    """Read cached markdown content."""
    path = _cache_path(competition, filename)
    if path.exists():
        return path.read_text(encoding="utf-8", errors="replace")
    return None


def _write_cache(competition: str, filename: str, content: str) -> None:
    """Write markdown content to cache."""
    path = _cache_path(competition, filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _load_competitions_index_cache() -> Optional[Dict[str, List[str]]]:
    """Load cached competition -> filenames mapping."""
    index_file = CACHE_DIR / "_competitions_index.json"
    if index_file.exists():
        try:
            return json.loads(index_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
    return None


def _save_competitions_index_cache(index: Dict[str, List[str]]) -> None:
    """Save competition -> filenames mapping to cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    index_file = CACHE_DIR / "_competitions_index.json"
    index_file.write_text(json.dumps(index, indent=2), encoding="utf-8")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN INDEXER
# ═══════════════════════════════════════════════════════════════════════════════

def _discover_from_local(repo_path: Path, competitions: Optional[List[str]] = None) -> Dict[str, List[str]]:
    """Discover competitions and findings from a local git clone."""
    comp_file_map: Dict[str, List[str]] = {}

    for entry in sorted(repo_path.iterdir()):
        if not entry.is_dir():
            continue
        name = entry.name
        if name.startswith(".") or name in ("scripts", "node_modules"):
            continue
        if competitions and name not in competitions:
            continue

        findings = []
        for f in sorted(entry.iterdir()):
            if f.suffix == ".md" and f.name.lower() not in SKIP_FILES:
                meta = parse_filename(f.name)
                if meta is not None:
                    findings.append(f.name)

        if findings:
            comp_file_map[name] = findings

    return comp_file_map


def index_immunefi_competitions(
    competitions: Optional[List[str]] = None,
    max_findings_per_competition: Optional[int] = None,
    incremental: bool = False,
    skip_fetch: bool = False,
    local_repo_path: Optional[str] = None,
) -> int:
    """
    Index Immunefi audit competition findings.

    Supports two modes:
    1. LOCAL (preferred): Pass local_repo_path pointing to a git clone of
       immunefi-team/Past-Audit-Competitions. Zero API calls, zero rate limits.
       Clone with: git clone https://github.com/immunefi-team/Past-Audit-Competitions.git
    2. REMOTE (fallback): Fetches from GitHub API + raw.githubusercontent.com.
       No token needed for typical usage (~50 API calls for directory listing).

    Args:
        competitions: List of competition directory names to index (None = all).
        max_findings_per_competition: Max findings per competition (None = all).
        incremental: If True, skip already-indexed entries.
        skip_fetch: If True, only use cached data (no GitHub API calls).
        local_repo_path: Path to local git clone of Past-Audit-Competitions (preferred).

    Returns:
        Number of vulnerabilities indexed.
    """
    db = get_db()
    use_local = local_repo_path is not None
    repo_path = Path(local_repo_path) if local_repo_path else None

    console.print("[bold blue]" + "=" * 60 + "[/bold blue]")
    console.print("[bold blue]  Immunefi Audit Competition Reports Indexer[/bold blue]")
    console.print("[bold blue]" + "=" * 60 + "[/bold blue]")

    if use_local:
        if not repo_path.is_dir():
            console.print(f"[red]Local repo path not found: {local_repo_path}[/red]")
            console.print("[yellow]Clone it: git clone https://github.com/immunefi-team/Past-Audit-Competitions.git[/yellow]")
            return 0
        console.print(f"[green]Using local repo: {repo_path}[/green]")
    else:
        token = os.environ.get("GITHUB_TOKEN")
        if token:
            console.print("[green]GITHUB_TOKEN detected - using authenticated requests (5000 req/hr)[/green]")
        else:
            console.print("[dim]Using remote mode (GitHub raw URLs — no token needed for typical usage).[/dim]")
            if sys.platform != "win32":
                console.print("[dim]Tip (macOS/Linux): clone locally for zero API calls:[/dim]")
                console.print("[dim]  git clone https://github.com/immunefi-team/Past-Audit-Competitions.git[/dim]")
                console.print("[dim]  Then pass --local-repo /path/to/Past-Audit-Competitions[/dim]")
            # Note: local clone doesn't work on Windows due to | and : in directory names

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # ── Step 1: Discover competitions ─────────────────────────────────────────
    console.print("\n[cyan]Step 1: Discovering competitions...[/cyan]")

    comp_file_map: Dict[str, List[str]] = {}  # competition -> list of finding filenames

    if use_local:
        comp_file_map = _discover_from_local(repo_path, competitions)
    elif skip_fetch:
        cached_index = _load_competitions_index_cache()
        if cached_index:
            comp_file_map = cached_index
            console.print(f"[yellow]Using cached index: {len(comp_file_map)} competitions[/yellow]")
        else:
            console.print("[red]No cached index available and skip_fetch=True. Nothing to do.[/red]")
            return 0
    else:
        comp_file_map = _discover_competitions(competitions)
        if not comp_file_map:
            console.print("[red]No competitions found![/red]")
            return 0
        _save_competitions_index_cache(comp_file_map)

    # Filter to requested competitions (for remote mode; local already filtered)
    if competitions and not use_local:
        comp_file_map = {
            k: v for k, v in comp_file_map.items()
            if k in competitions
        }
        if not comp_file_map:
            console.print(f"[red]None of the requested competitions found: {competitions}[/red]")
            return 0

    total_findings = sum(len(files) for files in comp_file_map.values())
    console.print(f"[green]Found {len(comp_file_map)} competitions with {total_findings} findings[/green]")

    # ── Step 2: Fetch and parse findings ──────────────────────────────────────
    console.print("\n[cyan]Step 2: Fetching and parsing findings...[/cyan]")

    all_vulns: List[Vulnerability] = []
    stats_by_severity: Dict[str, int] = {}
    stats_by_competition: Dict[str, int] = {}
    stats_by_category: Dict[str, int] = {}
    fetch_errors = 0
    parse_errors = 0
    skipped_cached = 0

    with httpx.Client() as client:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TextColumn("({task.completed}/{task.total})"),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("[cyan]Processing findings...", total=total_findings)

            for comp_name, filenames in sorted(comp_file_map.items()):
                finding_files = filenames
                if max_findings_per_competition:
                    finding_files = finding_files[:max_findings_per_competition]

                for filename in finding_files:
                    progress.update(task, description=f"[cyan]{comp_name}/{filename[:40]}...")

                    # Parse filename metadata
                    file_meta = parse_filename(filename)
                    if file_meta is None:
                        progress.advance(task)
                        continue

                    # Check incremental: skip if already indexed
                    source_id = f"immunefi-comp-{comp_name}-{file_meta['id']}"
                    if incremental:
                        existing = db.get_by_id(source_id)
                        if existing:
                            skipped_cached += 1
                            progress.advance(task)
                            continue

                    # Fetch content: local disk > cache > network
                    content = None
                    if use_local:
                        local_file = repo_path / comp_name / filename
                        try:
                            content = local_file.read_text(encoding="utf-8")
                        except Exception:
                            fetch_errors += 1
                            progress.advance(task)
                            continue
                    else:
                        content = _read_cache(comp_name, filename)
                    if content is None and not skip_fetch and not use_local:
                        file_path = f"{comp_name}/{filename}"
                        content = _fetch_raw_content(client, file_path)
                        if content:
                            _write_cache(comp_name, filename, content)
                        time.sleep(RAW_FETCH_DELAY)  # raw.githubusercontent.com has no rate limit

                    if content is None:
                        fetch_errors += 1
                        progress.advance(task)
                        continue

                    # Parse markdown
                    parsed = parse_finding_markdown(content)

                    # Create vulnerability
                    vuln = create_competition_vulnerability(
                        competition=comp_name,
                        filename=filename,
                        file_meta=file_meta,
                        parsed=parsed,
                    )

                    if vuln:
                        all_vulns.append(vuln)

                        # Update stats
                        stats_by_severity[vuln.severity] = stats_by_severity.get(vuln.severity, 0) + 1
                        stats_by_competition[comp_name] = stats_by_competition.get(comp_name, 0) + 1
                        stats_by_category[vuln.category] = stats_by_category.get(vuln.category, 0) + 1
                    else:
                        parse_errors += 1

                    progress.advance(task)

    console.print(f"[green]Parsed {len(all_vulns)} findings successfully[/green]")
    if fetch_errors:
        console.print(f"[yellow]Fetch errors: {fetch_errors}[/yellow]")
    if parse_errors:
        console.print(f"[yellow]Parse errors: {parse_errors}[/yellow]")
    if skipped_cached:
        console.print(f"[dim]Skipped {skipped_cached} already-indexed entries (incremental mode)[/dim]")

    if not all_vulns:
        console.print("[yellow]No vulnerabilities to index.[/yellow]")
        return 0

    # ── Step 3: Index to database ─────────────────────────────────────────────
    console.print("\n[cyan]Step 3: Indexing to database...[/cyan]")

    if not incremental:
        # Delete existing competition entries by source_id prefix
        # Since both bounty writeups and competition reports share Source.IMMUNEFI,
        # we need to selectively delete only competition entries.
        deleted = _delete_competition_entries(db)
        if deleted:
            console.print(f"[yellow]Cleared {deleted} existing competition entries[/yellow]")

    console.print(f"[cyan]Adding {len(all_vulns)} vulnerabilities to database...[/cyan]")
    added = db.add_vulnerabilities(all_vulns)

    # ── Step 4: Display statistics ────────────────────────────────────────────
    console.print("\n[bold green]" + "=" * 60 + "[/bold green]")
    console.print(f"[bold green]  Indexed {added} Immunefi competition findings![/bold green]")
    console.print("[bold green]" + "=" * 60 + "[/bold green]")

    # Severity table
    sev_table = Table(title="By Severity")
    sev_table.add_column("Severity", style="yellow")
    sev_table.add_column("Count", justify="right")
    severity_order = ["critical", "high", "medium", "low", "info", "gas", "unknown"]
    for sev in severity_order:
        if sev in stats_by_severity:
            sev_table.add_row(sev, str(stats_by_severity[sev]))
    console.print(sev_table)

    # Competition table (top 15)
    comp_table = Table(title="Top Competitions")
    comp_table.add_column("Competition", style="cyan")
    comp_table.add_column("Findings", justify="right")
    for comp, count in sorted(stats_by_competition.items(), key=lambda x: -x[1])[:15]:
        comp_table.add_row(comp, str(count))
    console.print(comp_table)

    # Category table (top 10)
    cat_table = Table(title="Top Categories")
    cat_table.add_column("Category", style="green")
    cat_table.add_column("Count", justify="right")
    for cat, count in sorted(stats_by_category.items(), key=lambda x: -x[1])[:10]:
        cat_table.add_row(cat, str(count))
    console.print(cat_table)

    return added


# ═══════════════════════════════════════════════════════════════════════════════
# INTERNAL HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _discover_competitions(
    filter_competitions: Optional[List[str]] = None,
) -> Dict[str, List[str]]:
    """
    Discover all competitions and their finding files via the GitHub API.
    Uses the contents API to list the repo root, then each competition directory.
    """
    comp_file_map: Dict[str, List[str]] = {}

    with httpx.Client() as client:
        # List repo root to get competition directories
        console.print("[dim]Listing repo root...[/dim]")
        root_contents = _github_get(client, f"{GITHUB_API_BASE}/contents/")
        if root_contents is None:
            console.print("[red]Failed to list repo root.[/red]")
            return {}

        time.sleep(API_REQUEST_DELAY)

        # Filter to directories only
        comp_dirs = [
            item for item in root_contents
            if item.get("type") == "dir"
            and item.get("name", "").lower() not in (".github", ".git", "__pycache__")
        ]

        if filter_competitions:
            comp_dirs = [d for d in comp_dirs if d["name"] in filter_competitions]

        console.print(f"[dim]Found {len(comp_dirs)} competition directories[/dim]")

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("({task.completed}/{task.total})"),
            console=console,
        ) as progress:
            task = progress.add_task("[cyan]Listing competitions...", total=len(comp_dirs))

            for item in comp_dirs:
                comp_name = item["name"]
                progress.update(task, description=f"[cyan]{comp_name}...")

                # List files in competition directory
                dir_contents = _github_get(client, f"{GITHUB_API_BASE}/contents/{urlquote(comp_name, safe='')}")
                time.sleep(API_REQUEST_DELAY)

                if dir_contents is None:
                    progress.advance(task)
                    continue

                # Filter to .md finding files only (use parse_filename as the gate)
                finding_files = []
                for file_item in dir_contents:
                    if file_item.get("type") != "file":
                        continue
                    fname = file_item.get("name", "")
                    if parse_filename(fname) is not None:
                        finding_files.append(fname)

                if finding_files:
                    comp_file_map[comp_name] = sorted(finding_files)

                progress.advance(task)

    return comp_file_map


def _delete_competition_entries(db) -> int:
    """
    Delete only competition entries (not bug bounty writeups) from the DB.
    Competition entries have source_id starting with 'immunefi-comp-'.
    """
    try:
        results = db.collection.get(
            where={"source": Source.IMMUNEFI.value},
            include=["metadatas"],
        )
        if not results["ids"]:
            return 0

        ids_to_delete = []
        for i, meta in enumerate(results.get("metadatas", [])):
            sid = meta.get("source_id", "")
            if sid.startswith("immunefi-comp-"):
                ids_to_delete.append(results["ids"][i])

        if ids_to_delete:
            # Delete in batches (ChromaDB may have limits)
            batch_size = 500
            for start in range(0, len(ids_to_delete), batch_size):
                batch = ids_to_delete[start:start + batch_size]
                db.collection.delete(ids=batch)
            return len(ids_to_delete)

    except Exception as e:
        console.print(f"[yellow]Error cleaning competition entries: {e}[/yellow]")

    return 0


# ═══════════════════════════════════════════════════════════════════════════════
# STANDALONE EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    comps = None
    max_per = None

    for arg in sys.argv[1:]:
        if arg.startswith("--max="):
            try:
                max_per = int(arg.split("=")[1])
            except ValueError:
                pass
        elif arg == "--skip-fetch":
            index_immunefi_competitions(skip_fetch=True)
            sys.exit(0)
        else:
            if comps is None:
                comps = []
            comps.append(arg)

    index_immunefi_competitions(
        competitions=comps,
        max_findings_per_competition=max_per,
    )
