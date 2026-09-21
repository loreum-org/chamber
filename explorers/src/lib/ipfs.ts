/**
 * IPFS URI resolution with gateway fallback.
 * Converts ipfs:// URIs to HTTPS gateway URLs and fetches metadata.
 */

const IPFS_GATEWAYS = [
  'https://ipfs.loreum.org/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
] as const

/** Convert an ipfs:// URI or plain CID to an HTTPS gateway URL. */
export function ipfsToGatewayUrl(uri: string, gatewayIndex = 0): string {
  const gateway = IPFS_GATEWAYS[gatewayIndex] ?? IPFS_GATEWAYS[0]!
  if (uri.startsWith('ipfs://')) {
    return `${gateway}${uri.slice(7)}`
  }
  // Already an HTTPS URL or bare CID
  if (uri.startsWith('https://') || uri.startsWith('http://')) {
    return uri
  }
  return `${gateway}${uri}`
}

/** Fetch JSON from an IPFS URI, trying each gateway in order. */
export async function fetchIpfsJson<T = unknown>(uri: string): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const url = ipfsToGatewayUrl(uri, i)
    try {
      const res = await fetch(url)
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${url}`)
        continue
      }
      return (await res.json()) as T
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error(`All IPFS gateways failed for ${uri}`)
}

/** NFT metadata standard fields. Never synthesized — only what the URI returns. */
export interface TokenMetadata {
  name?: string
  image?: string
  description?: string
  attributes?: Array<{ trait_type?: string; value?: unknown }>
}
