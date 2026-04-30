# Delegate to repo root — Foundry config lives at ../foundry.toml
export .env

ROOT := $(abspath ..)

ci-test :; $(MAKE) -C $(ROOT) ci-test

dev-test :; cd $(ROOT) && forge test --verbosity -vvv --watch

anvil :; anvil -m 'test test test test test test test test test test test junk'

deploy-anvil :; cd $(ROOT) && forge script contracts/script/${contract}.s.sol:Deploy${contract} \
	--rpc-url http://localhost:8545  \
	--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
	--broadcast \
	--verbosity -vvv

deploy :; cd $(ROOT) && forge script contracts/script/${contract}.s.sol:Deploy${contract} \
	--chain-id ${chain} \
	--rpc-url ${rpc}  \
	--account ${account} \
	--broadcast \
	--verify

cover :; cd $(ROOT) && forge coverage --report lcov && genhtml lcov.info --branch-coverage --output-dir coverage

# Show only src file coverage (excludes test/script files from display)
cover-src :; @cd $(ROOT) && forge coverage 2>&1 | grep -E "^\| contracts/src/|^\| File|^[+╭╰]|Total"

show  :; cd $(ROOT) && npx http-server ./coverage

clean :; cd $(ROOT) && rm -rf out coverage lcov.info cache artifacts

deploy-erc20-anvil :; cd $(ROOT) && forge script contracts/script/MockERC20.s.sol:DeployMockERC20 \
	--rpc-url http://localhost:8545 \
	--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
	--broadcast \
	--verbosity -vvv

deploy-erc721-anvil :; cd $(ROOT) && forge script contracts/script/MockERC721.s.sol:DeployMockERC721 \
	--rpc-url http://localhost:8545 \
	--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
	--broadcast \
	--verbosity -vvv

deploy-all-anvil :; cd $(ROOT) && forge script contracts/script/DeployAllAnvil.s.sol:DeployAllAnvil \
	--rpc-url http://localhost:8545 \
	--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
	--broadcast \
	--verbosity -vvv

sync-abis :; cd $(ROOT) && node contracts/script/sync-abis.js

setup-local :; $(MAKE) deploy-all-anvil && $(MAKE) sync-abis

deploy-erc20 :; cd $(ROOT) && forge script contracts/script/MockERC20.s.sol:DeployMockERC20 \
	--chain-id ${chain} \
	--rpc-url ${rpc} \
	--account ${account} \
	--broadcast \
	--verify

deploy-erc721 :; cd $(ROOT) && forge script contracts/script/MockERC721.s.sol:DeployMockERC721 \
	--chain-id ${chain} \
	--rpc-url ${rpc} \
	--account ${account} \
	--broadcast \
	--verify

verify :; cd $(ROOT) && forge verify-contract \
	--chain-id ${chain} \
	--num-of-optimizations ${runs} \
	--constructor-args ${args} \
	--watch  \
	--compiler-version ${compiler} \
	--etherscan-api-key ${etherscan} \
	${address} \
	contracts/src/${contract}.sol:${contract}

call :; cast call ${address} ${method} ${args} \
	--chain-id ${chain} \
	--rpc-url ${rpc} \
	--private-key ${private}
