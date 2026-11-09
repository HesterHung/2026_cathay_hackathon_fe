import { useMemo, useState } from 'react'
import { formatKg, getOverviewQueues, pendingPoolUnits, type PendingPoolDisposition } from './domain'
import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'

interface PendingPoolPageProps {
  onNavigate: (item: WorkspaceNavItem) => void
  initialFlightId?: string
}

export function PendingPoolPage({ onNavigate, initialFlightId }: PendingPoolPageProps) {
  const queues = useMemo(() => getOverviewQueues(), [])
  const targets = useMemo(() => [
    ...queues.recovery.map((item) => ({
      id: item.lifecycle.id,
      flightId: item.lifecycle.flightId,
      priority: 1,
      label: item.recoveryCase ? `${item.recoveryCase.origin} → ${item.recoveryCase.destination}` : 'Confirmed disruption',
    })),
    ...queues.preventive.map((item) => ({
      id: item.lifecycle.id,
      flightId: item.lifecycle.flightId,
      priority: 2,
      label: item.forecast?.route ?? 'Predicted offload',
    })),
  ], [queues])
  const [selectedTargetId, setSelectedTargetId] = useState(() =>
    targets.find((target) => target.flightId === initialFlightId)?.id ?? targets[0]?.id ?? '',
  )
  const [dispositions, setDispositions] = useState<Record<string, PendingPoolDisposition>>({})
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null)
  const selectedTarget = targets.find((target) => target.id === selectedTargetId)
  const protectedCount = Object.values(dispositions).filter((value) => value === 'Priority hold').length
  const setDisposition = (unitId: string, disposition: PendingPoolDisposition) => {
    setDispositions((current) => ({ ...current, [unitId]: disposition }))
  }

  return <div className="app-shell">
    <WorkspaceSidebar active="Pending Pool" onNavigate={onNavigate} />
    <main className="main-content shipment-page pending-pool-page">
      <header className="topbar"><div className="crumb">CATHAY ROUTER <span>/</span> PENDING POOL</div><span className="demo-label">SIMULATED WORKSPACE</span></header>

      <div className="page-heading">
        <div><p className="eyebrow">PRIORITY 3 · BACKUP INVENTORY</p><h1>Pending Pool</h1><p className="subtitle">Choose what to do with domino-offloaded ULDs.</p></div>
        <span className="demo-label">REVIEW ONLY</span>
      </div>

      <section className="pool-priority-flow" aria-label="Priority order">
        <div><span>1</span><strong>Disruption Alerts</strong><small>Confirmed offloads</small></div><i aria-hidden="true">›</i>
        <div><span>2</span><strong>Predicted Offload</strong><small>Forecast at risk</small></div><i aria-hidden="true">›</i>
        <div className="current"><span>3</span><strong>Pending Pool</strong><small>Domino offloads</small></div>
      </section>

      {initialFlightId && <section className="pool-target-context"><strong>Opened from {initialFlightId}</strong><span>Compare pool candidates with this higher-priority flight, then return to its recovery review.</span></section>}

      <section className="pool-target-picker">
        <div><p className="eyebrow">OPTION 1 · FIND A PRIORITY CASE</p><h2>Which flight needs backup capacity?</h2><p>Choose an active disruption or predicted-offload case to compare with these candidates.</p></div>
        {targets.length ? <label htmlFor="pool-target-select">Priority target<select id="pool-target-select" value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)}>
          {targets.map((target) => <option key={target.id} value={target.id}>Priority {target.priority} · {target.flightId} · {target.label}</option>)}
        </select></label> : <div className="pool-no-target">No active priority 1 or 2 cases. Pool candidates can remain available for a confirmed no-show.</div>}
      </section>

      <section className="plan-entry-summary pool-summary">
        <div><small>POOL CANDIDATES</small><strong>{pendingPoolUnits.length}</strong></div>
        <div><small>KEPT AVAILABLE FOR PRIORITY REVIEW</small><strong>{protectedCount}</strong></div>
        <div><small>POTENTIAL NO-SHOW CANDIDATES</small><strong>{pendingPoolUnits.filter((unit) => unit.eligibleForNoShowReplacement).length}</strong></div>
      </section>

      <div className="pool-options-heading"><div><p className="eyebrow">OPTIONS FOR EACH ULD</p><h2>Domino-offloaded candidates</h2></div><span>Protect · Compare · Wait for confirmed no-show</span></div>

      <section className="pool-candidate-list" aria-label="Pending pool ULDs">
        {pendingPoolUnits.length ? pendingPoolUnits.map((unit) => {
          const disposition = dispositions[unit.id] ?? 'Available'
          const targetRouteMatches = Boolean(selectedTarget && targets.find((target) => target.id === selectedTarget.id)?.label === `${unit.origin} → ${unit.destination}`)
          const isExpanded = expandedUnitId === unit.id
          return <article className="pool-candidate-card" key={unit.id}>
            <header className="pool-candidate-header">
              <div><span className="pool-unit-id">{unit.id}</span><h3>{unit.origin} <b>→</b> {unit.destination}</h3><p>{unit.commodity} · Flight {unit.sourceFlightId} · Domino offload</p></div>
              <span className={`pool-candidate-status ${disposition === 'Priority hold' ? 'protected' : ''}`}>{disposition === 'Priority hold' ? 'Kept for review' : 'Available to review'}</span>
            </header>
            <div className="pool-candidate-facts"><div><small>WEIGHT</small><strong>{formatKg(unit.weightKg)}</strong></div><div><small>VOLUME</small><strong>{unit.volumeM3.toFixed(1)} m³</strong></div><div><small>SOURCE FLIGHT</small><strong>{unit.sourceFlightId}</strong></div><div><small>NO-SHOW USE</small><strong>{unit.eligibleForNoShowReplacement ? 'Potentially eligible' : 'Not eligible'}</strong></div></div>

            <div className="pool-choice-grid">
              <section className={`pool-choice ${disposition === 'Priority hold' ? 'chosen' : ''}`}>
                <div className="pool-choice-number">A</div><div className="pool-choice-copy"><h4>Keep available for priority cases</h4><p>Keep this ULD visible as a candidate while disruption and predicted-offload cases are handled.</p><small>This is a review marker. It does not reserve capacity or guarantee the ULD will avoid a future offload.</small></div>
                <button className={disposition === 'Priority hold' ? 'pool-choice-button secondary' : 'pool-choice-button'} onClick={() => setDisposition(unit.id, disposition === 'Priority hold' ? 'Available' : 'Priority hold')}>{disposition === 'Priority hold' ? 'Remove review marker' : 'Keep available for review'}</button>
              </section>

              <section className={`pool-choice ${isExpanded ? 'chosen' : ''}`}>
                <div className="pool-choice-number">B</div><div className="pool-choice-copy"><h4>Compare with the selected flight</h4><p>{selectedTarget ? `Priority ${selectedTarget.priority} target: ${selectedTarget.flightId} · ${selectedTarget.label}` : 'Select a priority target above to compare.'}</p><small>{selectedTarget ? (targetRouteMatches ? 'Route matches. Handling, capacity, and operational acceptance still need confirmation.' : 'Route differs. Review routing and operational constraints before considering this candidate.') : 'No active priority case is selected.'}</small></div>
                <button className="pool-choice-button secondary" disabled={!selectedTarget} onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}>{isExpanded ? 'Close comparison' : 'View comparison'}</button>
                {isExpanded && selectedTarget && <div className="pool-comparison-detail"><strong>Route check: {targetRouteMatches ? 'Matches target route' : 'Route needs review'}</strong><span>Candidate {unit.origin} → {unit.destination} · Target {selectedTarget.label}</span><small>Route match alone does not prove ULD, handling, weight, volume, or station compatibility. No assignment is made here.</small></div>}
              </section>

              <section className="pool-choice no-show-choice">
                <div className="pool-choice-number">C</div><div className="pool-choice-copy"><h4>Consider after a confirmed no-show</h4><p>Use this candidate only when a booked ULD has a confirmed no-show and a compatible target is identified.</p><small>{unit.eligibleForNoShowReplacement ? 'Eligible in principle; this demo has no confirmed no-show event to review.' : 'This candidate is not flagged for no-show replacement.'}</small></div>
                <button className="pool-choice-button disabled" disabled title="Requires a confirmed no-show event and operational compatibility check">{unit.eligibleForNoShowReplacement ? 'Waiting for no-show evidence' : 'Not eligible'}</button>
              </section>
            </div>
          </article>
        }) : <div className="empty-state"><strong>No pool candidates</strong><span>Domino-offloaded ULDs will appear here when identified.</span></div>}
      </section>

      <section className="pool-allocation-note"><strong>What this page can and cannot do</strong><p>You can protect inventory and compare a candidate with a priority flight. No-show substitution requires a confirmed event and a full compatibility check. This page does not book, assign, or reserve capacity.</p><div className="pool-allocation-links"><button className="text-button" onClick={() => onNavigate('Disruption Alerts')}>Go to Disruption Alerts →</button><button className="text-button" onClick={() => onNavigate('Predicted Offload')}>Go to Predicted Offload →</button></div></section>
      <footer>Demo actions update local review state only. Live no-show, compatibility, station acceptance, and allocation data are not connected.</footer>
    </main>
  </div>
}
