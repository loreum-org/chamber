"""
Solodit API Indexer

Uses the official Solodit API to fetch vulnerability findings.
Requires SOLODIT_API_KEY environment variable.

API: POST https://solodit.cyfrin.io/api/v1/solodit/findings
Rate Limit: 20 requests per 60 seconds
"""

import asyncio
import hashlib
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx
from rich.console import Console
from rich.progress import Progress

from ..schema import (
    Vulnerability, Source, Severity, detect_category, detect_protocol_type,
    normalize_severity
)
from ..database import get_db

console = Console()

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
CACHE_DIR = DATA_DIR / "solodit_cache"

# Solodit API config - CORRECT endpoint
API_URL = "https://solodit.cyfrin.io/api/v1/solodit/findings"

# Rate limiting: 20 requests per 60 seconds
REQUEST_DELAY = 3.5  # ~17 requests per minute to stay under limit

# Impact levels
IMPACT_LEVELS = ["HIGH", "MEDIUM", "LOW"]

# Vulnerability tags to search
VULN_TAGS = [
    "Reentrancy",
    "Oracle",
    "Access Control",
    "Flash Loan",
    "Front-running",
    "Price Manipulation",
    "Integer Overflow/Underflow",
    "Logic Error",
    "DOS",
    "Griefing",
    "Signature",
    "Upgrade",
    "Initialization",
    "Precision Loss",
    "Rounding",
    "First Depositor",
    "Share Inflation",
    "ERC4626",
    "Liquidation",
    "Governance",
    "Cross-chain",
    "Bridge",
    "Slippage",
    "Timestamp",
    "Randomness",
    "Delegatecall",
    "Storage Collision",
]


def get_api_key() -> Optional[str]:
    """Get Solodit API key from environment (strip whitespace — MCP env configs can inject trailing spaces)."""
    key = os.environ.get("SOLODIT_API_KEY")
    return key.strip() if key else None


def generate_id(title: str, finding_id: str) -> str:
    """Generate unique ID for a finding."""
    combined = f"{title}-{finding_id}"
    hash_str = hashlib.md5(combined.encode()).hexdigest()[:8]
    slug = re.sub(r'[^a-zA-Z0-9]', '-', title.lower())[:40]
    return f"solodit-{slug}-{hash_str}"


async def fetch_api(
    client: httpx.AsyncClient,
    api_key: str,
    request_body: Dict[str, Any],
    max_retries: int = 3
) -> Optional[Dict]:
    """Fetch from Solodit API with retry and rate limiting."""
    headers = {
        "Content-Type": "application/json",
        "X-Cyfrin-API-Key": api_key,
    }
    
    for attempt in range(max_retries):
        try:
            await asyncio.sleep(REQUEST_DELAY)
            
            response = await client.post(
                API_URL,
                headers=headers,
                json=request_body,
                timeout=30.0
            )
            
            if response.status_code == 429:
                # Rate limited - wait longer
                console.print("[yellow]Rate limited, waiting 60s...[/yellow]")
                await asyncio.sleep(60)
                continue
            
            if response.status_code == 401:
                console.print("[red]Invalid API key. Get one from https://solodit.cyfrin.io[/red]")
                return None
            
            if response.status_code == 403:
                console.print("[red]API key unauthorized. Check your key permissions.[/red]")
                return None
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            console.print(f"[red]API error {e.response.status_code}: {e.response.text[:200]}[/red]")
            if attempt == max_retries - 1:
                return None
            await asyncio.sleep(2 ** attempt)
        except Exception as e:
            if attempt == max_retries - 1:
                console.print(f"[red]Request error: {e}[/red]")
                return None
            await asyncio.sleep(2 ** attempt)
    
    return None


def parse_content_sections(content: str) -> Dict[str, str]:
    """
    Parse markdown content from audit findings into structured sections.

    Looks for common audit report section headers and extracts:
    - root_cause: Why the bug exists
    - vulnerable_code: Code snippets (fenced blocks)
    - recommendation: How to fix
    - impact: What damage can occur
    - attack_vector: How to exploit
    - description: General description text
    """
    sections: Dict[str, str] = {}
    if not content:
        return sections

    # Extract all fenced code blocks first
    code_blocks = re.findall(r'```(?:solidity|sol|javascript|typescript|python|vyper)?\s*\n(.*?)```', content, re.DOTALL)
    if code_blocks:
        sections["vulnerable_code"] = code_blocks[0].strip()[:3000]

    # Section header patterns mapped to our keys
    header_map = {
        "root_cause": [
            r'(?:^|\n)#{1,3}\s*(?:Root\s*Cause|Vulnerability\s*Detail|Bug\s*Description)',
        ],
        "impact": [
            r'(?:^|\n)#{1,3}\s*Impact',
        ],
        "recommendation": [
            r'(?:^|\n)#{1,3}\s*(?:Recommend(?:ation|ed\s*Mitigation)|Remediation|Mitigation|Fix|Resolution|Suggested\s*Fix)',
        ],
        "attack_vector": [
            r'(?:^|\n)#{1,3}\s*(?:Attack(?:\s*Vector)?|Exploit(?:ation)?|Proof\s*of\s*Concept|PoC|Steps?\s*to\s*Reproduce)',
        ],
        "description": [
            r'(?:^|\n)#{1,3}\s*(?:Description|Detail|Overview|Summary|Finding)',
        ],
    }

    # For each section type, find the header and grab text until the next header
    all_header_pattern = r'(?:^|\n)#{1,3}\s+'

    for key, patterns in header_map.items():
        if key in sections and key != "description":
            continue
        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                start = match.end()
                # Find next header
                next_header = re.search(all_header_pattern, content[start:])
                if next_header:
                    text = content[start:start + next_header.start()]
                else:
                    text = content[start:]
                text = text.strip()
                if text and len(text) > 20:
                    sections[key] = text[:5000]
                break

    # If no structured sections found, use the full content as description
    if "description" not in sections and "root_cause" not in sections:
        # Strip code blocks for cleaner description
        desc = re.sub(r'```.*?```', '[code]', content, flags=re.DOTALL).strip()
        if desc:
            sections["description"] = desc[:5000]

    return sections


def parse_finding(finding: Dict) -> Optional[Vulnerability]:
    """Convert API finding to Vulnerability object with rich content extraction."""
    try:
        # Extract fields from API response
        finding_id = finding.get("id", "")
        slug = finding.get("slug", "")
        title = finding.get("title", "")

        if not title:
            return None

        # Get severity/impact
        impact = finding.get("impact", "").upper()
        severity = normalize_severity(impact.lower()) if impact else Severity.UNKNOWN.value

        # Get content and parse sections
        content = finding.get("content", "") or ""
        summary = finding.get("summary", "") or ""
        sections = parse_content_sections(content)

        description = summary or sections.get("description", content[:5000])

        # Get tags from nested structure
        tags = []
        tag_scores = finding.get("issues_issuetagscore", [])
        if tag_scores:
            for ts in tag_scores:
                tag_obj = ts.get("tags_tag", {})
                tag_title = tag_obj.get("title", "")
                if tag_title:
                    tags.append(tag_title)

        # Get finders
        finders = []
        issue_finders = finding.get("issues_issue_finders", [])
        if issue_finders:
            for f in issue_finders:
                warden = f.get("wardens_warden", {})
                handle = warden.get("handle", "")
                if handle:
                    finders.append(handle)

        # Get metadata
        protocol_name = finding.get("protocol_name", "") or ""
        audit_firm = finding.get("firm_name", "") or ""

        # Get URL
        source_link = finding.get("source_link", "")
        url = source_link if source_link else f"https://solodit.cyfrin.io/issues/{slug}" if slug else ""

        # Get date
        report_date = finding.get("report_date", "") or ""
        date = report_date[:10] if report_date else ""

        # Detect category from title + description + tags
        combined_text = f"{title} {description} {' '.join(tags)}"
        category = detect_category(combined_text)
        protocol_type = detect_protocol_type(combined_text)

        return Vulnerability(
            id=generate_id(title, finding_id or slug),
            source=Source.SOLODIT.value,
            source_id=finding_id or slug,
            category=category,
            severity=severity,
            protocol_type=protocol_type,
            title=title,
            description=description[:5000],
            impact=sections.get("impact", "") or impact,
            root_cause=sections.get("root_cause", ""),
            attack_vector=sections.get("attack_vector", ""),
            vulnerable_code=sections.get("vulnerable_code", ""),
            recommendation=sections.get("recommendation", ""),
            has_poc=bool(sections.get("attack_vector", "")),
            protocol_name=protocol_name,
            audit_firm=audit_firm,
            date=date,
            url=url,
            tags=tags[:10],
            related_nodes=[f"auditor:{f}" for f in finders[:5]],
        )

    except Exception as e:
        console.print(f"[red]Error parsing finding: {e}[/red]")
        return None


async def fetch_findings_by_filter(
    client: httpx.AsyncClient,
    api_key: str,
    filters: Dict[str, Any],
    max_pages: int = 5,
    page_size: int = 100
) -> List[Vulnerability]:
    """Fetch findings with given filters."""
    vulnerabilities = []
    
    for page in range(1, max_pages + 1):
        request_body = {
            "page": page,
            "pageSize": page_size,
            "filters": filters,
        }
        
        data = await fetch_api(client, api_key, request_body)
        
        if not data:
            break
        
        findings = data.get("findings", [])
        
        if not findings:
            break
        
        for finding in findings:
            vuln = parse_finding(finding)
            if vuln:
                vulnerabilities.append(vuln)
        
        # Check pagination
        metadata = data.get("metadata", {})
        total_pages = metadata.get("totalPages", 1)
        current_page = metadata.get("currentPage", page)
        
        if current_page >= total_pages:
            break
    
    return vulnerabilities


async def fetch_all_findings(
    api_key: str,
    max_pages_per_query: int = 5,
    page_size: int = 100,
) -> List[Vulnerability]:
    """
    Fetch findings from Solodit API using multiple filter strategies.
    
    Args:
        api_key: Solodit API key
        max_pages_per_query: Max pages to fetch per query
        page_size: Results per page (max 100)
        
    Returns:
        List of Vulnerability objects
    """
    all_vulnerabilities = []
    seen_ids = set()
    
    console.print(f"[bold blue]Fetching from Solodit API...[/bold blue]")
    
    async with httpx.AsyncClient() as client:
        
        with Progress() as progress:
            
            # Fetch by impact level
            impact_task = progress.add_task("[cyan]Fetching by impact...", total=len(IMPACT_LEVELS))
            
            for impact in IMPACT_LEVELS:
                progress.update(impact_task, description=f"[cyan]Impact: {impact}")
                
                filters = {
                    "impact": [impact],
                    "sortField": "Recency",
                    "sortDirection": "Desc",
                }
                
                vulns = await fetch_findings_by_filter(
                    client, api_key, filters,
                    max_pages=max_pages_per_query,
                    page_size=page_size
                )
                
                new_count = 0
                for v in vulns:
                    if v.id not in seen_ids:
                        seen_ids.add(v.id)
                        all_vulnerabilities.append(v)
                        new_count += 1
                
                progress.advance(impact_task)
                console.print(f"  [green]✓ {impact}: {new_count} new findings[/green]")
            
            # Fetch by tags
            tags_task = progress.add_task("[cyan]Fetching by tags...", total=len(VULN_TAGS))
            
            for tag in VULN_TAGS:
                progress.update(tags_task, description=f"[cyan]Tag: {tag}")
                
                filters = {
                    "tags": [{"value": tag}],
                    "sortField": "Quality",
                    "sortDirection": "Desc",
                }
                
                vulns = await fetch_findings_by_filter(
                    client, api_key, filters,
                    max_pages=max_pages_per_query,
                    page_size=page_size
                )
                
                new_count = 0
                for v in vulns:
                    if v.id not in seen_ids:
                        seen_ids.add(v.id)
                        all_vulnerabilities.append(v)
                        new_count += 1
                
                progress.advance(tags_task)
                if new_count > 0:
                    console.print(f"  [green]✓ {tag}: {new_count} new findings[/green]")
    
    # Cache results - use to_dict() to preserve full content (description, root_cause, etc.)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"solodit_api_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(cache_file, 'w') as f:
        json.dump([v.to_dict() for v in all_vulnerabilities], f, indent=2)
    console.print(f"[dim]Cached to {cache_file}[/dim]")
    
    console.print(f"[bold green]Fetched {len(all_vulnerabilities)} unique findings![/bold green]")
    return all_vulnerabilities


def index_solodit(
    max_pages_per_query: int = 5,
    incremental: bool = False
) -> int:
    """
    Fetch and index Solodit findings into the unified database.
    
    Requires SOLODIT_API_KEY environment variable.
    
    Args:
        max_pages_per_query: Maximum pages to fetch per query (default 5)
        incremental: If True, skip existing entries
        
    Returns:
        Number of vulnerabilities indexed
    """
    api_key = get_api_key()
    
    if not api_key:
        console.print("[red]SOLODIT_API_KEY not set![/red]")
        console.print("[yellow]Get your free API key from https://solodit.cyfrin.io[/yellow]")
        console.print("[yellow]Then set it: $env:SOLODIT_API_KEY = 'your_key_here'[/yellow]")
        return 0
    
    db = get_db()
    
    if not incremental:
        # Clear existing Solodit entries
        deleted = db.delete_by_source(Source.SOLODIT.value)
        if deleted:
            console.print(f"[yellow]Cleared {deleted} existing Solodit entries[/yellow]")
    
    # Fetch from API
    vulnerabilities = asyncio.run(fetch_all_findings(
        api_key=api_key,
        max_pages_per_query=max_pages_per_query
    ))
    
    if not vulnerabilities:
        console.print("[yellow]No findings fetched. Check your API key.[/yellow]")
        return 0
    
    # Index
    console.print(f"[cyan]Adding {len(vulnerabilities)} to database...[/cyan]")
    added = db.add_vulnerabilities(vulnerabilities)
    
    console.print(f"[bold green]Indexed {added} Solodit findings![/bold green]")
    return added


if __name__ == "__main__":
    index_solodit(max_pages_per_query=5)
