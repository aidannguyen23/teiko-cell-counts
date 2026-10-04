import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'

import { Layout } from '@/components/Layout'
import Overview from '@/pages/Overview'

// these two pull in plotly (big) so only load them when you open the page
const Stats = lazy(() => import('@/pages/Stats'))
const Baseline = lazy(() => import('@/pages/Baseline'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="stats" element={<Stats />} />
          <Route path="baseline" element={<Baseline />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
