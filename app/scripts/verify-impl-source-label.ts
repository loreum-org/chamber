/**
 * Offline checks for Factory-preferred impl-source banner copy.
 * Run: npx tsx --tsconfig tsconfig.json scripts/verify-impl-source-label.ts
 */
import assert from 'node:assert/strict'
import {
  implMismatchBannerCopy,
  preferredImplSourceLabel,
} from '../src/lib/implSource.ts'

function testPrefersFactoryWhenConfigured() {
  assert.equal(preferredImplSourceLabel(true, true), 'Factory')
  assert.equal(preferredImplSourceLabel(true, false), 'Factory')
}

function testRegistryOnlyWhenFactoryUnset() {
  assert.equal(preferredImplSourceLabel(false, true), 'Registry')
  assert.equal(preferredImplSourceLabel(false, false), undefined)
}

function testFactoryBannerCopy() {
  const copy = implMismatchBannerCopy('Factory')
  assert.equal(copy.title, 'New Chamber implementation available on the Factory')
  assert.equal(copy.defaultImplLead, 'The Factory’s default implementation is')
  assert.equal(copy.alignClause, 'aligns with the Factory')
  assert.equal(copy.viewLabel, 'View Factory')
  assert.equal(copy.title.includes('Registry'), false)
  assert.equal(copy.viewLabel.includes('Registry'), false)
}

function testRegistryBannerCopy() {
  const copy = implMismatchBannerCopy('Registry')
  assert.equal(copy.title, 'New Chamber implementation available on the Registry')
  assert.equal(copy.defaultImplLead, 'The Registry’s default implementation is')
  assert.equal(copy.alignClause, 'aligns with the Registry')
  assert.equal(copy.viewLabel, 'View Registry')
  assert.equal(copy.title.includes('Factory'), false)
}

testPrefersFactoryWhenConfigured()
testRegistryOnlyWhenFactoryUnset()
testFactoryBannerCopy()
testRegistryBannerCopy()
console.log('verify-impl-source-label: ok')
