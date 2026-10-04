import { BarChart3, FlaskConical, Table2 } from 'lucide-react'
import { Suspense, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router'

import { KpiCards } from '@/components/KpiCards'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Overview', icon: Table2 },
  { to: '/stats', label: 'Statistical Analysis', icon: BarChart3 },
  { to: '/baseline', label: 'Baseline Subset', icon: FlaskConical },
]

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <aside className="border-b bg-sidebar md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="px-5 py-5">
          <p className="text-sm font-semibold">Loblaw Bio</p>
          <p className="text-xs text-muted-foreground">miraclib trial cell counts</p>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )
              }
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main id="main" tabIndex={-1} className="min-w-0 focus:outline-none flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <KpiCards />
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = `${page} - Loblaw Bio dashboard`
  }, [page])
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  )
}
