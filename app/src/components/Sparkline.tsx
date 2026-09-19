import { useMemo } from 'react'
import { sparklineGeometry } from '@/lib/sparklineSvg'

interface SparklineProps {
  values: Array<number | null>
  width?: number
  height?: number
  /** Tailwind class for the stroke (e.g. text-accent-400's hex). */
  color?: string
  ariaLabel?: string
}

/**
 * Dependency-free SVG trend line used by the compliance widgets (#261).
 * Days without observable data are dropped rather than drawn as zero.
 */
export default function Sparkline({
  values,
  width = 240,
  height = 48,
  color = '#60a5fa',
  ariaLabel = 'Trend',
}: SparklineProps) {
  const geometry = useMemo(
    () => sparklineGeometry(values, width, height, 3),
    [values, width, height],
  )

  if (!geometry.polyline) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${ariaLabel}: no data`}
        className="block"
      >
        <text
          x={width / 2}
          y={height / 2 + 3}
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
          opacity="0.4"
        >
          no data
        </text>
      </svg>
    )
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="block"
    >
      <path d={geometry.area ?? undefined} fill={color} opacity="0.12" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={geometry.polyline}
      />
      {geometry.points.length > 0 && (
        <circle
          cx={geometry.points[geometry.points.length - 1].x}
          cy={geometry.points[geometry.points.length - 1].y}
          r="2"
          fill={color}
        />
      )}
    </svg>
  )
}