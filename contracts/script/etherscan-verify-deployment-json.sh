#!/usr/bin/env bash
# Print forge verify-contract lines for BOTH implementation contracts from deployments-registry-remote-*.json
# Usage (from contracts/):
#   bash script/etherscan-verify-deployment-json.sh deployments-registry-remote-11155111.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FILE="${1:?path to deployments-registry-remote-<chainId>.json}"
[[ -f "$FILE" ]] || { echo "Missing $FILE"; exit 1; }

CHAIN_ID="$(jq -r '.chainId // empty' "$FILE")"
[[ -n "$CHAIN_ID" ]] || { echo "JSON missing chainId"; exit 1; }

REG_IMPL="$(jq -r '.registryImplementation // empty' "$FILE")"
CH_IMPL="$(jq -r '.chamberImplementation // empty' "$FILE")"
[[ -n "$REG_IMPL" && "$REG_IMPL" != "null" ]] || { echo "JSON missing registryImplementation"; exit 1; }
[[ -n "$CH_IMPL" && "$CH_IMPL" != "null" ]] || { echo "JSON missing chamberImplementation"; exit 1; }

case "$CHAIN_ID" in
11155111) CHAIN_FORGE=sepolia ;;
1) CHAIN_FORGE=mainnet ;;
*)
	echo "Unsupported chainId in JSON: $CHAIN_ID — edit script or pass manually via etherscan-verify-cmd.sh"
	exit 1
	;;
esac

echo "# Verify from SAME git checkout + forge clean + forge build as deploy:"
echo ""

bash "$ROOT/script/etherscan-verify-cmd.sh" Registry "${REG_IMPL}" "${CHAIN_FORGE}"
echo ""

bash "$ROOT/script/etherscan-verify-cmd.sh" Chamber "${CH_IMPL}" "${CHAIN_FORGE}"
echo ""

echo "# If Etherscan still reports deployment bytecode mismatch:"
echo "#   git checkout <commit-at-broadcast>; cd contracts && forge clean && forge build"
echo "#   bash script/etherscan-diff-runtime-vs-artifact.sh Registry $REG_IMPL $CHAIN_FORGE   # MUST pass"
echo "#   bash script/etherscan-diff-runtime-vs-artifact.sh Chamber $CH_IMPL $CHAIN_FORGE"
echo "#   forge verify-contract ... --show-standard-json-input → Sepolia Verify → Standard JSON (via IR)"
