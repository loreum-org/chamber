"""
Unified Vulnerability Schema v2.0 - Knowledge Graph Ready

Transforms flat text storage into a relational, logic-aware knowledge graph.
Designed for Claude Code programmatic access.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Literal, Dict, Any
from enum import Enum
import hashlib
import re


# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS - Strict typing for filters
# ═══════════════════════════════════════════════════════════════════════════════

class Source(str, Enum):
    SOLODIT = "solodit"
    DEFIHACKLABS = "defihacklabs"
    HUGGINGFACE = "huggingface"
    CODE4RENA = "code4rena"
    SHERLOCK = "sherlock"
    IMMUNEFI = "immunefi"
    CANTINA = "cantina"
    CUSTOM = "custom"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"
    GAS = "gas"
    UNKNOWN = "unknown"


class Category(str, Enum):
    REENTRANCY = "reentrancy"
    REENTRANCY_CROSS_FUNCTION = "reentrancy-cross-function"
    REENTRANCY_READ_ONLY = "reentrancy-read-only"
    ORACLE_MANIPULATION = "oracle-manipulation"
    ORACLE_STALE_PRICE = "oracle-stale-price"
    ACCESS_CONTROL = "access-control"
    ACCESS_CONTROL_MISSING = "access-control-missing"
    FLASH_LOAN = "flash-loan"
    FRONT_RUNNING = "front-running"
    SANDWICH = "sandwich"
    DOS = "dos"
    DOS_UNBOUNDED_LOOP = "dos-unbounded-loop"
    DOS_BLOCK_GAS = "dos-block-gas"
    ARITHMETIC = "arithmetic"
    ARITHMETIC_OVERFLOW = "arithmetic-overflow"
    ARITHMETIC_PRECISION = "arithmetic-precision"
    ARITHMETIC_ROUNDING = "arithmetic-rounding"
    GOVERNANCE = "governance"
    GOVERNANCE_FLASHLOAN = "governance-flashloan"
    LIQUIDATION = "liquidation"
    SIGNATURE = "signature"
    SIGNATURE_REPLAY = "signature-replay"
    SIGNATURE_MALLEABILITY = "signature-malleability"
    UPGRADE = "upgrade"
    UPGRADE_STORAGE_COLLISION = "upgrade-storage-collision"
    INITIALIZATION = "initialization"
    ERC4626 = "erc4626"
    ERC4626_INFLATION = "erc4626-inflation"
    ERC4626_FIRST_DEPOSITOR = "erc4626-first-depositor"
    CENTRALIZATION = "centralization"
    LOGIC = "logic"
    INPUT_VALIDATION = "input-validation"
    TIMESTAMP = "timestamp"
    RANDOMNESS = "randomness"
    DELEGATECALL = "delegatecall"
    SELFDESTRUCT = "selfdestruct"
    OTHER = "other"


class ProtocolType(str, Enum):
    DEX = "dex"
    DEX_AMM = "dex-amm"
    DEX_ORDERBOOK = "dex-orderbook"
    LENDING = "lending"
    LENDING_CDP = "lending-cdp"
    VAULT = "vault"
    VAULT_ERC4626 = "vault-erc4626"
    BRIDGE = "bridge"
    BRIDGE_CANONICAL = "bridge-canonical"
    STAKING = "staking"
    STAKING_LIQUID = "staking-liquid"
    GOVERNANCE = "governance"
    NFT = "nft"
    NFT_MARKETPLACE = "nft-marketplace"
    TOKEN = "token"
    TOKEN_REBASE = "token-rebase"
    DERIVATIVES = "derivatives"
    PERPETUALS = "perpetuals"
    OPTIONS = "options"
    INSURANCE = "insurance"
    ORACLE = "oracle"
    YIELD_AGGREGATOR = "yield-aggregator"
    OTHER = "other"


class PoCEngine(str, Enum):
    FOUNDRY = "foundry"
    HARDHAT = "hardhat"
    BROWNIE = "brownie"
    APE = "ape"
    OTHER = "other"
    NONE = "none"


# ═══════════════════════════════════════════════════════════════════════════════
# AST SIGNATURE GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

class ASTSignatureExtractor:
    """
    Extracts condensed logic signatures from Solidity code.
    Pattern: function_name -> call_pattern -> state_pattern
    """
    
    # Patterns that indicate dangerous operations
    CALL_PATTERNS = [
        (r'\.call\{', 'LOW_LEVEL_CALL'),
        (r'\.delegatecall\(', 'DELEGATECALL'),
        (r'\.staticcall\(', 'STATICCALL'),
        (r'\.transfer\(', 'TRANSFER'),
        (r'\.send\(', 'SEND'),
        (r'safeTransfer\(', 'SAFE_TRANSFER'),
        (r'safeTransferFrom\(', 'SAFE_TRANSFER_FROM'),
        (r'transferFrom\(', 'TRANSFER_FROM'),
    ]
    
    STATE_PATTERNS = [
        (r'balanceOf\[.*\]\s*[+\-*/]?=', 'BALANCE_UPDATE'),
        (r'balance\s*[+\-*/]?=', 'BALANCE_UPDATE'),
        (r'totalSupply\s*[+\-*/]?=', 'SUPPLY_UPDATE'),
        (r'mapping\s*\(.*\)\s*.*\s*[+\-*/]?=', 'MAPPING_UPDATE'),
        (r'_mint\(', 'MINT'),
        (r'_burn\(', 'BURN'),
        (r'allowance\[.*\]\s*=', 'ALLOWANCE_UPDATE'),
    ]
    
    MODIFIER_PATTERNS = [
        (r'nonReentrant', 'REENTRANCY_GUARD'),
        (r'onlyOwner', 'ONLY_OWNER'),
        (r'onlyRole', 'ROLE_CHECK'),
        (r'whenNotPaused', 'PAUSE_CHECK'),
        (r'initializer', 'INITIALIZER'),
    ]
    
    @classmethod
    def extract(cls, code: str, function_name: str = "") -> str:
        """Extract AST signature from Solidity code."""
        if not code:
            return "EMPTY"
        
        signatures = []
        
        # Find function context
        if function_name:
            signatures.append(f"FN:{function_name}")
        
        # Detect modifiers
        for pattern, name in cls.MODIFIER_PATTERNS:
            if re.search(pattern, code):
                signatures.append(f"MOD:{name}")
        
        # Detect call patterns (ORDER MATTERS for CEI detection)
        call_positions = []
        for pattern, name in cls.CALL_PATTERNS:
            matches = list(re.finditer(pattern, code))
            for m in matches:
                call_positions.append((m.start(), f"CALL:{name}"))
        
        # Detect state patterns
        state_positions = []
        for pattern, name in cls.STATE_PATTERNS:
            matches = list(re.finditer(pattern, code))
            for m in matches:
                state_positions.append((m.start(), f"STATE:{name}"))
        
        # Sort by position to detect CEI violations
        all_ops = sorted(call_positions + state_positions, key=lambda x: x[0])
        
        # Check for CEI violation (external call before state update)
        has_cei_violation = False
        last_call_pos = -1
        for pos, op in all_ops:
            if op.startswith("CALL:"):
                last_call_pos = pos
            elif op.startswith("STATE:") and last_call_pos >= 0 and last_call_pos < pos:
                # State update AFTER external call = potential reentrancy
                has_cei_violation = True
        
        if has_cei_violation:
            signatures.append("PATTERN:CEI_VIOLATION")
        
        # Add unique operations
        seen = set()
        for _, op in all_ops:
            if op not in seen:
                signatures.append(op)
                seen.add(op)
        
        return " -> ".join(signatures) if signatures else "SIMPLE"


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN VULNERABILITY MODEL
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class Vulnerability:
    """
    Rich vulnerability representation for graph-enhanced RAG.
    
    Key additions over v1:
    - diff_patch: The actual fix
    - ast_signature: Logic flow signature for semantic matching
    - poc_engine: Which framework runs the PoC
    - related_nodes: Graph edges for traversal
    """
    
    # ═══ REQUIRED FIELDS (no defaults) ═══
    id: str
    source: str  # Source enum value
    category: str  # Category enum value
    severity: str  # Severity enum value
    protocol_type: str  # ProtocolType enum value
    title: str
    description: str
    
    # ═══ OPTIONAL FIELDS (with defaults) ═══
    
    # Identification
    source_id: str = ""  # Original ID from source platform
    
    # Classification
    subcategory: str = ""  # More specific categorization
    
    # Content
    impact: str = ""
    root_cause: str = ""
    attack_vector: str = ""
    
    # Code artifacts
    vulnerable_code: str = ""  # The buggy code
    fixed_code: str = ""  # The corrected code
    diff_patch: str = ""  # Git-style diff of the fix
    
    # AST/Logic signature
    ast_signature: str = ""  # Condensed logic: "FN:withdraw -> CALL:LOW_LEVEL_CALL -> STATE:BALANCE_UPDATE"
    affected_functions: List[str] = field(default_factory=list)  # ["withdraw", "transfer"]
    affected_contracts: List[str] = field(default_factory=list)  # ["Vault", "Token"]
    
    # Proof of Concept
    has_poc: bool = False
    poc_code: str = ""  # Full PoC source
    poc_path: str = ""  # Path to PoC file
    poc_engine: str = PoCEngine.NONE.value  # "foundry" | "hardhat" | etc.
    poc_commands: List[str] = field(default_factory=list)  # ["forge test --match-test testExploit"]
    
    # Metadata
    protocol_name: str = ""
    audit_firm: str = ""
    auditor: str = ""  # Individual auditor if known
    date: str = ""
    url: str = ""
    recommendation: str = ""
    
    # Graph edges
    related_nodes: List[str] = field(default_factory=list)
    # Format: ["auditor:trail-of-bits", "pattern:cei-violation", "library:openzeppelin", "cwe:CWE-841"]
    
    # Quantitative
    amount_lost: str = ""
    tx_hash: str = ""
    cvss_score: float = 0.0
    
    # Tags
    tags: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        """Auto-generate AST signature if code is provided."""
        if self.vulnerable_code and not self.ast_signature:
            func_name = self.affected_functions[0] if self.affected_functions else ""
            self.ast_signature = ASTSignatureExtractor.extract(self.vulnerable_code, func_name)
        
        # Auto-detect PoC engine
        if self.poc_code and self.poc_engine == PoCEngine.NONE.value:
            if "forge-std" in self.poc_code or "vm." in self.poc_code:
                self.poc_engine = PoCEngine.FOUNDRY.value
            elif "hardhat" in self.poc_code or "ethers" in self.poc_code:
                self.poc_engine = PoCEngine.HARDHAT.value
    
    def to_document(self) -> str:
        """
        Convert to searchable document text.
        Optimized for code-aware embeddings.
        """
        parts = [
            f"# {self.title}",
            f"Category: {self.category}",
            f"Severity: {self.severity}",
            f"Protocol: {self.protocol_type}",
            f"AST Pattern: {self.ast_signature}",
            "",
            f"## Description",
            self.description,
        ]
        
        if self.root_cause:
            parts.extend(["", f"## Root Cause", self.root_cause])
        if self.attack_vector:
            parts.extend(["", f"## Attack Vector", self.attack_vector])
        if self.impact:
            parts.extend(["", f"## Impact", self.impact])
        if self.vulnerable_code:
            parts.extend(["", f"## Vulnerable Code", f"```solidity", self.vulnerable_code[:2000], "```"])
        if self.recommendation:
            parts.extend(["", f"## Fix", self.recommendation])
        if self.affected_functions:
            parts.extend(["", f"Functions: {', '.join(self.affected_functions)}"])
        if self.tags:
            parts.extend(["", f"Tags: {', '.join(self.tags)}"])
            
        return "\n".join(parts)
    
    def to_metadata(self) -> Dict[str, Any]:
        """
        Convert to ChromaDB metadata.
        All values must be str, int, float, or bool (ChromaDB limitation).
        """
        return {
            "id": self.id,
            "source": self.source,
            "source_id": self.source_id,
            "category": self.category,
            "subcategory": self.subcategory,
            "severity": self.severity,
            "protocol_type": self.protocol_type,
            "protocol_name": self.protocol_name,
            "title": self.title,
            "ast_signature": self.ast_signature,
            "has_poc": self.has_poc,
            "poc_engine": self.poc_engine,
            "has_diff": bool(self.diff_patch),
            "date": self.date,
            "url": self.url,
            "audit_firm": self.audit_firm,
            "auditor": self.auditor,
            "amount_lost": self.amount_lost,
            "cvss_score": self.cvss_score,
            # Flatten lists for ChromaDB
            "tags": ",".join(self.tags) if self.tags else "",
            "affected_functions": ",".join(self.affected_functions) if self.affected_functions else "",
            "related_nodes": ",".join(self.related_nodes) if self.related_nodes else "",
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Full serialization for JSON API responses.
        This is what Claude Code sees.
        """
        return {
            "id": self.id,
            "source": self.source,
            "source_id": self.source_id,
            "category": self.category,
            "subcategory": self.subcategory,
            "severity": self.severity,
            "protocol_type": self.protocol_type,
            "title": self.title,
            "description": self.description,
            "impact": self.impact,
            "root_cause": self.root_cause,
            "attack_vector": self.attack_vector,
            "vulnerable_code": self.vulnerable_code,
            "fixed_code": self.fixed_code,
            "diff_patch": self.diff_patch,
            "ast_signature": self.ast_signature,
            "affected_functions": self.affected_functions,
            "affected_contracts": self.affected_contracts,
            "has_poc": self.has_poc,
            "poc_code": self.poc_code,
            "poc_path": self.poc_path,
            "poc_engine": self.poc_engine,
            "poc_commands": self.poc_commands,
            "protocol_name": self.protocol_name,
            "audit_firm": self.audit_firm,
            "auditor": self.auditor,
            "date": self.date,
            "url": self.url,
            "recommendation": self.recommendation,
            "related_nodes": self.related_nodes,
            "amount_lost": self.amount_lost,
            "tx_hash": self.tx_hash,
            "cvss_score": self.cvss_score,
            "tags": self.tags,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Vulnerability":
        """Reconstruct from dictionary."""
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


# ═══════════════════════════════════════════════════════════════════════════════
# CATEGORY DETECTION (Enhanced)
# ═══════════════════════════════════════════════════════════════════════════════

CATEGORY_KEYWORDS = {
    # ═══════════════════════════════════════════════════════════════════════════════
    # REENTRANCY VARIANTS
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.REENTRANCY: [
        "reentrancy", "re-entrancy", "reentrant", "reentering", "re-entering",
        "recursive call", "callback attack", "callback vulnerability",
        "external call before state", "cei violation", "check-effects-interactions",
        "effects before interactions", "state before call", "call before update",
        "entered again", "enters again", "re-enter", "reenter",
    ],
    Category.REENTRANCY_CROSS_FUNCTION: [
        "cross-function reentrancy", "cross function reentrancy",
        "inter-function reentrancy", "multi-function reentrancy",
        "reentrancy across functions", "different function callback",
    ],
    Category.REENTRANCY_READ_ONLY: [
        "read-only reentrancy", "view reentrancy", "staticcall reentrancy",
        "view function reentrancy", "readonly reentrancy", "read only reentrancy",
        "reentrancy through view", "view-only reentrancy",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # ORACLE VARIANTS
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.ORACLE_MANIPULATION: [
        "oracle manipulation", "price manipulation", "twap manipulation",
        "manipulate oracle", "manipulated price", "price feed manipulation",
        "spot price manipulation", "manipulate the price", "inflate price",
        "deflate price", "price can be manipulated", "manipulating the oracle",
        "oracle attack", "price oracle", "manipulated oracle",
        "latestrounddata manipulation", "chainlink manipulation",
    ],
    Category.ORACLE_STALE_PRICE: [
        "stale price", "outdated price", "price freshness", "stale data",
        "price staleness", "stale oracle", "old price", "expired price",
        "price not updated", "stale feed", "timestamp check", "heartbeat check",
        "roundid check", "updatedat", "answeredinround", "price delay",
        "no freshness check", "missing staleness", "stale chainlink",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # ACCESS CONTROL VARIANTS
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.ACCESS_CONTROL: [
        "access control", "authorization", "permission", "privilege",
        "unauthorized", "unprivileged", "access restriction", "restricted function",
        "only owner", "onlyowner", "only admin", "onlyadmin", "role check",
        "modifier missing", "missing modifier", "access modifier",
        "privilege escalation", "elevated privilege", "bypass authentication",
        "authentication bypass", "auth bypass", "access bypass",
        "anyone can call", "callable by anyone", "publicly callable",
        "no access check", "missing access check", "insufficient access",
        "role-based", "rbac", "access violation", "acl",
    ],
    Category.ACCESS_CONTROL_MISSING: [
        "missing access control", "unprotected function", "no access control",
        "lack of access control", "lacks access control", "without access control",
        "access control missing", "no restriction", "unrestricted access",
        "function is public", "should be restricted", "should be internal",
        "should be private", "exposed function", "unguarded function",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # ERC4626 / VAULT SPECIFIC
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.ERC4626: [
        "erc4626", "erc-4626", "tokenized vault", "vault standard",
        "vault share", "vault shares", "shares token", "share token",
        # Cross-ref with ARITHMETIC (share/asset calculations)
        "converttoassets", "converttoshares", "previewdeposit", "previewwithdraw",
        "previewmint", "previewredeem", "maxdeposit", "maxwithdraw",
        "maxmint", "maxredeem", "totalassets", "assetsperstore",
        # Cross-ref with LOGIC (vault operations)
        "vault accounting", "share accounting", "asset accounting",
        "deposit mint", "withdraw redeem", "virtual assets", "virtual shares",
    ],
    Category.ERC4626_INFLATION: [
        "share inflation", "share manipulation", "inflation attack",
        "vault inflation", "inflate share", "inflated share", "inflate vault",
        "donation attack", "vault donation", "donate to vault", "donated tokens",
        "exchange rate manipulation", "share price manipulation", "share value manipulation",
        "manipulate exchange rate", "manipulate share price", "skew exchange rate",
        "inflate the value", "inflate exchange rate", "inflated exchange rate",
        "dead shares", "virtual shares", "offset shares",
        "totalassets manipulation", "totalsupply manipulation",
        # Cross-ref with ARITHMETIC (calculation manipulation)
        "assets per share", "shares per asset", "dilution",
        "exchange rate calculation", "share rate", "redemption rate",
        # Cross-ref with FLASH_LOAN (flash donation)
        "flash donation", "flash mint donation", "single block inflation",
        # Cross-ref with LOGIC (direct transfer manipulation)
        "direct transfer", "transfer to vault", "unsolicited tokens",
        "balanceof manipulation", "balance manipulation",
    ],
    Category.ERC4626_FIRST_DEPOSITOR: [
        "first depositor", "first deposit attack", "first depositor attack",
        "initial depositor", "empty vault", "zero supply", "zero shares",
        "first deposit", "initial deposit", "bootstrap attack",
        "first user", "first staker", "initial staker",
        "vault is empty", "when vault is empty", "no shares minted",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # FLASH LOAN
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.FLASH_LOAN: [
        "flash loan", "flashloan", "flash-loan", "flash mint", "flashmint",
        "flash borrow", "flash attack", "instant loan", "uncollateralized loan",
        "same-block loan", "atomic loan", "flash lending",
        "aave flash", "dydx flash", "balancer flash", "uniswap flash",
        "flash callback", "flash liquidity",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # FRONT-RUNNING / MEV
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.FRONT_RUNNING: [
        "front-run", "frontrun", "front run", "frontrunning", "front-running",
        "mev", "maximal extractable", "miner extractable",
        "transaction ordering", "tx ordering", "mempool", "pending transaction",
        "race condition", "transaction race", "front runner", "frontrunner",
        "preemptive transaction", "anticipatory transaction",
        "backrun", "back-run", "back run",
        # Cross-ref with INPUT_VALIDATION (slippage protection)
        "no slippage protection", "missing slippage", "slippage vulnerability",
        "no deadline", "missing deadline", "expired transaction",
        "min amount", "max amount", "price impact",
        # Cross-ref with ORACLE (price manipulation via front-run)
        "price extracted", "arbitrage", "arbitrageur",
        # Cross-ref with GOVERNANCE (proposal front-running)
        "front-run proposal", "front-run vote", "vote extraction",
        # Cross-ref with INITIALIZATION (front-run init)
        "front-run deploy", "front-run creation",
    ],
    Category.SANDWICH: [
        "sandwich attack", "sandwich", "sandwiching", "sandwiched",
        "front and back", "buy before sell",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # DENIAL OF SERVICE
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.DOS: [
        "denial of service", "dos attack", "dos vulnerability", "dossed",
        "grief", "griefing", "griefer", "griefable",
        "block", "blocked", "blocking", "lock funds", "locked funds",
        "funds stuck", "stuck funds", "trapped funds", "freeze funds",
        "frozen funds", "freezing", "freeze contract",
        "halt", "halted", "halting", "pause attack", "permanent pause",
        "unusable", "inaccessible", "unavailable",
        "cannot withdraw", "cannot claim", "cannot redeem",
        "revert loop", "always reverts", "function reverts",
        # Additional DOS patterns
        "stuck in", "locked in", "locked forever", "permanently locked",
        "lost permanently", "permanently lost", "funds lost forever",
        "brick", "bricked", "bricking", "brick vault", "brick operations",
        "prevent", "prevents", "preventing", "prevented from",
        "unable to", "fail to claim", "fail to withdraw", "fail to redeem",
        "not recoverable", "unrecoverable", "cannot be recovered",
        "tokens locked", "tokens stuck", "tokens trapped",
        "remain locked", "remains locked", "remains stuck",
        # Claim/withdrawal DOS (cross-ref with ARITHMETIC for rewards)
        "claim fails", "claims fail", "claiming fails", "unable to claim",
        "withdrawal fails", "withdrawals fail", "unable to withdraw",
        "redeem fails", "redemption fails", "unable to redeem",
        "payout fails", "payouts fail", "pending payout", "payout stuck",
        # Bond/deposit DOS
        "bond locked", "bond stuck", "deposit stuck", "deposit locked",
        "collateral stuck", "collateral locked", "funds inaccessible",
        # Settlement/finalization DOS
        "settlement fails", "finalization fails", "settle fails",
        "queue stuck", "queue blocked", "processing stuck",
    ],
    Category.DOS_UNBOUNDED_LOOP: [
        "unbounded loop", "unbounded iteration", "infinite loop",
        "unbounded array", "array length", "loop through array",
        "iterate over", "for loop", "while loop", "loop dos",
        "gas limit", "block gas limit", "out of gas", "gas exhaustion",
        "too many iterations", "large array", "growing array",
    ],
    Category.DOS_BLOCK_GAS: [
        "block gas", "gas limit dos", "exceed gas limit",
        "gas griefing", "gas exhaustion attack", "block stuffing",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # ARITHMETIC
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.ARITHMETIC: [
        "arithmetic", "calculation error", "math error", "mathematical error",
        "computation error", "incorrect calculation", "wrong calculation",
        "miscalculation", "calculate incorrectly", "calculated incorrectly",
        # Fee calculation issues
        "fee calculation", "fee computed", "fee is incorrect", "incorrect fee",
        "wrong fee", "fee mismatch", "fee discrepancy", "fee accounting",
        "fee avoidance", "fee evasion", "uncollected fees", "fees not collected",
        "fees stuck", "performance fee", "protocol fee", "fee distribution",
        # Reward calculation issues
        "reward calculation", "reward computed", "reward is incorrect", "incorrect reward",
        "wrong reward", "reward mismatch", "reward discrepancy", "reward accounting",
        "reward distribution", "distribute reward", "claim reward", "unclaimed reward",
        "reward rate", "reward per", "rewards not", "rewards are not",
        # Generic calculation issues
        "calculation is incorrect", "calculation is wrong", "calculation mismatch",
        "computed incorrectly", "computes incorrectly", "compute incorrectly",
        "amount is incorrect", "incorrect amount", "wrong amount", "amount mismatch",
        "value is incorrect", "incorrect value", "wrong value", "value mismatch",
        "rate is incorrect", "incorrect rate", "wrong rate", "rate mismatch",
        "ratio is incorrect", "incorrect ratio", "wrong ratio", "ratio mismatch",
        "price is incorrect", "incorrect price calculation", "price calculation",
        "share price", "share calculation", "shares calculation", "share mismatch",
        "double count", "double-count", "double counting", "counted twice",
        # TVL/NAV calculation (cross-ref with ERC4626)
        "tvl calculation", "nav calculation", "total assets", "total value",
        "asset calculation", "assets calculation", "totalassets",
        # Index/accumulator issues
        "index calculation", "accumulator", "cumulative", "accrued",
        "per token", "per share", "per unit",
        # Leverage/margin calculation
        "leverage calculation", "margin calculation", "position size",
        "leverage ratio", "margin ratio", "funding rate",
        # Interest/APR calculation
        "interest calculation", "apr calculation", "apy calculation",
        "interest rate", "borrow rate", "supply rate",
        # Generic incorrect patterns (specific enough)
        "incorrectly calculated", "wrongly calculated", "miscalculated",
        "calculation ignores", "calculation does not", "calculation fails",
        "computed wrong", "computes wrong", "math is wrong",
    ],
    Category.ARITHMETIC_OVERFLOW: [
        "overflow", "underflow", "integer overflow", "integer underflow",
        "uint overflow", "uint underflow", "wraparound", "wrap around",
        "unchecked arithmetic", "unchecked math", "unchecked block",
    ],
    Category.ARITHMETIC_PRECISION: [
        "precision", "precision loss", "loss of precision", "precision error",
        "decimal precision", "significant digits", "floating point",
        "fixed point", "scaling", "scale factor", "magnitude",
        "truncation", "truncate", "truncated",
    ],
    Category.ARITHMETIC_ROUNDING: [
        "rounding", "rounding error", "round down", "round up", "rounddown", "roundup",
        "division before multiplication", "divide before multiply",
        "mul before div", "div before mul", "division rounding",
        "rounding direction", "favor rounding", "rounding issue",
        "rounds to zero", "rounded to zero", "dust", "dust amount",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # GOVERNANCE
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.GOVERNANCE: [
        "governance", "voting", "vote", "proposal", "propose",
        "quorum", "threshold", "ballot", "election", "delegate",
        "delegation", "voting power", "vote weight", "governance token",
        "dao", "decentralized autonomous", "timelock", "time lock",
        "veto", "execute proposal", "proposal execution",
        # Cross-ref with ARITHMETIC (voting calculations)
        "voting calculation", "quorum calculation", "vote count",
        "weight calculation", "snapshot", "checkpoint",
        # Cross-ref with ACCESS_CONTROL (proposal permissions)
        "proposal threshold", "proposer", "executor", "guardian",
        "cancel proposal", "proposal access",
        # Cross-ref with TIMESTAMP (timelock/delays)
        "execution delay", "voting period", "voting delay",
        "grace period", "expiration period", "proposal expiry",
        # Cross-ref with LOGIC (governance logic)
        "double voting", "vote twice", "votes counted", "uncounted votes",
    ],
    Category.GOVERNANCE_FLASHLOAN: [
        "governance flash", "flash loan governance", "flash vote",
        "borrow voting power", "instant voting power",
        "flash loan voting", "governance manipulation via flash",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # LIQUIDATION
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.LIQUIDATION: [
        "liquidation", "liquidate", "liquidator", "liquidatable",
        "collateral", "collateralization", "undercollateralized", "overcollateralized",
        "health factor", "ltv", "loan-to-value", "loan to value",
        "bad debt", "insolvent", "insolvency", "underwater",
        "liquidation bonus", "liquidation penalty", "liquidation threshold",
        "margin call", "position liquidation", "force liquidation",
        "self-liquidation", "soft liquidation", "hard liquidation",
        # Cross-ref with ARITHMETIC (calculation issues)
        "health factor calculation", "collateral ratio", "debt ratio",
        "borrow limit", "borrow capacity", "liquidation price",
        "collateral value", "debt value", "position value",
        # Cross-ref with ORACLE (price-based liquidation)
        "price-based liquidation", "stale price liquidation",
        "manipulated liquidation", "unfair liquidation", "premature liquidation",
        # Cross-ref with DOS (liquidation blocked)
        "liquidation blocked", "unliquidatable", "cannot liquidate",
        "liquidation dos", "liquidation reverts", "liquidation fails",
        # Cross-ref with FLASH_LOAN (flash liquidation)
        "flash liquidation", "atomic liquidation",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # SIGNATURE
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.SIGNATURE: [
        "signature", "ecrecover", "ecdsa", "signing", "signed message",
        "eip-712", "eip712", "typed data", "domain separator",
        "permit", "permit2", "signaturechecker", "isvalidsignature",
        "verify signature", "signature verification", "invalid signature",
        "signature validation", "cryptographic signature",
        # Cross-ref with ACCESS_CONTROL (signature as auth)
        "signature authentication", "signed authorization", "off-chain approval",
        "meta-transaction", "metatransaction", "gasless", "relayer",
        "trusted signer", "signer validation", "recovered signer",
        # Cross-ref with INPUT_VALIDATION (signature format)
        "signature length", "signature format", "v r s", "compact signature",
        "malleable", "non-malleable", "signature bytes",
    ],
    Category.SIGNATURE_REPLAY: [
        "signature replay", "replay attack", "replay vulnerability",
        "nonce", "missing nonce", "nonce reuse", "reuse signature",
        "signature reuse", "replayed signature", "replay protection",
        "chain id", "missing chain id", "cross-chain replay",
    ],
    Category.SIGNATURE_MALLEABILITY: [
        "signature malleability", "malleable signature", "s value",
        "signature manipulation", "ecdsa malleability", "secp256k1 malleability",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # UPGRADE / PROXY
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.UPGRADE: [
        "upgrade", "proxy", "upgradeable", "upgradability", "upgradeability",
        "implementation", "logic contract", "transparent proxy", "uups",
        "beacon proxy", "minimal proxy", "clone", "eip-1967", "eip1967",
        "delegatecall proxy", "proxy admin", "proxy pattern",
        # Cross-ref with ACCESS_CONTROL (upgrade permissions)
        "unauthorized upgrade", "upgrade access", "upgrade permission",
        "upgradeto", "upgradetoandcall", "_authorizeupgrade",
        # Cross-ref with INITIALIZATION (upgrade + reinit)
        "upgrade initialization", "post-upgrade", "migration",
        "data migration", "state migration", "version upgrade",
        # Cross-ref with LOGIC (upgrade breaks functionality)
        "upgrade breaks", "broken after upgrade", "incompatible upgrade",
        "function selector clash", "selector collision",
    ],
    Category.UPGRADE_STORAGE_COLLISION: [
        "storage collision", "storage slot", "slot collision", "storage layout",
        "storage gap", "gap variable", "__gap", "layout collision",
        "storage conflict", "variable ordering", "inheritance order",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # INITIALIZATION
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.INITIALIZATION: [
        "initialize", "initializer", "initialization", "uninitialize",
        "uninitialized", "not initialized", "missing initialization",
        "double initialization", "reinitialize", "reinitializer",
        "constructor", "init function", "setup function",
        "front-run initialize", "frontrun initialize", "initialize attack",
        "initializable", "initialized state", "onlyinitializing",
        # Cross-ref with ACCESS_CONTROL (init permissions)
        "anyone can initialize", "public initializer", "unprotected init",
        "init access control", "initialization access",
        # Cross-ref with UPGRADE (reinitializer)
        "reinitializer missing", "missing reinitializer", "version mismatch",
        "v2 initialization", "upgrade init", "post-upgrade init",
        # Cross-ref with LOGIC (default/zero values)
        "default value", "zero initialization", "unset variable",
        "constructor arguments", "immutable initialization",
        "state not set", "variable not set", "parameter not set",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # CENTRALIZATION
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.CENTRALIZATION: [
        "centralization", "centralized", "single point of failure",
        "rug pull", "rugpull", "rug-pull", "trusted admin", "admin key",
        "owner privilege", "owner can", "admin can", "privileged role",
        "multisig", "multi-sig", "key management", "key compromise",
        "backdoor", "back door", "emergency function", "emergency withdraw",
        "pause all", "freeze all", "admin abuse", "owner abuse",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # LOGIC / BUSINESS LOGIC
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.LOGIC: [
        "logic", "business logic", "logic error", "logic flaw", "logic bug",
        "logical error", "logical flaw", "design flaw", "design error",
        "incorrect logic", "wrong logic", "flawed logic",
        "state inconsistency", "inconsistent state", "state mismatch",
        "unexpected behavior", "unintended behavior", "incorrect behavior",
        "edge case", "corner case", "boundary case", "special case",
        "incorrect assumption", "wrong assumption", "false assumption",
        "accounting error", "accounting mismatch", "balance mismatch",
        "invariant", "invariant violation", "broken invariant",
        "incorrect order", "wrong order", "order of operations",
        "missing check", "missing validation", "skipped check",
        "bypass", "bypassed", "bypassing", "circumvent", "circumvented",
        "can be gamed", "gaming", "exploit logic", "abuse logic",
        # State/update issues (cross-ref with DOS)
        "state not updated", "not synchronized", "out of sync", "desync",
        "stale state", "outdated state", "missing update", "update missing",
        # Transfer/accounting issues (cross-ref with ARITHMETIC)
        "transfer to wrong", "sent to wrong", "tokens sent to", "funds sent to",
        "double accounting", "accounting issue", "balance tracking",
        # Fee/reward logic issues (cross-ref with ARITHMETIC)
        "fee logic", "reward logic", "distribution logic", "claim logic",
        "payout logic", "rebate", "rebates not paid", "not distributed",
        # Assembly/encoding issues
        "assembly", "inline assembly", "yul", "encoding", "decoding",
        "abi encode", "abi decode", "packing", "unpacking", "bit manipulation",
        # Data structure issues
        "array index", "mapping key", "struct packing",
        "data corruption", "data loss", "overwrite data", "overwrites data",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # INPUT VALIDATION
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.INPUT_VALIDATION: [
        "input validation", "parameter validation", "argument validation",
        "missing validation", "lack of validation", "no validation",
        "unchecked input", "unchecked parameter", "unvalidated input",
        "insufficient validation", "improper validation", "weak validation",
        "sanitization", "sanitize", "unsanitized", "input sanitization",
        "boundary check", "bounds check", "range check", "length check",
        "zero address", "address(0)", "zero check", "null check",
        "empty array", "empty string", "empty input",
        "type confusion", "type coercion", "invalid type",
        "malformed input", "malicious input", "crafted input",
        # Cross-ref with ARITHMETIC (zero/overflow validation)
        "division by zero", "divide by zero", "zero divisor", "zero denominator",
        "negative value", "negative amount", "underflow check",
        "overflow check", "max uint", "type(uint256).max",
        # Cross-ref with ACCESS_CONTROL (address validation)
        "invalid address", "wrong address", "address validation",
        "caller validation", "sender validation", "recipient validation",
        # Cross-ref with DOS (input causes revert)
        "revert on invalid", "fails on invalid", "malformed data causes",
        "invalid calldata", "calldata validation", "selector validation",
        # Slippage/deadline validation (cross-ref with FRONT_RUNNING)
        "slippage", "slippage check", "slippage protection", "min output",
        "minimum output", "max input", "maximum input", "amount out min",
        "deadline", "deadline check", "expired deadline", "stale deadline",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # TIMESTAMP
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.TIMESTAMP: [
        "timestamp", "block.timestamp", "block timestamp",
        "time manipulation", "timestamp manipulation", "timestamp dependence",
        "deadline", "expiration", "expiry", "time lock", "timelock",
        "time-based", "time based", "timing", "time window",
        "block number", "block.number", "blockhash",
        "now", "current time", "current block",
        "stale timestamp", "old timestamp", "timestamp check",
        # Cross-ref with ARITHMETIC (time calculations)
        "duration calculation", "elapsed time", "time delta",
        "seconds per", "blocks per", "epoch", "period",
        "interval", "cooldown", "lockup period", "vesting",
        # Cross-ref with ORACLE (staleness)
        "staleness check", "freshness", "last update", "update time",
        # Cross-ref with GOVERNANCE (voting periods)
        "voting window", "proposal window", "execution window",
        # Cross-ref with DOS (time-based DOS)
        "expired", "too late", "too early", "not yet", "already passed",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # RANDOMNESS
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.RANDOMNESS: [
        "randomness", "random", "rng", "random number",
        "predictable", "predictability", "deterministic",
        "vrf", "chainlink vrf", "verifiable random",
        "block hash", "blockhash", "prevrandao", "difficulty",
        "seed", "entropy", "pseudo-random", "pseudorandom",
        "commit reveal", "commit-reveal", "randomness source",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # DELEGATECALL
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.DELEGATECALL: [
        "delegatecall", "delegate call", "delegated call",
        "context preservation", "storage context", "msg.sender preservation",
        "arbitrary delegatecall", "unchecked delegatecall",
        "delegatecall to untrusted", "library delegatecall",
    ],

    # ═══════════════════════════════════════════════════════════════════════════════
    # SELFDESTRUCT
    # ═══════════════════════════════════════════════════════════════════════════════
    Category.SELFDESTRUCT: [
        "selfdestruct", "self destruct", "self-destruct",
        "suicide", "contract destruction", "destroy contract",
        "force ether", "forced ether", "force eth",
    ],
}


def detect_category(text: str) -> str:
    """Detect vulnerability category from text with subcategory support."""
    text_lower = text.lower()

    # Check specific subcategories first (more specific patterns before general ones)
    subcategories_priority = [
        # Reentrancy subcategories
        Category.REENTRANCY_READ_ONLY,
        Category.REENTRANCY_CROSS_FUNCTION,
        # ERC4626 subcategories
        Category.ERC4626_FIRST_DEPOSITOR,
        Category.ERC4626_INFLATION,
        # Oracle subcategories
        Category.ORACLE_STALE_PRICE,
        # Access control subcategories
        Category.ACCESS_CONTROL_MISSING,
        # DoS subcategories
        Category.DOS_UNBOUNDED_LOOP,
        Category.DOS_BLOCK_GAS,
        # Arithmetic subcategories
        Category.ARITHMETIC_OVERFLOW,
        Category.ARITHMETIC_PRECISION,
        Category.ARITHMETIC_ROUNDING,
        # Governance subcategories
        Category.GOVERNANCE_FLASHLOAN,
        # Signature subcategories
        Category.SIGNATURE_REPLAY,
        Category.SIGNATURE_MALLEABILITY,
        # Upgrade subcategories
        Category.UPGRADE_STORAGE_COLLISION,
    ]

    for category in subcategories_priority:
        keywords = CATEGORY_KEYWORDS.get(category, [])
        for kw in keywords:
            if kw in text_lower:
                return category.value

    # Then check general categories (order matters - more specific first)
    general_categories_priority = [
        # More specific categories first
        Category.ERC4626,
        Category.ORACLE_MANIPULATION,
        Category.REENTRANCY,
        Category.ACCESS_CONTROL,
        Category.FLASH_LOAN,
        Category.FRONT_RUNNING,
        Category.SANDWICH,
        Category.DOS,
        Category.ARITHMETIC,
        Category.GOVERNANCE,
        Category.LIQUIDATION,
        Category.SIGNATURE,
        Category.UPGRADE,
        Category.INITIALIZATION,
        Category.CENTRALIZATION,
        Category.LOGIC,
        Category.INPUT_VALIDATION,
        Category.TIMESTAMP,
        Category.RANDOMNESS,
        Category.DELEGATECALL,
        Category.SELFDESTRUCT,
    ]

    for category in general_categories_priority:
        keywords = CATEGORY_KEYWORDS.get(category, [])
        for kw in keywords:
            if kw in text_lower:
                return category.value

    return Category.OTHER.value


def detect_protocol_type(text: str) -> str:
    """Detect protocol type from text."""
    text_lower = text.lower()
    
    mappings = {
        ProtocolType.DEX_AMM: ["amm", "liquidity pool", "uniswap", "curve", "balancer"],
        ProtocolType.VAULT_ERC4626: ["erc4626", "erc-4626"],
        ProtocolType.LENDING_CDP: ["cdp", "maker", "collateralized debt"],
        ProtocolType.STAKING_LIQUID: ["liquid staking", "lido", "rocket pool"],
        ProtocolType.DEX: ["dex", "swap", "exchange"],
        ProtocolType.LENDING: ["lending", "borrow", "aave", "compound"],
        ProtocolType.VAULT: ["vault", "yield", "yearn"],
        ProtocolType.BRIDGE: ["bridge", "cross-chain"],
        ProtocolType.STAKING: ["staking", "stake"],
        ProtocolType.GOVERNANCE: ["governance", "dao"],
        ProtocolType.PERPETUALS: ["perpetual", "perp"],
        ProtocolType.OPTIONS: ["options"],
        ProtocolType.NFT_MARKETPLACE: ["marketplace", "opensea"],
        ProtocolType.NFT: ["nft", "erc721"],
        ProtocolType.ORACLE: ["oracle", "chainlink"],
    }
    
    for ptype, keywords in mappings.items():
        for kw in keywords:
            if kw in text_lower:
                return ptype.value
    
    return ProtocolType.OTHER.value


def normalize_severity(text: str) -> str:
    """Normalize severity string."""
    text_lower = text.lower().strip()
    
    if "critical" in text_lower:
        return Severity.CRITICAL.value
    elif "high" in text_lower:
        return Severity.HIGH.value
    elif "medium" in text_lower or "med" in text_lower:
        return Severity.MEDIUM.value
    elif "low" in text_lower:
        return Severity.LOW.value
    elif "info" in text_lower or "qa" in text_lower:
        return Severity.INFO.value
    elif "gas" in text_lower:
        return Severity.GAS.value
    
    return Severity.UNKNOWN.value
