#!/usr/bin/env bash
# Print a forge verify-contract line that matches this repo's Foundry metadata (via_ir, solc commit, evm, runs).
# Usage (from contracts/): bash script/etherscan-verify-cmd.sh Chamber 0xYourImpl... sepolia
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

forge build --quiet

NAME="${1:?first arg: Chamber or Registry}"
ADDR="${2:?second arg: implementation address}"
CHAIN="${3:-sepolia}"

# Forge verify-contract defaults --rpc-url to http://localhost:8545; without pointing at Sepolia/etc.,
# Forge cannot see onchain bytecode and warns: "Unable to locate ContractCode".
# Values below resolve via foundry.toml [rpc_endpoints] (SEPOLIA_RPC_URL, MAINNET_RPC_URL, …).
case "$CHAIN" in
sepolia | 11155111) VERIFY_RPC_ALIAS=sepolia ;;
mainnet | 1) VERIFY_RPC_ALIAS=mainnet ;;
arbitrum | 42161) VERIFY_RPC_ALIAS=arbitrum ;;
base | 8453 | 84532) VERIFY_RPC_ALIAS=base ;;
*) VERIFY_RPC_ALIAS=$CHAIN ;;
esac

case "$NAME" in
Chamber | chamber)
	SRC='src/Chamber.sol:Chamber'
	JSON=out/Chamber.sol/Chamber.json
	;;
Registry | registry)
	SRC='src/Registry.sol:Registry'
	JSON=out/Registry.sol/Registry.json
	;;
*)
	echo "First arg must be Chamber or Registry" >&2
	exit 1
	;;
esac

if [[ ! -f "$JSON" ]]; then
	echo "Missing $JSON — run forge build from contracts/" >&2
	exit 1
fi

# --verifier etherscan: Forge default verifier is sourcify; etherscan expects exact bytecode match path we use below.
jq -r --arg A "$ADDR" --arg C "$CHAIN" --arg S "$SRC" --arg R "$VERIFY_RPC_ALIAS" \
	'"forge verify-contract " + $A + " " + $S + " --chain " + $C + " --rpc-url " + $R + " --verifier etherscan --compiler-version v" + .metadata.compiler.version + " --num-of-optimizations " + (.metadata.settings.optimizer.runs|tostring) + " --evm-version " + .metadata.settings.evmVersion + " --via-ir --watch"' \
	"$JSON"

echo "" >&2
echo "# Sanity: bash script/etherscan-diff-runtime-vs-artifact.sh \"$NAME\" \"$ADDR\" \"$CHAIN\"" >&2
echo "# If verify still fails on *deployment* bytecode after runtime MATCH: forge verify-contract ... --show-standard-json-input → Etherscan Standard JSON (via IR)." >&2
