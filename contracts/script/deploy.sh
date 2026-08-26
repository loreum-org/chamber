cd contracts
ADMIN=0x5d45A213B2B6259F0b3c116a8907B56AB5E22095 \
forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --account 0x0C6F86b338417B3b7FCB9B344DECC51d072919c9 \
  --sender 0x0C6F86b338417B3b7FCB9B344DECC51d072919c9 \
  --broadcast \
  --verify \
  -vvv
