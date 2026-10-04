import { extent, quantile } from 'd3-array'
import { scaleBand, scaleLinear } from 'd3-scale'
import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { COLORS } from '@/lib/format'

// small svg charts. replaced plotly, its hover labels were messy and it was 4.6mb

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const TOOLTIP_W = 184

function Tooltip({ left, top, title, color, rows }: { left: number; top: number; title?: string; color?: string; rows: [string, string][] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 rounded-lg border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg"
      style={{ left, top, width: TOOLTIP_W }}
    >
      {title && (
        <div className="mb-2 flex items-center gap-2 font-medium">
          {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
          {title}
        </div>
      )}
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const axisText = { fontSize: 12, fill: COLORS.axisText }

function YAxis({ ticks, y, left, right, fmt }: { ticks: number[]; y: (v: number) => number; left: number; right: number; fmt: (v: number) => string }) {
  return (
    <g aria-hidden>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke={COLORS.grid} />
          <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" {...axisText}>
            {fmt(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

// ---- boxplot ----

export type BoxGroup = { key: string; label: string; color: string; values: number[] }

function boxStats(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  const q1 = quantile(s, 0.25) ?? 0
  const median = quantile(s, 0.5) ?? 0
  const q3 = quantile(s, 0.75) ?? 0
  const iqr = q3 - q1
  // tukey whiskers: furthest points within 1.5 IQR of the box
  const inside = s.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr)
  const lo = inside[0] ?? q1
  const hi = inside[inside.length - 1] ?? q3
  return { n: s.length, q1, median, q3, lo, hi, outliers: s.filter((v) => v < lo || v > hi) }
}

const pct = (v: number) => `${v.toFixed(2)}%`

export function BoxPlot({ groups, unitLabel, height = 240 }: { groups: BoxGroup[]; unitLabel: string; height?: number }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const boxes = useMemo(() => groups.map((g) => ({ ...g, ...boxStats(g.values) })), [groups])

  const m = { t: 10, r: 8, b: 28, l: 40 }
  const [min, max] = extent(groups.flatMap((g) => g.values)) as [number, number]
  const y = scaleLinear()
    .domain([min ?? 0, max ?? 1])
    .nice()
    .range([height - m.b, m.t])
  const x = scaleBand()
    .domain(groups.map((g) => g.key))
    .range([m.l, Math.max(width - m.r, m.l + 1)])
    .padding(0.4)
  const bw = x.bandwidth()
  const cur = boxes.find((b) => b.key === active)

  let tip: ReactNode = null
  if (cur) {
    const bx = x(cur.key) ?? 0
    // open toward the middle of the chart so it never runs off the edge
    const onLeftHalf = bx + bw / 2 < width / 2
    tip = (
      <Tooltip
        left={onLeftHalf ? bx + bw + 10 : bx - TOOLTIP_W - 10}
        top={Math.min(Math.max(y(cur.q3) - 20, 0), height - 150)}
        title={cur.label}
        color={cur.color}
        rows={[
          ['n', `${cur.n} ${unitLabel}`],
          ['Median', pct(cur.median)],
          ['Q1 to Q3', `${pct(cur.q1)} to ${pct(cur.q3)}`],
          ['Whiskers', `${pct(cur.lo)} to ${pct(cur.hi)}`],
          ['Outliers', String(cur.outliers.length)],
        ]}
      />
    )
  }

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="overflow-visible">
          <YAxis ticks={y.ticks(5)} y={y} left={m.l} right={width - m.r} fmt={(v) => `${v}%`} />
          {boxes.map((b) => {
            const bx = x(b.key) ?? 0
            const cx = bx + bw / 2
            const dim = active !== null && active !== b.key
            return (
              <g
                key={b.key}
                tabIndex={0}
                role="img"
                aria-label={`${b.label}: median ${pct(b.median)}, middle half of ${unitLabel} between ${pct(b.q1)} and ${pct(b.q3)}, ${b.n} ${unitLabel}`}
                onMouseEnter={() => setActive(b.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => {
                  setActive(b.key)
                  setFocused(true)
                }}
                onBlur={() => {
                  setActive(null)
                  setFocused(false)
                }}
                className="cursor-default outline-none"
                style={{ opacity: dim ? 0.35 : 1, transition: 'opacity 150ms' }}
              >
                {/* hit area, highlighted only for keyboard focus (hover already dims the other box) */}
                <rect
                  x={bx - bw * 0.3}
                  y={m.t}
                  width={bw * 1.6}
                  height={height - m.t - m.b}
                  rx={6}
                  fill="transparent"
                  stroke={focused && active === b.key ? COLORS.accent : 'none'}
                  strokeWidth={2}
                />
                <line x1={cx} x2={cx} y1={y(b.hi)} y2={y(b.q3)} stroke={b.color} strokeWidth={1.5} />
                <line x1={cx} x2={cx} y1={y(b.q1)} y2={y(b.lo)} stroke={b.color} strokeWidth={1.5} />
                <line x1={cx - bw * 0.18} x2={cx + bw * 0.18} y1={y(b.hi)} y2={y(b.hi)} stroke={b.color} strokeWidth={1.5} />
                <line x1={cx - bw * 0.18} x2={cx + bw * 0.18} y1={y(b.lo)} y2={y(b.lo)} stroke={b.color} strokeWidth={1.5} />
                <rect
                  x={bx}
                  y={y(b.q3)}
                  width={bw}
                  height={Math.max(y(b.q1) - y(b.q3), 1)}
                  rx={4}
                  fill={b.color}
                  fillOpacity={0.14}
                  stroke={b.color}
                  strokeWidth={1.5}
                />
                <line x1={bx} x2={bx + bw} y1={y(b.median)} y2={y(b.median)} stroke={b.color} strokeWidth={2.5} />
                {b.outliers.map((v, i) => (
                  <circle key={i} cx={cx} cy={y(v)} r={2.5} fill={b.color} fillOpacity={0.45} />
                ))}
                <text x={cx} y={height - 8} textAnchor="middle" {...axisText}>
                  {b.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {tip}
    </div>
  )
}

// ---- scatter (diagnostics) ----

export function ScatterPlot({
  xs,
  ys,
  refLine,
  xLabel,
  yLabel,
  label,
  height = 280,
}: {
  xs: number[]
  ys: number[]
  refLine: [[number, number], [number, number]]
  xLabel: string
  yLabel: string
  label: string
  height?: number
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)

  const m = { t: 10, r: 24, b: 44, l: 52 }
  const x = scaleLinear()
    .domain(extent([...xs, refLine[0][0], refLine[1][0]]) as [number, number])
    .nice()
    .range([m.l, Math.max(width - m.r, m.l + 1)])
  const y = scaleLinear()
    .domain(extent([...ys, refLine[0][1], refLine[1][1]]) as [number, number])
    .nice()
    .range([height - m.b, m.t])

  // nearest point to the cursor, ~2k points so a plain loop is fine
  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    let best = -1
    let bestD = 24 * 24
    for (let i = 0; i < xs.length; i++) {
      const d = (x(xs[i]) - mx) ** 2 + (y(ys[i]) - my) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    setHover(best < 0 ? null : best)
  }

  return (
    <div ref={ref} className="relative" style={{ height }} role="img" aria-label={label}>
      {width > 0 && (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} aria-hidden>
          <YAxis ticks={y.ticks(5)} y={y} left={m.l} right={width - m.r} fmt={(v) => String(v)} />
          {x.ticks(6).map((t) => (
            <text key={t} x={x(t)} y={height - m.b + 16} textAnchor="middle" {...axisText}>
              {t}
            </text>
          ))}
          <text x={(m.l + width - m.r) / 2} y={height - 6} textAnchor="middle" {...axisText}>
            {xLabel}
          </text>
          <text transform={`translate(14 ${(m.t + height - m.b) / 2}) rotate(-90)`} textAnchor="middle" {...axisText}>
            {yLabel}
          </text>
          <line
            x1={x(refLine[0][0])}
            y1={y(refLine[0][1])}
            x2={x(refLine[1][0])}
            y2={y(refLine[1][1])}
            stroke={COLORS.muted}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          {xs.map((v, i) => (
            <circle key={i} cx={x(v)} cy={y(ys[i])} r={2.5} fill={COLORS.accent} fillOpacity={0.35} />
          ))}
          {hover !== null && (
            <circle cx={x(xs[hover])} cy={y(ys[hover])} r={5} fill={COLORS.accent} stroke="#fff" strokeWidth={2} />
          )}
        </svg>
      )}
      {hover !== null && (
        <Tooltip
          left={x(xs[hover]) + 12 + TOOLTIP_W > width ? x(xs[hover]) - TOOLTIP_W - 12 : x(xs[hover]) + 12}
          top={Math.max(y(ys[hover]) - 30, 0)}
          rows={[
            [xLabel, xs[hover].toFixed(2)],
            [yLabel, ys[hover].toFixed(2)],
          ]}
        />
      )}
    </div>
  )
}

// ---- horizontal breakdown (baseline counts) ----
// a real table with inline bars, so screen readers just get the numbers

export function Breakdown({
  caption,
  unit,
  rows,
  total,
}: {
  caption: string
  unit: string
  rows: { label: string; n: number; color: string }[]
  total: number
}) {
  return (
    <table className="w-full text-sm">
      <caption className="mb-3 text-left text-sm font-medium">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Group</th>
          <th scope="col">{unit}</th>
          <th scope="col">Percent</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const p = (100 * r.n) / total
          return (
            <tr key={r.label}>
              <th scope="row" className="w-32 py-2 pr-3 text-left font-normal text-muted-foreground">
                {r.label}
              </th>
              <td className="py-2" aria-hidden>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full" style={{ width: `${p}%`, background: r.color }} />
                </div>
              </td>
              <td className="w-14 py-2 pl-3 text-right font-medium tabular-nums">{r.n}</td>
              <td className="w-16 py-2 pl-2 text-right text-muted-foreground tabular-nums">{p.toFixed(1)}%</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
