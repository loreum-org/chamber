/** Production default so CTAs work when env is unset in a static build. */
export const chamberAppUrl =
  (import.meta.env.VITE_CHAMBER_APP_URL as string | undefined)?.trim() ||
  'https://app.loreum.org'
