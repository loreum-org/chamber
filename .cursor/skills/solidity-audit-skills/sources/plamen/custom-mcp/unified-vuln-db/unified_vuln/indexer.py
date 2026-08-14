"""
Unified Vulnerability Indexer CLI

Index vulnerabilities from all sources into the unified database.
"""

import click
from rich.console import Console
from rich.table import Table

from .database import get_db
from .sources import index_defihacklabs, index_solodit, index_immunefi, index_immunefi_competitions

console = Console()


@click.group()
def cli():
    """Unified Vulnerability Database Indexer"""
    pass


@cli.command()
@click.option('--source', '-s', type=click.Choice(['all', 'defihacklabs', 'solodit', 'immunefi', 'immunefi-competitions']),
              default='all', help='Data source to index')
@click.option('--incremental', '-i', is_flag=True, help='Skip existing entries')
@click.option('--max-pages', default=5, help='Max pages for Solodit scraping')
@click.option('--max-entries', default=None, type=int, help='Max entries for Immunefi indexing (None = all)')
@click.option('--skip-fetch', is_flag=True, default=False,
              help='Reuse cached HTTP responses instead of re-fetching URLs. '
                   'Use on retry after a timeout to skip the fetch phase and go straight to embedding.')
@click.option('--competitions', default=None, type=str,
              help='Immunefi competitions: comma-separated list of competition directory names to index '
                   '(e.g. "Vaultka,Gains"). Only used with --source immunefi-competitions.')
@click.option('--max-findings', default=None, type=int,
              help='Immunefi competitions: max findings per competition (None = all).')
@click.option('--local-repo', default=None, type=str,
              help='Immunefi competitions: path to local git clone of Past-Audit-Competitions. '
                   'Avoids all GitHub API calls. Clone with: '
                   'git clone https://github.com/immunefi-team/Past-Audit-Competitions.git')
def index(source: str, incremental: bool, max_pages: int, max_entries: int,
          skip_fetch: bool, competitions: str, max_findings: int, local_repo: str):
    """Index vulnerabilities from data sources."""
    console.print("[bold]Unified Vulnerability Database Indexer[/bold]\n")

    total = 0

    if source in ['all', 'defihacklabs']:
        console.print("\n[bold cyan]═══ DeFiHackLabs ═══[/bold cyan]")
        count = index_defihacklabs(incremental=incremental)
        total += count

    if source in ['all', 'solodit']:
        console.print("\n[bold cyan]═══ Solodit ═══[/bold cyan]")
        count = index_solodit(max_pages_per_query=max_pages, incremental=incremental)
        total += count

    if source in ['all', 'immunefi']:
        console.print("\n[bold cyan]═══ Immunefi Bug Bounty Writeups ═══[/bold cyan]")
        count = index_immunefi(max_entries=max_entries, incremental=incremental, skip_fetch=skip_fetch)
        total += count

    if source in ['all', 'immunefi-competitions']:
        console.print("\n[bold cyan]═══ Immunefi Audit Competitions ═══[/bold cyan]")
        comp_list = [c.strip() for c in competitions.split(",")] if competitions else None
        count = index_immunefi_competitions(
            competitions=comp_list,
            max_findings_per_competition=max_findings,
            incremental=incremental,
            skip_fetch=skip_fetch,
            local_repo_path=local_repo,
        )
        total += count

    console.print(f"\n[bold green]Total indexed: {total} vulnerabilities[/bold green]")

    # Show stats
    _show_stats(standalone_header=False)


def _show_stats(standalone_header: bool = True):
    """Internal function to display statistics."""
    db = get_db()
    statistics = db.get_statistics()
    
    if standalone_header:
        console.print("[bold]Unified Vulnerability Database Statistics[/bold]\n")
    else:
        console.print("\n[bold]Database Statistics[/bold]")
    
    console.print(f"Total vulnerabilities: [bold]{statistics['total']}[/bold]")
    console.print(f"With PoC code: [bold]{statistics['with_poc']}[/bold]")
    
    # By source table
    table = Table(title="By Source")
    table.add_column("Source", style="cyan")
    table.add_column("Count", justify="right")
    for source, count in sorted(statistics['by_source'].items(), key=lambda x: -x[1]):
        table.add_row(source, str(count))
    console.print(table)
    
    # By severity table
    table = Table(title="By Severity")
    table.add_column("Severity", style="yellow")
    table.add_column("Count", justify="right")
    severity_order = ['critical', 'high', 'medium', 'low', 'info', 'unknown']
    for sev in severity_order:
        if sev in statistics['by_severity']:
            table.add_row(sev, str(statistics['by_severity'][sev]))
    console.print(table)
    
    # Top categories
    table = Table(title="Top Categories")
    table.add_column("Category", style="green")
    table.add_column("Count", justify="right")
    for cat, count in sorted(statistics['by_category'].items(), key=lambda x: -x[1])[:10]:
        table.add_row(cat, str(count))
    console.print(table)


@cli.command()
def stats():
    """Show database statistics."""
    _show_stats(standalone_header=True)


@cli.command()
@click.argument('query')
@click.option('--limit', '-n', default=5, help='Number of results')
@click.option('--source', '-s', multiple=True, help='Filter by source')
@click.option('--category', '-c', multiple=True, help='Filter by category')
@click.option('--severity', multiple=True, help='Filter by severity')
def search(query: str, limit: int, source: tuple, category: tuple, severity: tuple):
    """Search the vulnerability database."""
    db = get_db()
    
    # Build filters dict
    filters = {}
    if source:
        filters["sources"] = list(source)
    if category:
        filters["categories"] = list(category)
    if severity:
        filters["severities"] = list(severity)
    
    results = db.search(
        query=query,
        n_results=limit,
        filters=filters if filters else None,
    )
    
    console.print(f"\n[bold]Search results for: [cyan]{query}[/cyan][/bold]\n")
    
    for i, result in enumerate(results, 1):
        # Results are now flat dicts with metadata merged in
        console.print(f"[bold]{i}. {result.get('title', 'Untitled')}[/bold]")
        console.print(f"   Source: [cyan]{result.get('source')}[/cyan] | "
                     f"Severity: [yellow]{result.get('severity')}[/yellow] | "
                     f"Category: [green]{result.get('category')}[/green]")
        console.print(f"   Protocol: {result.get('protocol_name', 'Unknown')}")
        if result.get('url'):
            console.print(f"   URL: {result.get('url')}")
        console.print(f"   Score: {result.get('score', 0):.4f}")
        console.print()


@cli.command()
@click.confirmation_option(prompt='Are you sure you want to clear the database?')
def clear():
    """Clear the entire database."""
    db = get_db()
    db.clear()
    console.print("[bold red]Database cleared![/bold red]")


@cli.command()
def rebuild():
    """Rebuild the entire database from scratch."""
    console.print("[bold yellow]Rebuilding database...[/bold yellow]")

    db = get_db()
    db.clear()

    # Reindex all
    ctx = click.Context(index)
    ctx.invoke(index, source='all', incremental=False, max_pages=5)


@cli.command()
def recategorize():
    """Re-categorize all entries using updated CATEGORY_KEYWORDS."""
    from .schema import detect_category, detect_protocol_type

    console.print("[bold yellow]Re-categorizing all entries...[/bold yellow]")

    db = get_db()

    # Get all entries
    all_data = db.collection.get(include=["documents", "metadatas"])

    if not all_data["ids"]:
        console.print("[red]No entries in database![/red]")
        return

    total = len(all_data["ids"])
    console.print(f"[cyan]Processing {total} entries...[/cyan]")

    # Track category changes
    old_categories = {}
    new_categories = {}
    changes = 0

    from rich.progress import Progress

    with Progress(console=console) as progress:
        task = progress.add_task("[cyan]Re-categorizing...", total=total)

        for i, (doc_id, doc, meta) in enumerate(zip(
            all_data["ids"],
            all_data["documents"],
            all_data["metadatas"]
        )):
            old_cat = meta.get("category", "other")
            old_categories[old_cat] = old_categories.get(old_cat, 0) + 1

            # Re-detect category from the document text
            # Document contains title, description, root cause, etc.
            new_cat = detect_category(doc)
            new_categories[new_cat] = new_categories.get(new_cat, 0) + 1

            if old_cat != new_cat:
                changes += 1
                # Update the metadata
                meta["category"] = new_cat
                try:
                    db.collection.update(
                        ids=[doc_id],
                        metadatas=[meta]
                    )
                except Exception as e:
                    console.print(f"[red]Error updating {doc_id}: {e}[/red]")

            progress.advance(task)

    console.print(f"\n[bold green]Re-categorization complete![/bold green]")
    console.print(f"Total entries: {total}")
    console.print(f"Categories changed: {changes}")

    # Show category comparison
    console.print("\n[bold]Category Distribution (Before → After):[/bold]")

    all_cats = set(old_categories.keys()) | set(new_categories.keys())
    for cat in sorted(all_cats, key=lambda x: -new_categories.get(x, 0)):
        old_count = old_categories.get(cat, 0)
        new_count = new_categories.get(cat, 0)
        diff = new_count - old_count
        diff_str = f"+{diff}" if diff > 0 else str(diff)
        color = "green" if diff > 0 else "red" if diff < 0 else "white"
        console.print(f"  {cat}: {old_count} → {new_count} ([{color}]{diff_str}[/{color}])")

    # Show "other" specifically
    other_count = new_categories.get("other", 0)
    console.print(f"\n[bold]'other' category: {other_count} ({other_count*100/total:.1f}%)[/bold]")


if __name__ == "__main__":
    cli()
