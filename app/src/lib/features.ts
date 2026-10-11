/**
 * Build-time feature flags. Set the matching VITE_ env var to `'true'` to turn
 * a feature on.
 */

/**
 * Compliance dashboard (#261). Hidden for now: no nav entry, no route, and the
 * compliance metrics query never runs. Set VITE_ENABLE_COMPLIANCE=true to bring
 * it back.
 */
export const COMPLIANCE_ENABLED = import.meta.env.VITE_ENABLE_COMPLIANCE === 'true'
