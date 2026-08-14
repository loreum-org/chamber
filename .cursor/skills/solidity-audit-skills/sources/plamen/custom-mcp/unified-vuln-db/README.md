# Unified Vulnerability Database

A single ChromaDB-based RAG system that aggregates vulnerabilities from multiple sources.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified Vulnerability DB                  │
│                        (ChromaDB)                            │
├─────────────────────────────────────────────────────────────┤
│  Collection: "vulnerabilities"                               │
│  Embeddings: all-MiniLM-L6-v2 (384-dim, local CPU)          │
│  - Semantic search across ALL sources                        │
│  - Metadata filtering by source/severity/category            │
│  - Local embeddings (no data exfiltration)                   │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Unified Schema
        ┌──────────┬──────────┼──────────┐
        │          │          │          │
   ┌────┴────┐ ┌───┴───┐ ┌───┴───┐ ┌───┴────┐
   │ Solodit │ │DeFiHk │ │Immunefi│ │Immunefi│
   │  (API)  │ │ Labs  │ │Bounty │ │Compete │
   └─────────┘ └───────┘ └───────┘ └────────┘
   (3400+)     (500+PoC)  (curated) (879 comp)
                                    Total: 4k+
```

## Unified Schema

All vulnerabilities are normalized to this schema:

```python
{
    # Identification
    "id": "source-unique-id",
    "source": "solodit|defihacklabs|immunefi",  # immunefi covers both writeups and competitions

    # Classification
    "category": "reentrancy|oracle|flash-loan|access-control|...",
    "severity": "critical|high|medium|low|info",
    "protocol_type": "dex|lending|vault|bridge|staking|governance|nft|token",

    # Content
    "title": "Short descriptive title",
    "description": "Full description of the vulnerability",
    "impact": "What damage can occur",
    "root_cause": "Why the vulnerability exists",
    "attack_vector": "How to exploit",

    # Code
    "vulnerable_code": "Vulnerable code excerpt",
    "has_poc": true|false,
    "poc_code": "Full PoC if available",

    # Metadata
    "protocol_name": "Affected protocol name",
    "audit_firm": "Auditor who found it",
    "date": "YYYY-MM-DD",
    "url": "Source URL",
    "recommendation": "How to fix",

    # Graph edges
    "related_nodes": ["auditor:name", "pattern:type", "protocol:name"],
    "tags": ["tag1", "tag2"],
}
```

## Data Sources

### 1. Solodit (live API)
- 3400+ audit findings indexed via Solodit API (with SOLODIT_API_KEY)
- Categories: reentrancy, oracle, access-control, flash-loan, etc.
- Severities: Critical, High, Medium, Low, Info
- Largest single source — key set SOLODIT_API_KEY for full coverage

### 2. DeFiHackLabs (local repo parsing)
- 500+ real exploit PoCs with working Foundry test code
- Actual attack transactions with tx hashes
- Loss amounts and dates

### 3. Immunefi Bug Bounties (curated writeups)
- Curated third-party list of Immunefi bug bounty writeups
- Fetches articles from Medium, Mirror, GitHub, blogs
- Real-world bounty reports with researcher attribution

### 4. Immunefi Competitions (GitHub)
- 879 competition-validated findings from 25 Immunefi audit competitions
- Source: `immunefi-team/Past-Audit-Competitions` GitHub repo
- Remote mode by default (raw.githubusercontent.com, no token needed)
- Local clone mode available on macOS/Linux: `--local-repo /path/to/clone`
- Supports `--competitions "Alchemix,ZeroLend"` filtering and `--max-findings N` cap
- Windows-safe (sanitized cache paths, URL-encoded API calls)
- Three filename formats parsed (new dash, old bracket, prefixed bracket)

## Key Features

### Local Embeddings
Uses `all-MiniLM-L6-v2` (384-dim, ~90MB) for local CPU inference — no data sent to external APIs:
```python
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')  # Runs locally
```

### Smart Chunking
Different chunk strategies for different content types:
- **Description**: Full semantic chunks
- **Code**: Function-level chunks with context
- **Metadata**: Stored separately for filtering

### Hybrid Search
Combines semantic search with metadata filtering:
```python
collection.query(
    query_texts=["reentrancy with external call"],
    where={"severity": {"$in": ["critical", "high"]}},
    where_document={"$contains": "callback"},
    n_results=10
)
```

## Installation

```bash
cd custom-mcp/unified-vuln-db
pip install -r requirements.txt

# Index all sources (recommended — runs all 4 indexers)
python -m unified_vuln.indexer index -s all

# Or index specific sources
python -m unified_vuln.indexer index -s solodit
python -m unified_vuln.indexer index -s defihacklabs
python -m unified_vuln.indexer index -s immunefi
python -m unified_vuln.indexer index -s immunefi-competitions

# Immunefi Competitions options
python -m unified_vuln.indexer index -s immunefi-competitions --competitions "Alchemix,ZeroLend"
python -m unified_vuln.indexer index -s immunefi-competitions --max-findings 50
python -m unified_vuln.indexer index -s immunefi-competitions --incremental
# Local clone mode (macOS/Linux only — Windows blocked by | and : in dir names):
python -m unified_vuln.indexer index -s immunefi-competitions --local-repo /path/to/Past-Audit-Competitions
```

Note: `plamen rag` runs all 4 indexers automatically. Manual CLI usage is for debugging or selective rebuilds.

## MCP Tools

The server exposes these tools to Claude Code agents:

| Tool | Description |
|------|-------------|
| `validate_hypothesis` | Validate a security hypothesis against historical findings |
| `search_solodit_live` | Live search against Solodit API (50k+ findings, requires API key) |
| `get_similar_findings` | Find similar vulnerabilities by pattern description |
| `get_common_vulnerabilities` | Get common vulnerabilities for a category |
| `analyze_code_pattern` | Analyze a code pattern for known vulnerability matches |
| `assess_hypothesis_strength` | Score a hypothesis against historical precedent |
| `get_attack_vectors` | Get known attack vectors for a vulnerability class |
| `get_root_cause_analysis` | Get root cause analysis for a vulnerability pattern |
| `get_fix_patterns` | Get known fix patterns for a vulnerability class |
| `get_poc_template` | Get PoC template for a vulnerability type |
| `get_impact_precedents` | Get historical impact data for similar vulnerabilities |
| `get_knowledge_stats` | Database statistics by source/category/severity |
| `get_similar_exploit_code` | Find similar exploit code patterns |
| `get_controllability_evidence` | Get evidence for attacker controllability of inputs |
| `get_reachability_evidence` | Get evidence for vulnerability reachability |
| `get_exploitation_requirements` | Get requirements for exploiting a vulnerability class |

## Query Examples

```python
# Validate a security hypothesis
validate_hypothesis(
    hypothesis="Flash loan can manipulate oracle price in single transaction"
)

# Search Solodit live (requires SOLODIT_API_KEY)
search_solodit_live(
    keywords="first depositor inflation vault",
    impact=["HIGH", "CRITICAL"],
    quality_score=3,
    max_results=15
)

# Find similar findings in local DB
get_similar_findings(
    pattern="reentrancy via ERC721 safeTransferFrom callback"
)

# Analyze a code pattern
analyze_code_pattern(
    code="balanceOf(address(this)) used for share calculation",
    context="ERC4626 vault deposit function"
)
```

## Maintenance

```bash
# Full rebuild (all 4 sources — same as 'plamen rag')
python -m unified_vuln.indexer index -s all

# Rebuild a specific source
python -m unified_vuln.indexer index -s defihacklabs

# Incremental update (immunefi-competitions supports --incremental)
python -m unified_vuln.indexer index -s immunefi-competitions --incremental

# View database statistics
python -m unified_vuln.indexer stats
```
