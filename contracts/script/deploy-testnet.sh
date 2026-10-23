#!/usr/bin/env bash
# Deploy the Chamber Factory (plus demo tokens) to one supported testnet and
# write the addresses to deployments/<network>.txt, which the app reads.
#
# Usage (from contracts/):
#   make deploy-testnet network=arbitrum-sepolia account=deployer
#   make deploy-testnet network=all account=deployer
#
# Networks: sepolia, base-sepolia, arbitrum-sepolia, op-sepolia, all
#
# Env (optional, from contracts/.env):
#   ADMIN                     Factory admin (default 0x5d45…2095)
#   SENDER                    Address of --account (default 0x0C6F…19c9)
#   <NET>_RPC_URL             SEPOLIA_RPC_URL, BASE_SEPOLIA_RPC_URL,
#                             ARBITRUM_SEPOLIA_RPC_URL, OP_SEPOLIA_RPC_URL
#   ETHERSCAN_API_KEY         One Etherscan v2 key verifies on all four chains
#   SKIP_MOCKS=1              Do not deploy the demo ERC-20 / ERC-721
#   SKIP_VERIFY=1             Do not verify on the block explorer
#   DRY_RUN=1                 Simulate only (no --broadcast, no file written)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
	set -a
	# shellcheck disable=SC1091
	source .env
	set +a
fi

NETWORK="${1:-${NETWORK:-}}"
ACCOUNT="${ACCOUNT:-}"
ADMIN="${ADMIN:-0x5d45A213B2B6259F0b3c116a8907B56AB5E22095}"
SENDER="${SENDER:-0x0C6F86b338417B3b7FCB9B344DECC51d072919c9}"

usage() {
	echo "Usage: ACCOUNT=<foundry keystore> bash script/deploy-testnet.sh <sepolia|base-sepolia|arbitrum-sepolia|op-sepolia|all>" >&2
	exit 1
}

[[ -n "$NETWORK" ]] || usage
[[ -n "$ACCOUNT" ]] || { echo "Set ACCOUNT (foundry keystore name, see 'cast wallet list')." >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required to read the broadcast file." >&2; exit 1; }

if [[ "$NETWORK" == "all" ]]; then
	for net in sepolia base-sepolia arbitrum-sepolia op-sepolia; do
		bash "$0" "$net"
	done
	exit 0
fi

# name | chain id | rpc env var | public rpc | explorer
case "$NETWORK" in
	sepolia)
		CHAIN_ID=11155111 RPC_VAR=SEPOLIA_RPC_URL
		PUBLIC_RPC=https://ethereum-sepolia-rpc.publicnode.com
		EXPLORER=https://sepolia.etherscan.io LABEL="Ethereum Sepolia" ;;
	base-sepolia)
		CHAIN_ID=84532 RPC_VAR=BASE_SEPOLIA_RPC_URL
		PUBLIC_RPC=https://sepolia.base.org
		EXPLORER=https://sepolia.basescan.org LABEL="Base Sepolia" ;;
	arbitrum-sepolia)
		CHAIN_ID=421614 RPC_VAR=ARBITRUM_SEPOLIA_RPC_URL
		PUBLIC_RPC=https://sepolia-rollup.arbitrum.io/rpc
		EXPLORER=https://sepolia.arbiscan.io LABEL="Arbitrum Sepolia" ;;
	op-sepolia)
		CHAIN_ID=11155420 RPC_VAR=OP_SEPOLIA_RPC_URL
		PUBLIC_RPC=https://sepolia.optimism.io
		EXPLORER=https://sepolia-optimism.etherscan.io LABEL="OP Sepolia" ;;
	*) usage ;;
esac

RPC_URL="${!RPC_VAR:-$PUBLIC_RPC}"
OUT="deployments/$NETWORK.txt"

actual_chain="$(cast chain-id --rpc-url "$RPC_URL")"
[[ "$actual_chain" == "$CHAIN_ID" ]] || {
	echo "$RPC_VAR points at chain $actual_chain, expected $CHAIN_ID ($LABEL)." >&2
	exit 1
}

FORGE_FLAGS=(--rpc-url "$RPC_URL" --account "$ACCOUNT" --sender "$SENDER" -vvv)
if [[ -z "${DRY_RUN:-}" ]]; then
	FORGE_FLAGS+=(--broadcast)
	if [[ -z "${SKIP_VERIFY:-}" ]]; then
		[[ -n "${ETHERSCAN_API_KEY:-}" ]] || { echo "Set ETHERSCAN_API_KEY or SKIP_VERIFY=1." >&2; exit 1; }
		FORGE_FLAGS+=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY" --chain "$CHAIN_ID")
	fi
fi

echo ">>> $LABEL (chain $CHAIN_ID): Factory + Chamber implementation"
ADMIN="$ADMIN" forge script script/DeployFactory.s.sol:DeployFactory "${FORGE_FLAGS[@]}"

if [[ -z "${SKIP_MOCKS:-}" ]]; then
	echo ">>> $LABEL: demo ERC-20 and membership ERC-721"
	forge script script/DeploySepoliaMocks.s.sol:DeploySepoliaMocks "${FORGE_FLAGS[@]}"
fi

if [[ -n "${DRY_RUN:-}" ]]; then
	echo "DRY_RUN: nothing broadcast, $OUT not written."
	exit 0
fi

FACTORY_RUN="broadcast/DeployFactory.s.sol/$CHAIN_ID/run-latest.json"
MOCKS_RUN="broadcast/DeploySepoliaMocks.s.sol/$CHAIN_ID/run-latest.json"

checksum() { [[ -n "$1" ]] && cast to-check-sum-address "$1" || true; }

created() { # <run.json> <contractName>
	checksum "$(jq -r --arg n "$2" \
		'[.transactions[] | select(.transactionType == "CREATE" or .transactionType == "CREATE2") | select(.contractName == $n) | .contractAddress] | last // empty' \
		"$1")"
}

created_block() { # <run.json> <address>
	jq -r --arg a "$(echo "$2" | tr '[:upper:]' '[:lower:]')" \
		'[.receipts[] | select((.contractAddress // "" | ascii_downcase) == $a) | .blockNumber] | first // empty' \
		"$1"
}

created_tx() { # <run.json> <address>
	jq -r --arg a "$(echo "$2" | tr '[:upper:]' '[:lower:]')" \
		'[.receipts[] | select((.contractAddress // "" | ascii_downcase) == $a) | .transactionHash] | first // empty' \
		"$1"
}

FACTORY="$(created "$FACTORY_RUN" Factory)"
CHAMBER_IMPL="$(created "$FACTORY_RUN" Chamber)"
library() { # <run.json> <name>; linked libraries are listed as path:Name:address
	jq -r --arg n "$2" '[.libraries[]? | split(":") | select(.[1] == $n) | .[2]] | last // empty' "$1"
}
BOARD_LIB="$(library "$FACTORY_RUN" BoardLib)"
WALLET_LIB="$(library "$FACTORY_RUN" WalletLib)"
[[ -n "$FACTORY" ]] || { echo "No Factory in $FACTORY_RUN." >&2; exit 1; }
START_BLOCK="$(printf '%d' "$(created_block "$FACTORY_RUN" "$FACTORY")")"
FACTORY_TX="$(created_tx "$FACTORY_RUN" "$FACTORY")"

{
	echo ""
	echo "  $(date -u '+%b %d, %Y') - $LABEL (chain $CHAIN_ID, Factory path)"
	echo "  ===================================================================="
	echo "  DeployFactory"
	echo "  ===================================================================="
	printf '  %-26s%s\n' "Chain" "$CHAIN_ID"
	printf '  %-26s%s\n' "Deployer" "$SENDER"
	printf '  %-26s%s\n' "ADMIN" "$ADMIN"
	printf '  %-26s%s\n' "Factory" "$FACTORY"
	[[ -n "$CHAMBER_IMPL" ]] && printf '  %-26s%s\n' "Chamber implementation" "$CHAMBER_IMPL"
	[[ -n "$BOARD_LIB" ]] && printf '  %-26s%s\n' "BoardLib" "$BOARD_LIB"
	[[ -n "$WALLET_LIB" ]] && printf '  %-26s%s\n' "WalletLib" "$WALLET_LIB"
	printf '  %-26s%s\n' "Factory start block" "$START_BLOCK"
	printf '  %-26s%s\n' "Factory tx" "$FACTORY_TX"
	printf '  %-26s%s\n' "Explorer" "$EXPLORER/address/$FACTORY"
	if [[ -z "${SKIP_MOCKS:-}" && -f "$MOCKS_RUN" ]]; then
		printf '  %-26s%s\n' "MockERC20 (demo)" "$(created "$MOCKS_RUN" MockERC20)"
		printf '  %-26s%s\n' "MockERC721 (membership)" "$(created "$MOCKS_RUN" MockERC721)"
	fi
} >>"$OUT"

# The app builds from its own copy of the deployment files.
if [[ -d ../app/contracts/deployments ]]; then
	cp "$OUT" "../app/contracts/deployments/$NETWORK.txt"
fi

echo ">>> Wrote $OUT (last entry wins in the app). Commit it to point the app at this Factory."
