#!/usr/bin/env bash
# Print a forge verify-contract line that matches this repo's Foundry metadata (via_ir, solc commit, evm, runs).
#
# Usage (from contracts/):
#   bash script/etherscan-verify-cmd.sh Chamber 0xYourImpl... sepolia
#   bash script/etherscan-verify-cmd.sh Factory 0xYourFactory... sepolia
#   bash script/etherscan-verify-cmd.sh BoardLib 0xYourLib... sepolia
#   bash script/etherscan-verify-cmd.sh WalletLib 0xYourLib... sepolia
#
# Optional env (appended to the printed command):
#   CONSTRUCTOR_ARGS  ABI-encoded constructor args (Factory)
#   BOARD_LIB         linked BoardLib address (Chamber, Factory-path)
#   WALLET_LIB        linked WalletLib address (Chamber, Factory-path)
#
# One-command Sepolia Factory path (26 Aug 2026 addresses in deployments/sepolia.txt):
#   make verify-sepolia-factory
#   # or: bash script/etherscan-verify-sepolia-factory.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

forge build --quiet

NAME="${1:?first arg: Chamber, Registry, Factory, BoardLib, or WalletLib}"
ADDR="${2:?second arg: deployed address}"
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
Factory | factory)
	SRC='src/Factory.sol:Factory'
	JSON=out/Factory.sol/Factory.json
	;;
BoardLib | boardlib)
	SRC='src/libraries/BoardLib.sol:BoardLib'
	JSON=out/BoardLib.sol/BoardLib.json
	;;
WalletLib | walletlib)
	SRC='src/libraries/WalletLib.sol:WalletLib'
	JSON=out/WalletLib.sol/WalletLib.json
	;;
*)
	echo "First arg must be Chamber, Registry, Factory, BoardLib, or WalletLib" >&2
	exit 1
	;;
esac

if [[ ! -f "$JSON" ]]; then
	echo "Missing $JSON — run forge build from contracts/" >&2
	exit 1
fi

# --verifier etherscan: Forge default verifier is sourcify; etherscan expects exact bytecode match path we use below.
cmd="$(
	jq -r --arg A "$ADDR" --arg C "$CHAIN" --arg S "$SRC" --arg R "$VERIFY_RPC_ALIAS" \
		'"forge verify-contract " + $A + " " + $S + " --chain " + $C + " --rpc-url " + $R + " --verifier etherscan --compiler-version v" + .metadata.compiler.version + " --num-of-optimizations " + (.metadata.settings.optimizer.runs|tostring) + " --evm-version " + .metadata.settings.evmVersion + " --via-ir --watch"' \
		"$JSON"
)"

if [[ -n "${CONSTRUCTOR_ARGS:-}" ]]; then
	cmd+=" --constructor-args ${CONSTRUCTOR_ARGS}"
fi
if [[ -n "${BOARD_LIB:-}" ]]; then
	cmd+=" --libraries src/libraries/BoardLib.sol:BoardLib:${BOARD_LIB}"
fi
if [[ -n "${WALLET_LIB:-}" ]]; then
	cmd+=" --libraries src/libraries/WalletLib.sol:WalletLib:${WALLET_LIB}"
fi

printf '%s\n' "$cmd"

echo "" >&2
if [[ "$NAME" == "Chamber" || "$NAME" == "chamber" || "$NAME" == "Registry" || "$NAME" == "registry" ]]; then
	echo "# Sanity: bash script/etherscan-diff-runtime-vs-artifact.sh \"$NAME\" \"$ADDR\" \"$CHAIN\"" >&2
fi
echo "# If verify still fails on *deployment* bytecode after runtime MATCH: forge verify-contract ... --show-standard-json-input → Etherscan Standard JSON (via IR)." >&2
