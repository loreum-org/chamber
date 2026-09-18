import { useEffect } from 'react'

export const SITE_URL = 'https://loreum.org'

export const DEFAULT_TITLE = 'Loreum — Chamber: onchain governance for DAOs'

export const DEFAULT_DESCRIPTION =
  'Loreum Chamber: onchain governance for DAOs — factory-deployed ERC-4626 vault, liquid-delegated ranked board, and quorum wallet.'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = url
}

/**
 * Per-route title/description/canonical so crawlers and link previews see the
 * right card on an SPA. Restores the site defaults on unmount.
 */
export function useSeo(title: string, description: string, path: string) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`
    document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', url)
    setCanonical(url)
    return () => {
      document.title = DEFAULT_TITLE
      setMeta('name', 'description', DEFAULT_DESCRIPTION)
    }
  }, [title, description, path])
}
