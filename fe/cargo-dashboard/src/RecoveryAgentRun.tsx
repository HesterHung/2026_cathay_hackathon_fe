import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Clock3, Database, LoaderCircle, PackageCheck, Route } from 'lucide-react'
import type { RecoveryDetail, RecoveryOption } from './recoveryApi'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Card } from './components/ui/card'

type Phase = 'idle' | 'running' | 'complete'

interface RecoveryAgentRunProps {
  detail: RecoveryDetail
  options: RecoveryOption[]
  currency: string
}

const stages = [
  { title: 'Gather shipment requirements', description: 'Reading cargo, delivery commitment, and handling needs', icon: PackageCheck },
  { title: 'Search and validate routes', description: 'Checking route options, capacity, ETA, and restrictions', icon: Route },
  { title: 'Compare feasible options', description: 'Ranking by feasibility, modeled impact, and delay', icon: Check },
]

export function RecoveryAgentRun({ detail, options, currency }: RecoveryAgentRunProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [stage, setStage] = useState(-1)
  const [showAlternatives, setShowAlternatives] = useState(false)

  // Agent integration placeholder: replace this timed demo sequence with the
  // recovery-agent API stream. Keep the same phase events for the UI.
  useEffect(() => {
    if (phase !== 'running') return
    setStage(0)
    const timers = [
      window.setTimeout(() => setStage(1), 850),
      window.setTimeout(() => setStage(2), 1700),
      window.setTimeout(() => { setStage(3); setPhase('complete') }, 2550),
    ]
    return () => timers.forEach(window.clearTimeout)
  }, [phase])

  const ranked = useMemo(() => [...options]
    .filter((option) => option.feasibilityStatus.toLowerCase() !== 'infeasible')
    .sort((a, b) => a.totalModeledExpectedLoss - b.totalModeledExpectedLoss || a.expectedDelayMinutes - b.expectedDelayMinutes), [options])
  const best = ranked[0]
  const hasUnknown = Boolean(best && (best.feasibilityStatus.toLowerCase().includes('unknown') || best.missingData.length > 0))

  const run = () => { setShowAlternatives(false); setPhase('running') }

  return <Card className="overflow-hidden border-slate-200 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-900 text-white"><Route size={17} /></span>
        <div><p className="m-0 text-sm font-semibold text-slate-900">Recovery route assistant</p><p className="m-0 mt-0.5 text-xs text-slate-500">Case {detail.workItemId} · recommendation only</p></div>
      </div>
      {phase !== 'running' && <Button onClick={run} className="border-emerald-900 bg-emerald-900 text-white hover:bg-emerald-800">
        <Route size={15} /> {phase === 'complete' ? 'Re-run route analysis' : 'Find best recovery route'} <ArrowRight size={15} />
      </Button>}
      {phase === 'running' && <span className="flex items-center gap-2 text-sm font-medium text-emerald-900"><LoaderCircle className="animate-spin" size={16} /> Analyzing routes</span>}
    </div>

    {phase === 'idle' && <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <p className="m-0 max-w-2xl text-sm leading-6 text-slate-600">Compare routes for {detail.uld.origin} → {detail.uld.destination}. The assistant checks the case data, filters route constraints, and presents the strongest available option with its evidence.</p>
      <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14} /> Route checks · case-scoped data</div>
    </div>}

    {phase !== 'idle' && <div className="grid gap-5 p-5 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-0">
        {stages.map((item, index) => {
          const Icon = item.icon
          const done = stage > index
          const active = phase === 'running' && stage === index
          return <div key={item.title} className="relative flex gap-3 pb-5 last:pb-0">
            {index < stages.length - 1 && <span className={`absolute left-[13px] top-7 h-[calc(100%-12px)] w-px ${done ? 'bg-emerald-700' : 'bg-slate-200'}`} />}
            <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${done ? 'border-emerald-700 bg-emerald-700 text-white' : active ? 'border-emerald-700 bg-white text-emerald-800' : 'border-slate-200 bg-white text-slate-400'}`}>
              {done ? <Check size={14} /> : active ? <LoaderCircle className="animate-spin" size={14} /> : <Icon size={14} />}
            </span>
            <div className="pt-0.5"><p className={`m-0 text-sm font-medium ${active || done ? 'text-slate-900' : 'text-slate-400'}`}>{item.title}</p><p className="m-0 mt-1 text-xs leading-5 text-slate-500">{item.description}</p></div>
          </div>
        })}
      </div>

      {phase === 'complete' && <div className="min-w-0">
        {!best ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-950"><AlertTriangle size={16} /> No feasible route found</div>
          <p className="mb-0 mt-2 text-sm leading-6 text-amber-900">Available options did not pass the route feasibility check. Review the blockers and request updated route options.</p>
        </div> : <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h3 className="m-0 text-sm font-semibold text-slate-900">Best available route</h3><span className="text-xs text-slate-500">1 of {ranked.length}</span></div><span className="text-xs text-slate-500"><Database size={13} className="mr-1 inline" /> Case route options</span></div>
          <div className="rounded-md border border-emerald-200 bg-[#f2f7f3] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-950">{best.recoveryLegs.map((leg, index) => <span className="inline-flex items-center gap-2" key={`${leg.from}-${leg.to}-${index}`}><span>{leg.from}</span><span className="flex items-center text-emerald-800"><span className="h-px w-6 bg-emerald-700" /><Route size={14} /><span className="h-px w-6 bg-emerald-700" /></span><span>{leg.to}</span></span>)}</div><p className="m-0 mt-2 text-sm text-slate-600">{best.recoveryLegs.map((leg) => leg.operatingFlightId).join(' · ')} · Arrival {best.expectedArrival}</p></div>
              <Badge className={best.feasibilityStatus.toLowerCase().includes('feasible') && !best.feasibilityStatus.toLowerCase().includes('unknown') ? 'border-emerald-200 bg-white text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900'}>{best.feasibilityStatus}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Usable capacity" value={`${best.usableCapacityKg.toLocaleString()} kg`} />
              <Metric label="Expected delay" value={`${Math.round(best.expectedDelayMinutes / 60)}h`} />
              <Metric label="Modeled loss" value={`${currency} ${best.totalModeledExpectedLoss.toLocaleString()}`} />
              <Metric label="Feasibility" value={`${best.feasibilityPercentage}%`} />
            </div>
          </div>
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
            <p className="m-0 text-sm font-semibold text-slate-700">Why this route ranks first</p>
            <p className="mb-0 mt-2 text-sm leading-6 text-slate-700">It is the lowest modeled-loss option among routes not marked infeasible, with expected delay used as the tie-breaker. This ranking is a demo heuristic; the production agent and approved priorities are not connected yet.</p>
          </div>
          {hasUnknown && <div role="status" className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950"><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span><strong>Provisional recommendation.</strong> {best.missingData.length ? `Unconfirmed: ${best.missingData.join(', ')}.` : 'Route feasibility is not confirmed.'} Recheck these details before operational use.</span></div>}
          {ranked.length > 1 && <div className="mt-4"><button type="button" className="text-sm font-medium text-emerald-900 underline decoration-emerald-300 underline-offset-4" onClick={() => setShowAlternatives((value) => !value)}>{showAlternatives ? 'Hide alternatives' : `Compare ${ranked.length - 1} alternative${ranked.length > 2 ? 's' : ''}`}</button>{showAlternatives && <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Route</th><th className="px-3 py-2">ETA</th><th className="px-3 py-2">Delay</th><th className="px-3 py-2">Modeled loss</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{ranked.slice(1).map((option) => <tr key={option.optionId} className="border-t border-slate-100"><td className="px-3 py-2">{option.recoveryLegs.map((leg) => `${leg.from} → ${leg.to} · ${leg.operatingFlightId}`).join(' / ')}</td><td className="px-3 py-2">{option.expectedArrival}</td><td className="px-3 py-2">{Math.round(option.expectedDelayMinutes / 60)}h</td><td className="px-3 py-2">{currency} {option.totalModeledExpectedLoss.toLocaleString()}</td><td className="px-3 py-2">{option.feasibilityStatus}</td></tr>)}</tbody></table></div>}</div>}
        </>}
      </div>}
    </div>}
    {phase === 'complete' && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3 text-xs text-slate-500"><span>Recommendation recorded in this case · No route change has been submitted.</span><span>AI agent integration: placeholder</span></div>}
  </Card>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="m-0 text-xs font-medium text-slate-500">{label}</p><p className="m-0 mt-1 text-sm font-semibold tabular-nums text-slate-900">{value}</p></div>
}
