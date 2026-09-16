export type PreferredImplSource = 'Factory' | 'Registry'

/**
 * Factory is the preferred impl source when configured. Registry is used only
 * when Factory is unset (legacy / Registry-only networks).
 */
export function preferredImplSourceLabel(
  factoryConfigured: boolean,
  registryConfigured: boolean,
): PreferredImplSource | undefined {
  if (factoryConfigured) return 'Factory'
  if (registryConfigured) return 'Registry'
  return undefined
}

export function implMismatchBannerCopy(source: PreferredImplSource): {
  title: string
  defaultImplLead: string
  alignClause: string
  viewLabel: string
} {
  switch (source) {
    case 'Factory':
      return {
        title: 'New Chamber implementation available on the Factory',
        defaultImplLead: 'The Factory’s default implementation is',
        alignClause: 'aligns with the Factory',
        viewLabel: 'View Factory',
      }
    case 'Registry':
      return {
        title: 'New Chamber implementation available on the Registry',
        defaultImplLead: 'The Registry’s default implementation is',
        alignClause: 'aligns with the Registry',
        viewLabel: 'View Registry',
      }
    default: {
      const _exhaustive: never = source
      throw new Error(`Unhandled impl source: ${_exhaustive}`)
    }
  }
}

export function implQueueUpgradeCopy(source: PreferredImplSource): {
  alreadyMatchesToast: string
  availableTitle: string
  availableLead: string
  proposalTitle: (versionLabel?: string) => string
  prefilledTitle: string
  prefilledImplLead: string
} {
  switch (source) {
    case 'Factory':
      return {
        alreadyMatchesToast: 'This chamber already matches the Factory’s default implementation.',
        availableTitle: 'Factory upgrade available',
        availableLead: 'Align this Chamber proxy with the Factory’s default implementation',
        proposalTitle: (versionLabel) =>
          `Upgrade Chamber to Factory implementation${versionLabel ? ` v${versionLabel}` : ''}`,
        prefilledTitle: 'Prefilled Factory upgrade proposal',
        prefilledImplLead: 'the Factory’s default implementation',
      }
    case 'Registry':
      return {
        alreadyMatchesToast: 'This chamber already matches the Registry’s default implementation.',
        availableTitle: 'Registry upgrade available',
        availableLead: 'Align this Chamber proxy with the Registry’s default implementation',
        proposalTitle: (versionLabel) =>
          `Upgrade Chamber to Registry implementation${versionLabel ? ` v${versionLabel}` : ''}`,
        prefilledTitle: 'Prefilled Registry upgrade proposal',
        prefilledImplLead: 'the Registry’s default implementation',
      }
    default: {
      const _exhaustive: never = source
      throw new Error(`Unhandled impl source: ${_exhaustive}`)
    }
  }
}
