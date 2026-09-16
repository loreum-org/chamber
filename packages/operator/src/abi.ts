/**
 * Re-export the generated Chamber ABI. Do not invent a second contract API.
 * Source of truth: `contracts/generated-abis.ts` (`make sync-abis`).
 *
 * PMN-M04 (#226) added 4-arg `setDirectorOperator` plus live expiry/scope/liveAt
 * readers. The last synced generated file does not include those entries yet,
 * so the IChamber fragments are appended here. Custom-error decoding still uses
 * the generated ABI plus the M04 session errors below.
 */
import {
  chamberAbi as generatedChamberAbi,
  factoryAbi,
  mockERC20Abi,
  mockERC721Abi,
} from '../../../contracts/generated-abis.ts'

export { factoryAbi, mockERC20Abi, mockERC721Abi }

/** Exact IChamber session-key surface after PMN-M04. Not an ERC-1271 fallback. */
export const directorOperatorAbi = [
  {
    type: 'function',
    name: 'getDirectorOperator',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'operator', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDirectorOperatorScope',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'scope', type: 'uint32', internalType: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDirectorOperatorLiveAt',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'liveAt', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDirectorSession',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'sessionOwner', type: 'address', internalType: 'address' },
      { name: 'operator', type: 'address', internalType: 'address' },
      { name: 'expiry', type: 'uint256', internalType: 'uint256' },
      { name: 'scope', type: 'uint32', internalType: 'uint32' },
      { name: 'liveAt', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setDirectorOperator',
    inputs: [
      { name: 'tokenId', type: 'uint256', internalType: 'uint256' },
      { name: 'operator', type: 'address', internalType: 'address' },
      { name: 'expiry', type: 'uint256', internalType: 'uint256' },
      { name: 'scope', type: 'uint32', internalType: 'uint32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'DirectorOperatorSet',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'operator', type: 'address', indexed: true, internalType: 'address' },
      { name: 'expiry', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'scope', type: 'uint32', indexed: false, internalType: 'uint32' },
    ],
    anonymous: false,
  },
  { type: 'error', name: 'InvalidSessionExpiry', inputs: [] },
  { type: 'error', name: 'InvalidSessionScope', inputs: [] },
] as const

export const chamberAbi = [...generatedChamberAbi, ...directorOperatorAbi] as const
