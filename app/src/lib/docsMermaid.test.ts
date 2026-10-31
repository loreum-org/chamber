// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'

// Every ```mermaid block in the in-app docs must parse with the Mermaid
// version the app ships, or the Docs page shows a broken diagram.
const docsDir = path.resolve(__dirname, '../docs')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return markdownFiles(full)
    return name.endsWith('.md') ? [full] : []
  })
}

const diagrams = markdownFiles(docsDir).flatMap((file) => {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((m, i) => ({
    name: `${path.relative(docsDir, file)} #${i + 1}`,
    chart: m[1],
  }))
})

describe('docs mermaid diagrams', () => {
  it('finds diagrams to check', () => {
    expect(diagrams.length).toBeGreaterThan(0)
  })

  it.each(diagrams)('$name parses', async ({ chart }) => {
    await expect(mermaid.parse(chart)).resolves.toBeTruthy()
  })
})
