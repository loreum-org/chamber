/**
 * Keeps `app/contracts/` in sync with repo-root `contracts/` when the latter exists,
 * so `npm run build` works from an app-only checkout (committed copies) or full monorepo.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')
const repoContracts = join(appRoot, '..', 'contracts')
const appContracts = join(appRoot, 'contracts')
const files = ['index.ts', 'abis.ts', 'deployments.json', 'deployments.d.ts']

function copyFromRepo() {
  mkdirSync(appContracts, { recursive: true })
  for (const name of files) {
    copyFileSync(join(repoContracts, name), join(appContracts, name))
  }
  console.log('sync-contracts: updated app/contracts from ../contracts')
}

if (existsSync(join(repoContracts, 'index.ts'))) {
  copyFromRepo()
} else if (!existsSync(join(appContracts, 'index.ts'))) {
  console.error(
    'sync-contracts: missing ../contracts and app/contracts — clone the full repo or run from monorepo root.',
  )
  process.exit(1)
}
