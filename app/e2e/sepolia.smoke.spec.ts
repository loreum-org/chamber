import { connectRainbowKitMetaMask, expect, test } from './fixtures'
import { sepoliaPrivateKey, targetChamberAddress } from './env'

/**
 * Short Sepolia wallet smoke: load app → RainbowKit + MetaMask → Sepolia →
 * open a known chamber (or connected My Chambers). Not submit/confirm/execute.
 *
 * `npm run test:e2e:sepolia` exits 0 when the key env is unset.
 */
test.describe('Sepolia wallet smoke', () => {
  test.skip(!sepoliaPrivateKey(), 'E2E_SEPOLIA_PRIVATE_KEY / SEPOLIA_PRIVATE_KEY unset')

  test('connect MetaMask and show wallet-gated chamber UI', async ({ page, wallet }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /deploy a chamber|my chambers/i })).toBeVisible()

    await connectRainbowKitMetaMask(page, wallet)

    const accountButton = page.getByTestId('rk-account-button')
    await expect(accountButton.first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'My chambers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Connect to see your chambers' })).toHaveCount(0)

    const chamber = targetChamberAddress()
    const openInput = page.getByPlaceholder(/open by address/i)
    await openInput.fill(chamber)
    await page.getByRole('button', { name: /^open$/i }).click()

    const chamberReady = page.getByRole('tab', { name: /overview/i }).or(
      page.getByRole('button', { name: /overview/i }),
    ).or(page.getByText('Your position'))
    const notChamber = page.getByRole('heading', { name: 'Not a Chamber' })
    const invalid = page.getByRole('heading', { name: 'Invalid Address' })

    await expect(chamberReady.or(notChamber).or(invalid).first()).toBeVisible({ timeout: 60_000 })

    if (await notChamber.isVisible().catch(() => false) || await invalid.isVisible().catch(() => false)) {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'My chambers' })).toBeVisible()
      await expect(accountButton.first()).toBeVisible()
      return
    }

    await expect(page).toHaveURL(new RegExp(`/chamber/${chamber}`, 'i'))
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible()
    await expect(accountButton.first()).toBeVisible()
  })
})
