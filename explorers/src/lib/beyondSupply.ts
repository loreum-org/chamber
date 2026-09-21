/**
 * LoreumNFT mints sequential 1-indexed ids (`tokenId = totalSupply() + 1`).
 * After N mints, ids 1..N exist and `totalSupply` is N. Only ids past N
 * are beyond supply / not yet minted.
 */
export function isBeyondSupply(
  tokenId: bigint,
  totalSupply: bigint | undefined,
): boolean {
  return totalSupply !== undefined && tokenId > totalSupply
}
