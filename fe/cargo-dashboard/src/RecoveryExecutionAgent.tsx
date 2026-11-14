import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { AlertTriangle, Check, ClipboardCheck, Clock3, LoaderCircle, PackageSearch, Route, Send, ShieldCheck, Truck, X } from 'lucide-react'
import type { RecoveryDetail, RecoveryOption } from './recoveryApi'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'

type Stage = 'ready' | 'investigating' | 'plan' | 'approved' | 'executing' | 'awaiting-confirmation' | 'closed'
type CheckState = 'pending' | 'running' | 'complete'
const checks = [
  { name: 'Customer', task: 'Check delivery preference and prepare a status update', icon: Send },
  { name: 'Warehouse', task: 'Check cargo readiness and dispatch handling', icon: PackageSearch },
  { name: 'Logistics', task: 'Verify route, capacity, and onward movement', icon: Truck },
  { name: 'Policy', task: 'Check remedy eligibility and approval limits', icon: ShieldCheck },
]

export function RecoveryExecutionAgent({ detail, option, currency, onClose }: { detail: RecoveryDetail; option: RecoveryOption; currency: string; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>('ready')
  const [checkStates, setCheckStates] = useState<CheckState[]>(checks.map(() => 'pending'))
  const [approval, setApproval] = useState<'approve' | 'revise' | null>(null)
  const [error, setError] = useState('')
  const isUncertain = option.feasibilityStatus.toLowerCase().includes('unknown') || option.missingData.length > 0 || option.capacityStatus.toLowerCase().includes('pending')

  useEffect(() => {
    if (stage !== 'investigating') return
    const timers = [900, 1450, 2050, 2550].map((delay, index) => window.setTimeout(() => {
      setCheckStates((states) => states.map((state, itemIndex) => itemIndex === index ? 'complete' : state))
      if (index === checks.length - 1) setStage('plan')
    }, delay))
    return () => timers.forEach(window.clearTimeout)
  }, [stage])

  useEffect(() => {
    if (stage !== 'executing') return
    const timer = window.setTimeout(() => setStage('awaiting-confirmation'), 1600)
    return () => window.clearTimeout(timer)
  }, [stage])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && stage !== 'executing' && stage !== 'investigating') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, stage])

  const start = () => { setError(''); setCheckStates(checks.map(() => 'running')); setStage('investigating') }
  const execute = () => { setError(''); setStage('executing') }
  const finish = () => {
    const key = 'cathay-recovery-work-history'
    try {
      const old = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]
      localStorage.setItem(key, JSON.stringify([...old, { workItemId: detail.workItemId, optionId: option.optionId, route: option.recoveryLegs, outcome: 'closed', closedAt: new Date().toISOString() }]))
      setStage('closed')
    } catch { setError('Could not save the demo case outcome in browser storage.') }
  }

  return createPortal(<MotionConfig reducedMotion="user"><AnimatePresence>
    <motion.div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget && ['ready', 'plan', 'approved', 'closed'].includes(stage)) onClose() }}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="recovery-execution-title" initial={{ opacity: 0, y: 18, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: .22, ease: 'easeOut' }} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><h2 id="recovery-execution-title" className="m-0 text-lg font-semibold text-slate-950">Recovery work</h2><p className="m-0 mt-1 text-sm text-slate-500">{detail.flight.flightId} · {detail.uld.uldId} · {option.optionId}</p></div><button aria-label="Close recovery work" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.1fr_.9fr]">
          <section className="border-b border-slate-200 p-5 sm:p-6 lg:border-b-0 lg:border-r"><div className="flex items-center gap-2"><Route size={17} className="text-emerald-800" /><h3 className="m-0 text-sm font-semibold text-slate-900">Selected recovery option</h3></div>
            <div className="mt-4 border-l-[3px] border-emerald-800 bg-[#f2f7f3] px-4 py-3"><p className="m-0 text-base font-semibold text-slate-950">{option.recoveryLegs.map((leg) => `${leg.from} → ${leg.to}`).join(' / ')}</p><p className="m-0 mt-1 text-sm text-slate-600">{option.recoveryLegs.map((leg) => leg.operatingFlightId).join(' · ')} · Arrival {option.expectedArrival}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><span className="block text-xs text-slate-500">Capacity</span><strong className="text-slate-800">{option.usableCapacityKg.toLocaleString()} kg</strong></div><div><span className="block text-xs text-slate-500">Modeled loss</span><strong className="text-slate-800">{currency} {option.totalModeledExpectedLoss.toLocaleString()}</strong></div></div></div>
            {isUncertain && <div className="mt-3 flex gap-2 border-b border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-5 text-amber-950"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span><strong>Needs confirmation.</strong> {option.missingData.join(' · ') || option.capacityStatus}</span></div>}
            <div className="mt-6 flex items-center justify-between gap-3"><h3 className="m-0 text-sm font-semibold text-slate-900">Specialists working in parallel</h3>{stage === 'investigating' && <span className="text-xs font-medium text-emerald-800">4 tasks launched</span>}</div>
            <div className="relative mt-3 grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-5">
              {stage === 'investigating' && <motion.div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 hidden h-px w-[calc(100%-28px)] -translate-x-1/2 bg-emerald-300 sm:block" initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ duration: .55, ease: 'easeOut' }} />}
              {checks.map((item, index) => { const Icon = item.icon; const state = checkStates[index]; const done = state === 'complete' || ['plan', 'approved', 'executing', 'awaiting-confirmation', 'closed'].includes(stage); const running = state === 'running'; return <motion.article key={item.name} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24, delay: stage === 'investigating' ? 0 : index * .05 }} className={`relative my-1 flex min-h-[112px] items-start gap-3 border-b border-slate-200 bg-white py-3 ${stage === 'investigating' && running ? 'sm:after:absolute sm:after:inset-y-2 sm:after:-right-2 sm:after:w-px sm:after:bg-emerald-200' : ''}`}>
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${done ? 'bg-emerald-50 text-emerald-800' : running ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{done ? <Check size={16} /> : running ? <LoaderCircle className="animate-spin" size={16} /> : <Icon size={16} />}</span>
                <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="m-0 text-sm font-semibold text-slate-800">{item.name}</p><span className={`text-[11px] font-medium ${done ? 'text-emerald-800' : running ? 'text-amber-800' : 'text-slate-400'}`}>{done ? 'Done' : running ? 'Working' : 'Waiting'}</span></div>{done && <motion.p initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="m-0 mt-1 text-xs leading-5 text-slate-600">{item.name === 'Logistics' ? isUncertain ? 'Capacity needs confirmation' : `Route available · ${option.expectedArrival}` : item.name === 'Warehouse' ? `${detail.uld.weightKg.toLocaleString()} kg cargo checked` : item.name === 'Policy' ? isUncertain ? 'Human review required' : 'Within current limits' : 'Customer update prepared'}</motion.p>}</div>
                {running && <motion.span aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] bg-emerald-700" initial={{ width: '5%' }} animate={{ width: '100%' }} transition={{ duration: [0.9, 1.45, 2.05, 2.55][index] / 1000, ease: 'linear' }} />}
              </motion.article> })}
            </div>
          </section>
          <section className="p-5 sm:p-6"><div className="flex items-center gap-2"><ClipboardCheck size={17} className="text-emerald-800" /><h3 className="m-0 text-sm font-semibold text-slate-900">Recovery coordinator</h3></div>
            {stage === 'ready' && <div className="mt-4"><p className="text-sm leading-6 text-slate-600">The coordinator will gather customer, warehouse, logistics, and policy checks for this selected route, then prepare a recovery plan.</p><p className="text-xs leading-5 text-slate-500">Starting runs the agent workflow preview. Live customer contact, warehouse dispatch, and route allocation require connected operational tools.</p><Button variant="primary" onClick={start} className="mt-3"><Route size={15} /> Start recovery agent</Button></div>}
            {stage === 'investigating' && <div className="mt-5"><p className="text-sm font-medium text-slate-800">Coordinator waiting for specialist results</p><div className="my-3 flex items-center gap-1.5" aria-hidden="true">{checks.map((item) => <motion.span key={item.name} className="h-1.5 flex-1 rounded-full bg-emerald-700" initial={{ opacity: .25 }} animate={{ opacity: [0.25, 1, .25] }} transition={{ duration: .9, repeat: Infinity, delay: checks.indexOf(item) * .12 }} />)}</div><p className="mt-3 text-sm leading-6 text-slate-600">Customer, warehouse, logistics, and policy checks were launched together. The coordinator will reconcile all responses before proposing a plan.</p></div>}
            {stage === 'plan' && <div className="mt-4"><Badge className="border-amber-200 bg-amber-50 text-amber-900">{isUncertain ? 'Human review needed' : 'Plan ready'}</Badge><h4 className="mb-1 mt-3 text-base font-semibold text-slate-900">Proposed recovery plan</h4><p className="mt-0 text-sm leading-6 text-slate-600">Rebook {detail.uld.uldId} on {option.recoveryLegs.map((leg) => leg.operatingFlightId).join(', ')} for arrival {option.expectedArrival}. Notify the customer with the confirmed route and revised arrival.</p><p className="border-l-2 border-slate-300 pl-3 text-sm leading-5 text-slate-600">Tradeoff: {option.networkImpact}</p>{isUncertain ? <div className="mt-4 space-y-3"><p className="text-sm font-medium text-slate-800">Capacity is unconfirmed. Choose how to proceed.</p><div className="flex flex-wrap gap-2"><Button onClick={() => { setApproval('revise'); setStage('approved') }}>Request confirmation first</Button><Button variant="primary" onClick={() => { setApproval('approve'); setStage('approved') }}>Escalate for human approval</Button></div></div> : <Button variant="primary" onClick={() => { setApproval('approve'); setStage('approved') }} className="mt-3">Continue to authorized execution</Button>}</div>}
            {stage === 'approved' && <div className="mt-4"><Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">{approval === 'revise' ? 'Confirmation requested' : 'Human review recorded'}</Badge><p className="mt-3 text-sm leading-6 text-slate-600">{approval === 'revise' ? 'The capacity confirmation request is prepared. Live logistics messaging is not connected.' : 'The plan is ready for an authorized operations system. No live route allocation endpoint is connected in this app.'}</p>{approval === 'approve' && <Button variant="primary" onClick={execute} className="mt-2">Continue to execution preview</Button>}</div>}
            {stage === 'executing' && <div className="mt-5 flex items-center gap-3 text-sm text-slate-700"><Clock3 className="animate-spin text-emerald-800" size={17} /> Preparing the execution handoff</div>}
            {stage === 'awaiting-confirmation' && <div className="mt-4"><h4 className="mb-2 text-base font-semibold text-slate-900">Resolution status</h4><p className="text-sm leading-6 text-slate-600">The selected route handoff is shown as a preview because operational allocation is not connected. In production, the agent should wait for the booking system and customer confirmation before closing.</p><Button variant="primary" onClick={finish} className="mt-2"><Check size={15} /> Mark demo case resolved</Button></div>}
            {stage === 'closed' && <div role="status" className="mt-4 border-l-[3px] border-emerald-800 bg-[#f2f7f3] px-4 py-3"><p className="m-0 text-sm font-semibold text-emerald-950">Recovery outcome recorded</p><p className="m-0 mt-1 text-sm text-slate-600">This demo case has been saved to the local recovery work history.</p></div>}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          </section>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">{stage === 'closed' && <Button variant="primary" onClick={onClose}>Close recovery case</Button>}{stage !== 'closed' && <Button onClick={onClose} disabled={stage === 'investigating' || stage === 'executing'}>Close</Button>}</footer>
      </motion.section>
    </motion.div>
  </AnimatePresence></MotionConfig>, document.body)
}
