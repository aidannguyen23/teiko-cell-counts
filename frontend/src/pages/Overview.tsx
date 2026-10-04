import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ErrorNote, PageHeader } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type FrequencyRow, useApi } from '@/lib/api'
import { fmtInt, POP_LABELS, POPULATIONS } from '@/lib/format'

const COLUMNS: ColumnDef<FrequencyRow>[] = [
  { accessorKey: 'sample', header: 'Sample' },
  {
    accessorKey: 'total_count',
    header: 'Total count',
    cell: (c) => fmtInt(c.getValue<number>()),
    enableGlobalFilter: false,
    meta: { numeric: true },
  },
  {
    accessorKey: 'population',
    header: 'Population',
    filterFn: 'equals',
    enableGlobalFilter: false,
  },
  {
    accessorKey: 'count',
    header: 'Count',
    cell: (c) => fmtInt(c.getValue<number>()),
    enableGlobalFilter: false,
    meta: { numeric: true },
  },
  {
    accessorKey: 'percentage',
    header: 'Percentage',
    cell: (c) => `${c.getValue<number>().toFixed(2)}%`,
    enableGlobalFilter: false,
    meta: { numeric: true },
  },
]

function toCsv(rows: FrequencyRow[]) {
  const header = 'sample,total_count,population,count,percentage'
  const lines = rows.map((r) => [r.sample, r.total_count, r.population, r.count, r.percentage].join(','))
  return [header, ...lines].join('\n')
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function Overview() {
  const { data, error } = useApi<FrequencyRow[]>('/api/frequencies')
  const rows = useMemo(() => data ?? [], [data])

  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [population, setPopulation] = useState('all')

  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    state: {
      sorting,
      globalFilter: search,
      columnFilters: population === 'all' ? [] : [{ id: 'population', value: population }],
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const filtered = table.getPrePaginationRowModel().rows
  const { pageIndex, pageSize } = table.getState().pagination

  return (
    <section className="space-y-6">
      <PageHeader
        title="Cell population frequencies"
        description="part 2: each row is one population in one sample. percentage = count / total cells in that sample."
      />

      {error && <ErrorNote message={error} />}

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="search sample id…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  table.setPageIndex(0)
                }}
                className="pl-8"
              />
            </div>
            <Select
              value={population}
              onValueChange={(v) => {
                setPopulation(v)
                table.setPageIndex(0)
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All populations</SelectItem>
                {POPULATIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {POP_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!filtered.length}
              onClick={() => download('cell_frequencies.csv', toCsv(filtered.map((r) => r.original)))}
            >
              <Download />
              Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="bg-muted/50 hover:bg-muted/50">
                    {hg.headers.map((h) => {
                      const sorted = h.column.getIsSorted()
                      const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
                      const numeric = (h.column.columnDef.meta as { numeric?: boolean })?.numeric
                      return (
                        <TableHead key={h.id} className={numeric ? 'text-right' : ''}>
                          <button
                            onClick={h.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1.5 hover:text-foreground"
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <Icon className={`size-3.5 ${sorted ? 'text-primary' : 'text-muted-foreground/60'}`} />
                          </button>
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {!data &&
                  !error &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={COLUMNS.length}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const numeric = (cell.column.columnDef.meta as { numeric?: boolean })?.numeric
                      return (
                        <TableCell key={cell.id} className={numeric ? 'text-right tabular-nums' : ''}>
                          {cell.column.id === 'population'
                            ? POP_LABELS[cell.getValue<string>()]
                            : flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
                {data && !filtered.length && (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="py-10 text-center text-muted-foreground">
                      no rows match
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
            <span>
              {filtered.length
                ? `${fmtInt(pageIndex * pageSize + 1)}–${fmtInt(Math.min((pageIndex + 1) * pageSize, filtered.length))} of ${fmtInt(filtered.length)} rows`
                : '0 rows'}
            </span>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft />
              </Button>
              <span className="tabular-nums">
                {pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
              </span>
              <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
