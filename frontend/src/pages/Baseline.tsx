import { ErrorNote, PageHeader } from '@/components/Layout'
import { Plot } from '@/components/Plot'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type Baseline as BaselineData, type CountRow, useApi } from '@/lib/api'
import { COLORS, fmtInt } from '@/lib/format'

const LABELS: Record<string, string> = {
  yes: 'Responders',
  no: 'Non-responders',
  M: 'Male',
  F: 'Female',
}

function CountCard({ title, unit, rows, total }: { title: string; unit: string; rows: CountRow[]; total: number }) {
  const labels = rows.map((r) => LABELS[r.label] ?? r.label)
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          {rows.map((r, i) => (
            <div key={r.label}>
              <p className="text-2xl font-semibold tabular-nums">{fmtInt(r.n)}</p>
              <p className="text-xs text-muted-foreground">
                {labels[i]} · {((100 * r.n) / total).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <Plot
          className="h-28"
          data={[
            {
              type: 'bar',
              orientation: 'h',
              x: rows.map((r) => r.n),
              y: labels,
              marker: { color: COLORS.accent },
              width: 0.55,
              text: rows.map((r) => fmtInt(r.n)),
              textposition: 'outside',
              cliponaxis: false,
              textfont: { color: COLORS.muted },
              hovertemplate: `%{y}: %{x} ${unit}<extra></extra>`,
            },
          ]}
          layout={{
            margin: { t: 0, r: 40, b: 20, l: 100 },
            xaxis: { showgrid: true, rangemode: 'tozero' },
            yaxis: { autorange: 'reversed', showgrid: false, tickfont: { color: COLORS.ink } },
            bargap: 0.3,
          }}
        />
        <p className="pt-1 text-xs text-muted-foreground">counted as {unit}</p>
      </CardContent>
    </Card>
  )
}

export default function Baseline() {
  const { data, error } = useApi<BaselineData>('/api/baseline')

  return (
    <section className="space-y-6">
      <PageHeader
        title="Baseline subset"
        description="part 4: melanoma PBMC samples at baseline (day 0) from patients treated with miraclib"
      />

      {error && <ErrorNote message={error} />}

      {!data && !error && (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{fmtInt(data.total_samples)} samples</span> match the filter.
            each subject only has one baseline sample so samples = subjects here. prj2 doesnt show up because all its
            samples are whole blood (WB), not PBMC.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <CountCard title="Samples per project" unit="samples" rows={data.by_project} total={data.total_samples} />
            <CountCard title="Subjects by response" unit="subjects" rows={data.by_response} total={data.total_samples} />
            <CountCard title="Subjects by sex" unit="subjects" rows={data.by_sex} total={data.total_samples} />
          </div>

          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <CardDescription>Average B cell count</CardDescription>
              <CardTitle className="text-4xl font-semibold tabular-nums">
                {data.avg_b_cell_male_responders.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              melanoma males who responded, at time 0. includes all sample types and treatments (so its a wider filter
              than the cards above).
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}
