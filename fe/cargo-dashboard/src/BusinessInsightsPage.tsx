import { ArrowRight } from 'lucide-react'
import type { WorkspaceNavItem } from './WorkspaceSidebar'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { OffloadDriversChart, OffloadRateTrendChart, ServiceabilityChart, StationUtilizationChart, TurnaroundChart } from './UldInsightCharts'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'

const insights = [
  { title: 'Reduce capacity mismatch', action: 'Review ULD allocation before close-out', signal: 'Largest contributor · 38%' },
  { title: 'Move late-arriving ULDs earlier', action: 'Set station handoff checks at FRA and LAX', signal: 'Turnaround exceeds 4 hours' },
  { title: 'Repair the highest-use units first', action: 'Prioritize serviceable replacements at SIN', signal: '9% unavailable for service' },
]

export function BusinessInsightsPage({ onNavigate }: { onNavigate: (item: WorkspaceNavItem) => void }) {
  return <div className="app-shell"><WorkspaceSidebar active="Business Insights" onNavigate={onNavigate} /><main className="main-content shipment-page business-insights-page">
    <header className="topbar"><div className="crumb">CATHAY ROUTER <span>/</span> BUSINESS INSIGHTS</div><Badge className="border-amber-200 bg-amber-50 text-amber-900">Illustrative</Badge></header>
    <section className="insight-context"><div><h1>ULD business insights</h1></div><div className="insight-context-meta"><span>Last 6 weeks</span></div></section>
    <section className="kpi-grid insight-kpis uld-kpis" aria-label="Insight summary">
      <article className="kpi-card neutral"><div className="kpi-top"><span>Avg. offload rate</span></div><strong>4.8%</strong><small>Across 6 weeks</small></article>
      <article className="kpi-card warning"><div className="kpi-top"><span>Empty repositioning</span></div><strong>25%</strong><small>Of tracked movements</small></article>
      <article className="kpi-card blue"><div className="kpi-top"><span>Serviceable</span></div><strong>91%</strong><small>Inspection records</small></article>
      <article className="kpi-card success"><div className="kpi-top"><span>Top driver</span></div><strong>38%</strong><small>Capacity mismatch</small></article>
    </section>

    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-label="ULD operating patterns">
      <Card className="min-w-0"><CardHeader><CardTitle>Offload rate</CardTitle><Badge className="border-slate-200 bg-slate-50 text-slate-600">%</Badge></CardHeader><CardContent className="pt-2"><OffloadRateTrendChart /></CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle>Loaded vs empty ULDs</CardTitle><Badge className="border-slate-200 bg-slate-50 text-slate-600">By station</Badge></CardHeader><CardContent className="pt-2"><StationUtilizationChart /></CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle>Turnaround time</CardTitle><Badge className="border-slate-200 bg-slate-50 text-slate-600">Hours</Badge></CardHeader><CardContent className="pt-2"><TurnaroundChart /></CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle>ULD serviceability</CardTitle><Badge className="border-slate-200 bg-slate-50 text-slate-600">Inspection status</Badge></CardHeader><CardContent className="pt-2"><ServiceabilityChart /></CardContent></Card>
      <Card className="min-w-0 xl:col-span-2"><CardHeader><CardTitle>Offload drivers</CardTitle><Badge className="border-slate-200 bg-slate-50 text-slate-600">Share of cases</Badge></CardHeader><CardContent className="pt-2"><OffloadDriversChart /></CardContent></Card>
    </section>

    <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]" aria-label="Recommended operating changes">
      <Card><CardHeader><CardTitle>What to change</CardTitle><Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">3 actions</Badge></CardHeader><div className="divide-y divide-slate-100 px-5">{insights.map((item) => <article className="grid gap-1 py-4 md:grid-cols-[1fr_auto] md:items-center" key={item.title}><div><h3 className="m-0 text-sm font-medium text-slate-900">{item.title}</h3><p className="mb-0 mt-1 text-sm text-slate-600">{item.action}</p></div><span className="text-sm text-slate-500">{item.signal}</span></article>)}</div></Card>
      <Card><CardHeader><CardTitle>Next review</CardTitle></CardHeader><CardContent className="grid gap-4"><p className="m-0 text-sm leading-6 text-slate-700">Check capacity fit and late ULD arrivals at FRA first. Confirm these patterns against live station records before changing allocation rules.</p><Button onClick={() => onNavigate('Pending Pool')} className="justify-self-start">Open ULD pool <ArrowRight size={16} /></Button></CardContent></Card>
    </section>
    <footer>Illustrative data · replace with validated station and ULD history</footer>
  </main></div>
}
