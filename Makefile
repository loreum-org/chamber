export .env

ci-test :; forge test

dev-test :; forge test --verbosity -vvv --watch

anvil :; anvil -m 'test test test test test test test test test test test junk'

deploy-anvil :; forge script script/${contract}.s.sol:Deploy${contract} \
	--rpc-url http://localhost:8646  \
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

show  :; npx http-server ./coverage

clean :; rm -rf out coverage lcov.info cache artifacts

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