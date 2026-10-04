import Plotly from 'plotly.js-dist-min'
import { useEffect, useRef } from 'react'

import { COLORS } from '@/lib/format'

type Props = {
  data: Plotly.Data[]
  layout?: Partial<Plotly.Layout>
  className?: string
}

const baseLayout: Partial<Plotly.Layout> = {
  font: { family: 'Geist Variable, system-ui, sans-serif', size: 12, color: COLORS.ink },
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  margin: { t: 16, r: 16, b: 48, l: 56 },
  hoverlabel: { bgcolor: '#ffffff', bordercolor: COLORS.grid, font: { color: COLORS.ink } },
  legend: { orientation: 'h', y: 1.12, x: 0 },
}

const axis = { gridcolor: COLORS.grid, zerolinecolor: COLORS.grid, linecolor: COLORS.grid, tickfont: { color: COLORS.muted } }

// small wrapper around plotly so we dont need react-plotly.js
export function Plot({ data, layout, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    Plotly.react(
      ref.current,
      data,
      {
        ...baseLayout,
        ...layout,
        xaxis: { ...axis, ...layout?.xaxis },
        yaxis: { ...axis, ...layout?.yaxis },
      },
      { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] },
    )
  }, [data, layout])

  useEffect(() => {
    const el = ref.current
    return () => {
      if (el) Plotly.purge(el)
    }
  }, [])

  return <div ref={ref} className={className} />
}
