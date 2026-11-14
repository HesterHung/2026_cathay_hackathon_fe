import { useMemo, useState } from 'react'
import { demoOffloadTrend, filterOffloadTrend, type TrendMetric } from './domain'

function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

export function OffloadTrendChart() {
  const [days, setDays] = useState<7 | 5>(5)
  const [route, setRoute] = useState('All routes')
  const [metric, setMetric] = useState<TrendMetric>('shipment')
  const points = useMemo(() => filterOffloadTrend(demoOffloadTrend, { days, route, metric }), [days, metric, route])
  const width = 760
  const height = 250
  const chartTop = 24
  const chartBottom = 206
  const maxRate = 0.12
  const x = (index: number) => points.length <= 1 ? width / 2 : 28 + (index * (width - 56)) / (points.length - 1)
  const y = (rate: number) => chartBottom - (Math.min(rate, maxRate) / maxRate) * (chartBottom - chartTop)
  const actualPoints = points.filter((point) => point.actualRate !== null).map((point) => ({ x: x(points.indexOf(point)), y: y(point.actualRate ?? 0) }))
  const predictedHistory = points.filter((point) => !point.isFuture && point.predictedRate !== null).map((point) => ({ x: x(points.indexOf(point)), y: y(point.predictedRate ?? 0) }))
  const futureIndex = points.findIndex((point) => point.isFuture)
  const predictedFuture = points.filter((point, index) => point.predictedRate !== null && (point.isFuture || index === futureIndex - 1)).map((point) => ({ x: x(points.indexOf(point)), y: y(point.predictedRate ?? 0) }))
  const futureStart = points.findIndex((point) => point.isFuture)
  const boundaryX = futureStart >= 0 ? x(futureStart) - (points.length > 1 ? (x(1) - x(0)) / 2 : 0) : null
  const metricLabel = metric === 'shipment' ? 'shipment-count' : metric
  return <section className="panel offload-trend-panel"><div className="panel-heading"><div><h2>Actual versus predicted offload rate</h2><p>Same flight-departure cohorts · saved forecast cutoff: <b>24 hours before departure</b> · default metric: shipment-count</p></div></div><div className="trend-controls"><label>Reporting period<select value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 5)}><option value={5}>Last 5 departures</option><option value={7}>Last 7 departures</option></select></label><label>Route<select value={route} onChange={(event) => setRoute(event.target.value)}><option>All routes</option><option>HKG-LHR</option><option>SIN-FRA</option><option>HKG-LAX</option><option>HKG-JFK</option></select></label><label>Rate basis<select value={metric} onChange={(event) => setMetric(event.target.value as TrendMetric)}><option value="shipment">Shipment count</option><option value="weight">Weight (unavailable)</option><option value="volume">Volume (unavailable)</option></select></label></div><div className="line-chart-wrap"><div className="line-y-axis"><span>12%</span><span>8%</span><span>4%</span><span>0%</span></div><svg className="offload-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Actual and predicted ${metricLabel} offload rate trend`}><line className="chart-grid-line" x1="28" x2="732" y1={chartTop} y2={chartTop} /><line className="chart-grid-line" x1="28" x2="732" y1="85" y2="85" /><line className="chart-grid-line" x1="28" x2="732" y1="145" y2="145" /><line className="chart-grid-line" x1="28" x2="732" y1={chartBottom} y2={chartBottom} />{boundaryX !== null && <><line className="forecast-boundary" x1={boundaryX} x2={boundaryX} y1="12" y2={chartBottom} /><text className="forecast-boundary-label" x={boundaryX + 8} y="20">UPCOMING FORECAST</text></>}{actualPoints.length > 1 && <path className="actual-line" d={linePath(actualPoints)} />}{predictedHistory.length > 1 && <path className="predicted-line historical" d={linePath(predictedHistory)} />}{predictedFuture.length > 0 && <path className="predicted-line future" d={linePath(predictedFuture)} />}{points.map((point, index) => <g key={`${point.flightId}-${point.departureDate}`}><circle className={point.actualRate === null ? 'point predicted-point' : 'point actual-point'} cx={x(index)} cy={y(point.actualRate ?? point.predictedRate ?? 0)} r="4"><title>{`${point.departureDate} · ${point.flightId}
Forecast: ${point.predictedRate === null ? 'Unavailable' : `${(point.predictedRate * 100).toFixed(1)}%`}
Actual: ${point.actualRate === null ? 'Unavailable' : `${(point.actualRate * 100).toFixed(1)}%`}
Eligible: ${point.eligibleCount ?? 'Unavailable'}
Actual offloaded: ${point.actualOffloadCount ?? 'Unavailable'}
Prediction timestamp: ${point.predictionTimestamp ?? 'Unavailable'}
Forecast error: ${point.actualRate === null || point.predictedRate === null ? 'Unavailable' : `${((point.actualRate - point.predictedRate) * 100).toFixed(1)} pp`}`}</title></circle></g>)}</svg><div className="line-x-axis">{points.map((point) => <span key={`${point.flightId}-label`}>{point.departureDate.slice(5)}<small>{point.flightId}</small></span>)}</div></div><div className="trend-chart-legend"><span><i className="actual-key" />Actual completed departure</span><span><i className="predicted-key" />Predicted snapshot at -24h</span><span className="trend-unavailable">Weight and volume series unavailable in current fixtures</span></div><p className="trend-note">Actual values remain blank for upcoming departures. Historical points use preserved forecast snapshots from the same departure cohort; no later information is used to reconstruct them.</p></section>
}
