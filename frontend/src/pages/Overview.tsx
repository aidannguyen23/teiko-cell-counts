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
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { KpiCards } from '@/components/KpiCards'
import { ErrorNote, PageHeader, usePageTitle } from '@/components/Layout'
import { Section } from '@/components/Section'
import { Button } from '@/components/ui/button'
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

export default function Overview() {
  const { data, error } = useApi<FrequencyRow[]>('/api/frequencies')
  const rows = useMemo(() => data ?? [], [data])

  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [population, setPopulation] = useState('all')
  usePageTitle('Data Overview')

  // has to be memoized. a new array every render makes the table think the filter
  // changed -> it resets the page -> rerender -> loop (this broke page navigation)
  const columnFilters = useMemo(
    () => (population === 'all' ? [] : [{ id: 'population', value: population }]),
    [population],
  )

  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    state: {
      sorting,
      globalFilter: search,
      columnFilters,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const filtered = table.getPrePaginationRowModel().rows
  const { pageIndex, pageSize } = table.getState().pagination

  return (
    <div className="space-y-6">
      <PageHeader
        title="Part 2: Initial Analysis - Data Overview"
        description="A summary of the trial data and the relative frequency of each immune cell population in every sample."
      />

      <KpiCards />

      {error && <ErrorNote message={error} />}

      <Section
        title="Cell Population Frequencies"
        description="Each row is one cell population in one sample. Percentage is the population's cell count divided by the total cell count of that sample."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search aria-hidden className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search by sample ID"
                placeholder="Search by sample ID"
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
              <SelectTrigger aria-label="Filter by population" className="w-full sm:w-48">
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
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <caption className="sr-only">
                Cell population frequencies per sample. Column headers are buttons that sort the table.
              </caption>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="bg-muted/50 hover:bg-muted/50">
                    {hg.headers.map((h) => {
                      const sorted = h.column.getIsSorted()
                      const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
                      const numeric = (h.column.columnDef.meta as { numeric?: boolean })?.numeric
                      return (
                        <TableHead
                          key={h.id}
                          aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                          className={numeric ? 'text-right' : ''}
                        >
                          <button
                            onClick={h.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <Icon aria-hidden className={`size-3.5 ${sorted ? 'text-primary' : 'text-muted-foreground'}`} />
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
                      No rows match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
            <span aria-live="polite">
              {filtered.length
                ? `Showing ${fmtInt(pageIndex * pageSize + 1)} to ${fmtInt(Math.min((pageIndex + 1) * pageSize, filtered.length))} of ${fmtInt(filtered.length)} rows`
                : '0 rows'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <span className="tabular-nums">
                Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
