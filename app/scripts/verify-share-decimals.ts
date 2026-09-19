/**
 * Offline checks: chamber share amounts use ERC-4626 decimals() (asset + offset),
 * not hardcoded 18. Run: npx tsx --tsconfig tsconfig.json scripts/verify-share-decimals.ts
 */
import assert from 'node:assert/strict'
import { formatUnits, parseUnits } from 'viem'
import { resolveTokenDecimals } from '../src/lib/utils.ts'

/** Chamber._decimalsOffset() — ERC-4626 virtual-share protection */
const DECIMALS_OFFSET = 3

function shareDecimals(assetDecimals: number): number {
  return assetDecimals + DECIMALS_OFFSET
}

function testResolveTokenDecimals() {
  assert.equal(resolveTokenDecimals(21), 21)
  assert.equal(resolveTokenDecimals(9), 9)
  assert.equal(resolveTokenDecimals(21n), 21)
  assert.equal(resolveTokenDecimals(undefined), 18)
  assert.equal(resolveTokenDecimals(null), 18)
  assert.equal(resolveTokenDecimals(99), 18)
  assert.equal(resolveTokenDecimals(-1), 18)
}

function testWethSharesAreNotScaledAs18() {
  const decimals = shareDecimals(18)
  assert.equal(decimals, 21)
  const oneShare = parseUnits('1', decimals)
  assert.equal(formatUnits(oneShare, decimals), '1')
  assert.notEqual(formatUnits(oneShare, 18), '1')
  assert.equal(formatUnits(oneShare, 18), '1000')
}

function testUsdcSharesAreNotScaledAs18() {
  const decimals = shareDecimals(6)
  assert.equal(decimals, 9)
  const oneShare = parseUnits('1', decimals)
  assert.equal(formatUnits(oneShare, decimals), '1')
  assert.notEqual(formatUnits(oneShare, 18), '1')
}

function testAssetDecimalsAloneMisparsesShares() {
  const shareDec = shareDecimals(6)
  const typed = parseUnits('1', shareDec)
  const wrongAssetOnly = parseUnits('1', 6)
  assert.notEqual(typed, wrongAssetOnly)
  assert.equal(typed / wrongAssetOnly, 10n ** BigInt(DECIMALS_OFFSET))
}

testResolveTokenDecimals()
testWethSharesAreNotScaledAs18()
testUsdcSharesAreNotScaledAs18()
testAssetDecimalsAloneMisparsesShares()
console.log('verify-share-decimals: ok')
