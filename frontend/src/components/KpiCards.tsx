import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type Kpis, useApi } from '@/lib/api'
import { fmtInt } from '@/lib/format'

const ITEMS: { key: keyof Kpis; label: string; note: string }[] = [
  { key: 'samples', label: 'Samples', note: 'all sample types + timepoints' },
  { key: 'subjects', label: 'Subjects', note: 'unique patients' },
  { key: 'projects', label: 'Projects', note: 'prj1, prj2, prj3' },
  { key: 'responders', label: 'Responders', note: 'subjects w/ response = yes' },
]

export function KpiCards() {
  const { data, error } = useApi<Kpis>('/api/kpis')
  if (error) return null

  return (
    <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {ITEMS.map(({ key, label, note }) => (
        <Card key={key} size="sm">
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {data ? fmtInt(data[key]) : <Skeleton className="h-8 w-20" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{note}</CardContent>
        </Card>
      ))}
    </section>
  )
}
