"""Update ~/.claude/mcp.json to use locally-installed pinned MCP packages.

Replaces npx commands with direct node invocations pointing at the local
node_modules. Wraps servers that need schema sanitization. Preserves all
existing env vars and non-npm servers untouched.

Cross-platform: works on Windows, macOS, and Linux.
Target: ~/.claude/mcp.json (NOT ~/.claude.json — that is the global Claude
config and should not have mcpServers managed by this script).
"""

import json
import os
import sys

MCP_JSON = os.path.join(os.path.expanduser("~"), ".claude", "mcp.json")
MCP_DIR = os.path.dirname(os.path.abspath(__file__))
NM = os.path.join(MCP_DIR, "node_modules")
SANITIZER = os.path.join(MCP_DIR, "schema-sanitizer.js")

# Map of server name -> (npm package path relative to node_modules, needs_sanitizer)
NPM_SERVERS = {
    "evm-chain-data": (os.path.join("@mcpdotdirect", "evm-mcp-server", "build", "index.js"), True),
    "foundry-suite": (os.path.join("@pranesh.asp", "foundry-mcp-server", "dist", "index.js"), True),
    "tavily-search": (os.path.join("tavily-mcp", "build", "index.js"), False),
    "memory": (os.path.join("@modelcontextprotocol", "server-memory", "dist", "index.js"), False),
    "helius": (os.path.join("@mcp-dockmaster", "mcp-server-helius", "build", "index.js"), False),
}


def _find_node():
    """Find the node binary path."""
    import shutil
    node = shutil.which("node")
    if node:
        return node
    # Windows fallback
    candidate = os.path.join("C:\\Program Files", "nodejs", "node.exe")
    if os.path.isfile(candidate):
        return candidate
    return "node"


def _build_args(entry_js, needs_sanitizer, node_bin):
    """Build the args list for a server entry. Cross-platform."""
    if needs_sanitizer:
        return [SANITIZER, entry_js]
    else:
        return [entry_js]


def main():
    if not os.path.isfile(MCP_JSON):
        print(f"ERROR: {MCP_JSON} not found. Run 'plamen install' first.", file=sys.stderr)
        sys.exit(1)

    with open(MCP_JSON, "r") as f:
        config = json.load(f)

    servers = config.setdefault("mcpServers", {})
    node_bin = _find_node()
    updated = []

    for name, (rel_path, needs_sanitizer) in NPM_SERVERS.items():
        entry_js = os.path.join(NM, rel_path)
        if not os.path.isfile(entry_js):
            print(f"  SKIP {name}: {entry_js} not found")
            continue

        # Preserve existing env vars
        existing_env = {}
        if name in servers and "env" in servers[name]:
            existing_env = servers[name]["env"]

        new_entry = {
            "command": node_bin,
            "args": _build_args(entry_js, needs_sanitizer, node_bin),
        }
        if existing_env:
            new_entry["env"] = existing_env

        servers[name] = new_entry
        tag = "+ SANITIZER" if needs_sanitizer else "direct"
        updated.append(f"  {name}: pinned ({tag})")

    with open(MCP_JSON, "w") as f:
        json.dump(config, f, indent=2)
        f.write("\n")

    print(f"DONE: {len(updated)} npm-based MCP servers updated in {MCP_JSON}:")
    for line in updated:
        print(line)
    print()
    print("Unchanged: Python-based servers (unified-vuln-db, slither-analyzer, etc.)")


if __name__ == "__main__":
    main()
