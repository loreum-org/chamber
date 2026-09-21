import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const file = join(root, 'node_modules/cuer/_dist/QrCode.js')

const needle = `    const grid = encodeQR(value, 'raw', {
        border: 0,
        ecc: errorCorrection,
        scale: 1,
        version: version,
    });`

const replacement = `    const grid = encodeQR(value, 'raw', {
        border: 1,
        ecc: errorCorrection,
        scale: 1,
        version: version,
    })
        .slice(1, -1)
        .map((row) => row.slice(1, -1));`

const source = readFileSync(file, 'utf8')
if (source.includes(replacement)) {
  process.exit(0)
}
if (!source.includes(needle)) {
  console.error(
    'cuer QrCode.js no longer matches the border=0 patch; update scripts/patch-cuer-qr.mjs',
  )
  process.exit(1)
}

writeFileSync(file, source.replace(needle, replacement))

const viteCache = join(root, 'node_modules/.vite')
if (existsSync(viteCache)) {
  rmSync(viteCache, { recursive: true, force: true })
}
