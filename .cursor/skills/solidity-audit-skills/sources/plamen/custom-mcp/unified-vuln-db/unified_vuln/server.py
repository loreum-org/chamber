"""
Unified Vulnerability Knowledge Base - Reasoning Augmentation System

PURPOSE: Extend Claude's reasoning capabilities, NOT replace them.

This is a BRAIN EXTENSION that:
- Provides historical context for patterns Claude identifies
- Explains WHY patterns are dangerous (root causes)
- Shows HOW patterns have been exploited (attack vectors)
- Offers templates for PROVING hypotheses (PoC structures)

WRONG USAGE: "Search for reentrancy bugs in vaults"
RIGHT USAGE: "I identified a CEI violation - how has this pattern been exploited?"
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Optional, List, Dict, Any
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Prompt, Resource, ResourceTemplate, TextContent, Tool
import httpx

from .database import get_db, VulnerabilityDB

server = Server("unified-vuln-db")
server.experimental.enable_tasks()


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL DEFINITIONS - Reasoning Augmentation
# ═══════════════════════════════════════════════════════════════════════════════

@server.list_tools()
async def list_tools() -> list[Tool]:
    """Tools designed to augment Claude's reasoning, not replace it."""
    return [
        # ═══════════════════════════════════════════════════════════════════════
        # PATTERN ANALYSIS - "I found this pattern, tell me about it"
        # ═══════════════════════════════════════════════════════════════════════
        Tool(
            name="analyze_code_pattern",
            description="""When you identify a suspicious code pattern, use this to understand its danger.

WHEN TO USE:
- You see code that "looks wrong" but need context on WHY it's dangerous
- You identified an AST pattern (e.g., external call before state update)
- You want to understand if a pattern has been exploited before

INPUT: The code snippet or AST signature you identified
OUTPUT: Historical examples showing WHY this pattern is dangerous, HOW it was exploited, and ROOT CAUSES

Example:
- You see: `token.transfer(to, amount); balances[msg.sender] -= amount;`
- You call: analyze_code_pattern("external call before state update")
- You get: Explanation of CEI violations + real exploits + root cause analysis
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "The code pattern or AST signature you identified (e.g., 'external call before state update', 'unchecked return value', 'FN:withdraw -> CALL:LOW_LEVEL -> STATE:UPDATE')"
                    },
                    "code_context": {
                        "type": "string",
                        "description": "Optional: The actual code snippet for more precise matching"
                    },
                    "protocol_type": {
                        "type": "string",
                        "description": "Optional: The type of protocol (vault, lending, dex, bridge) for more relevant examples"
                    },
                },
                "required": ["pattern"],
            },
        ),
        
        Tool(
            name="get_root_cause_analysis",
            description="""Understand the FUNDAMENTAL reason why a bug class exists.

WHEN TO USE:
- You found a potential vulnerability and want to understand WHY it happens
- You need to explain the root cause in an audit report
- You want to check if your understanding of a bug class is complete

INPUT: A vulnerability category (reentrancy, oracle-manipulation, etc.)
OUTPUT: Deep analysis of WHY this class exists, common developer mistakes, edge cases
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "bug_class": {
                        "type": "string",
                        "description": "The vulnerability class: reentrancy, oracle-manipulation, access-control, flash-loan, erc4626-inflation, arithmetic-precision, etc."
                    },
                },
                "required": ["bug_class"],
            },
        ),
        
        # ═══════════════════════════════════════════════════════════════════════
        # EXPLOITATION STRATEGIES - "How would an attacker exploit this?"
        # ═══════════════════════════════════════════════════════════════════════
        Tool(
            name="get_attack_vectors",
            description="""Get real-world attack strategies for a bug class.

WHEN TO USE:
- You confirmed a vulnerability exists and need to understand HOW to exploit it
- You're writing a PoC and need inspiration on the attack structure
- You want to assess the IMPACT by understanding exploitation paths

INPUT: Bug class or pattern
OUTPUT: Step-by-step attack vectors from real exploits + required conditions + profit mechanisms
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "bug_class": {
                        "type": "string",
                        "description": "The vulnerability class or pattern"
                    },
                    "constraints": {
                        "type": "string",
                        "description": "Optional: Any constraints (e.g., 'no flash loans available', 'requires governance token')"
                    },
                },
                "required": ["bug_class"],
            },
        ),
        
        Tool(
            name="get_exploitation_requirements",
            description="""Understand what conditions are needed to exploit a pattern.

WHEN TO USE:
- You found a potential bug but aren't sure if it's exploitable in practice
- You need to assess likelihood/severity based on required conditions
- You want to check if protective measures (guards, checks) are sufficient

INPUT: The vulnerability type
OUTPUT: Required conditions, common blockers, ways around protections
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "vulnerability_type": {
                        "type": "string",
                        "description": "The vulnerability type"
                    },
                },
                "required": ["vulnerability_type"],
            },
        ),
        
        # ═══════════════════════════════════════════════════════════════════════
        # POC TEMPLATES - "Help me prove this is exploitable"
        # ═══════════════════════════════════════════════════════════════════════
        Tool(
            name="get_poc_template",
            description="""Get a PoC template structure for proving a vulnerability.

WHEN TO USE:
- You've confirmed a vulnerability and need to write a PoC
- You want a starting structure to adapt to the specific protocol
- You need the right test setup pattern (fork, actors, initial state)

INPUT: Bug class + test framework
OUTPUT: Template PoC code with comments explaining each section to adapt

NOTE: This returns a TEMPLATE to adapt, not a copy-paste solution.
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "bug_class": {
                        "type": "string",
                        "description": "The vulnerability class (reentrancy, oracle-manipulation, etc.)"
                    },
                    "framework": {
                        "type": "string",
                        "enum": ["foundry", "hardhat"],
                        "default": "foundry",
                        "description": "Test framework"
                    },
                    "needs_fork": {
                        "type": "boolean",
                        "default": False,
                        "description": "Whether the PoC needs mainnet fork"
                    },
                },
                "required": ["bug_class"],
            },
        ),
        
        Tool(
            name="get_similar_exploit_code",
            description="""Get real exploit code for a similar bug to use as reference.

WHEN TO USE:
- You need to see how a real PoC was structured for this bug class
- You want to compare your PoC approach with historical ones
- You need specific code patterns (callback structure, flash loan setup, etc.)

INPUT: Bug class + optional severity filter
OUTPUT: Real PoC code from historical exploits (to learn from, not copy)
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "bug_class": {
                        "type": "string",
                        "description": "The vulnerability class"
                    },
                    "min_severity": {
                        "type": "string",
                        "enum": ["critical", "high", "medium"],
                        "default": "high",
                        "description": "Minimum severity for examples"
                    },
                    "limit": {
                        "type": "integer",
                        "default": 3,
                        "maximum": 5,
                        "description": "Number of examples"
                    },
                },
                "required": ["bug_class"],
            },
        ),
        
        # ═══════════════════════════════════════════════════════════════════════
        # FIX PATTERNS - "How should this be fixed?"
        # ═══════════════════════════════════════════════════════════════════════
        Tool(
            name="get_fix_patterns",
            description="""Get recommended fix patterns for a vulnerability class.

WHEN TO USE:
- You've confirmed a vulnerability and need to recommend a fix
- You want to verify a proposed fix is sufficient
- You need to explain best practices in an audit report

INPUT: Bug class
OUTPUT: Recommended fix patterns with code examples, common mistakes in fixes
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "bug_class": {
                        "type": "string",
                        "description": "The vulnerability class"
                    },
                },
                "required": ["bug_class"],
            },
        ),
        
        # ═══════════════════════════════════════════════════════════════════════
        # HYPOTHESIS VALIDATION - "Is my understanding correct?"
        # ═══════════════════════════════════════════════════════════════════════
        Tool(
            name="validate_hypothesis",
            description="""Cross-reference your vulnerability hypothesis against historical data.

WHEN TO USE:
- You have a theory about why code is vulnerable
- You want to check if similar vulnerabilities have been found before
- You need confidence before writing a detailed finding

INPUT: Your hypothesis about the vulnerability
OUTPUT: Supporting/contradicting evidence from historical bugs
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "hypothesis": {
                        "type": "string",
                        "description": "Your hypothesis (e.g., 'This vault is vulnerable to first depositor attack because totalSupply can be 0 when depositing')"
                    },
                    "code_context": {
                        "type": "string",
                        "description": "Optional: Relevant code that supports your hypothesis"
                    },
                },
                "required": ["hypothesis"],
            },
        ),
        
        # ═══════════════════════════════════════════════════════════════════════
        # KNOWLEDGE CHECK - "What should I look for in this protocol type?"
        # ═══════════════════════════════════════════════════════════════════════
        Tool(
            name="get_common_vulnerabilities",
            description="""Get common vulnerability patterns for a specific protocol type.

WHEN TO USE:
- You're starting analysis of a new protocol and want a checklist
- You want to ensure you haven't missed common patterns
- You need to prioritize which areas to focus on

INPUT: Protocol type
OUTPUT: Common vulnerability patterns with frequency, severity distribution, key functions to check
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "protocol_type": {
                        "type": "string",
                        "description": "Protocol type: vault, erc4626, lending, dex, bridge, staking, governance, oracle"
                    },
                },
                "required": ["protocol_type"],
            },
        ),
        
        # ═══════════════════════════════════════════════════════════════════════
        # STATISTICS (for meta-understanding)
        # ═══════════════════════════════════════════════════════════════════════
        Tool(
            name="get_knowledge_stats",
            description="""Get statistics about the knowledge base coverage.

WHEN TO USE:
- You want to understand how much historical data backs your analysis
- You need to know which bug classes have most examples
- You want to assess confidence in the knowledge base for a topic
""",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        
        # ═══════════════════════════════════════════════════════════════════════
        # VERIFICATION GATES SUPPORT - For kritt.ai methodology
        # ═══════════════════════════════════════════════════════════════════════
        Tool(
            name="get_reachability_evidence",
            description="""Get historical evidence for REACHABILITY (Gate 1).

WHEN TO USE:
- You need to understand how similar vulnerable code was reached by attackers
- You want call path examples from real exploits
- You need to verify your reachability analysis against historical patterns

INPUT: The sink (vulnerable operation) and protocol type
OUTPUT: Historical examples showing HOW attackers reached similar sinks
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "sink_type": {
                        "type": "string",
                        "description": "The type of sink/vulnerable operation (e.g., 'external call', 'state update', 'token transfer', 'price read')"
                    },
                    "function_context": {
                        "type": "string",
                        "description": "Optional: The function name or context (e.g., 'withdraw', 'liquidate', 'swap')"
                    },
                },
                "required": ["sink_type"],
            },
        ),
        
        Tool(
            name="get_controllability_evidence",
            description="""Get historical evidence for CONTROLLABILITY (Gate 2).

WHEN TO USE:
- You need to understand how attackers controlled similar inputs
- You want to verify that your identified input is actually controllable
- You need examples of input manipulation from real exploits

INPUT: The input/parameter type and control method
OUTPUT: Historical examples showing HOW attackers controlled similar inputs
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "input_type": {
                        "type": "string",
                        "description": "The type of input (e.g., 'amount parameter', 'price oracle', 'callback address', 'token amount')"
                    },
                    "control_method": {
                        "type": "string",
                        "description": "Optional: How the input might be controlled (e.g., 'direct parameter', 'flash loan', 'donation', 'front-running')"
                    },
                },
                "required": ["input_type"],
            },
        ),
        
        Tool(
            name="get_impact_precedents",
            description="""Get historical IMPACT precedents (Gate 3).

WHEN TO USE:
- You need to assess realistic impact for a vulnerability
- You want to compare your impact estimate with historical exploits
- You need examples of actual losses from similar bugs

INPUT: The impact type and vulnerability class
OUTPUT: Historical examples showing ACTUAL IMPACT of similar vulnerabilities
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "impact_type": {
                        "type": "string",
                        "description": "The type of impact (e.g., 'fund theft', 'privilege escalation', 'DoS', 'price manipulation')"
                    },
                    "bug_class": {
                        "type": "string",
                        "description": "Optional: The vulnerability class for more specific examples"
                    },
                },
                "required": ["impact_type"],
            },
        ),
        
        Tool(
            name="assess_hypothesis_strength",
            description="""Assess the strength of a hypothesis against historical data.

WHEN TO USE:
- Before investing time in a PoC, check if similar hypotheses were confirmed historically
- You want to know the "success rate" of similar vulnerability hypotheses
- You need confidence calibration based on historical outcomes

INPUT: Your hypothesis statement
OUTPUT: Historical confirmation rate, similar hypotheses, and confidence assessment
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "hypothesis": {
                        "type": "string",
                        "description": "Your hypothesis statement (e.g., 'Reentrancy via callback allows double-spend')"
                    },
                    "code_pattern": {
                        "type": "string",
                        "description": "Optional: The code pattern supporting your hypothesis"
                    },
                    "protocol_type": {
                        "type": "string",
                        "description": "Optional: Protocol type for more relevant comparison"
                    },
                },
                "required": ["hypothesis"],
            },
        ),
        
        Tool(
            name="get_similar_findings",
            description="""Get findings similar to your current hypothesis for learning.

WHEN TO USE:
- You want to see how similar vulnerabilities were documented
- You need examples of audit report language for similar bugs
- You want to compare severity assessments

INPUT: The vulnerability pattern or title
OUTPUT: Similar findings with their severity, description, and recommendations
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "The vulnerability pattern or description"
                    },
                    "severity_filter": {
                        "type": "string",
                        "enum": ["critical", "high", "medium", "all"],
                        "description": "Optional: Filter by minimum severity"
                    },
                    "limit": {
                        "type": "integer",
                        "default": 5,
                        "maximum": 10,
                        "description": "Number of similar findings to return"
                    },
                },
                "required": ["pattern"],
            },
        ),

        # ═══════════════════════════════════════════════════════════════════════
        # LIVE SOLODIT API - Search beyond indexed data
        # ═══════════════════════════════════════════════════════════════════════
        Tool(
            name="search_solodit_live",
            description="""Search the full Solodit database (50k+ findings) via live API.

WHEN TO USE:
- You need findings beyond what's indexed locally (local index has ~3.4k findings)
- You want to search for a SPECIFIC protocol, audit firm, or tag combination
- You're validating a hypothesis and need comprehensive historical evidence
- You want the most recent findings (sorted by recency)
- You need to deep-dive into a specific vulnerability pattern with more examples

MANDATORY USAGE (per audit workflow):
- During hypothesis validation: search for similar patterns
- During deep dive analysis: get more context on identified patterns
- When local search returns < 3 results: expand search via live API

PRO TIPS for better recall:
- Use quality_score >= 3 to filter out low-quality/noisy findings
- Use language filter ('Solidity', 'Rust', 'Cairo', 'Move') to avoid cross-language noise
- Use rarity_score >= 3 with sort_by='Rarity' to find unique/solo-auditor patterns
- Use min_finders=1, max_finders=1 to find solo discoveries (often the hardest bugs)
- Combine protocol_category + tags for targeted domain searches

INPUT: Search filters (keywords, impact, tags, protocol, firms, language, quality/rarity scores, etc.)
OUTPUT: Matching findings with title, severity, description, root cause, and recommendations

NOTE: Adaptive rate limiting from API headers. Results cached 5 minutes.
Requires SOLODIT_API_KEY environment variable.
""",
            inputSchema={
                "type": "object",
                "properties": {
                    "keywords": {
                        "type": "string",
                        "description": "Search keywords (e.g., 'reentrancy callback', 'first depositor vault')"
                    },
                    "impact": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW", "GAS"]},
                        "description": "Filter by severity/impact levels"
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Filter by vulnerability tags (e.g., ['Reentrancy', 'Flash Loan', 'Oracle'])"
                    },
                    "protocol": {
                        "type": "string",
                        "description": "Filter by protocol name — partial match (e.g., 'Uniswap', 'Aave', 'Compound')"
                    },
                    "protocol_category": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Filter by protocol categories (e.g., ['DeFi', 'NFT', 'Bridge', 'Lending', 'DEX'])"
                    },
                    "firms": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Filter by audit firm names (e.g., ['Trail of Bits', 'Cyfrin', 'Sherlock'])"
                    },
                    "language": {
                        "type": "string",
                        "description": "Filter by programming language (e.g., 'Solidity', 'Rust', 'Cairo', 'Move')"
                    },
                    "reported": {
                        "type": "string",
                        "enum": ["30", "60", "90", "alltime"],
                        "description": "Filter by time period: last 30/60/90 days, or all time"
                    },
                    "reported_after": {
                        "type": "string",
                        "description": "Filter findings reported after this ISO date (e.g., '2024-01-01'). Overrides 'reported' if both set."
                    },
                    "quality_score": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 5,
                        "description": "Minimum quality score (0-5). Use >= 3 for well-documented findings."
                    },
                    "rarity_score": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 5,
                        "description": "Minimum rarity score (0-5). Use >= 3 for unique/uncommon vulnerability patterns."
                    },
                    "user": {
                        "type": "string",
                        "description": "Filter by auditor/finder handle (partial match)"
                    },
                    "min_finders": {
                        "type": "integer",
                        "description": "Minimum number of finders (1 = include solo finds)"
                    },
                    "max_finders": {
                        "type": "integer",
                        "description": "Maximum number of finders (1 = solo finds only, rare/hard bugs)"
                    },
                    "sort_by": {
                        "type": "string",
                        "enum": ["Recency", "Quality", "Rarity"],
                        "default": "Quality",
                        "description": "Sort results by: Recency (newest), Quality (best documented), Rarity (unique patterns)"
                    },
                    "sort_direction": {
                        "type": "string",
                        "enum": ["Desc", "Asc"],
                        "default": "Desc",
                        "description": "Sort direction"
                    },
                    "max_results": {
                        "type": "integer",
                        "default": 10,
                        "maximum": 50,
                        "description": "Maximum number of results to return (max 50)"
                    },
                },
                "required": [],
            },
        ),
    ]


@server.list_resources()
async def list_resources() -> list[Resource]:
    """Return no static resources.

    Codex probes optional MCP discovery methods during startup. Returning an empty
    list here avoids spurious startup failures from "method not found".
    """
    return []


@server.list_resource_templates()
async def list_resource_templates() -> list[ResourceTemplate]:
    """Return no resource templates."""
    return []


@server.list_prompts()
async def list_prompts() -> list[Prompt]:
    """Return no prompts."""
    return []


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def format_response(data: Any) -> TextContent:
    """Format response as JSON."""
    return TextContent(type="text", text=json.dumps(data, indent=2, default=str))


def parse_document_sections(doc: str) -> Dict[str, str]:
    """
    Parse the structured markdown document stored in ChromaDB back into sections.
    The document is created by Vulnerability.to_document() with ## headers.
    """
    sections: Dict[str, str] = {}
    if not doc:
        return sections

    current = "header"
    lines: list = []

    for line in doc.split('\n'):
        if line.startswith('## '):
            if lines:
                sections[current] = '\n'.join(lines).strip()
            current = line[3:].strip().lower().replace(' ', '_')
            lines = []
        else:
            lines.append(line)

    if lines:
        sections[current] = '\n'.join(lines).strip()

    return sections


def extract_reasoning_material(results: List[Dict], focus: str = "all") -> Dict[str, Any]:
    """
    Transform raw DB results into reasoning-augmentation material.

    Reads from both metadata fields AND the document text (which contains
    structured sections from to_document()). This ensures we capture
    root_cause, attack_vector, recommendation, and vulnerable_code
    even when metadata doesn't include them.

    Focus: 'root_cause', 'attack_vector', 'fix', 'all'
    """
    if not results:
        return {"examples_found": 0, "analysis": "No historical examples found for this pattern."}

    output = {
        "examples_found": len(results),
        "similar_findings": [],
        "patterns_observed": [],
        "root_causes": [],
        "attack_vectors": [],
        "fix_patterns": [],
        "methodology_hints": [],
    }

    seen_causes = set()
    seen_vectors = set()
    seen_fixes = set()

    for r in results:
        # Parse the document text for sections not in metadata
        doc = r.get("document", "")
        parsed = parse_document_sections(doc)

        # Extract root causes: try metadata first, then parsed document
        root_cause = r.get("root_cause", "") or parsed.get("root_cause", "")
        if root_cause and root_cause not in seen_causes:
            seen_causes.add(root_cause)
            output["root_causes"].append(root_cause[:2000])

        # Extract attack vectors
        attack_vector = r.get("attack_vector", "") or parsed.get("attack_vector", "")
        if attack_vector and attack_vector not in seen_vectors:
            seen_vectors.add(attack_vector)
            output["attack_vectors"].append(attack_vector[:2000])

        # Extract AST patterns
        ast_sig = r.get("ast_signature", "")
        if ast_sig and ast_sig not in output["patterns_observed"]:
            output["patterns_observed"].append(ast_sig)

        # Extract recommendations / fix patterns
        rec = r.get("recommendation", "") or parsed.get("fix", "") or parsed.get("recommendation", "")
        if rec and rec not in seen_fixes:
            seen_fixes.add(rec)
            output["fix_patterns"].append(rec[:2000])

        # Build similar_findings entry (limited to 5)
        if len(output["similar_findings"]) < 5:
            desc = r.get("description", "") or parsed.get("description", "")
            code = r.get("vulnerable_code", "") or parsed.get("vulnerable_code", "")
            output["similar_findings"].append({
                "title": r.get("title", "Unknown"),
                "severity": r.get("severity", "unknown"),
                "protocol": r.get("protocol_name", ""),
                "root_cause": (root_cause or "")[:500],
                "description_excerpt": (desc or "")[:500],
                "vulnerable_code": (code or "")[:1000],
                "recommendation": (rec or "")[:500],
                "what_to_look_for": (root_cause or desc or "")[:300],
            })

    # Derive methodology hints from descriptions
    hint_phrases = set()
    for finding in output["similar_findings"]:
        desc = finding.get("description_excerpt", "").lower()
        rc = finding.get("root_cause", "").lower()
        for text in [desc, rc]:
            if "before" in text and ("state" in text or "update" in text):
                hint_phrases.add("Check for state updates after external calls (CEI violations)")
            if "callback" in text or "safemint" in text or "safetransfer" in text:
                hint_phrases.add("Look for callbacks in ERC721/ERC1155 token transfers")
            if "flash" in text and "loan" in text:
                hint_phrases.add("Check if balances can be manipulated via flash loans")
            if "first deposit" in text or "inflation" in text:
                hint_phrases.add("Check first depositor / share inflation scenarios")
            if "oracle" in text or "price" in text:
                hint_phrases.add("Verify oracle freshness and manipulation resistance")
            if "overflow" in text or "underflow" in text:
                hint_phrases.add("Check arithmetic operations for overflow/underflow")
            if "access" in text or "onlyowner" in text or "modifier" in text:
                hint_phrases.add("Verify access control on all state-changing functions")
    output["methodology_hints"] = list(hint_phrases)[:10]

    # Severity distribution
    sev_dist: Dict[str, int] = {}
    for r in results:
        sev = r.get("severity", "unknown")
        sev_dist[sev] = sev_dist.get(sev, 0) + 1
    output["severity_distribution"] = sev_dist

    # Common root causes (deduplicated short summaries)
    output["common_root_causes"] = list(seen_causes)[:5]

    # Filter by focus
    if focus == "root_cause":
        return {
            "examples_found": len(results),
            "root_causes": output["root_causes"],
            "common_root_causes": output["common_root_causes"],
            "patterns_observed": output["patterns_observed"],
            "similar_findings": output["similar_findings"][:3],
            "methodology_hints": output["methodology_hints"],
        }
    elif focus == "attack_vector":
        return {
            "examples_found": len(results),
            "attack_vectors": output["attack_vectors"],
            "patterns_observed": output["patterns_observed"],
            "similar_findings": output["similar_findings"][:3],
            "methodology_hints": output["methodology_hints"],
        }
    elif focus == "fix":
        return {
            "examples_found": len(results),
            "fix_patterns": output["fix_patterns"],
            "similar_findings": output["similar_findings"][:3],
        }

    return output


def get_poc_examples(db: VulnerabilityDB, bug_class: str, limit: int = 3) -> List[Dict]:
    """Get PoC examples for a bug class."""
    results = db.search(
        query=f"{bug_class} exploit proof of concept",
        n_results=limit * 2,
        filters={"has_poc": True}
    )

    examples = []
    for r in results:
        if r.get("has_poc") and len(examples) < limit:
            poc_code = r.get("poc_code", "")
            if poc_code:
                examples.append({
                    "title": r.get("title", ""),
                    "protocol": r.get("protocol_name", ""),
                    "severity": r.get("severity", ""),
                    "poc_engine": r.get("poc_engine", "foundry"),
                    "poc_code": poc_code,
                    "attack_summary": r.get("attack_vector", ""),
                })

    return examples


# ═══════════════════════════════════════════════════════════════════════════════
# LIVE SOLODIT API HELPER
# ═══════════════════════════════════════════════════════════════════════════════

SOLODIT_API_URL = "https://solodit.cyfrin.io/api/v1/solodit/findings"
SOLODIT_MAX_RETRIES = 3  # Retry transient failures


class _SoloditRateLimiter:
    """Adaptive rate limiter that reads x-ratelimit-* headers from Solodit API."""

    def __init__(self):
        self._remaining: Optional[int] = None
        self._reset_at: Optional[float] = None  # epoch seconds

    def update(self, response_headers):
        """Update rate limit state from response headers."""
        remaining = response_headers.get("x-ratelimit-remaining")
        reset = response_headers.get("x-ratelimit-reset")
        if remaining is not None:
            try:
                self._remaining = int(remaining)
            except (ValueError, TypeError):
                pass
        if reset is not None:
            try:
                self._reset_at = float(reset)
            except (ValueError, TypeError):
                pass

    async def wait_if_needed(self):
        """Wait only when approaching rate limit. Much faster than fixed delay."""
        if self._remaining is not None and self._remaining <= 2 and self._reset_at:
            now = asyncio.get_event_loop().time()
            # Convert epoch reset time to wait duration
            import time as _time
            wall_now = _time.time()
            if self._reset_at > wall_now:
                wait = self._reset_at - wall_now + 0.5
                await asyncio.sleep(min(wait, 65))  # cap at 65s


_solodit_rate_limiter = _SoloditRateLimiter()


class _SoloditSearchCache:
    """In-memory TTL cache for search results. Avoids redundant API calls."""

    def __init__(self, ttl_seconds: int = 300):
        self._store: Dict[str, Any] = {}
        self._expires: Dict[str, float] = {}
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        if key in self._store:
            import time as _time
            if _time.time() < self._expires.get(key, 0):
                return self._store[key]
            # Expired
            del self._store[key]
            del self._expires[key]
        return None

    def set(self, key: str, value: Any):
        import time as _time
        self._store[key] = value
        self._expires[key] = _time.time() + self._ttl


_solodit_cache = _SoloditSearchCache(ttl_seconds=300)  # 5 min


async def _solodit_api_request(
    client: httpx.AsyncClient,
    headers: Dict[str, str],
    request_body: Dict[str, Any],
) -> Optional[Dict]:
    """Make a single Solodit API request with adaptive rate limiting and retry."""
    for attempt in range(SOLODIT_MAX_RETRIES):
        try:
            await _solodit_rate_limiter.wait_if_needed()
            response = await client.post(
                SOLODIT_API_URL,
                headers=headers,
                json=request_body,
                timeout=30.0
            )
            # Update rate limiter from response headers
            _solodit_rate_limiter.update(response.headers)

            if response.status_code == 429:
                if attempt < SOLODIT_MAX_RETRIES - 1:
                    await asyncio.sleep(60)
                    continue
                return {"_error": "Rate limited by Solodit API after retries."}

            if response.status_code in (401, 403):
                return {"_error": f"Solodit API authentication failed (HTTP {response.status_code}). Verify your API key."}

            if response.status_code >= 500:
                if attempt < SOLODIT_MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** (attempt + 1))
                    continue
                return {"_error": f"Solodit API server error (HTTP {response.status_code}) after {SOLODIT_MAX_RETRIES} retries."}

            response.raise_for_status()
            return response.json()

        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
            if attempt < SOLODIT_MAX_RETRIES - 1:
                await asyncio.sleep(2 ** (attempt + 1))
                continue
            return {"_error": f"Network error after {SOLODIT_MAX_RETRIES} retries: {str(e)[:200]}"}
        except Exception as e:
            if attempt < SOLODIT_MAX_RETRIES - 1:
                await asyncio.sleep(2 ** (attempt + 1))
                continue
            return {"_error": f"Request failed after {SOLODIT_MAX_RETRIES} retries: {str(e)[:200]}"}

    return {"_error": "Exhausted all retries"}


async def _search_solodit_api(
    api_key: str,
    filters: Dict[str, Any],
    max_results: int = 10
) -> Dict[str, Any]:
    """
    Search Solodit API with given filters.

    Returns structured results with findings, metadata, and search info.
    """
    import re

    headers = {
        "Content-Type": "application/json",
        "X-Cyfrin-API-Key": api_key,
    }

    # Calculate pages needed (100 per page max)
    page_size = min(max_results, 100)
    pages_needed = (max_results + page_size - 1) // page_size

    all_findings = []
    total_available = 0

    async with httpx.AsyncClient() as client:
        for page in range(1, pages_needed + 1):
            request_body = {
                "page": page,
                "pageSize": page_size,
                "filters": filters,
            }

            data = await _solodit_api_request(client, headers, request_body)

            if data and "_error" in data:
                if all_findings:
                    # Return partial results with error note
                    return {
                        "search_filters": filters,
                        "total_available": total_available,
                        "returned": len(all_findings),
                        "findings": all_findings,
                        "warning": data["_error"],
                        "note": f"Partial results: {len(all_findings)} findings returned before error."
                    }
                return {"error": data["_error"]}

            if not data:
                break

            findings = data.get("findings", [])
            metadata = data.get("metadata", {})
            total_available = metadata.get("totalItems", 0)

            if not findings:
                break

            # Parse findings
            for f in findings:
                if len(all_findings) >= max_results:
                    break

                # Extract content sections
                content = f.get("content", "") or ""

                # Extract code blocks
                code_blocks = re.findall(
                    r'```(?:solidity|sol|javascript|typescript|python|vyper)?\s*\n(.*?)```',
                    content, re.DOTALL
                )
                vulnerable_code = code_blocks[0].strip()[:2000] if code_blocks else ""

                # Extract impact section
                impact_match = re.search(r'#{1,3}\s*Impact\s*\n(.*?)(?=#{1,3}|\Z)', content, re.DOTALL | re.IGNORECASE)
                impact_text = impact_match.group(1).strip()[:1000] if impact_match else ""

                # Extract recommendation section
                rec_match = re.search(
                    r'#{1,3}\s*(?:Recommend(?:ation|ed\s*Mitigation)?|Remediation|Mitigation|Fix)\s*\n(.*?)(?=#{1,3}|\Z)',
                    content, re.DOTALL | re.IGNORECASE
                )
                recommendation = rec_match.group(1).strip()[:1000] if rec_match else ""

                # Extract root cause
                rc_match = re.search(
                    r'#{1,3}\s*(?:Root\s*Cause|Vulnerability\s*Detail|Bug\s*Description)\s*\n(.*?)(?=#{1,3}|\Z)',
                    content, re.DOTALL | re.IGNORECASE
                )
                root_cause = rc_match.group(1).strip()[:1000] if rc_match else ""

                # Get tags
                tags = []
                tag_scores = f.get("issues_issuetagscore", [])
                for ts in tag_scores:
                    tag_obj = ts.get("tags_tag", {})
                    tag_title = tag_obj.get("title", "")
                    if tag_title:
                        tags.append(tag_title)

                all_findings.append({
                    "title": f.get("title", ""),
                    "severity": f.get("impact", "").upper(),
                    "protocol": f.get("protocol_name", ""),
                    "audit_firm": f.get("firm_name", ""),
                    "date": (f.get("report_date", "") or "")[:10],
                    "summary": f.get("summary", "")[:500],
                    "root_cause": root_cause,
                    "impact": impact_text,
                    "recommendation": recommendation,
                    "vulnerable_code": vulnerable_code,
                    "tags": tags[:5],
                    "url": f.get("source_link", "") or f"https://solodit.cyfrin.io/issues/{f.get('slug', '')}",
                })

            # Check if we have enough or reached last page
            if len(all_findings) >= max_results:
                break
            if page >= metadata.get("totalPages", 1):
                break

    return {
        "search_filters": filters,
        "total_available": total_available,
        "returned": len(all_findings),
        "findings": all_findings,
        "note": f"Searched Solodit's full database ({total_available} matching findings available). "
                f"Returned top {len(all_findings)} by {filters.get('sortField', 'Quality')}."
    }


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle reasoning-augmentation tool calls."""
    # Use pre-loaded database (loaded at server startup)
    db = _ensure_db_loaded()
    if db is None:
        return [format_response({
            "error": "Database not available",
            "reason": "Embedding model failed to load. Run 'plamen rag' to build the database, then restart the MCP server.",
            "fallback": "Use Slither + Three Prompts methodology instead."
        })]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PATTERN ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════════
    
    if name == "analyze_code_pattern":
        pattern = arguments["pattern"]
        code_context = arguments.get("code_context", "")
        protocol_type = arguments.get("protocol_type", "")
        
        # Build query from pattern + context
        query = f"vulnerability pattern: {pattern}"
        if code_context:
            query += f" code: {code_context[:500]}"
        
        # Search with optional protocol filter
        filters = {}
        if protocol_type:
            filters["protocol_types"] = [protocol_type]
        
        results = db.search(query, n_results=10, filters=filters if filters else None)
        
        # Transform to reasoning material
        analysis = extract_reasoning_material(results)
        analysis["query_pattern"] = pattern
        analysis["interpretation"] = f"Based on {analysis['examples_found']} historical examples of similar patterns:"
        
        return [format_response(analysis)]
    
    elif name == "get_root_cause_analysis":
        bug_class = arguments["bug_class"]
        
        results = db.search(f"{bug_class} root cause why vulnerable", n_results=15)
        analysis = extract_reasoning_material(results, focus="root_cause")
        
        # Add structured analysis
        analysis["bug_class"] = bug_class
        analysis["summary"] = f"Root cause analysis for {bug_class} based on {analysis['examples_found']} examples"
        
        return [format_response(analysis)]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # EXPLOITATION STRATEGIES
    # ═══════════════════════════════════════════════════════════════════════════
    
    elif name == "get_attack_vectors":
        bug_class = arguments["bug_class"]
        constraints = arguments.get("constraints", "")
        
        query = f"{bug_class} attack vector exploit how"
        if constraints:
            query += f" {constraints}"
        
        results = db.search(query, n_results=15)
        analysis = extract_reasoning_material(results, focus="attack_vector")
        
        analysis["bug_class"] = bug_class
        analysis["constraints"] = constraints
        
        return [format_response(analysis)]
    
    elif name == "get_exploitation_requirements":
        vuln_type = arguments["vulnerability_type"]
        
        results = db.search(f"{vuln_type} requirements conditions exploit", n_results=10)
        
        # Extract requirements from descriptions
        requirements = []
        blockers = []
        
        for r in results:
            desc = r.get("description", "") + " " + r.get("attack_vector", "")
            desc_lower = desc.lower()
            
            # Common requirement indicators
            if "requires" in desc_lower or "needs" in desc_lower or "must" in desc_lower:
                requirements.append(r.get("title", "") + ": " + desc[:300])
            if "protected by" in desc_lower or "mitigated" in desc_lower or "prevented" in desc_lower:
                blockers.append(desc[:300])
        
        return [format_response({
            "vulnerability_type": vuln_type,
            "examples_analyzed": len(results),
            "common_requirements": requirements[:5],
            "common_blockers": blockers[:5],
            "example_contexts": [r.get("description", "")[:200] for r in results[:3]],
        })]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # POC TEMPLATES
    # ═══════════════════════════════════════════════════════════════════════════
    
    elif name == "get_poc_template":
        bug_class = arguments["bug_class"]
        framework = arguments.get("framework", "foundry")
        needs_fork = arguments.get("needs_fork", False)
        
        # Get real examples to derive template
        examples = get_poc_examples(db, bug_class, limit=2)
        
        # Build template based on framework
        if framework == "foundry":
            template = f"""// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title PoC Template for {bug_class}
 * @notice ADAPT this template to the specific protocol
 * 
 * Based on {len(examples)} historical exploits of similar bugs.
 */
contract Poc{bug_class.replace('-', '_').title()} is Test {{
    
    // ═══════════════════════════════════════════════════════════════════
    // PROTOCOL CONTRACTS - Replace with actual contract addresses/instances
    // ═══════════════════════════════════════════════════════════════════
    
    // ITargetContract target;
    // IERC20 token;
    
    // ═══════════════════════════════════════════════════════════════════
    // ACTORS
    // ═══════════════════════════════════════════════════════════════════
    
    address attacker = makeAddr("attacker");
    address victim = makeAddr("victim");  // If needed
    
    // ═══════════════════════════════════════════════════════════════════
    // CONSTANTS - Adjust based on protocol
    // ═══════════════════════════════════════════════════════════════════
    
    uint256 constant ATTACK_AMOUNT = 1 ether;
    
    function setUp() public {{
        {"// Fork mainnet at specific block\\n        vm.createSelectFork(vm.envString(\"ETH_RPC_URL\"), BLOCK_NUMBER);" if needs_fork else "// Local deployment"}
        
        // TODO: Deploy or reference target contracts
        // target = ITargetContract(DEPLOYED_ADDRESS);
        
        // TODO: Set up initial state
        // vm.deal(attacker, 10 ether);
        // token.transfer(attacker, ATTACK_AMOUNT);
    }}
    
    function test_exploit_{bug_class.replace('-', '_')}() public {{
        console.log("=== Initial State ===");
        // uint256 attackerBalanceBefore = token.balanceOf(attacker);
        // console.log("Attacker balance:", attackerBalanceBefore);
        
        // ═══════════════════════════════════════════════════════════════
        // ATTACK EXECUTION
        // ═══════════════════════════════════════════════════════════════
        
        vm.startPrank(attacker);
        
        // TODO: Implement attack steps based on the specific vulnerability
        // Step 1: ...
        // Step 2: ...
        // Step 3: Profit
        
        vm.stopPrank();
        
        // ═══════════════════════════════════════════════════════════════
        // VERIFY EXPLOITATION
        // ═══════════════════════════════════════════════════════════════
        
        console.log("=== Final State ===");
        // uint256 attackerBalanceAfter = token.balanceOf(attacker);
        // uint256 profit = attackerBalanceAfter - attackerBalanceBefore;
        // console.log("Profit:", profit);
        
        // assertGt(profit, 0, "Exploit must be profitable");
    }}
}}
"""
        else:  # hardhat
            template = f"""// Hardhat PoC Template for {bug_class}
const {{ expect }} = require("chai");
const {{ ethers }} = require("hardhat");

describe("{bug_class} Exploit PoC", function () {{
    let attacker, victim;
    let targetContract;
    
    before(async function () {{
        [attacker, victim] = await ethers.getSigners();
        
        // TODO: Deploy or connect to contracts
        // const Target = await ethers.getContractFactory("TargetContract");
        // targetContract = await Target.deploy();
    }});
    
    it("should exploit {bug_class}", async function () {{
        const balanceBefore = await ethers.provider.getBalance(attacker.address);
        
        // TODO: Execute attack
        
        const balanceAfter = await ethers.provider.getBalance(attacker.address);
        expect(balanceAfter).to.be.gt(balanceBefore);
    }});
}});
"""
        
        return [format_response({
            "bug_class": bug_class,
            "framework": framework,
            "needs_fork": needs_fork,
            "template": template,
            "historical_examples": len(examples),
            "example_approaches": [e.get("attack_summary", "") for e in examples],
        })]
    
    elif name == "get_similar_exploit_code":
        bug_class = arguments["bug_class"]
        min_severity = arguments.get("min_severity", "high")
        limit = min(arguments.get("limit", 3), 5)
        
        severity_filter = {
            "critical": ["critical"],
            "high": ["critical", "high"],
            "medium": ["critical", "high", "medium"],
        }.get(min_severity, ["critical", "high"])
        
        results = db.search(
            query=f"{bug_class} exploit PoC",
            n_results=limit * 3,
            filters={"has_poc": True, "severities": severity_filter}
        )
        
        examples = []
        for r in results:
            if r.get("poc_code") and len(examples) < limit:
                examples.append({
                    "title": r.get("title", ""),
                    "severity": r.get("severity", ""),
                    "protocol": r.get("protocol_name", ""),
                    "attack_vector": r.get("attack_vector", ""),
                    "poc_code": r.get("poc_code", ""),
                })
        
        return [format_response({
            "bug_class": bug_class,
            "examples_found": len(examples),
            "examples": examples,
        })]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # FIX PATTERNS
    # ═══════════════════════════════════════════════════════════════════════════
    
    elif name == "get_fix_patterns":
        bug_class = arguments["bug_class"]
        
        results = db.search(f"{bug_class} fix recommendation remediation", n_results=15)
        analysis = extract_reasoning_material(results, focus="fix")
        
        # Also get diffs if available
        diffs = []
        for r in results:
            diff = r.get("diff_patch", "")
            if diff and len(diffs) < 3:
                diffs.append({
                    "title": r.get("title", ""),
                    "diff": diff[:1000],
                })
        
        analysis["bug_class"] = bug_class
        analysis["example_diffs"] = diffs
        
        return [format_response(analysis)]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # HYPOTHESIS VALIDATION
    # ═══════════════════════════════════════════════════════════════════════════
    
    elif name == "validate_hypothesis":
        hypothesis = arguments["hypothesis"]
        code_context = arguments.get("code_context", "")
        
        # Search for similar historical cases
        query = hypothesis
        if code_context:
            query += f" {code_context[:300]}"
        
        results = db.search(query, n_results=10)
        
        # Analyze support level
        supporting = []
        contradicting = []
        
        for r in results:
            desc = r.get("description", "").lower()
            hyp_lower = hypothesis.lower()
            
            # Check for keyword overlap (simple heuristic)
            hyp_keywords = set(hyp_lower.split())
            desc_keywords = set(desc.split())
            overlap = len(hyp_keywords & desc_keywords) / max(len(hyp_keywords), 1)
            
            if overlap > 0.2:  # Significant overlap
                supporting.append({
                    "title": r.get("title", ""),
                    "severity": r.get("severity", ""),
                    "similarity": r.get("score", 0),
                    "description": r.get("description", "")[:300],
                })
        
        confidence = "high" if len(supporting) >= 3 else "medium" if len(supporting) >= 1 else "low"
        
        return [format_response({
            "hypothesis": hypothesis,
            "confidence": confidence,
            "supporting_examples": len(supporting),
            "evidence": supporting[:5],
            "recommendation": "Your hypothesis is supported by historical data." if confidence != "low" else "Limited historical support - consider additional verification.",
        })]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # KNOWLEDGE CHECK
    # ═══════════════════════════════════════════════════════════════════════════
    
    elif name == "get_common_vulnerabilities":
        protocol_type = arguments["protocol_type"]
        
        results = db.search(
            query=f"{protocol_type} vulnerability common",
            n_results=30,
            filters={"protocol_types": [protocol_type]}
        )
        
        # Aggregate by category
        category_counts = {}
        severity_dist = {}
        key_functions = set()
        
        for r in results:
            cat = r.get("category", "other")
            category_counts[cat] = category_counts.get(cat, 0) + 1
            
            sev = r.get("severity", "unknown")
            severity_dist[sev] = severity_dist.get(sev, 0) + 1
            
            funcs = r.get("affected_functions", "")
            if funcs:
                for f in funcs.split(","):
                    key_functions.add(f.strip())
        
        # Sort by frequency
        sorted_categories = sorted(category_counts.items(), key=lambda x: -x[1])
        
        return [format_response({
            "protocol_type": protocol_type,
            "total_examples": len(results),
            "common_vulnerability_classes": [
                {"category": cat, "frequency": count} 
                for cat, count in sorted_categories[:10]
            ],
            "severity_distribution": severity_dist,
            "key_functions_to_check": list(key_functions)[:15],
            "checklist": [cat for cat, _ in sorted_categories[:7]],
        })]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STATISTICS
    # ═══════════════════════════════════════════════════════════════════════════
    
    elif name == "get_knowledge_stats":
        stats = db.get_statistics()
        return [format_response({
            "summary": f"Knowledge base contains {stats.get('total', 0)} vulnerability examples",
            "coverage": stats,
        })]
    
    # ═══════════════════════════════════════════════════════════════════════════
    # VERIFICATION GATES SUPPORT
    # ═══════════════════════════════════════════════════════════════════════════
    
    elif name == "get_reachability_evidence":
        sink_type = arguments["sink_type"]
        function_context = arguments.get("function_context", "")
        
        query = f"reachability call path entry point {sink_type}"
        if function_context:
            query += f" {function_context}"
        
        results = db.search(query, n_results=10)
        
        # Extract call paths and entry points
        call_paths = []
        entry_points = []
        
        for r in results:
            desc = r.get("description", "")
            title = r.get("title", "")
            
            # Look for function names and paths in descriptions
            call_paths.append({
                "title": title,
                "description": desc[:400],
                "category": r.get("category", ""),
                "severity": r.get("severity", ""),
            })
            
            # Extract affected functions as entry points
            funcs = r.get("affected_functions", "")
            if funcs:
                entry_points.extend(funcs.split(",")[:3])
        
        return [format_response({
            "sink_type": sink_type,
            "function_context": function_context,
            "examples_found": len(results),
            "historical_call_paths": call_paths[:5],
            "common_entry_points": list(set(entry_points))[:10],
            "guidance": f"Based on {len(results)} historical examples, similar sinks ({sink_type}) were typically reached through the entry points listed.",
        })]
    
    elif name == "get_controllability_evidence":
        input_type = arguments["input_type"]
        control_method = arguments.get("control_method", "")
        
        query = f"attacker control input {input_type} manipulation"
        if control_method:
            query += f" {control_method}"
        
        results = db.search(query, n_results=10)
        
        # Extract control methods
        control_examples = []
        
        for r in results:
            desc = r.get("description", "").lower()
            
            # Look for control-related keywords
            control_info = {
                "title": r.get("title", ""),
                "input_controlled": input_type,
                "severity": r.get("severity", ""),
                "description": r.get("description", "")[:400],
            }
            
            # Detect control method from description
            if "flash loan" in desc:
                control_info["control_method"] = "flash_loan"
            elif "front-run" in desc or "frontrun" in desc:
                control_info["control_method"] = "front_running"
            elif "donation" in desc or "donate" in desc:
                control_info["control_method"] = "donation"
            elif "parameter" in desc or "argument" in desc:
                control_info["control_method"] = "direct_input"
            elif "oracle" in desc:
                control_info["control_method"] = "oracle_manipulation"
            else:
                control_info["control_method"] = "unknown"
            
            control_examples.append(control_info)
        
        return [format_response({
            "input_type": input_type,
            "examples_found": len(results),
            "control_examples": control_examples[:5],
            "common_control_methods": list(set(e.get("control_method", "") for e in control_examples)),
            "guidance": f"Historical examples show {input_type} inputs were controlled via various methods. Review the examples for applicable techniques.",
        })]
    
    elif name == "get_impact_precedents":
        impact_type = arguments["impact_type"]
        bug_class = arguments.get("bug_class", "")
        
        query = f"impact {impact_type} loss damage"
        if bug_class:
            query += f" {bug_class}"
        
        results = db.search(query, n_results=15)
        
        # Extract impact examples
        impact_examples = []
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        
        for r in results:
            sev = r.get("severity", "unknown").lower()
            if sev in severity_counts:
                severity_counts[sev] += 1
            
            impact_examples.append({
                "title": r.get("title", ""),
                "severity": r.get("severity", ""),
                "protocol": r.get("protocol_name", ""),
                "impact_description": r.get("impact", "") or r.get("description", "")[:300],
            })
        
        # Calculate severity distribution
        total = sum(severity_counts.values())
        severity_pct = {k: f"{(v/max(total,1))*100:.0f}%" for k, v in severity_counts.items()}
        
        return [format_response({
            "impact_type": impact_type,
            "bug_class": bug_class,
            "examples_found": len(results),
            "impact_examples": impact_examples[:7],
            "severity_distribution": severity_pct,
            "assessment": f"Based on {len(results)} historical examples with {impact_type} impact. Severity distribution: {severity_pct}",
        })]
    
    elif name == "assess_hypothesis_strength":
        hypothesis = arguments["hypothesis"]
        code_pattern = arguments.get("code_pattern", "")
        protocol_type = arguments.get("protocol_type", "")
        
        # Build comprehensive query
        query = hypothesis
        if code_pattern:
            query += f" {code_pattern}"
        
        filters = {}
        if protocol_type:
            filters["protocol_types"] = [protocol_type]
        
        results = db.search(query, n_results=15, filters=filters if filters else None)
        
        # Analyze hypothesis strength
        high_severity = sum(1 for r in results if r.get("severity", "").lower() in ["critical", "high"])
        has_poc = sum(1 for r in results if r.get("has_poc"))
        
        # Calculate strength score
        strength_factors = []
        score = 0
        
        if len(results) >= 5:
            strength_factors.append("Strong historical precedent (5+ similar cases)")
            score += 3
        elif len(results) >= 2:
            strength_factors.append("Moderate historical precedent (2-4 cases)")
            score += 2
        elif len(results) >= 1:
            strength_factors.append("Limited historical precedent (1 case)")
            score += 1
        
        if high_severity >= 3:
            strength_factors.append("Multiple high/critical severity precedents")
            score += 2
        elif high_severity >= 1:
            strength_factors.append("At least one high/critical severity precedent")
            score += 1
        
        if has_poc >= 2:
            strength_factors.append("Multiple PoCs exist for similar bugs")
            score += 2
        elif has_poc >= 1:
            strength_factors.append("PoC exists for similar bug")
            score += 1
        
        # Determine overall strength
        if score >= 6:
            strength = "STRONG"
            recommendation = "High confidence - similar bugs have been exploited multiple times. Proceed to PoC."
        elif score >= 3:
            strength = "MODERATE"
            recommendation = "Moderate confidence - historical support exists. Worth investigating further."
        else:
            strength = "WEAK"
            recommendation = "Limited historical support - gather more evidence before investing in PoC."
        
        return [format_response({
            "hypothesis": hypothesis,
            "strength": strength,
            "score": f"{score}/8",
            "factors": strength_factors,
            "historical_matches": len(results),
            "high_severity_matches": high_severity,
            "poc_available": has_poc,
            "recommendation": recommendation,
            "similar_findings": [
                {"title": r.get("title", ""), "severity": r.get("severity", "")}
                for r in results[:5]
            ],
        })]
    
    elif name == "get_similar_findings":
        pattern = arguments["pattern"]
        severity_filter = arguments.get("severity_filter", "all")
        limit = min(arguments.get("limit", 5), 10)

        # Build severity filter
        filters = {}
        if severity_filter != "all":
            severity_map = {
                "critical": ["critical"],
                "high": ["critical", "high"],
                "medium": ["critical", "high", "medium"],
            }
            filters["severities"] = severity_map.get(severity_filter, [])

        results = db.search(
            query=pattern,
            n_results=limit * 2,
            filters=filters if filters else None
        )

        findings = []
        for r in results[:limit]:
            parsed = parse_document_sections(r.get("document", ""))
            desc = r.get("description", "") or parsed.get("description", "")
            rec = r.get("recommendation", "") or parsed.get("fix", "") or parsed.get("recommendation", "")
            root_cause = r.get("root_cause", "") or parsed.get("root_cause", "")
            code = r.get("vulnerable_code", "") or parsed.get("vulnerable_code", "")
            findings.append({
                "title": r.get("title", ""),
                "severity": r.get("severity", ""),
                "category": r.get("category", ""),
                "protocol": r.get("protocol_name", ""),
                "root_cause": root_cause[:500],
                "description": desc[:500],
                "vulnerable_code": code[:1000],
                "recommendation": rec[:500],
                "source": r.get("source", ""),
            })

        return [format_response({
            "query_pattern": pattern,
            "findings_found": len(findings),
            "findings": findings,
        })]

    # ═══════════════════════════════════════════════════════════════════════════
    # LIVE SOLODIT API
    # ═══════════════════════════════════════════════════════════════════════════

    elif name == "search_solodit_live":
        # Get API key (strip whitespace — env vars from MCP configs can have trailing spaces)
        api_key = (os.environ.get("SOLODIT_API_KEY") or "").strip()
        if not api_key:
            return [format_response({
                "error": "SOLODIT_API_KEY not set",
                "instructions": "Set the SOLODIT_API_KEY environment variable. Get a free key from https://solodit.cyfrin.io",
                "fallback": "Use the local database tools (get_similar_findings, validate_hypothesis) instead."
            })]

        # Build filters — use correct {value: x} wrapping for Solodit API format
        api_filters: Dict[str, Any] = {
            "sortField": arguments.get("sort_by", "Quality"),
            "sortDirection": arguments.get("sort_direction", "Desc"),
        }

        if arguments.get("keywords"):
            api_filters["keywords"] = arguments["keywords"]

        if arguments.get("impact"):
            # Impact values passed as uppercase strings in array (no wrapping needed)
            api_filters["impact"] = [v.upper() for v in arguments["impact"]]

        if arguments.get("tags"):
            # Tags MUST be wrapped as {value: tag} objects
            api_filters["tags"] = [{"value": t} for t in arguments["tags"]]

        if arguments.get("protocol"):
            api_filters["protocol"] = arguments["protocol"]

        if arguments.get("protocol_category"):
            # protocolCategory MUST be wrapped as [{value: cat}] — was broken (raw string)
            cats = arguments["protocol_category"]
            if isinstance(cats, str):
                cats = [cats]  # backwards compat: accept single string
            api_filters["protocolCategory"] = [{"value": c} for c in cats]

        if arguments.get("firms"):
            # firms MUST be wrapped as [{value: firm}] — was broken (raw array)
            api_filters["firms"] = [{"value": f} for f in arguments["firms"]]

        if arguments.get("language"):
            # language MUST be wrapped as [{value: lang}]
            api_filters["languages"] = [{"value": arguments["language"]}]

        # Time period filter
        if arguments.get("reported_after"):
            # reported_after overrides reported — set special "after" mode
            api_filters["reported"] = {"value": "after"}
            api_filters["reportedAfter"] = arguments["reported_after"]
        elif arguments.get("reported"):
            api_filters["reported"] = {"value": arguments["reported"]}

        # Quality and rarity score thresholds
        if arguments.get("quality_score") is not None:
            api_filters["qualityScore"] = arguments["quality_score"]

        if arguments.get("rarity_score") is not None:
            api_filters["rarityScore"] = arguments["rarity_score"]

        # Finder count filters
        if arguments.get("min_finders") is not None:
            api_filters["minFinders"] = arguments["min_finders"]

        if arguments.get("max_finders") is not None:
            api_filters["maxFinders"] = arguments["max_finders"]

        # Auditor handle
        if arguments.get("user"):
            api_filters["user"] = arguments["user"]

        max_results = min(arguments.get("max_results", 10), 50)

        # Check cache first (5 min TTL)
        cache_key = json.dumps({"filters": api_filters, "max": max_results}, sort_keys=True)
        cached = _solodit_cache.get(cache_key)
        if cached is not None:
            cached["_cached"] = True
            return [format_response(cached)]

        # Call Solodit API
        try:
            results = await _search_solodit_api(api_key, api_filters, max_results)
            if "error" not in results:
                _solodit_cache.set(cache_key, results)
            return [format_response(results)]
        except Exception as e:
            return [format_response({
                "error": f"Solodit API call failed: {str(e)}",
                "fallback": "Use local database tools instead."
            })]

    # ═══════════════════════════════════════════════════════════════════════════
    # UNKNOWN
    # ═══════════════════════════════════════════════════════════════════════════

    return [format_response({
        "error": f"Unknown tool: {name}",
        "available_tools": [
            "analyze_code_pattern",
            "get_root_cause_analysis",
            "get_attack_vectors",
            "get_exploitation_requirements",
            "get_poc_template",
            "get_similar_exploit_code",
            "get_fix_patterns",
            "validate_hypothesis",
            "get_common_vulnerabilities",
            "get_knowledge_stats",
            "get_reachability_evidence",
            "get_controllability_evidence",
            "get_impact_precedents",
            "assess_hypothesis_strength",
            "get_similar_findings",
            "search_solodit_live",
        ]
    })]


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

# Lazily-initialized database (loaded on first tool call, not at server startup)
# This avoids blocking the MCP handshake — the 14s model load was causing
# Claude Code to timeout before the server could even respond to `initialize`.
_preloaded_db = None

def _ensure_db_loaded():
    """Lazy-load the database on first tool call (not at startup)."""
    global _preloaded_db
    if _preloaded_db is None:
        import sys
        print("Loading vulnerability database (first tool call)...", file=sys.stderr)
        try:
            _preloaded_db = get_db()
            count = _preloaded_db.collection.count()
            print(f"Database ready: {count} vulnerabilities indexed", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Database load failed: {e}", file=sys.stderr)
            _preloaded_db = "failed"
    return _preloaded_db if _preloaded_db != "failed" else None


async def _verify_solodit_api_key():
    """Verify Solodit API key at startup. Non-blocking diagnostic."""
    import sys
    api_key = (os.environ.get("SOLODIT_API_KEY") or "").strip()
    if not api_key:
        print("Solodit API: No SOLODIT_API_KEY set. Live search will be unavailable.", file=sys.stderr)
        return

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                SOLODIT_API_URL,
                headers={"Content-Type": "application/json", "X-Cyfrin-API-Key": api_key},
                json={"page": 1, "pageSize": 1, "filters": {"impact": ["HIGH"]}},
                timeout=15.0
            )
            if response.status_code == 200:
                print(f"Solodit API: Key verified OK", file=sys.stderr)
            elif response.status_code in (401, 403):
                print(f"Solodit API: Key INVALID (HTTP {response.status_code}). Get a new key from https://solodit.cyfrin.io", file=sys.stderr)
            else:
                print(f"Solodit API: Unexpected status {response.status_code}", file=sys.stderr)
    except Exception as e:
        print(f"Solodit API: Connectivity check failed: {e}. Live search may fail.", file=sys.stderr)


async def main():
    """Run the MCP server."""
    # Non-blocking API key verification at startup
    asyncio.create_task(_verify_solodit_api_key())

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


def run():
    """Entry point."""
    import asyncio, sys

    # DB loading is now LAZY (on first tool call) instead of blocking startup.
    # This lets the MCP server complete the handshake with Claude Code immediately,
    # then load the 14s sentence_transformers + ChromaDB when actually needed.
    print("unified-vuln-db server starting (DB loads on first tool call)...", file=sys.stderr)

    asyncio.run(main())


if __name__ == "__main__":
    run()
