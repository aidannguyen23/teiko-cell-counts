export const POP_LABELS: Record<string, string> = {
  b_cell: 'B cells',
  cd8_t_cell: 'CD8 T cells',
  cd4_t_cell: 'CD4 T cells',
  nk_cell: 'NK cells',
  monocyte: 'Monocytes',
}

export const POPULATIONS = Object.keys(POP_LABELS)

// slots 1 + 2 of the dataviz palette (colorblind safe pair)
export const COLORS = {
  responder: '#2a78d6',
  nonResponder: '#eb6834',
  accent: '#2a78d6',
  ink: '#0b0b0b',
  muted: '#898781', // lines only, too light for text
  axisText: '#5c5b57',
  grid: '#e1e0d9',
}

export const fmtInt = (n: number) => n.toLocaleString('en-US')

export function fmtP(p: number) {
  if (p < 0.001) return '< 0.001'
  return p.toFixed(3)
}
