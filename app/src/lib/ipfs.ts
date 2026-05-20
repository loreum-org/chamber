/**
 * NFT metadata URI handling (ERC-721 / ERC-1155 JSON, OpenSea-style extensions).
 *
 * References:
 * - ERC-721 metadata JSON schema https://eips.ethereum.org/EIPS/eip-721
 * - OpenSea metadata https://docs.opensea.io/docs/metadata-standards
 */

/** Loreum public gateway: `https://ipfs.loreum.org/ipfs/{cid-or-cid/path}` */
export const LOREUM_IPFS_GATEWAY_BASE = 'https://ipfs.loreum.org/ipfs'

/** Cloudflare relay for legacy / ipns-heavy URIs — covered by CSP `connect-src/img-src https:` */
const IPFS_DOT_IO = 'https://ipfs.io'
const ARWEAVE_NET = 'https://arweave.net'

const PROTOCOL_SCHEME = /^[a-z][a-z\d+.-]*:/i

/** Image-ish animation_url endings (avoid using raw MP4/HTML as <img src>) */
function looksLikeStaticImageHref(href: string): boolean {
  const h = href.trim().toLowerCase().split(/[?#]/)[0] ?? ''
  if (h.startsWith('data:image/')) return true
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:$|\/|\?)/.test(h) || /\/pinata\.cloud\/.+\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(href)
}

/**
 * Rewrite storage schemes to Loreum/IPFS-compatible HTTPS for fetch / <img src>.
 */
export function normalizeStorageUriToHttps(uri: string): string {
  const raw = uri.trim()

  const lowerStart = raw.toLowerCase()

  /* ipfs: — normalize legacy `ipfs://ipfs/CID`, trim slashes after scheme */
  if (lowerStart.startsWith('ipfs://')) {
    let rest = raw.slice('ipfs://'.length).replace(/^\/+/, '')
    if (rest.toLowerCase().startsWith('ipfs/')) rest = rest.slice('ipfs/'.length).replace(/^\/+/, '')
    return `${LOREUM_IPFS_GATEWAY_BASE}/${rest}`
  }

  /* ipfs path without scheme (broken but seen in dumps) — treat cidv0/cidv1 heuristic */
  if (!PROTOCOL_SCHEME.test(raw) && /^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|bafy[a-z2-7]{52,}\b)/i.test(raw)) {
    return `${LOREUM_IPFS_GATEWAY_BASE}/${raw}`
  }

  if (lowerStart.startsWith('ipns://')) {
    const host = raw.slice('ipns://'.length).replace(/^\/+/, '')
    /* Public resolver; CSP allows https:. */
    return `${IPFS_DOT_IO}/ipns/${host}`
  }

  if (/^ar:\/\//i.test(raw)) {
    const tx = raw.slice('ar://'.length).replace(/^\/+/, '')
    return `${ARWEAVE_NET}/${tx}`
  }

  if (/^arweave:\/\//i.test(raw)) {
    const tx = raw.slice('arweave://'.length).replace(/^\/+/, '')
    return `${ARWEAVE_NET}/${tx}`
  }

  return raw
}

/**
 * Turns `ipfs://…` (and cousins) into an HTTPS gateway URL passthrough-compatible with `<img>`.
 */
export function ipfsUriToLoreumHttps(uri: string): string {
  return normalizeStorageUriToHttps(uri)
}

export type Erc721JsonMetadata = {
  name?: string
  description?: string
  image?: string | string[] | { uri?: string; url?: string; gateway?: string; cid?: string; path?: string }
  /** OpenSea legacy / indexer mirror */
  image_url?: string
  animation_url?: string
  /** Tezos-ish / Rareible style */
  thumbnail_uri?: string
  /** Nested fields (ERC-1155-ish, Solana tooling JSON on EVM hybrids, etc.) */
  properties?:
    | {
        category?: string
        image?: string
        uri?: string
        files?: Array<string | ImageFileEntry>
      }
    | Record<string, unknown>

  media?:
    | Array<{ uri?: string; url?: string; gateway?: string; mimeType?: string; type?: string }>
    | { uri?: string; url?: string }
  /** Zora Metadata JSON */
  content?: { uri?: string; mime?: string }

  attributes?: unknown
}

export type ImageFileEntry = {
  uri?: string
  url?: string
  type?: string
  mimeType?: string
}

/** Browser-safe artwork URL (`<img>`). `data:image/...`, https, loreum-hosted ipfs transforms. */
export function artifactUriToDisplayUrl(uri: string | undefined): string | undefined {
  if (!uri?.trim()) return undefined
  const t = uri.trim()

  /* Inline images ( ERC-721 onchain metadata ) */
  if (t.toLowerCase().startsWith('data:image/')) return t

  return normalizeStorageUriToHttps(t)
}

/** String-only shorthand for simple `metadata.image`. */
export function metadataImageToUrl(image: string | undefined): string | undefined {
  return artifactUriToDisplayUrl(image)
}

function coerceObjectImageRef(v: Record<string, unknown>): string | undefined {
  const uri = typeof v.uri === 'string' ? v.uri.trim() : undefined
  const url = typeof v.url === 'string' ? v.url.trim() : undefined
  const gateway = typeof v.gateway === 'string' ? v.gateway.trim() : undefined
  const cid = typeof v.cid === 'string' ? v.cid.trim() : undefined
  const path = typeof v.path === 'string' ? v.path.trim() : undefined

  const u = uri || url
  if (u) return u
  if (cid) {
    const p = path?.replace(/^\/?/, '') ?? ''
    return p ? `ipfs://${cid}/${p}` : `ipfs://${cid}`
  }
  if (gateway && cid) {
    const g = gateway.replace(/\/$/, '')
    return `${g}/${cid}`
  }
  return undefined
}

function flattenImageArray(v: unknown[]): string | undefined {
  for (const entry of v) {
    if (typeof entry === 'string') {
      const x = entry.trim()
      if (x) return x
    }
    if (entry && typeof entry === 'object') {
      const u = coerceObjectImageRef(entry as Record<string, unknown>)
      if (u) return u
    }
  }
  return undefined
}

function pickFromProperties(properties: unknown): string | undefined {
  if (!properties || typeof properties !== 'object') return undefined
  const p = properties as Record<string, unknown>

  const direct =
    typeof p.image === 'string'
      ? p.image.trim()
      : typeof p.uri === 'string'
        ? p.uri.trim()
        : undefined
  if (direct) return direct

  const files = p.files
  if (!Array.isArray(files)) return undefined

  const imageMime = /^image\//i
  const imageExt = /\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[\s#?]|$)/i

  for (const f of files) {
    if (typeof f === 'string') {
      const s = f.trim()
      if (s && imageExt.test(s)) return s
    }
    if (f && typeof f === 'object') {
      const fe = f as ImageFileEntry
      const cand = fe.uri?.trim() || fe.url?.trim()
      const mime = fe.type?.trim() || fe.mimeType?.trim()
      if (!cand) continue
      if (mime && imageMime.test(mime)) return cand
      if (imageExt.test(cand)) return cand
    }
  }

  /* First URI in files if typing missing (common sloppy JSON) */
  for (const f of files) {
    if (f && typeof f === 'object') {
      const fe = f as ImageFileEntry
      const cand = fe.uri?.trim() || fe.url?.trim()
      if (cand) return cand
    }
  }
  return undefined
}

function pickFromMedia(media: Erc721JsonMetadata['media']): string | undefined {
  if (!media) return undefined
  if (Array.isArray(media)) {
    for (const m of media) {
      const mime = (m.mimeType ?? m.type ?? '').trim()
      const cand = (m.uri ?? m.url)?.trim()
      if (cand && (!mime || /^image\//i.test(mime))) return cand
    }
    /* Fall back to first usable uri/url */
    for (const m of media) {
      const cand = (m.uri ?? m.url)?.trim()
      if (cand) return cand
    }
  } else if (typeof media === 'object') {
    return (media.uri ?? media.url)?.trim()
  }
  return undefined
}

function pickFromContent(content: unknown): string | undefined {
  if (!content || typeof content !== 'object') return undefined
  const c = content as { uri?: string; mime?: string }
  const u = c.uri?.trim()
  if (!u) return undefined
  if (!c.mime?.trim()) return u
  if (/^image\//i.test(c.mime.trim())) return u
  return undefined
}

function pickLegacyImage(meta: Record<string, unknown>): string | undefined {
  /* Indexers / subgraph mirrors */
  for (const k of ['image_original', 'logo', 'imageUri', 'imageURI', 'display_image_uri']) {
    const v = meta[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

function pickPrimaryImageHref(meta: Erc721JsonMetadata | null | undefined): string | undefined {
  if (!meta) return undefined

  const v = meta.image as unknown
  if (typeof v === 'string') {
    const t = v.trim()
    if (t) return t
  }

  if (Array.isArray(v)) {
    const x = flattenImageArray(v as unknown[])
    if (x) return x
  }

  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = coerceObjectImageRef(v as Record<string, unknown>)
    if (o) return o
  }

  /* Order mirrors common indexer priority */
  const fromThumb = typeof meta.thumbnail_uri === 'string' ? meta.thumbnail_uri.trim() : undefined
  if (fromThumb) return fromThumb

  const fromImageUrl =
    typeof meta.image_url === 'string' ? meta.image_url.trim() : undefined
  if (fromImageUrl) return fromImageUrl

  const fromProp = pickFromProperties(meta.properties)
  if (fromProp) return fromProp

  const fromMedia = pickFromMedia(meta.media)
  if (fromMedia) return fromMedia

  const fromContent = pickFromContent(meta.content)
  if (fromContent) return fromContent

  const legacy = pickLegacyImage(meta as Record<string, unknown>)
  if (legacy) return legacy

  const anim = typeof meta.animation_url === 'string' ? meta.animation_url.trim() : undefined
  if (anim && looksLikeStaticImageHref(anim)) return anim

  return undefined
}

/**
 * Normalize relative image paths against the metadata document URL (post-redirect `Response.url`).
 */
export function resolveErc721ImageFromMetadata(
  meta: Erc721JsonMetadata | null | undefined,
  finalMetadataUrl?: string,
): string | undefined {
  const raw = pickPrimaryImageHref(meta)
  if (!raw) return undefined

  const t = raw.trim()

  /* Protocol / absolute URIs handled by normalization */
  if (
    PROTOCOL_SCHEME.test(t) ||
    t.toLowerCase().startsWith('data:image/') ||
    t.startsWith('//')
  ) {
    const normalized = t.startsWith('//') ? `https:${t}` : t
    return artifactUriToDisplayUrl(normalized)
  }

  if (!finalMetadataUrl?.trim()) {
    /* Bare CID / path fragments */
    const coerced = normalizeStorageUriToHttps(t)
    if (PROTOCOL_SCHEME.test(coerced)) return artifactUriToDisplayUrl(coerced)
    return artifactUriToDisplayUrl(t)
  }

  try {
    const base = new URL('.', finalMetadataUrl).href
    const joined = new URL(t, base).href
    return artifactUriToDisplayUrl(joined)
  } catch {
    return artifactUriToDisplayUrl(normalizeStorageUriToHttps(t))
  }
}

function unwrapMetadataEnvelope(parsed: unknown): Erc721JsonMetadata | null {
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>

  /* Direct NFT JSON or OpenSea-compatible root */
  if (
    'image' in o
    || 'name' in o
    || 'properties' in o
    || 'animation_url' in o
    || 'media' in o
    || 'content' in o
    || 'thumbnail_uri' in o
    || 'image_url' in o
  ) {
    return o as Erc721JsonMetadata
  }

  const meta = o.metadata
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta) as Erc721JsonMetadata
    } catch {
      return null
    }
  }
  if (meta && typeof meta === 'object') return meta as Erc721JsonMetadata

  const res = o.result
  if (res && typeof res === 'object') return res as Erc721JsonMetadata

  const data = o.data
  if (data && typeof data === 'object' && ('image' in data || 'name' in (data as object)))
    return data as Erc721JsonMetadata

  return null
}

function parseJsonDataUri(uri: string): Erc721JsonMetadata | null {
  if (!uri.toLowerCase().startsWith('data:application/json')) return null
  const base64Match = /^data:application\/json[^,]*;base64,(.+)$/i.exec(uri)
  if (base64Match) {
    try {
      const decoded = typeof atob === 'function' ? atob(base64Match[1]) : ''
      return unwrapMetadataEnvelope(JSON.parse(decoded))
    } catch {
      return null
    }
  }
  try {
    const payload = decodeURIComponent(uri.split(',').slice(1).join(','))
    return unwrapMetadataEnvelope(JSON.parse(payload))
  } catch {
    return null
  }
}

/**
 * Produce an HTTP(S) URL suitable for fetching JSON metadata, or empty if incompatible (caller handles data: inline).
 */
export function tokenUriToMetadataFetchUrl(tokenUri: string): string | null {
  const trimmed = tokenUri.trim()
  const low = trimmed.toLowerCase()

  if (low.startsWith('data:')) return null
  if (/^web3:\/\//i.test(trimmed)) return null /* ERC-4804 — needs resolver; unsupported in-browser */

  try {
    const u = normalizeStorageUriToHttps(trimmed)
    if (u.startsWith('http://') || u.startsWith('https://')) return u
  } catch {
    return null
  }
  return null
}

export type FetchedErc721Metadata = {
  meta: Erc721JsonMetadata
  /** Use for resolving relative `image` paths (post-redirect). */
  documentUrl: string
}

/**
 * Loads ERC-721-compatible metadata JSON from `tokenURI` (HTTPS, IPFS/IPNS/Arweave schemes, data:application/json).
 * ERC-4804 web3:// tokenURIs are not fetched in-browser here; use an indexer or RPC resolver.
 */
export async function fetchErc721Metadata(tokenUri: string): Promise<FetchedErc721Metadata | null> {
  const trimmed = tokenUri.trim()

  const fromData = parseJsonDataUri(trimmed)
  if (fromData) return { meta: fromData, documentUrl: '' }

  const fetchUrl = tokenUriToMetadataFetchUrl(trimmed)
  if (!fetchUrl) return null

  const res = await fetch(fetchUrl)
  if (!res.ok) return null
  try {
    const blob = await res.json()
    const meta = (unwrapMetadataEnvelope(blob) ?? blob) as Erc721JsonMetadata
    return { meta, documentUrl: res.url }
  } catch {
    return null
  }
}

/** Same as {@link fetchErc721Metadata} with backoff retries for flaky gateways / new tokens. */
export async function fetchErc721MetadataWithRetry(
  tokenUri: string,
  opts?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<FetchedErc721Metadata | null> {
  const maxAttempts = Math.max(1, opts?.maxAttempts ?? 5)
  /** Wait between attempts: base, 2×base, 3×base, … (default base 2.5s — slow IPFS / new mints). */
  const base = opts?.baseDelayMs ?? 2500
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, base * i))
    const pack = await fetchErc721Metadata(tokenUri)
    if (pack) return pack
  }
  return null
}
