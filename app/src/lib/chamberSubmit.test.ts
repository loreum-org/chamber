import { describe, expect, it, vi } from 'vitest'
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  stringToHex,
  toFunctionSelector,
  type TransactionReceipt,
} from 'viem'
import {
  ChamberSubmitError,
  legacySubmitAbi,
  parseChamberVersion,
  planSubmit,
  readChamberVersionLabel,
  submitTransactionEventAbi,
  submittedNonceFromReceipt,
  verifySubmitReceipt,
} from './chamberSubmit'

const chamber = '0x00000000000000000000000000000000000000C1' as const
const target = '0x000000000000000000000000000000000000dEaD' as const
const args = { tokenId: 1n, target, value: 0n, data: '0x' as const, metadataURI: 'ipfs://x', deadline: 0n }

function versionClient(label: string | Error) {
  return {
    readContract: vi.fn(async () => {
      if (label instanceof Error) throw label
      return stringToHex(label, { size: 32 })
    }),
  }
}

function submitLog(address: `0x${string}`, nonce: bigint) {
  const topics = encodeEventTopics({
    abi: submitTransactionEventAbi,
    eventName: 'SubmitTransaction',
    args: { tokenId: 1n, nonce, to: target },
  })
  const data = encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes' }], [0n, '0x'])
  return { address, topics, data }
}

function receipt(status: 'success' | 'reverted', logs: ReturnType<typeof submitLog>[]): TransactionReceipt {
  return { status, logs } as unknown as TransactionReceipt
}

describe('parseChamberVersion', () => {
  it('accepts plain and v-prefixed major.minor.patch, including multi-digit parts', () => {
    expect(parseChamberVersion('1.1.5')).toEqual([1, 1, 5])
    expect(parseChamberVersion('v1.3.0')).toEqual([1, 3, 0])
    expect(parseChamberVersion('1.10.0')).toEqual([1, 10, 0])
  })

  it('rejects suffixes and malformed labels, like the upgrade script', () => {
    for (const bad of ['1.2.0-rc', '1.2.0garbage', '1.3', '1..3', '1.3.0.1', '', undefined]) {
      expect(parseChamberVersion(bad)).toBeUndefined()
    }
  })
})

describe('planSubmit (version gate)', () => {
  it('uses the single 6-arg submitTransaction on 1.3.0+', () => {
    for (const v of ['1.3.0', '1.3.1', '2.0.0']) {
      const plan = planSubmit(v, args)
      expect(plan.kind).toBe('single')
      expect(plan.functionName).toBe('submitTransaction')
      const data = encodeFunctionData({ abi: plan.abi, functionName: plan.functionName, args: plan.args } as never)
      expect(data.slice(0, 10)).toBe(
        toFunctionSelector('submitTransaction(uint256,address,uint256,bytes,string,uint256)'),
      )
    }
  })

  it('uses legacy submitTransactionWithMetadata on 1.1.5 – 1.2.x', () => {
    for (const v of ['1.1.5', '1.1.9', '1.2.0']) {
      const plan = planSubmit(v, args)
      expect(plan.kind).toBe('legacy')
      expect(plan.functionName).toBe('submitTransactionWithMetadata')
      expect(plan.args).toEqual([1n, target, 0n, '0x', 'ipfs://x', 0n])
      const data = encodeFunctionData({ abi: legacySubmitAbi, functionName: 'submitTransactionWithMetadata', args: plan.args })
      expect(data.slice(0, 10)).toBe(
        toFunctionSelector('submitTransactionWithMetadata(uint256,address,uint256,bytes,string,uint256)'),
      )
    }
  })

  it('blocks chambers older than 1.1.5 with a redeploy message', () => {
    expect(() => planSubmit('1.1.4', args)).toThrow(/needs to be redeployed/)
    expect(() => planSubmit('1.0.0', args)).toThrow(ChamberSubmitError)
  })

  it('blocks when VERSION cannot be read', () => {
    expect(() => planSubmit(undefined, args)).toThrow(/Could not read this chamber/)
    expect(() => planSubmit('garbage', args)).toThrow(ChamberSubmitError)
  })

  it('defaults metadataURI to "" and deadline to 0', () => {
    const plan = planSubmit('1.3.0', { tokenId: 2n, target, value: 5n, data: '0x1234' })
    expect(plan.args).toEqual([2n, target, 5n, '0x1234', '', 0n])
  })
})

describe('readChamberVersionLabel', () => {
  it('decodes the on-chain bytes32 VERSION', async () => {
    const client = versionClient('1.1.5')
    await expect(readChamberVersionLabel(client, chamber)).resolves.toBe('1.1.5')
    expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: chamber, functionName: 'VERSION' }))
  })

  it('returns undefined when the read fails, so planSubmit blocks', async () => {
    const label = await readChamberVersionLabel(versionClient(new Error('rpc down')), chamber)
    expect(label).toBeUndefined()
    expect(() => planSubmit(label, args)).toThrow(ChamberSubmitError)
  })
})

describe('submit receipt check', () => {
  it('returns the nonce when the chamber emitted SubmitTransaction', () => {
    expect(submittedNonceFromReceipt(receipt('success', [submitLog(chamber, 7n)]), chamber)).toBe(7n)
  })

  it('throws when the event is missing (old fallback swallowed the call)', () => {
    expect(() => submittedNonceFromReceipt(receipt('success', []), chamber)).toThrow(/did not record a proposal/)
  })

  it('ignores SubmitTransaction logs from other contracts', () => {
    const other = '0x00000000000000000000000000000000000000c2' as const
    expect(() => submittedNonceFromReceipt(receipt('success', [submitLog(other, 1n)]), chamber)).toThrow(
      ChamberSubmitError,
    )
  })

  it('throws on a reverted receipt', () => {
    expect(() => submittedNonceFromReceipt(receipt('reverted', [submitLog(chamber, 1n)]), chamber)).toThrow(/reverted/)
  })

  it('verifySubmitReceipt waits for the receipt and applies the check', async () => {
    const ok = { waitForTransactionReceipt: vi.fn(async () => receipt('success', [submitLog(chamber, 3n)])) }
    await expect(verifySubmitReceipt(ok, '0xabc', chamber)).resolves.toBe(3n)
    const missing = { waitForTransactionReceipt: vi.fn(async () => receipt('success', [])) }
    await expect(verifySubmitReceipt(missing, '0xabc', chamber)).rejects.toThrow(ChamberSubmitError)
  })
})
