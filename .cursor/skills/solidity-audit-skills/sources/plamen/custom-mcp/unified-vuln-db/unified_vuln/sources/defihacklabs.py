"""
DeFiHackLabs Indexer

Parses exploit PoC files from the DeFiHackLabs repository.
"""

import re
from pathlib import Path
from typing import List, Optional
from rich.console import Console
from rich.progress import Progress

from ..schema import (
    Vulnerability, Source, detect_category, detect_protocol_type, 
    normalize_severity, Severity
)
from ..database import get_db

console = Console()

# Default paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
DEFIHACKLABS_DIR = DATA_DIR / "DeFiHackLabs"


def parse_exploit_file(filepath: Path) -> Optional[Vulnerability]:
    """Parse a Solidity exploit file and extract metadata."""
    try:
        content = filepath.read_text(encoding='utf-8', errors='ignore')
        
        # Extract from filename (e.g., "Sentiment_exp.sol" -> "Sentiment")
        protocol = filepath.stem.replace('_exp', '').replace('_', ' ')
        
        # Initialize fields
        date = ""
        amount = ""
        attack_vector = ""
        tx_hash = ""
        analysis_url = ""
        description = ""
        
        # Look for header comment block
        header_match = re.search(r'/\*[\s\S]*?\*/', content)
        if header_match:
            header = header_match.group()
            
            # Extract protocol name if specified
            protocol_match = re.search(r'(?:Exploit|Attack|Hack|Name):\s*([^\n\-\*]+)', header, re.IGNORECASE)
            if protocol_match:
                protocol = protocol_match.group(1).strip()
            
            # Extract date
            date_match = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2}|\w+\s+\d{1,2},?\s+\d{4})', header)
            if date_match:
                date = date_match.group(1)
            
            # Extract amount lost
            amount_match = re.search(r'\~?\$[\d,]+(?:\.\d+)?[MKB]?|\d+(?:,\d+)*\s*(?:ETH|BTC|USD|USDC|USDT)', header, re.IGNORECASE)
            if amount_match:
                amount = amount_match.group()
            
            # Extract attack vector / root cause
            vector_match = re.search(
                r'(?:Attack Vector|Vulnerability|Root Cause|Exploit|Bug):\s*([^\n\*]+)', 
                header, re.IGNORECASE
            )
            if vector_match:
                attack_vector = vector_match.group(1).strip()
            
            # Extract TX hash
            tx_match = re.search(r'(?:TX|Transaction|tx):\s*(0x[a-fA-F0-9]{64})', header, re.IGNORECASE)
            if tx_match:
                tx_hash = tx_match.group(1)
            
            # Extract analysis URL
            url_match = re.search(r'(https?://[^\s\n\*]+)', header)
            if url_match:
                analysis_url = url_match.group(1).rstrip(')')
            
            # Extract description from header
            desc_lines = []
            for line in header.split('\n'):
                line = line.strip().strip('*').strip()
                if line and not any(x in line.lower() for x in ['exploit:', 'attack:', 'tx:', 'http', 'pragma', 'spdx']):
                    if len(line) > 20:  # Skip short lines
                        desc_lines.append(line)
            description = ' '.join(desc_lines[:5])  # First 5 meaningful lines
        
        # Extract key code elements for better embedding
        functions = re.findall(r'function\s+(\w+)', content)
        interfaces = re.findall(r'interface\s+(\w+)', content)
        external_calls = re.findall(r'(\w+)\.(\w+)\(', content)
        
        # Build rich description
        description_parts = [description] if description else []
        if attack_vector:
            description_parts.append(f"Attack: {attack_vector}")
        if functions:
            description_parts.append(f"Functions: {', '.join(set(functions[:10]))}")
        if external_calls:
            unique_calls = list(set([f"{c[0]}.{c[1]}" for c in external_calls[:15]]))
            description_parts.append(f"Calls: {', '.join(unique_calls)}")
        
        full_description = '\n'.join(description_parts)
        
        # Detect category and protocol type
        combined_text = f"{protocol} {attack_vector} {description} {content[:3000]}"
        category = detect_category(combined_text)
        protocol_type = detect_protocol_type(combined_text)
        
        # Create vulnerability
        vuln_id = f"defihacklabs-{filepath.stem}"
        
        return Vulnerability(
            id=vuln_id,
            source=Source.DEFIHACKLABS.value,
            category=category,
            severity=Severity.HIGH.value,  # Real exploits are high severity by definition
            protocol_type=protocol_type,
            title=f"{protocol} Exploit",
            description=full_description,
            impact=f"Loss: {amount}" if amount else "Funds stolen",
            root_cause=attack_vector,
            attack_vector=attack_vector,
            vulnerable_code=content[:3000],  # First 3000 chars
            has_poc=True,
            poc_code=content,
            poc_path=str(filepath),
            protocol_name=protocol,
            date=date,
            url=analysis_url or f"https://github.com/SunWeb3Sec/DeFiHackLabs/blob/main/{filepath.relative_to(DEFIHACKLABS_DIR)}",
            amount_lost=amount,
            tx_hash=tx_hash,
            tags=[category, protocol_type, "real-exploit", "poc"],
        )
        
    except Exception as e:
        console.print(f"[red]Error parsing {filepath}: {e}[/red]")
        return None


def index_defihacklabs(
    repo_path: Optional[Path] = None,
    incremental: bool = False
) -> int:
    """
    Index DeFiHackLabs exploits into the unified database.
    
    Args:
        repo_path: Path to DeFiHackLabs repo (will clone if not exists)
        incremental: If True, skip existing entries
        
    Returns:
        Number of vulnerabilities indexed
    """
    repo_path = repo_path or DEFIHACKLABS_DIR
    db = get_db()
    
    console.print("[bold blue]Indexing DeFiHackLabs exploits...[/bold blue]")
    
    # Check if repo exists
    if not repo_path.exists():
        console.print(f"[yellow]DeFiHackLabs not found at {repo_path}[/yellow]")
        console.print("[yellow]Cloning repository...[/yellow]")
        
        import subprocess
        repo_path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([
            "git", "clone", "--depth", "1",
            "https://github.com/SunWeb3Sec/DeFiHackLabs.git",
            str(repo_path)
        ], check=True)
    
    # Find all Solidity exploit files
    poc_dirs = [
        repo_path / "src" / "test",
        repo_path / "test",
    ]
    
    sol_files = []
    for poc_dir in poc_dirs:
        if poc_dir.exists():
            sol_files.extend(poc_dir.glob("**/*.sol"))
    
    # Filter to likely exploit files
    exploit_files = [
        f for f in sol_files 
        if any(x in f.name.lower() for x in ['exp', 'exploit', 'attack', 'hack', 'poc'])
        or any(x in f.stem for x in ['_', '-'])  # Named like Protocol_exp.sol
    ]
    
    console.print(f"Found {len(exploit_files)} exploit files")
    
    if not incremental:
        # Clear existing DeFiHackLabs entries
        deleted = db.delete_by_source(Source.DEFIHACKLABS.value)
        if deleted:
            console.print(f"[yellow]Cleared {deleted} existing entries[/yellow]")
    
    # Parse and index
    vulns = []
    with Progress() as progress:
        task = progress.add_task("[cyan]Parsing exploits...", total=len(exploit_files))
        
        for filepath in exploit_files:
            vuln = parse_exploit_file(filepath)
            if vuln:
                vulns.append(vuln)
            progress.advance(task)
    
    # Add to database
    console.print(f"[cyan]Adding {len(vulns)} vulnerabilities to database...[/cyan]")
    added = db.add_vulnerabilities(vulns)
    
    console.print(f"[bold green]Indexed {added} DeFiHackLabs exploits![/bold green]")
    return added


if __name__ == "__main__":
    index_defihacklabs()
