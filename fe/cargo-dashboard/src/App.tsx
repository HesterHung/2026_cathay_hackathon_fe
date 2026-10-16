import { useMemo, useState } from 'react'
import './App.css'

type ShipmentStatus = 'On Track' | 'At Risk' | 'Delayed' | 'Recovery in Progress' | 'Recovered'
type Priority = 'Critical' | 'High' | 'Standard'
type AlertSeverity = 'Critical' | 'Warning' | 'Advisory'

interface Shipment {
  id: string
  origin: string
  destination: string
  movement: string
  time: string
  priority: Priority
  status: ShipmentStatus
  delayHours: number
}

interface Disruption {
  id: string
  severity: AlertSeverity
  location: string
  title: string
  description: string
  affected: number
  time: string
}

interface RecoveryPlan {
  id: string
  original: string
  alternative: string
  reduction: string
  cost: string
  confidence: number
  tradeoff: string
}

interface ActivityItem {
  id: string
  title: string
  description: string
  time: string
  tone: 'green' | 'amber' | 'red' | 'blue'
}

const shipments: Shipment[] = [
  { id: 'CX-482901', origin: 'HKG', destination: 'LHR', movement: 'CX 257 · B-LJA', time: 'Today, 18:40', priority: 'Critical', status: 'At Risk', delayHours: 7 },
  { id: 'CX-483117', origin: 'SIN', destination: 'FRA', movement: 'CX 289 · B-KQA', time: 'Today, 21:15', priority: 'High', status: 'Recovery in Progress', delayHours: 4 },
  { id: 'CX-482774', origin: 'HKG', destination: 'LAX', movement: 'CX 880 · B-HNS', time: 'Tomorrow, 02:05', priority: 'Standard', status: 'On Track', delayHours: 0 },
  { id: 'CX-481992', origin: 'FRA', destination: 'HKG', movement: 'CX 288 · B-KPB', time: 'Today, 20:10', priority: 'High', status: 'Delayed', delayHours: 11 },
  { id: 'CX-483204', origin: 'LHR', destination: 'SYD', movement: 'CX 101 · B-LRF', time: 'Tomorrow, 06:30', priority: 'Standard', status: 'Recovered', delayHours: 2 },
  { id: 'CX-482630', origin: 'HKG', destination: 'JFK', movement: 'CX 840 · B-LAE', time: 'Today, 23:50', priority: 'High', status: 'On Track', delayHours: 0 },
  { id: 'CX-483091', origin: 'LAX', destination: 'HKG', movement: 'CX 881 · B-KPF', time: 'Tomorrow, 01:25', priority: 'Critical', status: 'At Risk', delayHours: 5 },
]

const disruptions: Disruption[] = [
  { id: 'WX-204', severity: 'Critical', location: 'LHR · London', title: 'Severe weather advisory', description: 'Low visibility is restricting cargo ramp operations and may impact tonight’s arrival bank.', affected: 18, time: '12 min ago' },
  { id: 'FL-718', severity: 'Critical', location: 'FRA → HKG', title: 'Flight cancellation', description: 'CX 288 has been cancelled. Reassignment is required for priority consignments.', affected: 9, time: '34 min ago' },
  { id: 'CP-091', severity: 'Warning', location: 'HKG · Hong Kong', title: 'Capacity constraint', description: 'Main deck capacity is limited on the next two Europe-bound departures.', affected: 27, time: '1 hr ago' },
  { id: 'MC-441', severity: 'Advisory', location: 'SIN · Singapore', title: 'Missed connection', description: 'A handling delay has put four temperature-sensitive shipments at risk.', affected: 4, time: '2 hrs ago' },
]

const recoveryPlans: RecoveryPlan[] = [
  { id: 'CX-482901', original: 'HKG → LHR', alternative: 'HKG → FRA → LHR', reduction: '8 hours', cost: 'USD 420', confidence: 92, tradeoff: 'One additional handling event at FRA; preserves priority delivery window.' },
  { id: 'CX-481992', original: 'FRA → HKG', alternative: 'FRA → DOH → HKG', reduction: '6 hours', cost: 'USD 680', confidence: 86, tradeoff: 'Higher line-haul cost with a reliable onward connection.' },
  { id: 'CX-483117', original: 'SIN → FRA', alternative: 'SIN → HKG → FRA', reduction: '4 hours', cost: 'USD 295', confidence: 89, tradeoff: 'Adds a regional transfer but unlocks confirmed main deck capacity.' },
]

const activity: ActivityItem[] = [
  { id: 'a1', title: 'Recovery plan generated', description: 'CX-482901 · HKG → FRA → LHR', time: '8 min ago', tone: 'blue' },
  { id: 'a2', title: 'Shipment marked at risk', description: 'CX-483091 · Weather exposure at LAX', time: '21 min ago', tone: 'amber' },
  { id: 'a3', title: 'Alternative route proposed', description: 'CX-481992 · FRA → DOH → HKG', time: '42 min ago', tone: 'green' },
  { id: 'a4', title: 'Disruption alert received', description: 'Flight cancellation · CX 288', time: '1 hr ago', tone: 'red' },
]

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    box: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
    alert: 'M10.3 3.2 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01',
    route: 'M5 19c7 0 7-14 14-14M5 5h.01M19 19h.01',
    chart: 'M4 19V5m0 14h16M8 16v-5m4 5V7m4 9v-8',
    settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.1-1.2L14.5 3h-4l-.4 2.7A8 8 0 0 0 8 6.9l-2.4-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.1 1.2l.4 2.7h4l.4-2.7a8 8 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
    search: 'm21 21-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    close: 'm6 6 12 12M18 6 6 18',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    plane: 'm3 11 18-5-6 18-3-8-9-5Zm9 5 4-4',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.grid} /></svg>
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  return <span className={`status-badge ${status.toLowerCase().replaceAll(' ', '-')}`}><span />{status}</span>
}

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | 'At Risk' | 'Critical'>('All')
  const [sortByDelay, setSortByDelay] = useState(false)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<RecoveryPlan | null>(null)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  const visibleShipments = useMemo(() => {
    const result = shipments.filter((shipment) => {
      const matchesQuery = `${shipment.id} ${shipment.origin} ${shipment.destination} ${shipment.movement}`.toLowerCase().includes(query.toLowerCase())
      const matchesFilter = filter === 'All' || (filter === 'At Risk' ? shipment.status === 'At Risk' : shipment.priority === 'Critical')
      return matchesQuery && matchesFilter
    })
    return sortByDelay ? [...result].sort((a, b) => b.delayHours - a.delayHours) : result
  }, [filter, query, sortByDelay])

  const navItems = [['Overview', 'grid'], ['Shipments', 'box'], ['Disruptions', 'alert'], ['Recovery Plans', 'route'], ['Analytics', 'chart'], ['Settings', 'settings']]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Icon name="plane" size={20} /></span><span>CARGO <b>RECOVERY</b></span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav>{navItems.map(([label, icon]) => <button key={label} className={activeNav === label ? 'active' : ''} onClick={() => { setActiveNav(label); setMenuOpen(false) }}><Icon name={icon} /><span>{label}</span>{label === 'Disruptions' && <em>4</em>}</button>)}</nav>
        <div className="sidebar-footer"><div className="nav-label">OPERATIONS CONTROL</div><div className="demo-status"><span />Demo environment</div><div className="profile"><div className="avatar">AL</div><div><strong>Alex Lee</strong><small>Network operator</small></div><span className="more">•••</span></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><span /><span /><span /></button><div className="crumb">CARGO RECOVERY <span>/</span> {activeNav.toUpperCase()}</div><div className="top-actions"><label className="global-search"><Icon name="search" size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shipment or route" aria-label="Search shipments" /></label><button className="icon-button notification" aria-label="Notifications"><Icon name="bell" /><i /></button><div className="top-avatar">AL</div></div></header>

        <div className="page-heading"><div><p className="eyebrow">THURSDAY, 09 OCTOBER 2026 <span className="live-dot" /> DEMO DATA</p><h1>Operations Overview</h1><p className="subtitle">Monitor disruptions and optimise shipment recovery.</p></div><button className="outline-button"><Icon name="clock" size={16} /> Last 24 hours <span className="chevron">⌄</span></button></div>

        <section className="kpi-grid">
          {[
            ['Active Shipments', '1,284', 'Across current operations', 'box', 'neutral'],
            ['At-Risk Shipments', '37', 'Require operational attention', 'alert', 'warning'],
            ['Disrupted Routes', '12', 'Affected by operational events', 'route', 'danger'],
            ['Recovery Success Rate', '94.2%', 'Simulated recovery performance', 'chart', 'success'],
          ].map(([title, value, label, icon, tone]) => <article className={`kpi-card ${tone}`} key={title}><div className="kpi-top"><span>{title}</span><span className="kpi-icon"><Icon name={icon} size={17} /></span></div><strong>{value}</strong><small>{label}</small>{title === 'Recovery Success Rate' && <span className="trend">↑ 2.4% <i>illustrative</i></span>}</article>)}
        </section>

        <div className="content-grid">
          <section className="panel shipments-panel"><div className="panel-heading"><div><h2>Shipment Recovery Overview</h2><p>Prioritised view of current shipment movements.</p></div><button className="text-button">View all <Icon name="arrow" size={15} /></button></div><div className="table-toolbar"><div className="segmented">{(['All', 'At Risk', 'Critical'] as const).map((item) => <button className={filter === item ? 'selected' : ''} key={item} onClick={() => setFilter(item)}>{item}{item !== 'All' && <span>{item === 'At Risk' ? 2 : 2}</span>}</button>)}</div><button className={`sort-button ${sortByDelay ? 'selected' : ''}`} onClick={() => setSortByDelay(!sortByDelay)}>Sort: {sortByDelay ? 'Delay' : 'Priority'} <span>↕</span></button></div><div className="table-wrap"><table><thead><tr><th>SHIPMENT</th><th>ROUTE</th><th>MOVEMENT</th><th>DEPARTURE</th><th>PRIORITY</th><th>STATUS</th><th>DELAY</th><th /></tr></thead><tbody>{visibleShipments.map((shipment) => <tr key={shipment.id} onClick={() => setSelectedShipment(shipment)}><td><strong>{shipment.id}</strong><small>Fictional record</small></td><td><b>{shipment.origin}</b> <span className="route-arrow">→</span> <b>{shipment.destination}</b></td><td>{shipment.movement}</td><td>{shipment.time}</td><td><span className={`priority ${shipment.priority.toLowerCase()}`}><i />{shipment.priority}</span></td><td><StatusBadge status={shipment.status} /></td><td className={shipment.delayHours > 0 ? 'delay' : ''}>{shipment.delayHours ? `+${shipment.delayHours}h` : '—'}</td><td><button className="row-action" aria-label={`View ${shipment.id}`}><Icon name="arrow" size={15} /></button></td></tr>)}</tbody></table>{visibleShipments.length === 0 && <div className="empty-state"><Icon name="search" size={24} /><strong>No shipments found</strong><span>Try a different shipment ID, route, or filter.</span></div>}</div></section>

          <section className="panel alerts-panel"><div className="panel-heading"><div><h2>Operational Alerts <span className="count-badge">4</span></h2><p>Events requiring review.</p></div><button className="text-button">View log <Icon name="arrow" size={15} /></button></div><div className="alert-list">{disruptions.filter((item) => !dismissed.includes(item.id)).map((item) => <article className={`alert-item ${item.severity.toLowerCase()}`} key={item.id}><div className="alert-icon"><Icon name="alert" size={16} /></div><div className="alert-copy"><div className="alert-meta"><span>{item.severity}</span><time>{item.time}</time></div><strong>{item.title}</strong><small>{item.location} · {item.affected} shipments affected</small><p>{item.description}</p><button onClick={() => setDismissed([...dismissed, item.id])}>Mark reviewed <Icon name="arrow" size={13} /></button></div></article>)}</div></section>
        </div>

        <div className="lower-grid"><section className="panel recovery-panel"><div className="panel-heading"><div><h2>Recommended Recovery Plans</h2><p>Illustrative suggestions from the optimisation engine.</p></div><span className="demo-label">DEMO SUGGESTIONS</span></div><div className="plans-list">{recoveryPlans.map((plan) => <article className="plan-card" key={plan.id}><div className="plan-id"><span className="plan-symbol"><Icon name="route" size={15} /></span><strong>{plan.id}</strong><span className="confidence">{plan.confidence}% feasible</span></div><div className="route-comparison"><div><small>ORIGINAL</small><b>{plan.original}</b></div><Icon name="arrow" size={16} /><div><small>PROPOSED</small><b>{plan.alternative}</b></div></div><div className="plan-metrics"><span><small>DELAY REDUCTION</small><b>↓ {plan.reduction}</b></span><span><small>ADDITIONAL COST</small><b>{plan.cost}</b></span><button onClick={() => setSelectedPlan(plan)}>Review plan <Icon name="arrow" size={14} /></button></div></article>)}</div></section><section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent Activity</h2><p>Demo operational feed.</p></div><button className="text-button">See all <Icon name="arrow" size={15} /></button></div><div className="activity-list">{activity.map((item) => <div className="activity-item" key={item.id}><span className={`activity-dot ${item.tone}`} /><div><strong>{item.title}</strong><small>{item.description}</small></div><time>{item.time}</time></div>)}</div></section></div>

        <section className="panel analytics-panel"><div className="panel-heading"><div><h2>Performance Analytics</h2><p>Current distribution and recent simulated performance.</p></div><div className="chart-switch"><button className="selected">7 days</button><button>30 days</button></div></div><div className="charts"><div className="donut-wrap"><div className="donut"><div><strong>1,284</strong><small>SHIPMENTS</small></div></div><div className="legend"><span><i className="green" />On track <b>78%</b></span><span><i className="amber" />At risk <b>12%</b></span><span><i className="red" />Disrupted <b>10%</b></span></div></div><div className="line-chart"><div className="chart-labels"><span>100%</span><span>95%</span><span>90%</span><span>85%</span></div><svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label="Recovery performance trend"><path className="grid-line" d="M0 20H600M0 60H600M0 100H600M0 140H600" /><path className="area" d="M0 105 C60 100 70 80 125 88 S190 65 245 76 S300 42 360 57 S420 48 480 34 S540 42 600 22 V160H0Z" /><path className="trend-line" d="M0 105 C60 100 70 80 125 88 S190 65 245 76 S300 42 360 57 S420 48 480 34 S540 42 600 22" /></svg><div className="x-labels"><span>04 Oct</span><span>05 Oct</span><span>06 Oct</span><span>07 Oct</span><span>08 Oct</span><span>09 Oct</span></div><div className="chart-callout">94.2% <small>recovery rate</small></div></div></div></section>
        <footer>All records and metrics shown are fictional demo data. Backend integration pending.</footer>
      </main>

      {selectedShipment && <div className="modal-backdrop" onClick={() => setSelectedShipment(null)}><aside className="detail-drawer" onClick={(e) => e.stopPropagation()}><button className="close-button" onClick={() => setSelectedShipment(null)} aria-label="Close details"><Icon name="close" /></button><p className="eyebrow">SHIPMENT DETAIL · DEMO</p><h2>{selectedShipment.id}</h2><StatusBadge status={selectedShipment.status} /><div className="drawer-route"><span>{selectedShipment.origin}</span><Icon name="arrow" /><span>{selectedShipment.destination}</span></div><dl><div><dt>Current movement</dt><dd>{selectedShipment.movement}</dd></div><div><dt>Scheduled departure</dt><dd>{selectedShipment.time}</dd></div><div><dt>Priority</dt><dd>{selectedShipment.priority}</dd></div><div><dt>Estimated delay</dt><dd className={selectedShipment.delayHours ? 'delay' : ''}>{selectedShipment.delayHours ? `+${selectedShipment.delayHours} hours` : 'On schedule'}</dd></div></dl><div className="drawer-note"><Icon name="box" size={17} /><span>This is a fictional shipment record for presentation. Live tracking will be connected through the backend integration.</span></div></aside></div>}
      {selectedPlan && <div className="modal-backdrop" onClick={() => setSelectedPlan(null)}><aside className="detail-drawer plan-drawer" onClick={(e) => e.stopPropagation()}><button className="close-button" onClick={() => setSelectedPlan(null)} aria-label="Close plan"><Icon name="close" /></button><p className="eyebrow">RECOVERY PLAN · DEMO</p><h2>{selectedPlan.id}</h2><div className="drawer-route"><span>{selectedPlan.original}</span><Icon name="arrow" /><span>{selectedPlan.alternative}</span></div><div className="impact-card"><span>ESTIMATED DELAY REDUCTION</span><strong>↓ {selectedPlan.reduction}</strong><small>Feasibility score: {selectedPlan.confidence}%</small></div><dl><div><dt>Additional cost</dt><dd>{selectedPlan.cost}</dd></div><div><dt>Operational trade-off</dt><dd>{selectedPlan.tradeoff}</dd></div></dl><button className="apply-button" disabled>Apply plan <small>Demo only</small></button></aside></div>}
    </div>
  )
}

export default App
