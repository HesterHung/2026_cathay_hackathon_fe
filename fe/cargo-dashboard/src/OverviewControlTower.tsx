import { useMemo, useState } from 'react'
import { buildForecasts, demoOffloadMetrics, formatCurrency, getOverviewMetrics, getOverviewQueues, recoveryCases, type FlightCapacityForecast, type OverviewQueueItem } from './domain'
import { WorkspaceSidebar } from './WorkspaceSidebar'

type NavItem = 'Overview' | 'Predictions' | 'Prevention Plan' | 'Shipments' | 'Recovery Plans' | 'Analytics' | 'Settings' | 'Unknown'

interface OverviewControlTowerProps {
  onNavigate: (item: NavItem) => void
  onSelectFlight: (flight: FlightCapacityForecast) => void
  onSelectPreventiveFlight: (flightId: string) => void
  onSelectRecoveryCase: (caseId: string) => void
}

function QueueStatus({ item }: { item: OverviewQueueItem }) {
  return <span className={`lifecycle-status ${item.lifecycle.state.toLowerCase()}`}>{item.lifecycle.statusLabel}</span>
}

function QueueAction({ item, onSelectPreventiveFlight, onSelectRecoveryCase }: { item: OverviewQueueItem; onSelectPreventiveFlight: (flightId: string) => void; onSelectRecoveryCase: (caseId: string) => void }) {
  if (item.lifecycle.recoveryCaseId) return <button className="text-button" onClick={() => onSelectRecoveryCase(item.lifecycle.recoveryCaseId!)}>Open recovery case <span aria-hidden="true">→</span></button>
  return item.forecast ? <button className="text-button" onClick={() => onSelectPreventiveFlight(item.lifecycle.flightId)}>Open prevention plan <span aria-hidden="true">→</span></button> : <span className="unavailable-label">Prevention plan unavailable</span>
}

const airportLocations: Record<string, { lat: number; lon: number }> = { HKG: { lat: 22.308, lon: 113.918 }, SIN: { lat: 1.364, lon: 103.991 }, FRA: { lat: 50.037, lon: 8.562 }, LHR: { lat: 51.47, lon: -0.454 }, LAX: { lat: 33.942, lon: -118.408 }, JFK: { lat: 40.641, lon: -73.778 } }
const osmZoom = 2
const osmTileSize = 256
const routeViewPadding = 160

function projectAirport(code: string) {
  const { lat, lon } = airportLocations[code]
  const scale = osmTileSize * 2 ** osmZoom
  const sinLat = Math.sin(lat * Math.PI / 180)
  return { x: (lon + 180) / 360 * scale, y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale }
}

function RouteMap({ routes, onSelectPreventiveFlight, onSelectRecoveryCase }: { routes: Array<{ flightId: string; origin: string; destination: string; kind: 'preventive' | 'recovery'; recoveryCaseId?: string }>; onSelectPreventiveFlight: (flightId: string) => void; onSelectRecoveryCase: (caseId: string) => void }) {
  const [zoom, setZoom] = useState(1)
  const plotted = routes.filter((route) => airportLocations[route.origin] && airportLocations[route.destination])
  const alertAirports = new Map<string, { preventive: Array<string>; recovery: Array<{ flightId: string; caseId?: string }> }>()
  plotted.forEach((route) => [route.origin, route.destination].forEach((code) => {
    const airport = alertAirports.get(code) ?? { preventive: [], recovery: [] }
    if (route.kind === 'preventive') airport.preventive.push(route.flightId)
    else airport.recovery.push({ flightId: route.flightId, caseId: route.recoveryCaseId })
    alertAirports.set(code, airport)
  }))
  const airportEntries = [...alertAirports.entries()]
  const tileCount = 2 ** osmZoom
  const tiles = Array.from({ length: tileCount * tileCount }, (_, index) => ({ x: index % tileCount, y: Math.floor(index / tileCount) }))
  const plottedPoints = airportEntries.flatMap(([code]) => {
    const point = projectAirport(code), tooltipX = point.x > 512 ? point.x - 182 : point.x + 4
    return [point, { x: tooltipX, y: point.y - 42 }, { x: tooltipX + 178, y: point.y + 150 }]
  })
  const minX = plottedPoints.length ? Math.min(...plottedPoints.map((point) => point.x)) : 0
  const maxX = plottedPoints.length ? Math.max(...plottedPoints.map((point) => point.x)) : 1024
  const minY = plottedPoints.length ? Math.min(...plottedPoints.map((point) => point.y)) : 0
  const maxY = plottedPoints.length ? Math.max(...plottedPoints.map((point) => point.y)) : 1024
  const fitX = plottedPoints.length ? Math.max(0, minX - routeViewPadding) : minX
  const fitY = plottedPoints.length ? Math.max(0, minY - routeViewPadding) : minY
  const fitWidth = plottedPoints.length ? Math.min(1024 - fitX, maxX - minX + routeViewPadding * 2) : 1024
  const fitHeight = plottedPoints.length ? Math.min(1024 - fitY, maxY - minY + routeViewPadding * 2) : 1024
  const viewWidth = fitWidth / zoom
  const viewHeight = fitHeight / zoom
  const viewX = Math.max(0, Math.min(1024 - viewWidth, fitX + (fitWidth - viewWidth) / 2))
  const viewY = Math.max(0, Math.min(1024 - viewHeight, fitY + (fitHeight - viewHeight) / 2))
  return <section className="panel route-map-panel" aria-label="Map of affected flight routes">
    <div className="panel-heading"><div><p className="eyebrow">NETWORK ALERT VIEW</p><h2>Airports needing attention</h2><p>{airportEntries.length} airports · hover or focus a point to see alert flights.</p></div><div className="route-map-tools"><div className="route-map-legend"><span><i className="preventive-dot" /> Preventive</span><span><i className="recovery-dot" /> Recovery</span></div><div className="map-zoom-controls" aria-label="Map zoom controls"><button type="button" onClick={() => setZoom((level) => Math.max(1, Number((level - 0.5).toFixed(1))))} disabled={zoom <= 1} aria-label="Zoom out">−</button><span>{zoom.toFixed(1)}×</span><button type="button" onClick={() => setZoom((level) => Math.min(2.5, Number((level + 0.5).toFixed(1))))} disabled={zoom >= 2.5} aria-label="Zoom in">+</button><button type="button" onClick={() => setZoom(1)}>Fit airports</button></div></div></div>
    <div className="route-map-canvas"><svg viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`} role="img" aria-label={`Affected routes: ${plotted.map((route) => `${route.flightId} ${route.origin} to ${route.destination}`).join(', ') || 'none'}`}>
      {tiles.map((tile) => <image key={`${tile.x}-${tile.y}`} href={`https://tile.openstreetmap.org/${osmZoom}/${tile.x}/${tile.y}.png`} x={tile.x * osmTileSize} y={tile.y * osmTileSize} width={osmTileSize} height={osmTileSize} />)}
      {airportEntries.map(([code, alerts]) => { const point = projectAirport(code), tooltipX = point.x > 512 ? point.x - 182 : point.x + 4, hasPreventive = alerts.preventive.length > 0, hasRecovery = alerts.recovery.length > 0; return <g key={code} className={`map-airport alert-airport ${hasPreventive && hasRecovery ? 'mixed' : hasPreventive ? 'preventive' : 'recovery'}`} tabIndex={0} role="group" aria-label={`${code}, airport with alert flights`}>
        <circle className="airport-halo" cx={point.x} cy={point.y} r="13" />
        {hasPreventive && hasRecovery ? <><circle className="airport-marker preventive" cx={point.x - 3.5} cy={point.y} r="5" /><circle className="airport-marker recovery" cx={point.x + 3.5} cy={point.y} r="5" /></> : <circle className={`airport-marker ${hasPreventive ? 'preventive' : 'recovery'}`} cx={point.x} cy={point.y} r="6" />}
        <text className="airport-code" x={point.x + 11} y={point.y + 4}>{code}</text>
        <foreignObject className="airport-tooltip" x={tooltipX} y={point.y - 42} width="178" height="192"><div className="airport-tooltip-card"><b>{code} · Alert flights</b>{hasPreventive && <div className="airport-flight-links"><span className="preventive-text">Preventive</span>{alerts.preventive.map((flightId) => <button key={`preventive-${flightId}`} type="button" onClick={() => onSelectPreventiveFlight(flightId)}>{flightId}<small>Open prevention plan ↗</small></button>)}</div>}{hasRecovery && <div className="airport-flight-links"><span className="recovery-text">Recovery</span>{alerts.recovery.map(({ flightId, caseId }) => <button key={`recovery-${flightId}-${caseId ?? ''}`} type="button" disabled={!caseId} onClick={() => caseId && onSelectRecoveryCase(caseId)}>{flightId}<small>{caseId ? 'Open recovery case ↗' : 'Case unavailable'}</small></button>)}</div>}</div></foreignObject>
      </g> })}
    </svg></div>
    <div className="map-hint">Each point marks an airport on an alert route. Flight numbers appear on hover or keyboard focus.</div>
    <div className="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
  </section>
}

export function OverviewControlTower({ onNavigate, onSelectFlight, onSelectPreventiveFlight, onSelectRecoveryCase }: OverviewControlTowerProps) {
  const [showAllPreventive, setShowAllPreventive] = useState(false)
  const [showAllRecovery, setShowAllRecovery] = useState(false)
  const forecasts = useMemo(() => buildForecasts(), [])
  const queues = useMemo(() => getOverviewQueues(forecasts), [forecasts])
  const metrics = useMemo(() => getOverviewMetrics(queues, forecasts), [queues, forecasts])
  const schedule = useMemo(() => {
    const forecastRows = forecasts.map((forecast) => ({
      flightId: forecast.flightId,
      route: forecast.route,
      departure: forecast.departure,
      forecast,
      item: [...queues.preventive, ...queues.recovery, ...queues.onTrack].find((queueItem) => queueItem.lifecycle.flightId === forecast.flightId),
    }))
    const recoveryRows = queues.recovery.filter((item) => !forecasts.some((forecast) => forecast.flightId === item.lifecycle.flightId)).map((item) => {
      const recoveryCase = recoveryCases.find((entry) => entry.id === item.lifecycle.recoveryCaseId)
      return { flightId: item.lifecycle.flightId, route: recoveryCase ? `${recoveryCase.origin} → ${recoveryCase.destination}` : 'Route unavailable', departure: recoveryCase?.scheduledDeparture ?? 'Unavailable', forecast: undefined, item }
    })
    return [...forecastRows, ...recoveryRows]
  }, [forecasts, queues])
  const riskNames = new Set(queues.preventive.map((item) => item.lifecycle.flightId))
  const preventiveItems = useMemo(() => [...queues.preventive].sort((a, b) => (b.forecast?.forecastOffloadProbability ?? 0) - (a.forecast?.forecastOffloadProbability ?? 0) || b.estimatedImpact - a.estimatedImpact), [queues])
  const recoveryItems = useMemo(() => [...queues.recovery].sort((a, b) => {
    const statePriority = (item: OverviewQueueItem) => item.lifecycle.state === 'RECOVERY_IN_PROGRESS' ? 1 : 0
    const urgencyPriority = (item: OverviewQueueItem) => item.recoveryCase?.deliveryCommitment.includes('06:00') ? 1 : 0
    return statePriority(b) - statePriority(a) || urgencyPriority(b) - urgencyPriority(a) || (a.recoveryCase?.deliveryCommitment ?? '').localeCompare(b.recoveryCase?.deliveryCommitment ?? '')
  }), [queues])
  const visiblePreventiveItems = showAllPreventive ? preventiveItems : preventiveItems.slice(0, 3)
  const visibleRecoveryItems = showAllRecovery ? recoveryItems : recoveryItems.slice(0, 3)
  const mapRoutes = [
    ...preventiveItems.map((item) => ({ flightId: item.lifecycle.flightId, origin: item.forecast?.route.split(/[→-]/)[0]?.trim() ?? '', destination: item.forecast?.route.split(/[→-]/)[1]?.trim() ?? '', kind: 'preventive' as const, recoveryCaseId: undefined })),
    ...recoveryItems.map((item) => ({ flightId: item.lifecycle.flightId, origin: item.recoveryCase?.origin ?? '', destination: item.recoveryCase?.destination ?? '', kind: 'recovery' as const, recoveryCaseId: item.lifecycle.recoveryCaseId ?? undefined })),
  ]
  const uniqueMapRoutes = [...mapRoutes.reduce((byFlight, route) => {
    const current = byFlight.get(route.flightId)
    if (!current || route.kind === 'recovery') byFlight.set(route.flightId, route)
    return byFlight
  }, new Map<string, (typeof mapRoutes)[number]>()).values()]
  const actualOffloadRate = demoOffloadMetrics.actualOffloadRate
  const metricsCards: Array<{ label: string; value: string; note: string; tone: string; action: () => void }> = [
    { label: 'Actual offload rate', value: actualOffloadRate === null ? 'Unavailable' : `${(actualOffloadRate * 100).toFixed(1)}%`, note: `Target <5% · ${demoOffloadMetrics.actualOffloadedShipments} / ${demoOffloadMetrics.eligibleShipments} shipments · prior 24h · simulated`, tone: actualOffloadRate !== null && actualOffloadRate < 0.05 ? 'success' : 'danger', action: () => onNavigate('Analytics') },
    { label: 'Flights at risk', value: String(metrics.flightsAtRisk), note: 'Forecast risk; not confirmed offloads', tone: 'warning', action: () => onNavigate('Predictions') },
    { label: 'Confirmed offloads', value: String(metrics.confirmedOffloads), note: 'Authoritative events / decisions', tone: 'danger', action: () => { const caseId = queues.recovery[0]?.lifecycle.recoveryCaseId; if (caseId) onSelectRecoveryCase(caseId) } },
    { label: 'Active recovery cases', value: String(metrics.activeRecoveryCases), note: 'Confirmed or recovery in progress', tone: 'danger', action: () => { const caseId = queues.recovery[0]?.lifecycle.recoveryCaseId; if (caseId) onSelectRecoveryCase(caseId) } },
  ]

  return <div className="app-shell"><WorkspaceSidebar active="Overview" onNavigate={onNavigate} /><main className="main-content overview-page">
    <header className="topbar"><div className="crumb">CATHAY ROUNTER <span>/</span> OVERVIEW</div><div className="top-actions"><span className="data-freshness"><span className="live-dot" />Demo snapshot · 16 Oct 2026 09:12 UTC</span><span className="demo-label">SIMULATED</span></div></header>
    <div className="page-heading"><div><p className="eyebrow">NETWORK CONTROL TOWER · DEMO DATA</p><h1>Operations Overview</h1><p className="subtitle">Monitor the schedule, distinguish forecast risk from confirmed offloads, and route work to the right team.</p></div><span className="demo-label">SIMULATED</span></div>
    <section className="kpi-grid overview-kpis" aria-label="Operational metrics">{metricsCards.map((card) => <button className={`kpi-card ${card.tone} overview-metric`} key={card.label} onClick={card.action}><div className="kpi-top"><span>{card.label}</span><span aria-hidden="true">↗</span></div><strong>{card.value}</strong><small>{card.note}</small></button>)}</section>
    <section className="lifecycle-banner"><strong>Keep forecast and event status separate</strong><span>Predicted risks go to Predictions. Confirmed offloads and active recovery cases go to Recovery Plans.</span><small>All displayed operational records are deterministic demo data; predicted risk is never counted as a confirmed offload.</small></section>

    <RouteMap routes={uniqueMapRoutes} onSelectPreventiveFlight={onSelectPreventiveFlight} onSelectRecoveryCase={onSelectRecoveryCase} />
    <section className="overview-queues"><section className="panel queue-panel"><div className="panel-heading"><div><p className="eyebrow">PREVENTION · PREDICTED RISK</p><h2>Preventive action</h2><p>Sorted by highest flight risk · {queues.preventive.length} cases, {metrics.predictedOffloads} forecast affected shipments.</p></div><span className="count-badge">{queues.preventive.length}</span></div>{preventiveItems.length ? <><div className="queue-list">{visiblePreventiveItems.map((item) => <article className="queue-item" key={item.lifecycle.id}><div className="queue-item-header"><div><strong>{item.lifecycle.flightId} · {item.forecast?.route ?? 'Route unavailable'}</strong><small>{item.lifecycle.shipmentIds.join(', ')} · Departure {item.forecast?.departure ?? 'Unavailable'}</small></div><QueueStatus item={item} /></div><div className="queue-metrics"><span><small>FLIGHT RISK</small><b>{item.forecast ? `${Math.round(item.forecast.forecastOffloadProbability * 100)}%` : 'Unavailable'}</b></span><span><small>SHORTFALL</small><b>{item.forecast ? `${item.forecast.forecastCapacityShortfall.toLocaleString()} kg` : 'Unavailable'}</b></span><span><small>SHIPMENTS</small><b>{item.lifecycle.shipmentIds.length}</b></span><span><small>VALUE AT RISK</small><b>{formatCurrency(item.estimatedImpact)}</b></span></div><p className="queue-drivers">{item.forecast?.riskDrivers.join(' ') ?? 'Forecast details unavailable.'} This is a prediction, not an actual offload.</p><QueueAction item={item} onSelectPreventiveFlight={onSelectPreventiveFlight} onSelectRecoveryCase={onSelectRecoveryCase} /></article>)}</div><button className="queue-more-button" onClick={() => preventiveItems.length > 3 ? setShowAllPreventive((shown) => !shown) : preventiveItems[0] && onSelectPreventiveFlight(preventiveItems[0].lifecycle.flightId)}>{showAllPreventive && preventiveItems.length > 3 ? 'Show less' : 'Show more'} <span aria-hidden="true">→</span></button></> : <div className="empty-state"><strong>No preventive actions</strong><span>No unconfirmed forecast risks require intervention.</span></div>}</section>
    <section className="panel queue-panel recovery-queue-panel"><div className="panel-heading"><div><p className="eyebrow">RECOVERY · CONFIRMED EVENT</p><h2>Recovery required</h2><p>Sorted by recovery status and delivery urgency · {queues.recovery.length} cases, {metrics.confirmedOffloads} affected shipments.</p></div><span className="count-badge">{queues.recovery.length}</span></div>{recoveryItems.length ? <><div className="queue-list">{visibleRecoveryItems.map((item) => <article className="queue-item" key={item.lifecycle.id}><div className="queue-item-header"><div><strong>{item.lifecycle.recoveryCaseId ?? item.lifecycle.flightId} · {item.lifecycle.flightId}</strong><small>{item.lifecycle.shipmentIds.join(', ')} · {item.recoveryCase ? `${item.recoveryCase.origin} → ${item.recoveryCase.destination}` : 'Route unavailable'} · {item.lifecycle.recordedAt}</small></div><QueueStatus item={item} /></div><div className="queue-metrics"><span><small>SHIPMENTS</small><b>{item.lifecycle.shipmentIds.length}</b></span><span><small>URGENCY</small><b>{item.recoveryCase?.deliveryCommitment.includes('06:00') ? 'Critical' : 'Review'}</b></span><span><small>CASE IMPACT</small><b>{formatCurrency(item.recoveryCase?.baselineExpectedLoss ?? item.estimatedImpact)}</b></span><span><small>SOURCE</small><b>{item.lifecycle.authoritativeSource.replace('-', ' ')}</b></span></div><p className="queue-drivers">{item.lifecycle.statusLabel}. {item.recoveryCase?.reason ?? 'Recovery case details unavailable.'}</p><QueueAction item={item} onSelectPreventiveFlight={onSelectPreventiveFlight} onSelectRecoveryCase={onSelectRecoveryCase} /></article>)}</div><button className="queue-more-button" onClick={() => { if (recoveryItems.length > 3) setShowAllRecovery((shown) => !shown); else { const caseId = recoveryItems[0]?.lifecycle.recoveryCaseId; if (caseId) onSelectRecoveryCase(caseId) } }}>{showAllRecovery && recoveryItems.length > 3 ? 'Show less' : 'Show more'} <span aria-hidden="true">→</span></button></> : <div className="empty-state"><strong>No recovery cases</strong><span>No confirmed or committed offloads require recovery.</span></div>}</section></section>
    <section className="panel overview-schedule"><div className="panel-heading"><div><p className="eyebrow">UPCOMING MOVEMENTS</p><h2>Flight schedule and status</h2><p>Schedule and operational status from the current simulated fixtures.</p></div><span className="demo-label">DEMO DATA</span></div><div className="table-wrap"><table><thead><tr><th>FLIGHT</th><th>ROUTE</th><th>DEPARTURE</th><th>STATUS</th><th>RISK</th><th /></tr></thead><tbody>{schedule.map((row) => {
      const confirmed = row.item && queues.recovery.some((item) => item.lifecycle.id === row.item?.lifecycle.id)
      const status = confirmed ? row.item!.lifecycle.statusLabel : row.item?.lifecycle.statusLabel ?? 'Scheduled · status unavailable'
      const risk = row.forecast ? (riskNames.has(row.flightId) ? row.item?.lifecycle.statusLabel.includes('Preventive') ? 'Action required' : 'Predicted risk' : row.forecast.weatherRiskLevel === 'Low' ? 'Low' : row.forecast.weatherRiskLevel) : 'Confirmed event'
      const openRow = () => {
        const caseId = row.item?.lifecycle.recoveryCaseId
        if (confirmed && caseId) onSelectRecoveryCase(caseId)
        else if (row.forecast) onSelectFlight(row.forecast)
      }
      return <tr key={row.flightId} className="overview-flight-row" onClick={openRow}><td><strong>{row.flightId}</strong></td><td>{row.route}</td><td>{row.departure}</td><td><span className={`flight-status ${confirmed ? 'confirmed' : riskNames.has(row.flightId) ? 'risk' : ''}`}>{status}</span></td><td>{risk}</td><td><button className="row-action" aria-label={`Open ${row.flightId} details`} onClick={(event) => { event.stopPropagation(); openRow() }}>→</button></td></tr>
    })}</tbody></table></div></section>

    <footer>Predictions supports prevention; Recovery Plans manages confirmed events. No booking, reassignment, or operational action is executed in this simulated workspace.</footer>
  </main></div>
}
