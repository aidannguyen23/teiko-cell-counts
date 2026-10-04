import { useEffect, useState } from 'react'

export type Kpis = { samples: number; subjects: number; projects: number; responders: number }

export type FrequencyRow = {
  sample: string
  total_count: number
  population: string
  count: number
  percentage: number
}

export type StatsRow = {
  population: string
  mean_responders: number
  mean_non_responders: number
  estimate: number
  ci_low: number
  ci_high: number
  p_value: number
  q_value: number
  mwu_p_value: number
  mwu_q_value: number
  icc: number
  re_singular: number
  significant: number
  n_subjects: number
  n_samples: number
}

export type BoxplotRow = {
  sample: string
  subject_id: string
  time: number
  response: 'yes' | 'no'
  population: string
  percentage: number
}

export type DiagnosticRow = {
  population: string
  fitted: number
  residual: number
  theoretical_quantile: number
}

export type CountRow = { grouping: string; label: string; n: number }

export type Baseline = {
  total_samples: number
  by_project: CountRow[]
  by_response: CountRow[]
  by_sex: CountRow[]
  avg_b_cell_male_responders: number
}

// cache so switching pages doesnt refetch the same stuff
const cache = new Map<string, Promise<unknown>>()

function load<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    const p = fetch(url).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `${url} failed (${res.status})`)
      }
      return res.json()
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return cache.get(url) as Promise<T>
}

export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    load<T>(url)
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [url])

  return { data, error }
}
