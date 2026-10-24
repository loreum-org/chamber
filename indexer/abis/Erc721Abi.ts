import { parseAbi } from "viem";

/** Membership NFT surface the indexer needs: Transfer (seat owner changes) and ownerOf. */
export const Erc721Abi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);
