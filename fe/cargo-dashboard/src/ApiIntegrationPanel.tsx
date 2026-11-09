import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl, fetchPreventionPlans, preventionPlansUrl, type ApiSnapshot } from './api'

const STALE_AFTER_MS = 5 * 60 * 1000

export function ApiIntegrationPanel() {
  const [snapshot, setSnapshot] = useState<ApiSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await fetchPreventionPlans(signal)
      setSnapshot(result)
      setLastCheckedAt(result.fetchedAt)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Could not connect to the API.')
      setLastCheckedAt(new Date().toISOString())
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => { void refresh(controller.signal) }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [refresh])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const stale = Boolean(snapshot && now - Date.parse(snapshot.fetchedAt) > STALE_AFTER_MS)
  const checked = lastCheckedAt ? new Date(lastCheckedAt).toLocaleString() : 'Not checked'
  return <section className="panel api-integration-panel">
    <div className="panel-heading"><div><h2>Prevention plans API</h2><p>Read-only connection to the backend prevention-plans endpoint. Dashboard demo data remains separate.</p></div><button className="outline-button" type="button" onClick={() => { setLoading(true); setError(null); void refresh() }} disabled={loading}>{loading ? 'Checking…' : 'Refresh'}</button></div>
    <div className="api-connection-meta"><span><b>Endpoint</b><code>{preventionPlansUrl}</code></span><span><b>Configured base URL</b><code>{apiBaseUrl || 'Same origin (set VITE_API_BASE_URL to configure)'}</code></span><span><b>Last checked</b><span>{checked}</span></span></div>
    {loading && !snapshot && <div className="empty-state" role="status"><strong>Connecting to API</strong><span>Requesting the prevention plans page.</span></div>}
    {error && <div className="api-state error" role="alert"><strong>API unavailable</strong><span>{error}</span>{snapshot && <small>Showing the last successful response from {new Date(snapshot.fetchedAt).toLocaleString()}.</small>}</div>}
    {stale && <div className="api-state stale" role="status"><strong>Data may be stale</strong><span>Last successful response is more than five minutes old. Refresh to check the source again.</span></div>}
    {snapshot && <>
      {!error && <div className="api-state success" role="status"><strong>{snapshot.data.totalCases === 0 ? 'Connected · no prevention plans' : `Connected · ${snapshot.data.totalCases} prevention plans`}</strong><span>Fetched {new Date(snapshot.fetchedAt).toLocaleString()} · API has not provided a source-data timestamp.</span></div>}
      {snapshot.data.items.length > 0 && <div className="table-wrap"><table><thead><tr><th>FLIGHT</th><th>ULD</th><th>OFFLOAD RISK</th><th>SHIPMENTS</th><th>SHORTFALL</th><th>VALUE AT RISK</th></tr></thead><tbody>{snapshot.data.items.map((item) => <tr key={`${item.flightId}:${item.targetUldNo}`}><td><strong>{item.flightId}</strong><small>{item.riskLevel} · {item.status}</small></td><td>{item.targetUldNo}<small>{item.atRiskAwbs.length} AWB records</small></td><td>{Math.round(item.offloadProbability * 100)}%</td><td>{item.affectedShipmentCount}</td><td>{item.capacityShortfallKg.toLocaleString()} kg</td><td>{item.currency} {Math.round(item.valueAtRisk).toLocaleString()}</td></tr>)}</tbody></table></div>}
      {snapshot.data.items.length === 0 && <div className="empty-state"><strong>No records in this API page</strong><span>The backend returned a valid empty response.</span></div>}
      <small className="api-pagination">Page {snapshot.data.pagination.page} of {snapshot.data.pagination.totalPages} · {snapshot.data.totalShipmentsAtRisk} shipments at risk · Next page: {snapshot.data.pagination.hasNextPage ? 'available' : 'no'}</small>
    </>}
    <small className="api-contract-note">All counts, probability rates, weight values (kg), and currency codes are validated at the API boundary. No operational actions are sent.</small>
  </section>
}
