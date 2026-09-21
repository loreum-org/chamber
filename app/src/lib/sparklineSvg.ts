/**
 * Tiny dependency-free sparkline geometry shared by the dashboard widgets and
 * the printable PDF report (which inlines the same SVG markup).
 */

export interface SparklinePoint {
  x: number
  y: number
}

export interface SparklineGeometry {
  /** "x,y x,y …" polyline points string, or null when there is nothing to draw. */
  polyline: string | null
  /** Closed area path under the line (for a soft fill), or null. */
  area: string | null
  points: SparklinePoint[]
}

/**
 * Map a series onto a width×height box. Null values are dropped; the remaining
 * points are spaced evenly across the width by index.
 */
export function sparklineGeometry(
  values: Array<number | null>,
  width: number,
  height: number,
  pad = 2,
): SparklineGeometry {
  const live = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (live.length === 0) return { polyline: null, area: null, points: [] }
  const min = Math.min(...live)
  const max = Math.max(...live)
  const span = max - min
  const usableWidth = width - pad * 2
  const usableHeight = height - pad * 2
  const points: SparklinePoint[] = live.map((value, i) => ({
    x: pad + (live.length === 1 ? usableWidth / 2 : (i / (live.length - 1)) * usableWidth),
    y: pad + (span === 0 ? usableHeight / 2 : (1 - (value - min) / span) * usableHeight),
  }))
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const area =
    `M ${first.x.toFixed(1)},${(height - pad).toFixed(1)} ` +
    points.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L ${last.x.toFixed(1)},${(height - pad).toFixed(1)} Z`
  return { polyline, area, points }
}

/** Standalone inline-SVG sparkline markup (used in the printable report). */
export function sparklineSvgMarkup(
  values: Array<number | null>,
  width: number,
  height: number,
  color: string,
): string {
  const { polyline, area } = sparklineGeometry(values, width, height, 4)
  if (!polyline) {
    return (
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
      `role="img" aria-label="No data"></svg>`
    )
  }
  return (
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend">` +
    `<path d="${area}" fill="${color}" opacity="0.12"/>` +
    `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" ` +
    `stroke-linecap="round" points="${polyline}"/>` +
    `</svg>`
  )
}
