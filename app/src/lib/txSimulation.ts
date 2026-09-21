/**
 * Proposal simulation gate (#260).
 *
 * Runs the pending action as an `eth_call` against live state: the chamber
 * governance call is impersonated from the connected director, and the inner
 * payload is impersonated from the Chamber itself. Known transfer patterns
 * also get an analytic before/after state diff (balance/allowance rows) —
 * the same pattern the operator SDK uses for state previews.
 */

import {
  encodeFunctionData,
  formatUnits,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { chamberAbi, erc20Abi } from '@/contracts/abis'
import {
  decodeTransactionAction,
  humanizeSimulationError,
  type TxTransferIntent,
} from '@/lib/txDecoding'

export type SimDiffRow = {
  label: string
  before: string
  after: string
  /** Governance-sensitive rows (upgrades, pause, board changes) get emphasis. */
  highlight?: boolean
}

export type SimTokenMeta = { address: Address; symbol: string; decimals: number }

type SimResultBase = {
  ranAt: number
  diff: SimDiffRow[]
  /** ERC-20 metadata read during the simulation, when the action moves a token. */
  token?: SimTokenMeta
}

export type SimResult =
  | (SimResultBase & { status: 'passed' })
  | (SimResultBase & { status: 'reverted'; reason: string })
  | (SimResultBase & { status: 'error'; reason: string })

export type SimulationMode = 'confirm' | 'execute'

const ZERO = 0n

function fmtWei(wei: bigint): string {
  const eth = Number(wei) / 1e18
  if (!Number.isFinite(eth)) return `${wei.toString()} wei`
  if (wei === ZERO) return '0 ETH'
  const digits = eth !== 0 ? Math.min(6, Math.max(2, 9 - Math.max(0, Math.floor(Math.log10(eth))))) : 2
  return `${eth.toFixed(digits)} ETH`
}

function fmtTokens(amountRaw: bigint, decimals: number, symbol: string): string {
  let human: number
  try {
    human = Number(formatUnits(amountRaw, decimals))
  } catch {
    return `${amountRaw.toString()} (raw)`
  }
  if (!Number.isFinite(human)) return `${amountRaw.toString()} (raw)`
  return `${human.toLocaleString('en-US', { maximumFractionDigits: Math.min(decimals, 6) })} ${symbol}`
}

export async function simulateChamberTx(params: {
  publicClient: PublicClient
  chamberAddress: Address
  userAddress: Address
  userTokenId: bigint
  txId: number
  mode: SimulationMode
  target: Address
  value: bigint
  calldata?: string | null
}): Promise<SimResult> {
  const { publicClient, chamberAddress, userAddress, userTokenId, txId, mode, target, value } = params
  const calldata =
    params.calldata && params.calldata.startsWith('0x') && params.calldata !== '0x'
      ? (params.calldata as Hex)
      : null

  const intent: TxTransferIntent = calldata
    ? decodeTransactionAction({ target, value, calldata })?.intent ?? null
    : value > 0n
      ? decodeTransactionAction({ target, value, calldata: null })?.intent ?? null
      : null

  const diff: SimDiffRow[] = []
  const token = intent?.kind === 'erc20' ? intent.token : null

  // ---- "before" state reads -------------------------------------------------
  let beforeChamberEth: bigint | undefined
  let beforeRecipientEth: bigint | undefined
  let beforeChamberTokens: bigint | undefined
  let beforeRecipientTokens: bigint | undefined
  let beforeAllowance: bigint | undefined
  let tokenSymbol = 'tokens'
  let tokenDecimals = 18
  let tokenMeta: SimTokenMeta | undefined
  const recipient =
    intent?.kind === 'eth'
      ? intent.recipient
      : intent?.kind === 'erc20' && intent.mode !== 'approve'
        ? (intent.to ?? null)
        : null

  try {
    const reads: Promise<unknown>[] = [
      publicClient.getBalance({ address: chamberAddress }),
    ]
    if (intent?.kind === 'eth' && intent.recipient) {
      reads.push(publicClient.getBalance({ address: intent.recipient }))
    }
    if (token) {
      reads.push(
        publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
        publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
        publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [chamberAddress] }),
      )
    }
    if (recipient && token) {
      reads.push(
        publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [recipient] }),
      )
    }
    if (intent?.kind === 'erc20' && intent.mode === 'approve' && intent.spender) {
      reads.push(
        publicClient.readContract({
          address: token as Address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [chamberAddress, intent.spender],
        }),
      )
    }

    const results = await Promise.allSettled(reads)
    let i = 0
    const next = (): unknown => {
      const r = results[i++]
      return r?.status === 'fulfilled' ? r.value : undefined
    }
    beforeChamberEth = next() as bigint | undefined
    if (intent?.kind === 'eth') beforeRecipientEth = next() as bigint | undefined
    if (token) {
      const sym = next()
      const dec = next()
      beforeChamberTokens = next() as bigint | undefined
      if (typeof sym === 'string' && sym.length > 0 && sym.length <= 12) tokenSymbol = sym
      if (typeof dec === 'number' && dec >= 0 && dec <= 36) tokenDecimals = dec
      if (typeof sym === 'string' && typeof dec === 'number' && tokenSymbol === sym && tokenDecimals === dec) {
        tokenMeta = { address: token, symbol: sym, decimals: dec }
      }
    }
    if (recipient && token) beforeRecipientTokens = next() as bigint | undefined
    if (intent?.kind === 'erc20' && intent.mode === 'approve') beforeAllowance = next() as bigint | undefined
  } catch {
    // Preview reads are best-effort; the eth_call gate below is the real gate.
  }

  const pushEthRows = (ethIntent: Extract<TxTransferIntent, { kind: 'eth' }>) => {
    if (beforeChamberEth !== undefined) {
      diff.push({
        label: 'Chamber ETH balance',
        before: fmtWei(beforeChamberEth),
        after: fmtWei(beforeChamberEth > ethIntent.amountRaw ? beforeChamberEth - ethIntent.amountRaw : ZERO),
      })
    }
    if (beforeRecipientEth !== undefined) {
      diff.push({
        label: `Recipient ETH balance`,
        before: fmtWei(beforeRecipientEth),
        after: fmtWei(beforeRecipientEth + ethIntent.amountRaw),
      })
    }
  }

  const pushTokenRows = (erc20: Extract<TxTransferIntent, { kind: 'erc20' }>) => {
    const amt = fmtTokens(erc20.amountRaw, tokenDecimals, tokenSymbol)
    if (erc20.mode === 'approve') {
      diff.push({
        label: `Allowance: chamber → ${erc20.spender?.slice(0, 10)}…`,
        before: beforeAllowance !== undefined ? fmtTokens(beforeAllowance, tokenDecimals, tokenSymbol) : 'unknown',
        after: amt,
      })
      return
    }
    const dest = erc20.to ?? 'recipient'
    if (beforeChamberTokens !== undefined && erc20.mode === 'transfer') {
      diff.push({
        label: `Chamber ${tokenSymbol} balance`,
        before: fmtTokens(beforeChamberTokens, tokenDecimals, tokenSymbol),
        after: fmtTokens(
          beforeChamberTokens >= erc20.amountRaw ? beforeChamberTokens - erc20.amountRaw : beforeChamberTokens,
          tokenDecimals,
          tokenSymbol,
        ),
      })
    }
    if (erc20.mode === 'transferFrom' && beforeRecipientTokens !== undefined) {
      diff.push({
        label: `Sender ${tokenSymbol} balance`,
        before: fmtTokens(beforeRecipientTokens, tokenDecimals, tokenSymbol),
        after: fmtTokens(
          beforeRecipientTokens >= erc20.amountRaw ? beforeRecipientTokens - erc20.amountRaw : beforeRecipientTokens,
          tokenDecimals,
          tokenSymbol,
        ),
      })
    }
    if (erc20.mode !== 'transferFrom' && beforeRecipientTokens !== undefined) {
      diff.push({
        label: `${dest.slice(0, 10)}… ${tokenSymbol} balance`,
        before: fmtTokens(beforeRecipientTokens, tokenDecimals, tokenSymbol),
        after: fmtTokens(beforeRecipientTokens + erc20.amountRaw, tokenDecimals, tokenSymbol),
      })
    }
  }

  if (intent?.kind === 'eth') pushEthRows(intent)
  else if (intent?.kind === 'erc20') pushTokenRows(intent)
  else if (calldata) {
    diff.push({
      label: 'State diff',
      before: 'current state',
      after: 'not previewable — calldata pattern not recognized (simulation still validates execution)',
    })
  }

  // ---- governance impersonation ---------------------------------------------
  const callArgs = (to: Address, data: Hex, account: Address, callValue?: bigint) =>
    ({
      to,
      data,
      account,
      value: callValue,
      gas: 5_000_000n,
    }) as const

  const governanceData =
    mode === 'confirm'
      ? encodeFunctionData({
          abi: chamberAbi,
          functionName: 'confirmTransaction',
          args: [userTokenId, BigInt(txId)],
        })
      : encodeFunctionData({
          abi: chamberAbi,
          functionName: 'executeTransaction',
          args: [userTokenId, BigInt(txId), calldata ?? ('0x' as Hex)],
        })

  const runCall = async (to: Address, data: Hex, account: Address, callValue?: bigint): Promise<Error | null> => {
    try {
      await publicClient.call(callArgs(to, data, account, callValue))
      return null
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err))
    }
  }

  const ranAt = Date.now()
  const governanceError = await runCall(chamberAddress, governanceData, userAddress)
  if (governanceError) {
    return {
      status: 'reverted',
      ranAt,
      reason: humanizeSimulationError(governanceError),
      diff,
      token: tokenMeta,
    }
  }

  // ---- inner payload impersonated from the Chamber ---------------------------
  if (mode === 'execute' && calldata) {
    // Carry the proposal's ETH value so a payable call is simulated as sent.
    const innerError = await runCall(target, calldata, chamberAddress, value > 0n ? value : undefined)
    if (innerError) {
      return {
        status: 'reverted',
        ranAt,
        reason: humanizeSimulationError(innerError),
        diff,
        token: tokenMeta,
      }
    }
  }

  if (mode === 'confirm') {
    diff.push({
      label: 'Confirmations',
      before: 'not yet confirmed by you',
      after: 'your confirmation recorded — proposal moves toward quorum',
    })
  }

  return { status: 'passed', ranAt, diff, token: tokenMeta }
}
