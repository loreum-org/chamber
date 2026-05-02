#!/usr/bin/env bash
# Compare *deployed runtime* bytecode on-chain with `out/<Contract>/<Contract>.json` (cheap sanity check).
# If this does NOT match, your checkout ≠ what was deployed; no verifier flags will fix that.
#
# Usage (from contracts/):
#   export SEPOLIA_RPC_URL=...
#   bash script/etherscan-diff-runtime-vs-artifact.sh Registry 0xa5322E80e0b97Fd32744dbF696114fBE36FB814D sepolia
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NAME="${1:?Registry | Chamber}"
ADDR="${2:?0x deployed implementation}"
RPC_ALIAS="${3:-sepolia}"

case "$NAME" in
chamber | Chamber | CHAMBER) OUT_JSON=out/Chamber.sol/Chamber.json ;;
registry | Registry | REGISTRY) OUT_JSON=out/Registry.sol/Registry.json ;;
*)
	echo 'First arg: Registry | Chamber' >&2
	exit 2
	;;
esac

forge build --quiet

local_hex="$(jq -r '.deployedBytecode.object // empty' "$OUT_JSON")"
[[ -n "$local_hex" && "$local_hex" != "null" ]] || {
	echo "Missing deployedBytecode.object in $OUT_JSON — forge build?" >&2
	exit 1
}

remote_hex="$(cast code "$ADDR" --rpc-url "$RPC_ALIAS")"
[[ "$remote_hex" != "0x" && -n "$remote_hex" ]] || {
	echo "No contract code at $ADDR on $RPC_ALIAS (wrong address/RPC)." >&2
	exit 1
}

ln=$(((${#remote_hex} - 2) / 2))
ll=$(((${#local_hex} - 2) / 2))
echo "# remote runtime bytes=$ln artifact runtime bytes=$ll"

lh="$(echo "$local_hex" | tr '[:upper:]' '[:lower:]')"
rh="$(echo "$remote_hex" | tr '[:upper:]' '[:lower:]')"

if [[ "$lh" == "$rh" ]]; then
	echo "# OK: deployed runtime bytecode == local artifact (same built contract)."
	echo "# Next: forge verify-contract ... --show-standard-json-input → Etherscan → Standard Json (via IR)."
	exit 0
fi

echo "# MISMATCH: on-chain bytecode ≠ artifact for this tree." >&2
echo "# git checkout <deploy commit>, forge clean, forge build, re-run compare." >&2
exit 1
