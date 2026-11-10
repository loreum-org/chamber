// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const LORE = '0x7756D245527F5f8925A537be509BF54feb2FdC99'
const LOREUM = '0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15'
const NOT_A_TOKEN = '0x0000000000000000000000000000000000000001'

const { createChamber } = vi.hoisted(() => ({
  createChamber: vi.fn(async () => '0xabc'),
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: true, chainId: 11155111, address: LORE }),
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false, variables: undefined }),
  useReadContract: ({ address, functionName }: { address?: string; functionName?: string }) => {
    const key = address?.toLowerCase()
    if (!key || key === NOT_A_TOKEN.toLowerCase()) return { data: undefined, isLoading: false }
    if (functionName === 'name') {
      return { data: key === LOREUM.toLowerCase() ? 'Loreum Explorers' : 'Lore', isLoading: false }
    }
    if (functionName === 'symbol') {
      return { data: key === LOREUM.toLowerCase() ? 'LOREUM' : 'LORE', isLoading: false }
    }
    return { data: undefined, isLoading: false }
  },
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => null,
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/components/SeatTheBoard', () => ({
  default: () => null,
}))

vi.mock('@/hooks', () => ({
  useCreateChamberTarget: () => ({
    address: '0x00000000000000000000000000000000000000a1',
    abi: [],
    source: 'factory' as const,
  }),
  useCreateChamberWithStatus: () => ({
    createChamber,
    status: 'idle' as const,
    isPending: false,
    isConfirming: false,
    error: null,
    hash: undefined,
    reset: vi.fn(),
  }),
}))

vi.mock('framer-motion', async () => {
  const React = await import('react')
  const skip = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'variants',
    'whileHover',
    'whileTap',
    'layout',
  ])
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
          const domProps: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(props)) {
            if (!skip.has(key)) domProps[key] = value
          }
          return React.createElement(tag, domProps, children)
        },
    },
  )
  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
  }
})

vi.mock('@/lib/wagmi', () => ({
  getConfiguredChainIds: () => [11155111],
  getContractAddresses: () => undefined,
  getNetworkName: () => 'Sepolia',
  getPreferredSupportedChainId: () => 11155111,
  getTestnetChainIds: () => [11155111],
  hasValidAddresses: () => true,
  isNonZeroAddress: () => false,
  config: {},
  LOCAL_CHAIN_ID: 31337,
}))

import DeployChamber from './DeployChamber'

const roots: Root[] = []

afterEach(() => {
  while (roots.length > 0) {
    act(() => {
      roots.pop()?.unmount()
    })
  }
  document.body.innerHTML = ''
  createChamber.mockClear()
})

function renderAt(path: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(DeployChamber) as ReactNode,
      ),
    )
  })
  return container
}

function inputs(container: ParentNode): HTMLInputElement[] {
  return [...container.querySelectorAll('input')]
}

function byPlaceholder(container: ParentNode, placeholder: string): HTMLInputElement {
  const match = inputs(container).find((input) => input.placeholder === placeholder)
  if (!match) throw new Error(`No input with placeholder ${placeholder}`)
  return match
}

function fill(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function buttonNamed(container: ParentNode, name: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(name),
  )
  if (!match) throw new Error(`No button named ${name}`)
  return match as HTMLButtonElement
}

describe('Deploy Chamber membership field', () => {
  it('renders one membership address input and one validation line', () => {
    const container = renderAt(`/deploy?erc20=${LORE}&erc721=${LOREUM}`)

    const membership = inputs(container).filter((input) => input.value === LOREUM)
    expect(membership).toHaveLength(1)
    expect(membership[0]?.required).toBe(true)

    const labels = [...container.querySelectorAll('label')].filter(
      (label) => label.textContent === 'Membership collection (ERC-721) *',
    )
    expect(labels).toHaveLength(1)

    const checks = [...container.querySelectorAll('span')].filter((node) =>
      node.textContent?.includes('Loreum Explorers (LOREUM)'),
    )
    expect(checks).toHaveLength(1)

    const assetChecks = [...container.querySelectorAll('span')].filter((node) =>
      node.textContent?.includes('Lore (LORE)'),
    )
    expect(assetChecks).toHaveLength(1)
  })

  it('shows a single error when the membership address is not an ERC-721', () => {
    const container = renderAt('/deploy')
    const addressInputs = inputs(container).filter((input) => input.placeholder === '0x...')
    expect(addressInputs).toHaveLength(2)

    fill(addressInputs[1]!, NOT_A_TOKEN)

    const errors = [...container.querySelectorAll('span')].filter((node) =>
      node.textContent?.includes('Address is not a valid ERC721 contract'),
    )
    expect(errors).toHaveLength(1)
    expect(buttonNamed(container, 'Review & Deploy').disabled).toBe(true)
  })

  it('reviews and deploys the single membership address', () => {
    const container = renderAt(`/deploy?erc20=${LORE}&erc721=${LOREUM}`)

    fill(byPlaceholder(container, 'e.g., Treasury Alpha'), 'Treasury Alpha')
    fill(byPlaceholder(container, 'e.g., ALPHA'), 'ALPHA')

    const review = buttonNamed(container, 'Review & Deploy')
    expect(review.disabled).toBe(false)
    act(() => {
      review.click()
    })

    const shown = container.textContent?.match(/0xB99DEdbD…ED044E15/g) ?? []
    expect(shown).toHaveLength(1)
    expect(container.textContent).toContain('Loreum Explorers (LOREUM)')

    const confirm = buttonNamed(container, 'Confirm Deploy')
    expect(confirm.disabled).toBe(false)
    act(() => {
      confirm.click()
    })

    expect(createChamber).toHaveBeenCalledTimes(1)
    expect(createChamber).toHaveBeenCalledWith(LORE, LOREUM, 5, 'Treasury Alpha', 'ALPHA')
  })
})
