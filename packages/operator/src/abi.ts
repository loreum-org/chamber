/**
 * Re-export the generated Chamber ABI. Do not invent a second contract API.
 * Source of truth: `contracts/generated-abis.ts` (`make sync-abis`).
 */
export {
  chamberAbi,
  factoryAbi,
  mockERC20Abi,
  mockERC721Abi,
} from '../../../contracts/generated-abis.ts'
