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
// `abis.ts` is hand-maintained in the app. `contracts/abis.ts` still lags
// the landed interfaces (pause, seating, registry paging, M-04/M-06).
// Do not overwrite until the handwritten repo ABI is regenerated.
const files = ['index.ts', 'deployments.json', 'deployments.d.ts']

function copyFromRepo() {
  mkdirSync(appContracts, { recursive: true })
  for (const name of files) {
    copyFileSync(join(repoContracts, name), join(appContracts, name))
  }
  const sepoliaRel = join('deployments', 'sepolia.txt')
  if (existsSync(join(repoContracts, sepoliaRel))) {
    mkdirSync(join(appContracts, 'deployments'), { recursive: true })
    copyFileSync(join(repoContracts, sepoliaRel), join(appContracts, sepoliaRel))
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
