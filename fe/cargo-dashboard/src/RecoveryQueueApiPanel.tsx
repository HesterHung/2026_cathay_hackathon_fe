import { useEffect, useState } from 'react'
import { listRecoverySolutions, RecoveryApiError, type RecoveryListResponse, type QueueType } from './recoveryApi'

const STALE_MS = 5 * 60 * 1000

function failureLabel(error: RecoveryApiError): string {
  switch (error.kind) {
    case 'authorization': return 'Authorization required'
    case 'gated': return 'Action gated by workflow priority'
    case 'conflict': return 'Record changed; refresh before retrying'
    case 'validation': return 'Request validation failed'
    case 'network': return 'Recovery API is unreachable'
    case 'not-found': return 'Recovery API endpoint is not available'
    case 'server': return 'Recovery API server error'
    case 'invalid-response': return 'Recovery API returned an invalid response'
    default: return 'Recovery API request failed'
  }
}

export function RecoveryQueueApiPanel({ type }: { type: QueueType }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RecoveryListResponse | null>(null)
  const [error, setError] = useState<RecoveryApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void listRecoverySolutions({ type, page, limit: 20 }, controller.signal).then((result) => {
      setData(result)
      setCheckedAt(new Date().toISOString())
    }).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof RecoveryApiError ? cause : new RecoveryApiError('Unexpected API error.', 'http'))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [type, page, refreshKey])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const stale = Boolean(data && checkedAt && now - Date.parse(checkedAt) > STALE_MS)
  const workflow = data?.workflowControl
  const gated = type === 'PREDICTED_OFFLOAD' ? workflow?.canWorkPredictions === false
    : type === 'PENDING_POOL' ? workflow?.canReviewPool === false : false
  const queueCount = data?.totalByType[type]
  const isEmpty = Boolean(data && data.items.length === 0)

  return <section className="panel recovery-api-queue" aria-label={`${type} API integration`}>
    <div className="panel-heading"><div><h2>Live recovery API · {type.replaceAll('_', ' ')}</h2><p>Contract-backed queue data and workflow priority. The workspace below remains a separate simulated demonstration.</p></div><button className="outline-button" type="button" disabled={loading} onClick={() => { setLoading(true); setError(null); setRefreshKey((value) => value + 1) }}>{loading ? 'Loading…' : 'Refresh'}</button></div>
    {loading && !data && <div className="empty-state" role="status"><strong>Loading API queue</strong><span>Requesting page {page} from the shared recovery-solutions endpoint.</span></div>}
    {error && <div className="api-state error" role="alert"><strong>{failureLabel(error)}</strong><span>{error.message}</span>{error.kind === 'authorization' && <small>Sign in with an authorized operator account before requesting this queue.</small>}{error.kind === 'gated' && Array.isArray((error.details as { blockingWorkItemIds?: unknown } | undefined)?.blockingWorkItemIds) && <small>Blocking work items: {((error.details as { blockingWorkItemIds: string[] }).blockingWorkItemIds).join(', ')}</small>}{data && <small>Showing the last successful API response, checked {checkedAt ? new Date(checkedAt).toLocaleString() : 'earlier'}.</small>}</div>}
    {stale && <div className="api-state stale" role="status"><strong>Queue response is stale</strong><span>The last successful response is more than five minutes old. Refresh before acting on API data.</span></div>}
    {data && <>
      {!error && <div className="api-state success" role="status"><strong>{isEmpty ? 'Connected · no items on this page' : `Connected · ${queueCount ?? data.totalItems} active ${type.toLowerCase().replaceAll('_', ' ')} items`}</strong><span>Checked {checkedAt ? new Date(checkedAt).toLocaleString() : 'just now'} · active priority: {workflow?.activePriority ?? 'none'}{workflow?.message ? ` · ${workflow.message}` : ''}</span></div>}
      {gated && <div className="api-state stale" role="status"><strong>API workflow gate: live review actions are blocked</strong><span>{workflow?.message ?? 'The API reports higher-priority work. Resolve it before making lower-priority API decisions.'}{workflow?.blockingWorkItemIds.length ? ` Blocking: ${workflow.blockingWorkItemIds.join(', ')}.` : ''} The simulated controls below only change local demo state.</span></div>}
      {!isEmpty && <div className="table-wrap"><table><thead><tr><th>ULD WORK ITEM</th><th>MAWB</th><th>STATUS</th><th>FLIGHT / ROUTE</th><th>WEIGHT</th><th>UPDATED</th></tr></thead><tbody>{data.items.map((item) => <tr key={item.workItemId}><td><strong>{item.uld.uldId}</strong><small>{item.workItemId} · {item.type}</small></td><td>{item.masterAirwayBill.displayLabel}</td><td>{item.status}</td><td>{item.flight.flightId}<small>{item.flight.origin} → {item.flight.destination}</small></td><td>{item.cargo.weightKg.toLocaleString()} kg</td><td>{new Date(item.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
      {isEmpty && <div className="empty-state"><strong>No recovery work items</strong><span>This API response contains no records for the selected queue and page.</span></div>}
      <div className="recovery-api-pagination"><span>Page {data.pagination.page} of {data.pagination.totalPages} · {data.totalItems} matching records</span><div><button className="outline-button" type="button" disabled={loading || page <= 1} onClick={() => { setLoading(true); setError(null); setPage((value) => Math.max(1, value - 1)) }}>Previous</button><button className="outline-button" type="button" disabled={loading || !data.pagination.hasNextPage} onClick={() => { setLoading(true); setError(null); setPage((value) => value + 1) }}>Next</button></div></div>
    </>}
    <small className="api-contract-note">A review is not an operational action. Route approval records review only; offload confirmation and cargo allocation require separate authorized flows.</small>
  </section>
}
