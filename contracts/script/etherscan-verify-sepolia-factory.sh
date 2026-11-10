#!/usr/bin/env bash
# Verify the 10 Nov 2026 Sepolia Factory path on Etherscan:
#   BoardLib, WalletLib, Chamber impl, Factory
# Addresses must match contracts/deployments/sepolia.txt (Nov 10 section).
#
# One-command re-run (from contracts/):
#   make verify-sepolia-factory
#
# Or:
#   export ETHERSCAN_API_KEY=...
#   export SEPOLIA_RPC_URL=...          # foundry.toml [rpc_endpoints].sepolia
#   bash script/etherscan-verify-sepolia-factory.sh
#
# Print the four forge commands without submitting (no API key needed):
#   PRINT_ONLY=1 bash script/etherscan-verify-sepolia-factory.sh
#
# Verify libraries first so the Chamber impl page can link BoardLib + WalletLib.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
	set -a
	# shellcheck disable=SC1091
	source .env
	set +a
fi

# Public fallback so --rpc-url sepolia resolves when a private RPC is unset.
export SEPOLIA_RPC_URL="${SEPOLIA_RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"

# 10 Nov 2026 Factory path — keep in sync with deployments/sepolia.txt
FACTORY=0xE87FF28C44593122e4BD87e48A18c9f08eBc811d
CHAMBER=0x07026D7DC398b8eF7874aEa1bBC00ACA231B20Af
BOARD_LIB=0x7D5c6d334426a58aBeBF6453d58d958B76a408cd
WALLET_LIB=0x74024B02dd1fcaBBA9eb9c0E2EABe480a81fDa3F
ADMIN=0x5d45A213B2B6259F0b3c116a8907B56AB5E22095

for addr in "$FACTORY" "$CHAMBER" "$BOARD_LIB" "$WALLET_LIB"; do
	grep -q "$addr" "$ROOT/deployments/sepolia.txt" || {
		echo "Address $addr is not in deployments/sepolia.txt — refuse to verify a drifted set." >&2
		exit 1
	}
done

FACTORY_CTOR_ARGS="$(cast abi-encode "constructor(address,address)" "$CHAMBER" "$ADMIN")"

run_or_print() {
	local name="$1" addr="$2"
	local cmd
	cmd="$(bash "$ROOT/script/etherscan-verify-cmd.sh" "$name" "$addr" sepolia)"
	echo "+ $cmd"
	if [[ "${PRINT_ONLY:-}" == "1" ]]; then
		return 0
	fi
	eval "$cmd"
}

if [[ -z "${ETHERSCAN_API_KEY:-}" && "${PRINT_ONLY:-}" != "1" ]]; then
	echo "ETHERSCAN_API_KEY is unset. Printing the four forge verify-contract commands." >&2
	echo "Re-run with the key set: make verify-sepolia-factory" >&2
	echo "" >&2
	PRINT_ONLY=1
	MISSING_KEY=1
fi

# Libraries first, then Chamber (so Etherscan can attach BoardLib + WalletLib), then Factory.
run_or_print BoardLib "$BOARD_LIB"
run_or_print WalletLib "$WALLET_LIB"
BOARD_LIB="$BOARD_LIB" WALLET_LIB="$WALLET_LIB" run_or_print Chamber "$CHAMBER"
CONSTRUCTOR_ARGS="$FACTORY_CTOR_ARGS" run_or_print Factory "$FACTORY"

echo ""
echo "# Sepolia Etherscan"
echo "# Factory                 https://sepolia.etherscan.io/address/${FACTORY}#code"
echo "# Chamber implementation  https://sepolia.etherscan.io/address/${CHAMBER}#code"
echo "# BoardLib                https://sepolia.etherscan.io/address/${BOARD_LIB}#code"
echo "# WalletLib               https://sepolia.etherscan.io/address/${WALLET_LIB}#code"

if [[ "${MISSING_KEY:-}" == "1" ]]; then
	exit 2
fi
