import { useMemo, useState } from 'react'

import { BoxPlot, ScatterPlot } from '@/components/charts'
import { ErrorNote, PageHeader, usePageTitle } from '@/components/Layout'
import { Section } from '@/components/Section'
import { Badge } from '@/components/ui/badge'
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

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`

function Summary({ stats }: { stats: StatsRow[] }) {
  const sig = stats.filter((s) => s.significant)
  const n = stats[0]
  return (
    <div className="max-w-3xl space-y-3 text-sm leading-relaxed">
      {sig.length ? (
        sig.map((s) => (
          <p key={s.population}>
            <span className="font-medium">{POP_LABELS[s.population]}</span> show a statistically significant difference
            between responders and non-responders. Responders average {s.mean_responders.toFixed(2)}% compared with{' '}
            {s.mean_non_responders.toFixed(2)}% for non-responders, an estimated difference of {signed(s.estimate)}{' '}
            percentage points (95% CI {s.ci_low.toFixed(2)} to {s.ci_high.toFixed(2)}, adjusted q = {fmtP(s.q_value)}).
          </p>
        ))
      ) : (
        <p>No cell population differs significantly between responders and non-responders after correction.</p>
      )}
      <p className="text-muted-foreground">
        {sig.length ? 'None of the other populations' : 'None of the populations'} reached significance after adjusting
        for multiple comparisons. The analysis covers {n?.n_subjects} melanoma patients treated with miraclib (
        {n?.n_samples} PBMC samples).
      </p>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-5 text-sm text-muted-foreground">
      <span className="flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-full" style={{ background: COLORS.responder }} /> Responders
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-full" style={{ background: COLORS.nonResponder }} /> Non-responders
      </span>
    </div>
  )
}

function Boxplots({ rows, stats }: { rows: BoxplotRow[]; stats: StatsRow[] }) {
  const [unit, setUnit] = useState<'sample' | 'subject'>('sample')
  const points = useMemo(() => (unit === 'sample' ? rows : subjectMeans(rows)), [rows, unit])
  const byPop = useMemo(() => Object.fromEntries(stats.map((s) => [s.population, s])), [stats])

  const groups = useMemo(
    () =>
      Object.fromEntries(
        POPULATIONS.map((pop) => [
          pop,
          (['yes', 'no'] as const).map((resp) => ({
            key: resp,
            label: resp === 'yes' ? 'Responders' : 'Non-responders',
            color: resp === 'yes' ? COLORS.responder : COLORS.nonResponder,
            values: points.filter((p) => p.population === pop && p.response === resp).map((p) => p.percentage),
          })),
        ]),
      ),
    [points],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Legend />
        <Tabs value={unit} onValueChange={(v) => setUnit(v as 'sample' | 'subject')}>
          <TabsList aria-label="Unit of observation">
            <TabsTrigger value="sample">Per sample</TabsTrigger>
            <TabsTrigger value="subject">Per subject (mean)</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {POPULATIONS.map((pop) => {
          const s = byPop[pop]
          return (
            <figure key={pop} className="space-y-2">
              <figcaption className="flex items-baseline justify-between px-1">
                <h3 className="text-sm font-medium">{POP_LABELS[pop]}</h3>
                {s && (
                  <span className={`text-xs tabular-nums ${s.significant ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                    q = {fmtP(s.q_value)}
                  </span>
                )}
              </figcaption>
              <BoxPlot groups={groups[pop]} unitLabel={unit === 'sample' ? 'samples' : 'subjects'} />
            </figure>
          )
        })}
      </div>
    </div>
  )
}

function StatsTable({ stats }: { stats: StatsRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <caption className="sr-only">Mixed model results for each cell population</caption>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Population</TableHead>
            <TableHead className="text-right">Responders</TableHead>
            <TableHead className="text-right">Non-responders</TableHead>
            <TableHead className="text-right">Difference (95% CI)</TableHead>
            <TableHead className="text-right">p</TableHead>
            <TableHead className="text-right">q (BH)</TableHead>
            <TableHead className="text-right">Mann-Whitney q</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((s) => (
            <TableRow key={s.population} className={s.significant ? 'bg-primary/5 hover:bg-primary/10' : ''}>
              <TableCell className={s.significant ? 'font-medium' : ''}>{POP_LABELS[s.population]}</TableCell>
              <TableCell className="text-right tabular-nums">{s.mean_responders.toFixed(2)}%</TableCell>
              <TableCell className="text-right tabular-nums">{s.mean_non_responders.toFixed(2)}%</TableCell>
              <TableCell className="text-right tabular-nums">
                {signed(s.estimate)}{' '}
                <span className="text-muted-foreground">
                  ({s.ci_low.toFixed(2)}, {s.ci_high.toFixed(2)})
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmtP(s.p_value)}</TableCell>
              <TableCell className={`text-right tabular-nums ${s.significant ? 'font-medium text-primary' : ''}`}>
                {fmtP(s.q_value)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{fmtP(s.mwu_q_value)}</TableCell>
              <TableCell>
                {s.significant ? <Badge>Significant</Badge> : <Badge variant="outline">Not significant</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Diagnostics({ rows }: { rows: DiagnosticRow[] }) {
  const [pop, setPop] = useState(POPULATIONS[0])

  const d = useMemo(() => {
    const sub = rows.filter((r) => r.population === pop)
    const resid = sub.map((r) => r.residual)
    const sd = Math.sqrt(resid.reduce((a, b) => a + b * b, 0) / Math.max(resid.length - 1, 1))
    const qs = sub.map((r) => r.theoretical_quantile)
    const fitted = sub.map((r) => r.fitted)
    const [qMin, qMax] = [Math.min(...qs), Math.max(...qs)]
    const [fMin, fMax] = [Math.min(...fitted), Math.max(...fitted)]
    return {
      resid,
      qs,
      fitted,
      qqLine: [[qMin, qMin * sd], [qMax, qMax * sd]] as [[number, number], [number, number]],
      zeroLine: [[fMin, 0], [fMax, 0]] as [[number, number], [number, number]],
    }
  }, [rows, pop])

  return (
    <div className="space-y-5">
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
      <div className="grid gap-8 md:grid-cols-2">
        <figure className="space-y-2">
          <figcaption>
            <h3 className="text-sm font-medium">Normal Q-Q plot</h3>
            <p className="text-xs text-muted-foreground">Points close to the dashed line indicate normally distributed residuals.</p>
          </figcaption>
          <ScatterPlot
            xs={d.qs}
            ys={d.resid}
            refLine={d.qqLine}
            xLabel="Theoretical quantile"
            yLabel="Residual"
            label={`Normal Q-Q plot of ${POP_LABELS[pop]} model residuals`}
          />
        </figure>
        <figure className="space-y-2">
          <figcaption>
            <h3 className="text-sm font-medium">Residuals vs fitted values</h3>
            <p className="text-xs text-muted-foreground">An even band around zero indicates constant variance.</p>
          </figcaption>
          <ScatterPlot
            xs={d.fitted}
            ys={d.resid}
            refLine={d.zeroLine}
            xLabel="Fitted value (%)"
            yLabel="Residual"
            label={`Residuals versus fitted values for the ${POP_LABELS[pop]} model`}
          />
        </figure>
      </div>
    </div>
  )
}

function Methods({ stats }: { stats: StatsRow[] }) {
  const n = stats[0]
  const singular = stats.every((s) => s.re_singular)
  const sig = stats.filter((s) => s.significant)
  const h = 'font-medium text-foreground'
  return (
    <div className="max-w-3xl space-y-5 text-sm leading-relaxed text-muted-foreground">
      <div className="space-y-1">
        <h3 className={h}>Data</h3>
        <p>
          The analysis includes melanoma patients treated with miraclib, using PBMC samples only
          {n && ` (${n.n_subjects} subjects, ${n.n_samples} samples)`}. Each subject was sampled at three timepoints: days
          0, 7 and 14 after the start of treatment. The outcome is the relative frequency of each cell population, as
          shown on the Data Overview page.
        </p>
      </div>
      <div className="space-y-1">
        <h3 className={h}>Model</h3>
        <p>
          Because each subject contributes three samples, the samples are not independent. Treating them as independent
          would overstate the effective sample size and make p-values too small. For each cell population, a linear
          mixed-effects model was fit:
        </p>
        <p>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
            percentage ~ responder + time + (1 | subject)
          </code>
        </p>
        <p>
          The random intercept for each subject accounts for the repeated measurements, and timepoint is included as a
          categorical fixed effect. The reported difference is the responder coefficient: the estimated difference in
          relative frequency, in percentage points, between responders and non-responders at the same timepoint. It is
          tested with a Wald test.
        </p>
      </div>
      <div className="space-y-1">
        <h3 className={h}>Multiple comparisons</h3>
        <p>
          Five populations are tested, which raises the chance of a false positive. The p-values are adjusted with the
          Benjamini-Hochberg procedure, which controls the false discovery rate (the expected share of significant
          results that are false positives). Adjusted values are reported as q-values, and a population is considered
          significant when q &lt; 0.05.
        </p>
      </div>
      <div className="space-y-1">
        <h3 className={h}>Robustness check</h3>
        <p>
          As a check that does not assume normally distributed residuals, a Mann-Whitney U test was run on each
          subject's mean frequency across the three timepoints (one value per subject), with the same Benjamini-Hochberg
          adjustment.
        </p>
      </div>
      {singular && (
        <div className="space-y-1">
          <h3 className={h}>Between-subject variance</h3>
          <p>
            The estimated between-subject variance was effectively zero for every population (intraclass correlation
            ≈ 0). In other words, samples from the same subject were no more alike than samples from different subjects,
            so the mixed model gives essentially the same estimates as ordinary linear regression. The conclusions do
            not depend on the choice between the two.
          </p>
        </div>
      )}
      <div className="space-y-1">
        <h3 className={h}>Limitations</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            The model uses random intercepts only. Three timepoints per subject are too few to reliably estimate
            subject-specific slopes.
          </li>
          <li>Project is not included as a covariate.</li>
          <li>
            Relative frequencies are compositional: they sum to 100% within each sample, so an increase in one
            population implies a decrease in others. The five tests are therefore not fully independent.
          </li>
          {sig.map((s) => (
            <li key={s.population}>
              The {POP_LABELS[s.population]} difference is statistically significant but small (
              {Math.abs(s.estimate).toFixed(2)} percentage points), and the Mann-Whitney check{' '}
              {s.mwu_q_value < 0.05 ? 'agrees' : `is borderline (q = ${fmtP(s.mwu_q_value)})`}.
            </li>
          ))}
          <li>
            These results describe an association, not a predictive model. Predicting response for new patients would
            require a classifier evaluated on held-out data.
          </li>
        </ul>
      </div>
    </div>
  )
}

export default function Stats() {
  const stats = useApi<StatsRow[]>('/api/stats')
  const box = useApi<BoxplotRow[]>('/api/boxplot')
  const diag = useApi<DiagnosticRow[]>('/api/diagnostics')
  const error = stats.error ?? box.error ?? diag.error
  usePageTitle('Statistical Analysis')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Part 3: Statistical Analysis"
        description="Do immune cell population frequencies differ between melanoma patients who respond to miraclib and those who do not? Analysis is limited to PBMC samples."
      />

      {error && <ErrorNote message={error} />}

      {stats.data ? (
        <Section title="Summary">
          <Summary stats={stats.data} />
        </Section>
      ) : (
        !error && <Skeleton className="h-32 w-full" />
      )}

      {stats.data && box.data ? (
        <Section
          title="Responders vs Non-responders"
          description="Distribution of relative frequency for each cell population, split by treatment response."
        >
          <Boxplots rows={box.data} stats={stats.data} />
        </Section>
      ) : (
        !error && <Skeleton className="h-[640px] w-full" />
      )}

      {stats.data && (
        <Section
          title="Test Results"
          description="Group means and the mixed model estimate of the difference (responders minus non-responders, in percentage points). Highlighted rows are significant after Benjamini-Hochberg correction (q < 0.05)."
        >
          <StatsTable stats={stats.data} />
        </Section>
      )}

      {diag.data && (
        <Section
          title="Model Diagnostics"
          description="Residual plots used to check the normality and constant variance assumptions of the model."
          defaultOpen={false}
        >
          <Diagnostics rows={diag.data} />
        </Section>
      )}

      {stats.data && (
        <Section title="Methods and Limitations">
          <Methods stats={stats.data} />
        </Section>
      )}
    </div>
  )
}
