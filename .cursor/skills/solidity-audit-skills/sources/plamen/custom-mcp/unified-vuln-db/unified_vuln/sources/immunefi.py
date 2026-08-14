"""
Immunefi Bug Bounty Writeups Indexer

Parses the curated list from:
https://github.com/sayan011/Immunefi-bug-bounty-writeups-list

Fetches and extracts content from writeup articles (Medium, Mirror, GitHub, blogs).
"""

import asyncio
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse
import httpx
from rich.console import Console
from rich.progress import Progress, TaskID

from ..schema import (
    Vulnerability, Source, Severity, detect_category, detect_protocol_type,
    normalize_severity
)
from ..database import get_db

console = Console()

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
CACHE_DIR = DATA_DIR / "immunefi_cache"

# GitHub raw URL for the README
README_URL = "https://raw.githubusercontent.com/sayan011/Immunefi-bug-bounty-writeups-list/main/README.md"

# Rate limiting
REQUEST_DELAY = 1.0  # Seconds between requests
MAX_CONCURRENT = 5   # Max concurrent fetches

# User agent and headers for web requests
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

BROWSER_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    # Note: Don't set Accept-Encoding - httpx handles compression automatically
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


def parse_bounty_amount(amount_str: str) -> Tuple[str, float]:
    """Parse bounty amount string to normalized value."""
    if not amount_str or amount_str == "-" or "Not Paid" in amount_str:
        return amount_str, 0.0
    
    # Clean the string
    clean = amount_str.strip().replace(",", "").replace("~", "")
    
    # Extract numeric value
    value = 0.0
    
    # Handle different formats: "$10M", "50K", "400 ETH", "$1M+50k"
    patterns = [
        (r'\$?([\d.]+)M', 1_000_000),
        (r'\$?([\d.]+)K', 1_000),
        (r'\$?([\d.]+)\s*ETH', 2000),  # Rough ETH to USD
        (r'\$?([\d.]+)', 1),
    ]
    
    for pattern, multiplier in patterns:
        match = re.search(pattern, clean, re.IGNORECASE)
        if match:
            try:
                value = float(match.group(1)) * multiplier
                break
            except ValueError:
                pass
    
    return amount_str, value


def parse_readme_table(content: str) -> List[Dict[str, str]]:
    """Parse the markdown table from README."""
    entries = []
    
    # Find the main table (skip header rows)
    lines = content.split('\n')
    in_table = False
    
    for line in lines:
        line = line.strip()
        
        # Skip empty lines and header separators
        if not line or line.startswith('|--') or line.startswith('| --'):
            continue
        
        # Detect table start
        if '| bounty amount' in line.lower() or '| **severity**' in line.lower():
            in_table = True
            continue
        
        if not in_table:
            continue
        
        # Parse table row
        if line.startswith('|') and 'Critical' in line or 'High' in line or 'Medium' in line or 'Low' in line or '-' in line:
            # Split by pipe, clean up
            parts = [p.strip() for p in line.split('|')]
            parts = [p for p in parts if p]  # Remove empty parts
            
            if len(parts) >= 4:
                bounty_raw = parts[0]
                severity_raw = parts[1].replace('**', '').strip()
                
                # Parse protocol + link: [Protocol](url) or just text
                protocol_link = parts[2]
                protocol_name = ""
                writeup_url = ""
                
                link_match = re.search(r'\[([^\]]+)\]\(([^)]+)\)', protocol_link)
                if link_match:
                    protocol_name = link_match.group(1).strip()
                    writeup_url = link_match.group(2).strip()
                else:
                    protocol_name = protocol_link.strip()
                
                # Parse researcher
                researcher = ""
                if len(parts) >= 4:
                    researcher_part = parts[3]
                    # Extract from [name](url) format
                    res_match = re.search(r'\[([^\]]+)\]', researcher_part)
                    if res_match:
                        researcher = res_match.group(1).strip()
                    else:
                        researcher = researcher_part.strip()
                
                # Skip if no writeup URL
                if writeup_url and 'http' in writeup_url:
                    entries.append({
                        "bounty_raw": bounty_raw,
                        "severity": severity_raw,
                        "protocol": protocol_name,
                        "writeup_url": writeup_url,
                        "researcher": researcher,
                    })
    
    return entries


async def fetch_url(client: httpx.AsyncClient, url: str, timeout: float = 30.0) -> Optional[str]:
    """Fetch URL content with error handling."""
    try:
        # Use domain-specific headers
        headers = BROWSER_HEADERS.copy()
        
        # Add referer for Medium
        if 'medium.com' in url:
            headers["Referer"] = "https://medium.com/"
        elif 'mirror.xyz' in url:
            headers["Referer"] = "https://mirror.xyz/"
        
        response = await client.get(
            url,
            headers=headers,
            timeout=timeout,
            follow_redirects=True
        )
        
        if response.status_code == 200:
            return response.text
        else:
            console.print(f"[dim]HTTP {response.status_code}: {url[:60]}...[/dim]")
            return None
            
    except httpx.TimeoutException:
        console.print(f"[dim]Timeout: {url[:60]}...[/dim]")
        return None
    except Exception as e:
        console.print(f"[dim]Error fetching {url[:60]}...: {type(e).__name__}[/dim]")
        return None


def extract_medium_content(html: str) -> Dict[str, str]:
    """Extract content from Medium article HTML."""
    result = {"title": "", "content": "", "code_blocks": []}
    
    # Title extraction
    title_patterns = [
        r'<h1[^>]*>([^<]+)</h1>',
        r'"headline"\s*:\s*"([^"]+)"',
        r'<meta[^>]*property="og:title"[^>]*content="([^"]+)"',
    ]
    for pattern in title_patterns:
        match = re.search(pattern, html)
        if match:
            result["title"] = match.group(1).strip()
            break
    
    # Content extraction - look for article body
    # Remove scripts and styles first
    clean_html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    clean_html = re.sub(r'<style[^>]*>.*?</style>', '', clean_html, flags=re.DOTALL)
    
    # Extract paragraphs
    paragraphs = re.findall(r'<p[^>]*>([^<]+(?:<[^/p][^>]*>[^<]*</[^>]+>)*[^<]*)</p>', clean_html)
    
    # Extract code blocks
    code_blocks = re.findall(r'<pre[^>]*><code[^>]*>(.*?)</code></pre>', clean_html, re.DOTALL)
    code_blocks.extend(re.findall(r'<pre[^>]*>(.*?)</pre>', clean_html, re.DOTALL))
    
    # Clean HTML tags from content
    def clean_tags(text):
        text = re.sub(r'<[^>]+>', '', text)
        text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
        text = text.replace('&lt;', '<').replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        return text.strip()
    
    content_parts = [clean_tags(p) for p in paragraphs if len(clean_tags(p)) > 30]
    result["content"] = '\n\n'.join(content_parts[:50])  # First 50 paragraphs
    result["code_blocks"] = [clean_tags(c) for c in code_blocks]
    
    return result


def extract_mirror_content(html: str) -> Dict[str, str]:
    """Extract content from Mirror.xyz article HTML."""
    result = {"title": "", "content": "", "code_blocks": []}
    
    # Mirror uses JSON embedded in the page
    json_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', html)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            props = data.get("props", {}).get("pageProps", {})
            
            # Extract from different possible structures
            entry = props.get("entry", {}) or props.get("post", {})
            if entry:
                result["title"] = entry.get("title", "")
                body = entry.get("body", "") or entry.get("content", "")
                # Body is often markdown
                result["content"] = body[:10000]
                
                # Extract code blocks from markdown
                code_blocks = re.findall(r'```(?:\w+)?\n(.*?)```', body, re.DOTALL)
                result["code_blocks"] = code_blocks
        except json.JSONDecodeError:
            pass
    
    # Fallback to HTML parsing
    if not result["title"]:
        title_match = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
        if title_match:
            result["title"] = title_match.group(1).strip()
    
    return result


def extract_github_content(html: str, url: str) -> Dict[str, str]:
    """Extract content from GitHub gist or markdown file."""
    result = {"title": "", "content": "", "code_blocks": []}
    
    # For raw markdown files
    if 'raw.githubusercontent.com' in url or url.endswith('.md'):
        result["content"] = html[:15000]
        # Title from first heading
        title_match = re.search(r'^#\s+(.+)$', html, re.MULTILINE)
        if title_match:
            result["title"] = title_match.group(1).strip()
        
        # Extract code blocks
        code_blocks = re.findall(r'```(?:\w+)?\n(.*?)```', html, re.DOTALL)
        result["code_blocks"] = code_blocks
    else:
        # GitHub rendered page
        # Extract from article/readme content
        content_match = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
        if content_match:
            article = content_match.group(1)
            # Clean and extract text
            clean = re.sub(r'<[^>]+>', ' ', article)
            result["content"] = clean[:10000]
    
    return result


def extract_generic_content(html: str) -> Dict[str, str]:
    """Generic content extraction for blogs and other sites."""
    result = {"title": "", "content": "", "code_blocks": []}
    
    # Title
    for pattern in [
        r'<title>([^<]+)</title>',
        r'<h1[^>]*>([^<]+)</h1>',
        r'<meta[^>]*property="og:title"[^>]*content="([^"]+)"',
    ]:
        match = re.search(pattern, html)
        if match:
            result["title"] = match.group(1).strip()
            break
    
    # Remove scripts, styles, nav, footer
    clean_html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    clean_html = re.sub(r'<style[^>]*>.*?</style>', '', clean_html, flags=re.DOTALL)
    clean_html = re.sub(r'<nav[^>]*>.*?</nav>', '', clean_html, flags=re.DOTALL)
    clean_html = re.sub(r'<footer[^>]*>.*?</footer>', '', clean_html, flags=re.DOTALL)
    clean_html = re.sub(r'<header[^>]*>.*?</header>', '', clean_html, flags=re.DOTALL)
    
    # Extract article/main content
    for tag in ['article', 'main', 'div class="post"', 'div class="content"']:
        pattern = f'<{tag}[^>]*>(.*?)</{tag.split()[0]}>'
        match = re.search(pattern, clean_html, re.DOTALL)
        if match:
            clean_html = match.group(1)
            break
    
    # Extract paragraphs
    paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', clean_html, re.DOTALL)
    
    def clean_tags(text):
        text = re.sub(r'<[^>]+>', '', text)
        text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
        return text.strip()
    
    content_parts = [clean_tags(p) for p in paragraphs if len(clean_tags(p)) > 20]
    result["content"] = '\n\n'.join(content_parts[:40])
    
    # Code blocks
    code_blocks = re.findall(r'<pre[^>]*>(?:<code[^>]*>)?(.*?)(?:</code>)?</pre>', clean_html, re.DOTALL)
    result["code_blocks"] = [clean_tags(c) for c in code_blocks]
    
    return result


# Domains that are known to block scraping or can't be parsed
SKIP_DOMAINS = [
    'twitter.com',
    'x.com',
]

# Domains that require special handling (may need browser)
BLOCKED_DOMAINS = [
    'medium.com',
    'mirror.xyz',
]


def should_skip_url(url: str) -> bool:
    """Check if URL should be skipped entirely."""
    domain = urlparse(url).netloc.lower()
    return any(d in domain for d in SKIP_DOMAINS)


def is_blocked_domain(url: str) -> bool:
    """Check if domain is known to block scraping."""
    domain = urlparse(url).netloc.lower()
    return any(d in domain for d in BLOCKED_DOMAINS)


def extract_content(html: str, url: str) -> Dict[str, str]:
    """Route to appropriate content extractor based on URL."""
    domain = urlparse(url).netloc.lower()
    
    if 'medium.com' in domain:
        return extract_medium_content(html)
    elif 'mirror.xyz' in domain:
        return extract_mirror_content(html)
    elif 'github.com' in domain or 'githubusercontent.com' in domain:
        return extract_github_content(html, url)
    elif 'twitter.com' in domain or 'x.com' in domain:
        # Skip Twitter - can't extract meaningful content
        return {"title": "", "content": "", "code_blocks": []}
    else:
        return extract_generic_content(html)


def generate_id(protocol: str, researcher: str, url: str) -> str:
    """Generate unique ID for a bounty writeup."""
    combined = f"{protocol}-{researcher}-{url}"
    hash_str = hashlib.md5(combined.encode()).hexdigest()[:8]
    slug = re.sub(r'[^a-zA-Z0-9]', '-', protocol.lower())[:30]
    return f"immunefi-{slug}-{hash_str}"


def create_vulnerability(
    entry: Dict[str, str],
    extracted: Dict[str, str]
) -> Optional[Vulnerability]:
    """Create Vulnerability object from parsed data."""
    try:
        protocol = entry.get("protocol", "Unknown")
        writeup_url = entry.get("writeup_url", "")
        researcher = entry.get("researcher", "")
        severity_raw = entry.get("severity", "")
        bounty_raw = entry.get("bounty_raw", "")
        
        # Parse bounty amount
        amount_str, amount_value = parse_bounty_amount(bounty_raw)
        
        # Normalize severity
        severity = normalize_severity(severity_raw)
        
        # Get extracted content
        title = extracted.get("title", "") or f"{protocol} Bug Bounty Writeup"
        content = extracted.get("content", "")
        code_blocks = extracted.get("code_blocks", [])
        
        # Skip if no meaningful content
        if not content and not code_blocks:
            return None
        
        # Build description
        description_parts = []
        if content:
            description_parts.append(content[:5000])
        
        description = '\n'.join(description_parts)
        
        # Detect category from content
        combined_text = f"{title} {description} {protocol}"
        category = detect_category(combined_text)
        protocol_type = detect_protocol_type(combined_text)
        
        # Extract root cause / attack vector from content
        root_cause = ""
        attack_vector = ""
        
        # Common patterns in writeups
        root_cause_patterns = [
            r'(?:root cause|vulnerability|bug)[:\s]+([^.]+\.)',
            r'(?:the issue|the problem)[:\s]+([^.]+\.)',
        ]
        for pattern in root_cause_patterns:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                root_cause = match.group(1).strip()
                break
        
        attack_vector_patterns = [
            r'(?:attack vector|exploit)[:\s]+([^.]+\.)',
            r'(?:the attacker|an attacker)[:\s]+([^.]+\.)',
        ]
        for pattern in attack_vector_patterns:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                attack_vector = match.group(1).strip()
                break
        
        # Get code if available
        vulnerable_code = ""
        poc_code = ""
        if code_blocks:
            # First code block often is the vulnerable code or PoC
            for block in code_blocks:
                if len(block) > 50:
                    if not vulnerable_code:
                        vulnerable_code = block[:3000]
                    elif not poc_code:
                        poc_code = block[:5000]
                        break
        
        # Create vulnerability
        vuln = Vulnerability(
            id=generate_id(protocol, researcher, writeup_url),
            source=Source.IMMUNEFI.value,
            source_id=writeup_url,
            category=category,
            severity=severity,
            protocol_type=protocol_type,
            title=title[:200],
            description=description[:8000],
            impact=f"Bounty: {amount_str}" if amount_str else "",
            root_cause=root_cause[:500],
            attack_vector=attack_vector[:500],
            vulnerable_code=vulnerable_code,
            has_poc=bool(poc_code or "poc" in description.lower() or "exploit" in description.lower()),
            poc_code=poc_code,
            protocol_name=protocol,
            auditor=researcher,
            url=writeup_url,
            amount_lost=amount_str,
            cvss_score=0.0,
            tags=[
                category,
                protocol_type,
                "bug-bounty",
                "immunefi",
                f"researcher:{researcher}" if researcher else "",
            ],
            related_nodes=[
                f"researcher:{researcher}" if researcher else "",
                f"protocol:{protocol}",
                f"bounty:{int(amount_value)}" if amount_value > 0 else "",
            ],
        )
        
        # Clean up empty tags/nodes
        vuln.tags = [t for t in vuln.tags if t]
        vuln.related_nodes = [n for n in vuln.related_nodes if n]
        
        return vuln
        
    except Exception as e:
        console.print(f"[red]Error creating vulnerability: {e}[/red]")
        return None


async def fetch_writeups(
    entries: List[Dict[str, str]],
    max_concurrent: int = MAX_CONCURRENT,
    skip_blocked: bool = True
) -> List[Tuple[Dict[str, str], Dict[str, str]]]:
    """Fetch all writeup URLs concurrently with rate limiting."""
    results = []
    semaphore = asyncio.Semaphore(max_concurrent)
    skipped_blocked = 0
    skipped_unparseable = 0
    
    async def fetch_one(client: httpx.AsyncClient, entry: Dict[str, str]) -> Tuple[Dict[str, str], Dict[str, str], str]:
        nonlocal skipped_blocked, skipped_unparseable
        
        async with semaphore:
            url = entry.get("writeup_url", "")
            
            if not url:
                return entry, {}, "no_url"
            
            # Skip unparseable domains (Twitter, X)
            if should_skip_url(url):
                skipped_unparseable += 1
                return entry, {}, "skipped"
            
            # Optionally skip blocked domains
            if skip_blocked and is_blocked_domain(url):
                skipped_blocked += 1
                return entry, {}, "blocked"
            
            await asyncio.sleep(REQUEST_DELAY)
            html = await fetch_url(client, url)
            if html:
                extracted = extract_content(html, url)
                return entry, extracted, "success"
            
            return entry, {}, "failed"
    
    async with httpx.AsyncClient() as client:
        tasks = [fetch_one(client, entry) for entry in entries]
        
        with Progress() as progress:
            task_id = progress.add_task("[cyan]Fetching writeups...", total=len(tasks))
            
            for coro in asyncio.as_completed(tasks):
                entry, extracted, status = await coro
                results.append((entry, extracted))
                progress.advance(task_id)
    
    if skipped_blocked > 0:
        console.print(f"[yellow]Skipped {skipped_blocked} blocked domains (Medium, Mirror)[/yellow]")
    if skipped_unparseable > 0:
        console.print(f"[yellow]Skipped {skipped_unparseable} unparseable domains (Twitter, X)[/yellow]")
    
    return results


async def fetch_and_parse_readme() -> List[Dict[str, str]]:
    """Fetch and parse the README table."""
    async with httpx.AsyncClient() as client:
        console.print("[cyan]Fetching README from GitHub...[/cyan]")
        content = await fetch_url(client, README_URL)
        
        if not content:
            console.print("[red]Failed to fetch README[/red]")
            return []
        
        entries = parse_readme_table(content)
        console.print(f"[green]Parsed {len(entries)} entries from README[/green]")
        
        return entries


def index_immunefi(
    max_entries: Optional[int] = None,
    incremental: bool = False,
    skip_fetch: bool = False,
) -> int:
    """
    Fetch and index Immunefi bug bounty writeups.
    
    Args:
        max_entries: Maximum number of entries to process (None = all)
        incremental: If True, skip existing entries
        skip_fetch: If True, only use cached data
        
    Returns:
        Number of vulnerabilities indexed
    """
    db = get_db()
    
    console.print("[bold blue]" + "=" * 60 + "[/bold blue]")
    console.print("[bold blue]  Immunefi Bug Bounty Writeups Indexer[/bold blue]")
    console.print("[bold blue]" + "=" * 60 + "[/bold blue]")
    
    # Create cache directory
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    # Check for cached data
    cache_file = CACHE_DIR / "immunefi_entries.json"
    cached_results_file = CACHE_DIR / "immunefi_fetched.json"
    
    # Step 1: Get entries from README
    if skip_fetch and cache_file.exists():
        console.print("[yellow]Using cached entries...[/yellow]")
        with open(cache_file, 'r') as f:
            entries = json.load(f)
    else:
        entries = asyncio.run(fetch_and_parse_readme())
        
        if not entries:
            console.print("[red]No entries found![/red]")
            return 0
        
        # Cache entries
        with open(cache_file, 'w') as f:
            json.dump(entries, f, indent=2)
    
    # Limit entries if specified
    if max_entries:
        entries = entries[:max_entries]
    
    console.print(f"[cyan]Processing {len(entries)} entries...[/cyan]")
    
    # Step 2: Fetch writeup content
    if skip_fetch and cached_results_file.exists():
        console.print("[yellow]Using cached writeup content...[/yellow]")
        with open(cached_results_file, 'r') as f:
            cached_results = json.load(f)
        results = [(e, cached_results.get(e.get("writeup_url", ""), {})) for e in entries]
    else:
        results = asyncio.run(fetch_writeups(entries))
        
        # Cache results
        cached_results = {r[0].get("writeup_url", ""): r[1] for r in results}
        with open(cached_results_file, 'w') as f:
            json.dump(cached_results, f, indent=2)
    
    # Step 3: Create vulnerability objects
    console.print("[cyan]Creating vulnerability records...[/cyan]")
    
    vulnerabilities = []
    successful = 0
    failed = 0
    
    for entry, extracted in results:
        if extracted and (extracted.get("content") or extracted.get("code_blocks")):
            vuln = create_vulnerability(entry, extracted)
            if vuln:
                vulnerabilities.append(vuln)
                successful += 1
            else:
                failed += 1
        else:
            failed += 1
    
    console.print(f"[green]Successfully parsed: {successful}[/green]")
    console.print(f"[yellow]Failed/skipped: {failed}[/yellow]")
    
    if not vulnerabilities:
        console.print("[yellow]No vulnerabilities to index[/yellow]")
        return 0
    
    # Step 4: Index to database
    if not incremental:
        # Clear existing Immunefi entries
        deleted = db.delete_by_source(Source.IMMUNEFI.value)
        if deleted:
            console.print(f"[yellow]Cleared {deleted} existing Immunefi entries[/yellow]")
    
    console.print(f"[cyan]Adding {len(vulnerabilities)} vulnerabilities to database...[/cyan]")
    added = db.add_vulnerabilities(vulnerabilities)
    
    console.print("[bold green]" + "=" * 60 + "[/bold green]")
    console.print(f"[bold green]  Indexed {added} Immunefi bug bounty writeups![/bold green]")
    console.print("[bold green]" + "=" * 60 + "[/bold green]")
    
    # Stats
    severity_counts = {}
    category_counts = {}
    for v in vulnerabilities:
        severity_counts[v.severity] = severity_counts.get(v.severity, 0) + 1
        category_counts[v.category] = category_counts.get(v.category, 0) + 1
    
    console.print("\n[bold]By Severity:[/bold]")
    for sev, count in sorted(severity_counts.items(), key=lambda x: -x[1]):
        console.print(f"  {sev}: {count}")
    
    console.print("\n[bold]Top Categories:[/bold]")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1])[:10]:
        console.print(f"  {cat}: {count}")
    
    return added


if __name__ == "__main__":
    import sys
    
    # Parse args
    max_entries = None
    if len(sys.argv) > 1:
        try:
            max_entries = int(sys.argv[1])
        except ValueError:
            pass
    
    index_immunefi(max_entries=max_entries)
