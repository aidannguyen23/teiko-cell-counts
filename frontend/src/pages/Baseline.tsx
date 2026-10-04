import { Breakdown } from '@/components/charts'
import { ErrorNote, PageHeader, usePageTitle } from '@/components/Layout'
import { Section } from '@/components/Section'
import { Skeleton } from '@/components/ui/skeleton'
import { type Baseline as BaselineData, type CountRow, useApi } from '@/lib/api'
import { COLORS, fmtInt } from '@/lib/format'

const LABELS: Record<string, string> = {
  yes: 'Responders',
  no: 'Non-responders',
  M: 'Male',
  F: 'Female',
}

// response bars use the same colors as the stats page, everything else gets the accent
const BAR_COLORS: Record<string, string> = { yes: COLORS.responder, no: COLORS.nonResponder }

const toRows = (rows: CountRow[]) =>
  rows.map((r) => ({ label: LABELS[r.label] ?? r.label, n: r.n, color: BAR_COLORS[r.label] ?? COLORS.accent }))

function Criteria() {
  const items = [
    ['Condition', 'Melanoma'],
    ['Treatment', 'Miraclib'],
    ['Sample type', 'PBMC'],
    ['Time from treatment start', '0 days (baseline)'],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function Baseline() {
  const { data, error } = useApi<BaselineData>('/api/baseline')
  usePageTitle('Data Subset Analysis')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Part 4: Data Subset Analysis"
        description="Baseline samples from melanoma patients treated with miraclib, used to check how the cohort is distributed across projects, response groups and sex before treatment effects come into play."
      />

      {error && <ErrorNote message={error} />}

      {!data && !error && <Skeleton className="h-96 w-full" />}

      {data && (
        <>
          <Section title="Subset Definition" description="Samples included in this analysis meet all of the following criteria.">
            <div className="space-y-5">
              <Criteria />
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{fmtInt(data.total_samples)} samples</span> meet these
                criteria. Each subject has exactly one baseline sample, so the sample and subject counts are equal.
                Project prj2 does not appear because all of its samples are whole blood (WB) rather than PBMC.
              </p>
            </div>
          </Section>

          <Section title="Subset Composition" description="Number and share of baseline samples in each group.">
            <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
              <Breakdown caption="Samples per project" unit="Samples" rows={toRows(data.by_project)} total={data.total_samples} />
              <Breakdown caption="Subjects by response" unit="Subjects" rows={toRows(data.by_response)} total={data.total_samples} />
              <Breakdown caption="Subjects by sex" unit="Subjects" rows={toRows(data.by_sex)} total={data.total_samples} />
            </div>
          </Section>

          <Section
            title="Average B Cell Count"
            description="Melanoma patients who are male, responded to treatment, and were sampled at time 0."
          >
            <div className="space-y-3">
              <p className="text-4xl font-semibold tracking-tight tabular-nums">
                {data.avg_b_cell_male_responders.toFixed(2)}
                <span className="ml-2 text-base font-normal text-muted-foreground">B cells per sample</span>
              </p>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                This is the mean absolute B cell count across all qualifying samples. Unlike the subset above, it
                includes every sample type and treatment, so it covers a broader group of samples.
              </p>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
