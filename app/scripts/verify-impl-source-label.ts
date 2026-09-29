/**
 * Offline checks for Factory-preferred impl-source banner and Queue upgrade copy.
 * Run: npx tsx --tsconfig tsconfig.json scripts/verify-impl-source-label.ts
 */
import assert from 'node:assert/strict'
import {
  implMismatchBannerCopy,
  implQueueUpgradeCopy,
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

function testFactoryQueueUpgradeCopy() {
  const copy = implQueueUpgradeCopy('Factory')
  assert.equal(copy.alreadyMatchesToast, 'This chamber already matches the Factory’s default implementation.')
  assert.equal(copy.availableTitle, 'Factory upgrade available')
  assert.equal(copy.availableLead, 'Align this Chamber proxy with the Factory’s default implementation')
  assert.equal(copy.proposalTitle('1.1.5'), 'Upgrade Chamber to Factory implementation v1.1.5')
  assert.equal(copy.proposalTitle(), 'Upgrade Chamber to Factory implementation')
  assert.equal(copy.prefilledTitle, 'Prefilled Factory upgrade proposal')
  assert.equal(copy.prefilledImplLead, 'the Factory’s default implementation')
  assert.equal(copy.alreadyMatchesToast.includes('Registry'), false)
  assert.equal(copy.availableTitle.includes('Registry'), false)
  assert.equal(copy.proposalTitle('1.1.5').includes('Registry'), false)
  assert.equal(copy.prefilledTitle.includes('Registry'), false)
}

function testRegistryQueueUpgradeCopy() {
  const copy = implQueueUpgradeCopy('Registry')
  assert.equal(copy.alreadyMatchesToast, 'This chamber already matches the Registry’s default implementation.')
  assert.equal(copy.availableTitle, 'Registry upgrade available')
  assert.equal(copy.availableLead, 'Align this Chamber proxy with the Registry’s default implementation')
  assert.equal(copy.proposalTitle('1.1.4'), 'Upgrade Chamber to Registry implementation v1.1.4')
  assert.equal(copy.prefilledTitle, 'Prefilled Registry upgrade proposal')
  assert.equal(copy.prefilledImplLead, 'the Registry’s default implementation')
  assert.equal(copy.alreadyMatchesToast.includes('Factory'), false)
  assert.equal(copy.availableTitle.includes('Factory'), false)
}

testPrefersFactoryWhenConfigured()
testRegistryOnlyWhenFactoryUnset()
testFactoryBannerCopy()
testRegistryBannerCopy()
testFactoryQueueUpgradeCopy()
testRegistryQueueUpgradeCopy()
console.log('verify-impl-source-label: ok')
