/**
 * Offline: committed mainnet.txt records the Nov 10, 2026 Factory receipt.
 * Chamber proxy and Registry stay unset. Sepolia Factories are warnings only.
 *
 * Run: npm run test:mainnet-addresses
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAddress, isAddress } from 'viem'

const ZERO = '0x0000000000000000000000000000000000000000'
const SEPOLIA_FACTORY = '0x43aA92c8A26392f21F63cdA88B6BaB5031C40550'
const SEPOLIA_FACTORY_NOV_2026 = '0xE87FF28C44593122e4BD87e48A18c9f08eBc811d'
const MAINNET_FACTORY = '0x35977d540799db1e8910c00F476a879E2c0e1a24'
const MAINNET_CHAMBER_IMPL = '0x49479286057636c820b6bEBcc048c17A79C59DB4'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const txt = readFileSync(join(root, 'contracts/deployments/mainnet.txt'), 'utf8')

const LINE_PARSERS = [
  { key: 'registry', re: /^Registry \(proxy\)\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'factory', re: /^Factory\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'chamberImplementation', re: /^Chamber implementation\s+(0x[a-fA-F0-9]{40})\s*$/i },
] as const

const parsed = { registry: ZERO, factory: ZERO, chamberImplementation: ZERO }
for (const line of txt.split(/\r?\n/)) {
  const trimmed = line.trim()
  for (const { key, re } of LINE_PARSERS) {
    const match = trimmed.match(re)
    if (!match?.[1] || !isAddress(match[1])) continue
    parsed[key] = getAddress(match[1])
  }
}

assert.equal(parsed.factory, MAINNET_FACTORY)
assert.equal(parsed.chamberImplementation, MAINNET_CHAMBER_IMPL)
assert.equal(parsed.registry, ZERO, 'Registry must stay unset')
assert.match(txt, /Factory start block\s+26379502/)
assert.match(txt, /Chamber \(proxy\)\s+TBD/)
assert.match(txt, /Registry \(proxy\)\s+TBD/)
assert.ok(txt.includes(SEPOLIA_FACTORY), 'must warn against copying the Aug 26 Sepolia Factory')
assert.ok(txt.includes(SEPOLIA_FACTORY_NOV_2026), 'must warn against copying the Nov 2026 Sepolia Factory')
assert.ok(!/^Factory\s+0x43aA92c8A26392f21F63cdA88B6BaB5031C40550/m.test(txt))
assert.ok(!/^Factory\s+0xE87FF28C44593122e4BD87e48A18c9f08eBc811d/m.test(txt))

console.log('mainnet.txt: Factory receipt is recorded; proxy and Registry stay unset')
