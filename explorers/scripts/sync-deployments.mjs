// Keep explorers' committed deployment snapshots in sync with the
// contracts source of truth when it is available (local monorepo checkout).
// On Railway the build root is explorers/ only — app/contracts does not
// exist there — so this script must NEVER fail: it just leaves the
// committed snapshots in place.
//
// Source of truth:  <repo>/app/contracts/deployments/{mainnet,sepolia}.txt
// Snapshot target:  explorers/deployments/{mainnet,sepolia}.txt
//   (committed to git; src/lib/addresses.ts imports these with ?raw)

import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const explorersRoot = path.resolve(here, '..')
const snapshotDir = path.join(explorersRoot, 'deployments')
// from explorers/scripts -> repo root is ../../, then app/contracts
const sourceDir = path.resolve(explorersRoot, '..', 'app', 'contracts', 'deployments')

const FILES = ['mainnet.txt', 'sepolia.txt']

mkdirSync(snapshotDir, { recursive: true })

let synced = 0
for (const file of FILES) {
  const src = path.join(sourceDir, file)
  const dst = path.join(snapshotDir, file)

  if (existsSync(src) && statSync(src).isFile()) {
    copyFileSync(src, dst)
    synced += 1
    console.log(`[sync-deployments] ${file} <- app/contracts/deployments`)
  } else if (existsSync(dst)) {
    console.log(`[sync-deployments] ${file}: source not found, using committed snapshot`)
  } else {
    console.warn(`[sync-deployments] WARNING: ${file} missing from both source and snapshot`)
  }
}

console.log(`[sync-deployments] ${synced}/${FILES.length} file(s) refreshed from app/contracts`)
