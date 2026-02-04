export .env

ci-test :; forge test

dev-test :; forge test --verbosity -vvv --watch

anvil :; anvil -m 'test test test test test test test test test test test junk'

deploy-anvil :; forge script script/${contract}.s.sol:Deploy${contract} \
	--rpc-url http://localhost:8545  \
	--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
	--broadcast \
	--verbosity -vvv

deploy :; forge script script/${contract}.s.sol:Deploy${contract} \
	--chain-id ${chain} \
	--rpc-url ${rpc}  \
	--account ${account} \
	--broadcast \
	--verify

cover :; forge coverage --report lcov && genhtml lcov.info --branch-coverage --output-dir coverage

# Show only src file coverage (excludes test/script files from display)
cover-src :; @forge coverage 2>&1 | grep -E "^\| src/|^\| File|^[+╭╰]|Total"

show  :; npx http-server ./coverage

clean :; rm -rf out coverage lcov.info cache artifacts

# Deploy mock tokens for testing
deploy-erc20-anvil :; forge script script/MockERC20.s.sol:DeployMockERC20 \
	--rpc-url http://localhost:8545 \
	--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
	--broadcast \
	--verbosity -vvv

deploy-erc721-anvil :; forge script script/MockERC721.s.sol:DeployMockERC721 \
	--rpc-url http://localhost:8545 \
	--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
	--broadcast \
	--verbosity -vvv

# Deploy Registry, MockERC20, and MockERC721 to anvil
# This also writes deployment addresses to app/src/contracts/deployments.json
deploy-all-anvil :; forge script script/DeployAllAnvil.s.sol:DeployAllAnvil \
	--rpc-url http://localhost:8545 \
	--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
	--broadcast \
	--verbosity -vvv

# Sync ABIs from compiled contracts to the app
sync-abis :; node script/sync-abis.js

# Full local development setup: deploy contracts + sync ABIs
# Usage: Start anvil in one terminal, then run `make setup-local` in another
setup-local :; $(MAKE) deploy-all-anvil && $(MAKE) sync-abis

deploy-erc20 :; forge script script/MockERC20.s.sol:DeployMockERC20 \
	--chain-id ${chain} \
	--rpc-url ${rpc} \
	--account ${account} \
	--broadcast \
	--verify

deploy-erc721 :; forge script script/MockERC721.s.sol:DeployMockERC721 \
	--chain-id ${chain} \
	--rpc-url ${rpc} \
	--account ${account} \
	--broadcast \
	--verify

verify :; forge verify-contract \
	--chain-id ${chain} \
	--num-of-optimizations ${runs} \
	--constructor-args ${args} \
	--watch  \
	--compiler-version ${compiler} \
	--etherscan-api-key ${etherscan} \
	${address} \
	src/${contract}.sol:${contract}


call :; cast call ${address} ${method} ${args} \
	--chain-id ${chain} \
	--rpc-url ${rpc} \
	--private-key ${private}



dev :; cd app && npm run dev