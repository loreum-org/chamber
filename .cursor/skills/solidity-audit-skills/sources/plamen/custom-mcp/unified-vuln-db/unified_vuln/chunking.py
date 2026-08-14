"""
Logic-Aware Solidity Chunker

Splits Solidity code by AST nodes (Functions, Modifiers, Contracts),
NOT by character count. Preserves semantic boundaries for better embeddings.
"""

import re
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any
from enum import Enum


class ChunkType(str, Enum):
    CONTRACT = "contract"
    INTERFACE = "interface"
    LIBRARY = "library"
    FUNCTION = "function"
    MODIFIER = "modifier"
    EVENT = "event"
    ERROR = "error"
    STRUCT = "struct"
    ENUM = "enum"
    STATE_VARIABLE = "state_variable"
    CONSTRUCTOR = "constructor"
    FALLBACK = "fallback"
    RECEIVE = "receive"
    IMPORT = "import"
    PRAGMA = "pragma"


@dataclass
class CodeChunk:
    """A semantic chunk of Solidity code."""
    chunk_type: ChunkType
    name: str
    code: str
    start_line: int
    end_line: int
    parent_contract: str = ""
    visibility: str = ""  # public, private, internal, external
    modifiers: List[str] = None
    parameters: List[str] = None
    returns: List[str] = None
    state_mutability: str = ""  # pure, view, payable, nonpayable
    
    def __post_init__(self):
        if self.modifiers is None:
            self.modifiers = []
        if self.parameters is None:
            self.parameters = []
        if self.returns is None:
            self.returns = []
    
    def to_document(self) -> str:
        """Convert to searchable document."""
        parts = [
            f"Type: {self.chunk_type.value}",
            f"Name: {self.name}",
        ]
        if self.parent_contract:
            parts.append(f"Contract: {self.parent_contract}")
        if self.visibility:
            parts.append(f"Visibility: {self.visibility}")
        if self.modifiers:
            parts.append(f"Modifiers: {', '.join(self.modifiers)}")
        if self.state_mutability:
            parts.append(f"Mutability: {self.state_mutability}")
        
        parts.extend(["", "```solidity", self.code, "```"])
        return "\n".join(parts)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize for JSON."""
        return {
            "chunk_type": self.chunk_type.value,
            "name": self.name,
            "code": self.code,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "parent_contract": self.parent_contract,
            "visibility": self.visibility,
            "modifiers": self.modifiers,
            "parameters": self.parameters,
            "returns": self.returns,
            "state_mutability": self.state_mutability,
        }


class SolidityChunker:
    """
    AST-aware Solidity code chunker.
    
    Key features:
    - Preserves full function definitions with context
    - Extracts modifiers and visibility
    - Maintains parent contract relationships
    - Handles nested structures
    """
    
    # Regex patterns for Solidity constructs
    PATTERNS = {
        'pragma': re.compile(r'^(\s*pragma\s+[^;]+;)', re.MULTILINE),
        'import': re.compile(r'^(\s*import\s+[^;]+;)', re.MULTILINE),
        'contract': re.compile(
            r'^(\s*(?:abstract\s+)?contract\s+(\w+)(?:\s+is\s+[^{]+)?\s*\{)',
            re.MULTILINE
        ),
        'interface': re.compile(
            r'^(\s*interface\s+(\w+)(?:\s+is\s+[^{]+)?\s*\{)',
            re.MULTILINE
        ),
        'library': re.compile(
            r'^(\s*library\s+(\w+)\s*\{)',
            re.MULTILINE
        ),
        'function': re.compile(
            r'^(\s*function\s+(\w+)\s*\([^)]*\)(?:\s+(?:public|private|internal|external|view|pure|payable|virtual|override|returns\s*\([^)]*\)|[A-Z]\w+(?:\([^)]*\))?)\s*)*\s*(?:\{|;))',
            re.MULTILINE
        ),
        'constructor': re.compile(
            r'^(\s*constructor\s*\([^)]*\)(?:\s+(?:public|internal|payable|[A-Z]\w+(?:\([^)]*\))?)\s*)*\s*\{)',
            re.MULTILINE
        ),
        'modifier': re.compile(
            r'^(\s*modifier\s+(\w+)\s*(?:\([^)]*\))?\s*\{)',
            re.MULTILINE
        ),
        'event': re.compile(
            r'^(\s*event\s+(\w+)\s*\([^)]*\)\s*;)',
            re.MULTILINE
        ),
        'error': re.compile(
            r'^(\s*error\s+(\w+)\s*\([^)]*\)\s*;)',
            re.MULTILINE
        ),
        'struct': re.compile(
            r'^(\s*struct\s+(\w+)\s*\{)',
            re.MULTILINE
        ),
        'enum': re.compile(
            r'^(\s*enum\s+(\w+)\s*\{)',
            re.MULTILINE
        ),
        'fallback': re.compile(
            r'^(\s*fallback\s*\([^)]*\)(?:\s+(?:external|payable|virtual|override)\s*)*\s*\{)',
            re.MULTILINE
        ),
        'receive': re.compile(
            r'^(\s*receive\s*\([^)]*\)\s+external\s+payable(?:\s+(?:virtual|override)\s*)*\s*\{)',
            re.MULTILINE
        ),
    }
    
    # Visibility keywords
    VISIBILITY = ['public', 'private', 'internal', 'external']
    MUTABILITY = ['pure', 'view', 'payable']
    
    def __init__(self, include_context: bool = True, max_context_lines: int = 5):
        """
        Args:
            include_context: Include surrounding comments/natspec
            max_context_lines: Max lines of context to include
        """
        self.include_context = include_context
        self.max_context_lines = max_context_lines
    
    def chunk(self, code: str) -> List[CodeChunk]:
        """
        Split Solidity code into semantic chunks.
        
        Returns list of CodeChunks preserving AST structure.
        """
        if not code or not code.strip():
            return []
        
        chunks = []
        lines = code.split('\n')
        
        # Find all contract-level constructs
        contracts = self._find_contracts(code)
        
        for contract_name, contract_code, contract_start in contracts:
            # Extract functions from this contract
            functions = self._extract_functions(contract_code, contract_name, contract_start, lines)
            chunks.extend(functions)
            
            # Extract modifiers
            modifiers = self._extract_modifiers(contract_code, contract_name, contract_start, lines)
            chunks.extend(modifiers)
            
            # Extract events
            events = self._extract_events(contract_code, contract_name, contract_start)
            chunks.extend(events)
            
            # Add the contract itself as a chunk (header + state variables)
            contract_chunk = self._create_contract_chunk(contract_name, contract_code, contract_start, lines)
            if contract_chunk:
                chunks.append(contract_chunk)
        
        # Handle top-level items (interfaces, libraries without internal functions)
        if not contracts:
            # Treat entire code as one chunk
            chunks.append(CodeChunk(
                chunk_type=ChunkType.CONTRACT,
                name="unknown",
                code=code,
                start_line=1,
                end_line=len(lines),
            ))
        
        return chunks
    
    def _find_contracts(self, code: str) -> List[Tuple[str, str, int]]:
        """Find all contract/interface/library definitions."""
        results = []
        
        for pattern_type in ['contract', 'interface', 'library']:
            pattern = self.PATTERNS[pattern_type]
            for match in pattern.finditer(code):
                name = match.group(2)
                start_pos = match.start()
                
                # Find matching closing brace
                brace_count = 0
                in_contract = False
                end_pos = start_pos
                
                for i, char in enumerate(code[start_pos:], start_pos):
                    if char == '{':
                        brace_count += 1
                        in_contract = True
                    elif char == '}':
                        brace_count -= 1
                        if in_contract and brace_count == 0:
                            end_pos = i + 1
                            break
                
                contract_code = code[start_pos:end_pos]
                start_line = code[:start_pos].count('\n') + 1
                results.append((name, contract_code, start_line))
        
        return results
    
    def _extract_functions(
        self, 
        contract_code: str, 
        contract_name: str, 
        base_line: int,
        all_lines: List[str]
    ) -> List[CodeChunk]:
        """Extract all functions from a contract."""
        chunks = []
        
        # Match function signatures
        func_pattern = re.compile(
            r'function\s+(\w+)\s*\(([^)]*)\)'
            r'((?:\s+(?:public|private|internal|external|view|pure|payable|virtual|override|returns\s*\([^)]*\)|[A-Z]\w+(?:\([^)]*\))?)\s*)*)'
            r'\s*(\{|;)',
            re.MULTILINE
        )
        
        for match in func_pattern.finditer(contract_code):
            func_name = match.group(1)
            params_str = match.group(2)
            modifiers_str = match.group(3)
            has_body = match.group(4) == '{'
            
            start_pos = match.start()
            
            if has_body:
                # Find function body
                func_code = self._extract_block(contract_code, start_pos)
            else:
                # Interface function (no body)
                func_code = match.group(0)
            
            # Parse visibility and modifiers
            visibility = self._extract_visibility(modifiers_str)
            mutability = self._extract_mutability(modifiers_str)
            mods = self._extract_modifiers_list(modifiers_str)
            params = self._parse_parameters(params_str)
            returns = self._extract_returns(modifiers_str)
            
            # Calculate line numbers
            start_line = base_line + contract_code[:start_pos].count('\n')
            end_line = start_line + func_code.count('\n')
            
            # Include NatSpec context
            if self.include_context:
                context = self._get_natspec_context(all_lines, start_line - 1)
                if context:
                    func_code = context + "\n" + func_code
            
            chunks.append(CodeChunk(
                chunk_type=ChunkType.FUNCTION,
                name=func_name,
                code=func_code,
                start_line=start_line,
                end_line=end_line,
                parent_contract=contract_name,
                visibility=visibility,
                modifiers=mods,
                parameters=params,
                returns=returns,
                state_mutability=mutability,
            ))
        
        # Also extract constructor
        constr_pattern = self.PATTERNS['constructor']
        for match in constr_pattern.finditer(contract_code):
            start_pos = match.start()
            constr_code = self._extract_block(contract_code, start_pos)
            start_line = base_line + contract_code[:start_pos].count('\n')
            
            chunks.append(CodeChunk(
                chunk_type=ChunkType.CONSTRUCTOR,
                name="constructor",
                code=constr_code,
                start_line=start_line,
                end_line=start_line + constr_code.count('\n'),
                parent_contract=contract_name,
            ))
        
        # Extract fallback and receive
        for func_type in ['fallback', 'receive']:
            pattern = self.PATTERNS[func_type]
            for match in pattern.finditer(contract_code):
                start_pos = match.start()
                func_code = self._extract_block(contract_code, start_pos)
                start_line = base_line + contract_code[:start_pos].count('\n')
                
                chunks.append(CodeChunk(
                    chunk_type=ChunkType.FALLBACK if func_type == 'fallback' else ChunkType.RECEIVE,
                    name=func_type,
                    code=func_code,
                    start_line=start_line,
                    end_line=start_line + func_code.count('\n'),
                    parent_contract=contract_name,
                    visibility="external",
                ))
        
        return chunks
    
    def _extract_modifiers(
        self, 
        contract_code: str, 
        contract_name: str, 
        base_line: int,
        all_lines: List[str]
    ) -> List[CodeChunk]:
        """Extract all modifiers from a contract."""
        chunks = []
        pattern = self.PATTERNS['modifier']
        
        for match in pattern.finditer(contract_code):
            mod_name = match.group(2)
            start_pos = match.start()
            mod_code = self._extract_block(contract_code, start_pos)
            start_line = base_line + contract_code[:start_pos].count('\n')
            
            chunks.append(CodeChunk(
                chunk_type=ChunkType.MODIFIER,
                name=mod_name,
                code=mod_code,
                start_line=start_line,
                end_line=start_line + mod_code.count('\n'),
                parent_contract=contract_name,
            ))
        
        return chunks
    
    def _extract_events(
        self, 
        contract_code: str, 
        contract_name: str, 
        base_line: int
    ) -> List[CodeChunk]:
        """Extract all events from a contract."""
        chunks = []
        pattern = self.PATTERNS['event']
        
        for match in pattern.finditer(contract_code):
            event_name = match.group(2)
            event_code = match.group(1)
            start_pos = match.start()
            start_line = base_line + contract_code[:start_pos].count('\n')
            
            chunks.append(CodeChunk(
                chunk_type=ChunkType.EVENT,
                name=event_name,
                code=event_code.strip(),
                start_line=start_line,
                end_line=start_line,
                parent_contract=contract_name,
            ))
        
        return chunks
    
    def _create_contract_chunk(
        self, 
        name: str, 
        code: str, 
        start_line: int,
        all_lines: List[str]
    ) -> Optional[CodeChunk]:
        """Create a chunk for the contract header and state variables."""
        # Extract just the header and state variables (before first function)
        func_match = re.search(r'\bfunction\b|\bconstructor\b', code)
        if func_match:
            header_code = code[:func_match.start()]
        else:
            header_code = code
        
        if header_code.strip():
            return CodeChunk(
                chunk_type=ChunkType.CONTRACT,
                name=name,
                code=header_code,
                start_line=start_line,
                end_line=start_line + header_code.count('\n'),
            )
        return None
    
    def _extract_block(self, code: str, start_pos: int) -> str:
        """Extract a complete block (from start to matching close brace)."""
        brace_count = 0
        started = False
        
        for i, char in enumerate(code[start_pos:], start_pos):
            if char == '{':
                brace_count += 1
                started = True
            elif char == '}':
                brace_count -= 1
                if started and brace_count == 0:
                    return code[start_pos:i + 1]
        
        # No closing brace found, return to next line
        newline = code.find('\n', start_pos)
        if newline != -1:
            return code[start_pos:newline]
        return code[start_pos:]
    
    def _extract_visibility(self, modifiers_str: str) -> str:
        """Extract visibility from modifier string."""
        for vis in self.VISIBILITY:
            if vis in modifiers_str.lower():
                return vis
        return "internal"  # Default
    
    def _extract_mutability(self, modifiers_str: str) -> str:
        """Extract state mutability."""
        for mut in self.MUTABILITY:
            if mut in modifiers_str.lower():
                return mut
        return "nonpayable"
    
    def _extract_modifiers_list(self, modifiers_str: str) -> List[str]:
        """Extract custom modifiers (not visibility/mutability)."""
        # Match CamelCase words that aren't keywords
        keywords = {'public', 'private', 'internal', 'external', 'view', 'pure', 
                   'payable', 'virtual', 'override', 'returns'}
        
        mods = re.findall(r'\b([A-Z]\w+)(?:\([^)]*\))?', modifiers_str)
        return [m for m in mods if m.lower() not in keywords]
    
    def _extract_returns(self, modifiers_str: str) -> List[str]:
        """Extract return types."""
        match = re.search(r'returns\s*\(([^)]*)\)', modifiers_str)
        if match:
            return [r.strip() for r in match.group(1).split(',') if r.strip()]
        return []
    
    def _parse_parameters(self, params_str: str) -> List[str]:
        """Parse function parameters."""
        if not params_str.strip():
            return []
        return [p.strip() for p in params_str.split(',') if p.strip()]
    
    def _get_natspec_context(self, lines: List[str], func_line: int) -> str:
        """Get NatSpec/comment context before a function."""
        context_lines = []
        
        for i in range(func_line - 1, max(-1, func_line - self.max_context_lines - 1), -1):
            if i < 0:
                break
            line = lines[i].strip()
            if line.startswith('///') or line.startswith('*') or line.startswith('/*') or line.startswith('//'):
                context_lines.insert(0, lines[i])
            elif line.endswith('*/'):
                context_lines.insert(0, lines[i])
            elif line == '':
                continue
            else:
                break
        
        return '\n'.join(context_lines)


def chunk_solidity(code: str, include_context: bool = True) -> List[CodeChunk]:
    """
    Convenience function to chunk Solidity code.
    
    Args:
        code: Solidity source code
        include_context: Include NatSpec comments
        
    Returns:
        List of CodeChunks
    """
    chunker = SolidityChunker(include_context=include_context)
    return chunker.chunk(code)


def chunk_vulnerability_code(vuln_code: str, max_chunk_size: int = 1500) -> List[str]:
    """
    Chunk vulnerability code preserving function boundaries.
    Falls back to simple chunking if AST parsing fails.
    
    Args:
        vuln_code: Solidity code
        max_chunk_size: Max characters per chunk (soft limit)
        
    Returns:
        List of code strings
    """
    try:
        chunks = chunk_solidity(vuln_code)
        
        if chunks:
            result = []
            current = ""
            
            for chunk in chunks:
                chunk_text = chunk.to_document()
                
                if len(current) + len(chunk_text) < max_chunk_size:
                    current += "\n\n" + chunk_text if current else chunk_text
                else:
                    if current:
                        result.append(current)
                    current = chunk_text
            
            if current:
                result.append(current)
            
            return result if result else [vuln_code]
        
    except Exception:
        pass
    
    # Fallback: simple chunking by lines
    lines = vuln_code.split('\n')
    result = []
    current = ""
    
    for line in lines:
        if len(current) + len(line) < max_chunk_size:
            current += "\n" + line if current else line
        else:
            if current:
                result.append(current)
            current = line
    
    if current:
        result.append(current)
    
    return result if result else [vuln_code]
