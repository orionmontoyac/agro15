import { cn } from "@/lib/utils"

type SparklineProps = {
  values: (number | null)[]
  className?: string
  /** Draw a dashed reference at this value when inside the range (e.g. base 100). */
  reference?: number
}

/** Tiny inline SVG trend line; nulls break the path. */
export function Sparkline({ values, className, reference }: SparklineProps) {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length < 2) return <div className={cn("h-10", className)} />

  const w = 120
  const h = 40
  const pad = 2
  let min = Math.min(...nums)
  let max = Math.max(...nums)
  if (max === min) {
    max += 1
    min -= 1
  }
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (h - pad * 2)

  let d = ""
  let penDown = false
  values.forEach((v, i) => {
    if (v == null) {
      penDown = false
      return
    }
    d += `${penDown ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    penDown = true
  })

  const showRef = reference != null && reference >= min && reference <= max

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-10 w-full overflow-visible", className)}
      aria-hidden
    >
      {showRef ? (
        <line
          x1={0}
          x2={w}
          y1={y(reference)}
          y2={y(reference)}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
