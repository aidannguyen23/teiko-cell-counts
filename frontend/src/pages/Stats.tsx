import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ErrorNote, PageHeader, usePageTitle } from '@/components/Layout'
import { Plot } from '@/components/Plot'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type BoxplotRow, type DiagnosticRow, type StatsRow, useApi } from '@/lib/api'
import { COLORS, fmtP, POP_LABELS, POPULATIONS } from '@/lib/format'

type Point = { response: 'yes' | 'no'; population: string; percentage: number }

// average each subjects 3 timepoints -> one point per subject
function subjectMeans(rows: BoxplotRow[]): Point[] {
  const acc = new Map<string, Point & { n: number }>()
  for (const r of rows) {
    const key = `${r.subject_id}|${r.population}`
    const cur = acc.get(key)
    if (cur) {
      cur.percentage += r.percentage
      cur.n += 1
    } else {
      acc.set(key, { response: r.response, population: r.population, percentage: r.percentage, n: 1 })
    }
  }
  return [...acc.values()].map(({ n, ...p }) => ({ ...p, percentage: p.percentage / n }))
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: COLORS.responder }} /> Responders
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: COLORS.nonResponder }} /> Non-responders
      </span>
    </div>
  )
}

function Boxplots({ rows, stats }: { rows: BoxplotRow[]; stats: StatsRow[] }) {
  const [unit, setUnit] = useState<'sample' | 'subject'>('sample')
  const points = useMemo(() => (unit === 'sample' ? rows : subjectMeans(rows)), [rows, unit])
  const byPop = useMemo(() => Object.fromEntries(stats.map((s) => [s.population, s])), [stats])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Responders vs non-responders</h2>
        </CardTitle>
        <CardDescription>
          relative frequency of each population. melanoma patients on miraclib, PBMC samples only
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Legend />
          <Tabs value={unit} onValueChange={(v) => setUnit(v as 'sample' | 'subject')}>
            <TabsList aria-label="Plot unit">
              <TabsTrigger value="sample">Per sample</TabsTrigger>
              <TabsTrigger value="subject">Per subject (mean)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POPULATIONS.map((pop) => {
            const s = byPop[pop]
            const data = (['yes', 'no'] as const).map((resp) => ({
              type: 'box' as const,
              name: resp === 'yes' ? 'Responders' : 'Non-responders',
              y: points.filter((p) => p.population === pop && p.response === resp).map((p) => p.percentage),
              marker: { color: resp === 'yes' ? COLORS.responder : COLORS.nonResponder, size: 4 },
              line: { width: 1.5 },
              boxpoints: 'outliers' as const,
              hovertemplate: '%{y:.2f}%<extra>%{fullData.name}</extra>',
            }))
            return (
              <div key={pop} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-medium">{POP_LABELS[pop]}</h3>
                  {s && (
                    <span className={`text-xs tabular-nums ${s.significant ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                      q = {fmtP(s.q_value)}
                    </span>
                  )}
                </div>
                <Plot
                  className="h-64"
                  label={`boxplot of ${POP_LABELS[pop]} percentage, responders vs non-responders${s ? `, q = ${fmtP(s.q_value)}` : ''}. exact numbers are in the results table below`}
                  data={data}
                  layout={{
                    showlegend: false,
                    margin: { t: 8, r: 8, b: 32, l: 44 },
                    yaxis: { title: { text: '% of cells' }, ticksuffix: '' },
                  }}
                />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function StatsTable({ stats }: { stats: StatsRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Test results</h2>
        </CardTitle>
        <CardDescription>
          difference = responders minus non-responders (percentage points) from the mixed model. highlighted rows are
          significant after BH correction (q &lt; 0.05)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <caption className="sr-only">mixed model results per population</caption>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Population</TableHead>
                <TableHead className="text-right">Responders</TableHead>
                <TableHead className="text-right">Non-resp.</TableHead>
                <TableHead className="text-right">Difference (95% CI)</TableHead>
                <TableHead className="text-right">p</TableHead>
                <TableHead className="text-right">q (BH)</TableHead>
                <TableHead className="text-right">MWU q</TableHead>
                <TableHead>
                  <span className="sr-only">Result</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.population} className={s.significant ? 'bg-primary/5 hover:bg-primary/10' : ''}>
                  <TableCell className={s.significant ? 'font-medium' : ''}>{POP_LABELS[s.population]}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.mean_responders.toFixed(2)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{s.mean_non_responders.toFixed(2)}%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.estimate > 0 ? '+' : ''}
                    {s.estimate.toFixed(2)}{' '}
                    <span className="text-muted-foreground">
                      ({s.ci_low.toFixed(2)}, {s.ci_high.toFixed(2)})
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtP(s.p_value)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${s.significant ? 'font-medium text-primary' : ''}`}>
                    {fmtP(s.q_value)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtP(s.mwu_q_value)}</TableCell>
                  <TableCell>{s.significant ? <Badge>significant</Badge> : <Badge variant="outline">not significant</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function Diagnostics({ rows }: { rows: DiagnosticRow[] }) {
  const [open, setOpen] = useState(false)
  const [pop, setPop] = useState(POPULATIONS[0])

  const plots = useMemo(() => {
    const d = rows.filter((r) => r.population === pop)
    const resid = d.map((r) => r.residual)
    const sd = Math.sqrt(resid.reduce((a, b) => a + b * b, 0) / Math.max(resid.length - 1, 1))
    const qs = d.map((r) => r.theoretical_quantile)
    const qMin = Math.min(...qs)
    const qMax = Math.max(...qs)
    const fitted = d.map((r) => r.fitted)
    const marker = { color: COLORS.accent, size: 4, opacity: 0.45 }
    return {
      qq: [
        { type: 'scattergl' as const, mode: 'markers' as const, x: qs, y: resid, marker, hovertemplate: '%{x:.2f}, %{y:.2f}<extra></extra>' },
        { type: 'scatter' as const, mode: 'lines' as const, x: [qMin, qMax], y: [qMin * sd, qMax * sd], line: { color: COLORS.muted, width: 1.5, dash: 'dash' as const }, hoverinfo: 'skip' as const },
      ],
      rvf: [
        { type: 'scattergl' as const, mode: 'markers' as const, x: fitted, y: resid, marker, hovertemplate: 'fitted %{x:.2f}<br>resid %{y:.2f}<extra></extra>' },
        { type: 'scatter' as const, mode: 'lines' as const, x: [Math.min(...fitted), Math.max(...fitted)], y: [0, 0], line: { color: COLORS.muted, width: 1.5, dash: 'dash' as const }, hoverinfo: 'skip' as const },
      ],
    }
  }, [rows, pop])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between rounded-md px-4 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <div>
              <h2 className="font-medium">Model diagnostics</h2>
              <p className="text-sm text-muted-foreground">residual QQ plot + residuals vs fitted, to check the normality assumption</p>
            </div>
            <ChevronDown aria-hidden className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-2">
            <Select value={pop} onValueChange={setPop}>
              <SelectTrigger aria-label="Population for diagnostics" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POPULATIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {POP_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {open && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <h3 className="px-1 text-sm font-medium">Normal QQ</h3>
                  <Plot
                    className="h-72"
                    label={`normal QQ plot of ${POP_LABELS[pop]} model residuals`}
                    data={plots.qq}
                    layout={{ showlegend: false, xaxis: { title: { text: 'theoretical quantile' } }, yaxis: { title: { text: 'residual' } } }}
                  />
                </div>
                <div className="rounded-lg border p-3">
                  <h3 className="px-1 text-sm font-medium">Residuals vs fitted</h3>
                  <Plot
                    className="h-72"
                    label={`residuals vs fitted values for the ${POP_LABELS[pop]} model`}
                    data={plots.rvf}
                    layout={{ showlegend: false, xaxis: { title: { text: 'fitted %' } }, yaxis: { title: { text: 'residual' } } }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function Methods({ stats }: { stats: StatsRow[] }) {
  const n = stats[0]
  const singular = stats.every((s) => s.re_singular)
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Methods + caveats</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Data.</span> melanoma patients treated w/ miraclib, PBMC samples
          only{n && ` (${n.n_subjects} subjects, ${n.n_samples} samples)`}. each subject was sampled at day 0, 7 and 14.
        </p>
        <p>
          <span className="font-medium text-foreground">Model.</span> since every subject shows up 3 times the samples
          arent independent, so a plain test on all samples would overcount. for each population i fit a linear mixed
          model <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">percentage ~ responder + time + (1 | subject)</code>{' '}
          and test the responder coefficient. p-values are Benjamini-Hochberg corrected across the 5 populations (q
          values). a Mann-Whitney U test on each subjects mean is shown as a nonparametric check.
        </p>
        {singular && (
          <p>
            <span className="font-medium text-foreground">Subject variance came out ~0.</span> the random intercept
            variance is basically zero for every population (ICC ≈ 0), meaning a subjects 3 samples arent more alike
            than samples from different people. so the mixed model ends up the same as regular regression here, the
            conclusions dont depend on that choice.
          </p>
        )}
        <p>
          <span className="font-medium text-foreground">Caveats.</span> random intercept only (3 timepoints is too few
          for random slopes). project isnt in the model. percentages are compositional (they sum to 100) so if one goes
          up others have to go down, the 5 tests arent fully independent. the CD4 difference is small (well under 1
          percentage point) and its an association, not a predictive model. to actually predict response youd want a
          classifier evaluated on held out patients.
        </p>
      </CardContent>
    </Card>
  )
}

export default function Stats() {
  const stats = useApi<StatsRow[]>('/api/stats')
  const box = useApi<BoxplotRow[]>('/api/boxplot')
  const diag = useApi<DiagnosticRow[]>('/api/diagnostics')
  const error = stats.error ?? box.error ?? diag.error

  const sig = stats.data?.filter((s) => s.significant) ?? []
  usePageTitle('Statistical analysis')

  return (
    <section className="space-y-6">
      <PageHeader
        title="Statistical analysis"
        description="part 3: do immune cell frequencies differ between miraclib responders and non-responders?"
      />

      {error && <ErrorNote message={error} />}

      {stats.data && (
        <div className="rounded-lg border-l-4 border-primary bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
          {sig.length ? (
            <>
              <span className="font-medium">
                {sig.map((s) => POP_LABELS[s.population]).join(', ')}{' '}
                {sig.length === 1 ? 'is' : 'are'} significantly different
              </span>{' '}
              between responders and non-responders after correction
              {sig.map((s) => ` (${s.estimate > 0 ? '+' : ''}${s.estimate.toFixed(2)} pts, q = ${fmtP(s.q_value)})`).join('')}.
              no other population is significant.
            </>
          ) : (
            <span className="font-medium">no population is significantly different after correction.</span>
          )}
        </div>
      )}

      {stats.data && box.data ? <Boxplots rows={box.data} stats={stats.data} /> : !error && <Skeleton className="h-[640px] w-full" />}
      {stats.data ? <StatsTable stats={stats.data} /> : !error && <Skeleton className="h-72 w-full" />}
      {diag.data && <Diagnostics rows={diag.data} />}
      {stats.data && <Methods stats={stats.data} />}
    </section>
  )
}
