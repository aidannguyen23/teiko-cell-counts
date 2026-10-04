import { BrowserRouter, Route, Routes } from 'react-router'

import { Layout } from '@/components/Layout'
import Baseline from '@/pages/Baseline'
import Overview from '@/pages/Overview'
import Stats from '@/pages/Stats'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="stats" element={<Stats />} />
          <Route path="subset" element={<Baseline />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
