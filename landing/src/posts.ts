export type BlogPost = {
  slug: string
  title: string
  date: string
  summary: string
  body: string
}

const FRONTMATTER_KEYS = ['title', 'date', 'summary'] as const

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const normalized = raw.replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---')) {
    throw new Error('Markdown post is missing YAML frontmatter')
  }
  const end = normalized.indexOf('\n---', 3)
  if (end === -1) {
    throw new Error('Markdown post has unclosed YAML frontmatter')
  }
  const fm = normalized.slice(4, end).trim()
  const body = normalized.slice(end + 4).replace(/^\r?\n/, '')
  const data: Record<string, string> = {}
  for (const line of fm.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colon = trimmed.indexOf(':')
    if (colon === -1) continue
    const key = trimmed.slice(0, colon).trim()
    let value = trimmed.slice(colon + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[key] = value
  }
  return { data, body }
}

const modules = import.meta.glob('../content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function loadPosts(): BlogPost[] {
  const posts = Object.entries(modules).map(([path, raw]) => {
    const filename = path.split('/').pop() ?? path
    const slug = filename.replace(/\.md$/, '')
    const { data, body } = parseFrontmatter(raw)
    for (const key of FRONTMATTER_KEYS) {
      if (!data[key]) {
        throw new Error(`Post ${slug} is missing frontmatter "${key}"`)
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new Error(`Post ${slug} date must be an ISO date (YYYY-MM-DD)`)
    }
    return {
      slug,
      title: data.title,
      date: data.date,
      summary: data.summary,
      body,
    }
  })

  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export const posts = loadPosts()

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug)
}

/** Format YYYY-MM-DD without timezone shift. */
export function formatPostDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[month - 1]} ${year}`
}
