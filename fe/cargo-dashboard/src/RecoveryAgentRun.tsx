import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronUp, Database, LoaderCircle, PackageCheck, Route, Send, X } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { createPortal } from 'react-dom'
import type { RecoveryDetail, RecoveryOption } from './recoveryApi'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Card } from './components/ui/card'
import { saveRecoveryDecision } from './recoveryApi'

type Phase = 'idle' | 'running' | 'complete'
interface RecoveryAgentRunProps { detail: RecoveryDetail; options: RecoveryOption[]; currency: string; onRecorded?: (optionId: string) => void }
interface FeedItem { stage: string; title: string; body: string; tone?: 'warning' | 'success' }

export function RecoveryAgentRun({ detail, options, currency, onRecorded }: RecoveryAgentRunProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [visibleItems, setVisibleItems] = useState(0)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordError, setRecordError] = useState('')
  const [recorded, setRecorded] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)

  const ranked = useMemo(() => [...options]
    .filter((option) => option.feasibilityStatus.toLowerCase() !== 'infeasible')
    .sort((a, b) => a.totalModeledExpectedLoss - b.totalModeledExpectedLoss || a.expectedDelayMinutes - b.expectedDelayMinutes), [options])
  const best = ranked[0]
  const hasUnknown = Boolean(best && (best.feasibilityStatus.toLowerCase().includes('unknown') || best.missingData.length > 0))

  const feed = useMemo<FeedItem[]>(() => {
    const first = options[0]
    const candidates = options.map((option) => option.recoveryLegs.map((leg) => `${leg.from}–${leg.to} ${leg.operatingFlightId}`).join(' / ')).join('; ')
    const routeList = candidates || 'No candidate route records returned for this case'
    const entries: FeedItem[] = [
      { stage: 'Case scope', title: `Recovery case ${detail.workItemId} loaded`, body: `Affected flight ${detail.flight.flightId} · ${detail.flight.origin} to ${detail.flight.destination} · ${detail.uld.uldId}`, tone: 'success' },
      { stage: 'Shipment requirements', title: 'Cargo requirements gathered', body: `${detail.uld.weightKg.toLocaleString()} kg · ${detail.uld.volumeM3.toLocaleString()} m³ · delivery commitment ${detail.caseSummary?.deliveryCommitment ?? 'not provided'}` },
      { stage: 'Shipment requirements', title: 'Handling and commodity fields checked', body: detail.cargo.handlingRequirements.length ? `Handling: ${detail.cargo.handlingRequirements.join(', ')}${detail.cargo.commodity ? ` · Commodity: ${detail.cargo.commodity}` : ''}` : 'No special handling requirements are recorded in the case data', tone: detail.cargo.handlingRequirements.length ? 'success' : undefined },
      { stage: 'Route search', title: `${options.length} candidate route${options.length === 1 ? '' : 's'} available`, body: routeList, tone: options.length ? 'success' : 'warning' },
      { stage: 'Capacity check', title: 'Usable route capacity reviewed', body: first ? `${first.usableCapacityKg.toLocaleString()} kg on ${first.recoveryLegs.map((leg) => leg.operatingFlightId).join(', ')} · status: ${first.capacityStatus}` : 'No usable capacity figure was returned', tone: first && first.capacityStatus.toLowerCase().includes('confirm') ? 'warning' : undefined },
      { stage: 'Schedule check', title: 'Arrival and delay compared with commitment', body: first ? `Candidate arrival ${first.expectedArrival} · estimated delay ${first.expectedDelayMinutes.toLocaleString()} minutes` : 'Arrival estimate unavailable' },
      { stage: 'Constraint check', title: 'Handling and route feasibility reviewed', body: first ? `${first.feasibilityStatus} · ${first.feasibilityPercentage}% feasibility estimate` : 'No route available to validate', tone: first?.feasibilityStatus.toLowerCase().includes('unknown') ? 'warning' : undefined },
      { stage: 'Data quality', title: first?.missingData.length ? `${first.missingData.length} confirmation item${first.missingData.length === 1 ? '' : 's'} identified` : 'No missing data reported by route options', body: first?.missingData.length ? first.missingData.join(' · ') : 'Ranking will use the available case and route fields', tone: first?.missingData.length ? 'warning' : 'success' },
      { stage: 'Option comparison', title: 'Eligible route options ranked', body: ranked.map((option, index) => `${index + 1}. ${option.recoveryLegs.map((leg) => leg.operatingFlightId).join('/')} · modeled loss ${currency} ${option.totalModeledExpectedLoss.toLocaleString()} · delay ${Math.round(option.expectedDelayMinutes / 60)}h`).join(' | ') || 'No feasible route remains after filtering', tone: ranked.length ? 'success' : 'warning' },
      { stage: 'Recommendation', title: best ? 'Best available route selected' : 'No feasible route found', body: best ? `${best.recoveryLegs.map((leg) => `${leg.from}–${leg.to} ${leg.operatingFlightId}`).join(' / ')} · ${best.expectedArrival}` : 'Review route blockers and request updated options', tone: best ? 'success' : 'warning' },
    ]
    return entries
  }, [currency, detail, options, ranked, best])

  // Agent integration placeholder: replace the timed event stream with agent/API events.
  useEffect(() => {
    if (phase !== 'running') return
    userScrolledRef.current = false
    setVisibleItems(0)
    let current = 0
    const timer = window.setInterval(() => {
      current += 1
      setVisibleItems(current)
      if (current >= feed.length) {
        window.clearInterval(timer)
        setPhase('complete')
      }
    }, 520)
    return () => window.clearInterval(timer)
  }, [phase, feed.length])

  useEffect(() => {
    const node = feedRef.current
    if (!node || userScrolledRef.current) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [visibleItems])

  useEffect(() => {
    if (phase === 'idle') return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPhase('idle') }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase])

  useEffect(() => {
    if (!recorded) return
    const timeout = window.setTimeout(() => setRecorded(false), 3200)
    return () => window.clearTimeout(timeout)
  }, [recorded])

  const run = () => { setShowAlternatives(false); setShowDetails(false); setQuestion(''); setAnswer(''); setRecordError(''); setRecorded(false); setPhase('running') }

  const submitQuestion = () => {
    const submitted = question.trim()
    if (!submitted || !best) return
    setAnswer(`This route ranks first because it has the lowest modeled loss among the available options not marked infeasible. It arrives ${best.expectedArrival}, has ${best.usableCapacityKg.toLocaleString()} kg usable capacity, and carries a ${currency} ${best.totalModeledExpectedLoss.toLocaleString()} modeled loss. ${best.missingData.length ? `Still unconfirmed: ${best.missingData.join(', ')}.` : `Current feasibility estimate: ${best.feasibilityPercentage}%.`}`)
    setQuestion('')
  }

  const recordRecommendation = async () => {
    if (!best || recording || recorded) return
    setRecording(true)
    setRecordError('')
    try {
      const decision = {
        type: detail.type,
        uldId: detail.uld.uldId,
        masterAirwayBillNumber: detail.masterAirwayBill.number,
        documentVersion: detail.document.version,
        optionId: best.optionId,
        decision: 'APPROVE_FOR_REVIEW' as const,
        reason: `Recorded recommended route ${best.recoveryLegs.map((leg) => leg.operatingFlightId).join(' / ')} (${best.expectedArrival}); modeled loss ${currency} ${best.totalModeledExpectedLoss.toLocaleString()}.`,
        reviewerId: 'demo-operator',
        reviewedAt: new Date().toISOString(),
      }
      if (detail.workItemId.startsWith('demo-')) {
        const key = 'cathay-recovery-recommendations'
        const prior = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]
        localStorage.setItem(key, JSON.stringify([...prior, { ...decision, workItemId: detail.workItemId }]))
      } else {
        await saveRecoveryDecision(detail.workItemId, decision)
      }
      onRecorded?.(best.optionId)
      setRecorded(true)
      setPhase('idle')
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Could not record this recommendation.')
    } finally {
      setRecording(false)
    }
  }

  return <MotionConfig reducedMotion="user">
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-900 text-white"><Route size={17} /></span><p className="m-0 text-sm font-semibold text-slate-900">Recovery route assistant</p></div>
        <Button variant="primary" onClick={run}><Route size={15} /> {phase === 'complete' ? 'Run route analysis again' : 'Find best recovery route'} <ArrowRight size={15} /></Button>
      </div>
    </Card>
    {createPortal(<AnimatePresence>{recorded && <motion.div role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="fixed bottom-6 right-6 z-[120] flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg"><Check size={16} aria-hidden="true" /> Recommendation recorded</motion.div>}</AnimatePresence>, document.body)}

    {createPortal(<AnimatePresence>
      {phase !== 'idle' && <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget && phase === 'complete') setPhase('idle') }}>
        <motion.section role="dialog" aria-modal="true" aria-labelledby="recovery-run-title" initial={{ opacity: 0, y: 22, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.99 }} transition={{ duration: 0.24, ease: 'easeOut' }} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div><h2 id="recovery-run-title" className="m-0 text-lg font-semibold text-slate-950">Finding the best recovery route</h2><p className="m-0 mt-1 text-sm text-slate-500">{detail.flight.flightId} · {detail.flight.origin} → {detail.flight.destination} · {detail.uld.weightKg.toLocaleString()} kg cargo</p></div>
            <div className="flex items-center gap-3">{phase === 'running' ? <span className="flex items-center gap-2 text-sm font-medium text-emerald-900"><LoaderCircle className="animate-spin" size={16} /> Processing {Math.min(visibleItems, feed.length)} / {feed.length}</span> : <span className="flex items-center gap-2 text-sm font-medium text-emerald-900"><Check size={16} /> Analysis complete</span>}<button type="button" aria-label="Close analysis" onClick={() => setPhase('idle')} className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"><X size={18} /></button></div>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
            <div className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between px-5 py-3 sm:px-6"><p className="m-0 text-sm font-semibold text-slate-800">Analysis activity</p><span className="flex items-center gap-1.5 text-xs text-slate-500"><Database size={13} /> {visibleItems} / {feed.length}</span></div>
              <div ref={feedRef} onScroll={(event) => { const el = event.currentTarget; userScrolledRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80 }} className="min-h-[260px] flex-1 overflow-y-auto bg-white px-5 sm:px-6" aria-live="polite" aria-relevant="additions">
                <AnimatePresence initial={false}>{feed.slice(0, visibleItems).map((item, index) => <motion.article key={`${item.title}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: 'easeOut' }} className="border-b border-slate-200 py-4 last:border-b-0">
                  <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center ${item.tone === 'warning' ? 'text-amber-700' : item.tone === 'success' ? 'text-emerald-800' : 'text-slate-500'}`}>{item.tone === 'warning' ? <AlertTriangle size={15} /> : item.tone === 'success' ? <Check size={15} /> : index < 3 ? <PackageCheck size={15} /> : <Route size={15} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><p className="m-0 text-xs font-medium text-slate-500">{item.stage}</p><time className="text-[11px] tabular-nums text-slate-400">+{((index + 1) * 0.5).toFixed(1)}s</time></div><p className="m-0 mt-1 text-sm font-medium text-slate-900">{item.title}</p><p className="m-0 mt-1 text-sm leading-5 text-slate-600">{item.body}</p></div></div>
                </motion.article>)}</AnimatePresence>
                {phase === 'running' && <div className="flex items-center gap-2 px-1 py-2 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin" /> Checking next data point</div>}
              </div>
            </div>

            <aside className="min-h-0 overflow-y-auto p-5 sm:p-6">
              <p className="m-0 text-sm font-semibold text-slate-800">Recovery decision</p>
              <AnimatePresence mode="wait">
                {phase === 'running' && <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 rounded-md border border-dashed border-slate-300 p-4"><div className="flex items-center gap-2 text-sm font-medium text-slate-700"><LoaderCircle className="animate-spin text-emerald-800" size={16} /> Comparing route options</div><div className="mt-4 space-y-3">{['Capacity and schedule', 'Handling constraints', 'Modeled impact'].map((label) => <div key={label} className="flex items-center gap-2 text-xs text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />{label}</div>)}</div></motion.div>}
                {phase === 'complete' && <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: 'easeOut' }} className="mt-5">
                  {!best ? <div className="rounded-md border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-amber-950"><AlertTriangle size={16} /> No feasible route found</div><p className="mb-0 mt-2 text-sm leading-6 text-amber-900">No candidate route passed feasibility checks. Review blockers and request updated route options.</p></div> : <>
                    <div className="mb-3 flex items-center justify-between gap-2"><h3 className="m-0 text-sm font-semibold text-slate-900">Best available route</h3><span className="text-xs tabular-nums text-slate-500">1 of {ranked.length}</span></div>
                    <div className="rounded-md border border-emerald-200 bg-[#f2f7f3] p-4"><div className="flex items-center gap-2 text-lg font-semibold text-slate-950"><span>{best.recoveryLegs.map((leg) => leg.from).join(' / ')}</span><span className="flex items-center text-emerald-800"><span className="h-px w-5 bg-emerald-700" /><Route size={14} /><span className="h-px w-5 bg-emerald-700" /></span><span>{best.recoveryLegs.at(-1)?.to}</span></div><p className="m-0 mt-2 text-sm text-slate-600">{best.recoveryLegs.map((leg) => leg.operatingFlightId).join(' · ')} · Arrival {best.expectedArrival}</p><Badge className="mt-3 border-emerald-200 bg-white text-emerald-800">{best.feasibilityStatus}</Badge>
                      <div className="mt-4 grid grid-cols-2 gap-4"><Metric label="Usable capacity" value={`${best.usableCapacityKg.toLocaleString()} kg`} /><Metric label="Expected delay" value={`${Math.round(best.expectedDelayMinutes / 60)}h`} /><Metric label="Modeled loss" value={`${currency} ${best.totalModeledExpectedLoss.toLocaleString()}`} /><Metric label="Feasibility" value={`${best.feasibilityPercentage}%`} /></div>
                    </div>
                    <div className="mt-3 rounded-md border border-slate-200 p-3"><p className="m-0 text-sm font-semibold text-slate-800">Why it ranks first</p><p className="mb-0 mt-1.5 text-sm leading-5 text-slate-600">Lowest modeled loss among options not marked infeasible; delay breaks ties. Demo heuristic, not connected to the production agent.</p></div>
                    {hasUnknown && <div role="status" className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950"><AlertTriangle className="mt-0.5 shrink-0" size={16} /><span><strong>Provisional recommendation.</strong> {best.missingData.length ? `Unconfirmed: ${best.missingData.join(', ')}.` : 'Route feasibility is not confirmed.'}</span></div>}
                    {ranked.length > 1 && <div className="mt-4"><button type="button" className="text-sm font-medium text-emerald-900 underline decoration-emerald-300 underline-offset-4" onClick={() => setShowAlternatives((value) => !value)}>{showAlternatives ? 'Hide alternatives' : `Compare ${ranked.length - 1} alternative${ranked.length > 2 ? 's' : ''}`}</button><AnimatePresence initial={false}>{showAlternatives && <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mt-3 space-y-2">{ranked.slice(1).map((option) => <div key={option.optionId} className="rounded-md border border-slate-200 p-3"><p className="m-0 text-sm font-medium text-slate-800">{option.recoveryLegs.map((leg) => `${leg.from} → ${leg.to} · ${leg.operatingFlightId}`).join(' / ')}</p><p className="m-0 mt-1 text-xs text-slate-500">ETA {option.expectedArrival} · {Math.round(option.expectedDelayMinutes / 60)}h delay · {currency} {option.totalModeledExpectedLoss.toLocaleString()}</p></div>)}</motion.div>}</AnimatePresence></div>}
                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <button type="button" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails} className="flex w-full items-center justify-between py-1 text-left text-sm font-medium text-slate-800">Review route details {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                      <AnimatePresence initial={false}>{showDetails && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">{[
                        ['Cargo/customer impact', best.costBreakdown.cargoCustomerImpact],
                        ['Carrier contribution impact', best.costBreakdown.cathayContributionImpact],
                        ['Recovery and handling', best.costBreakdown.recoveryAndHandlingCost],
                        ['Delay and service impact', best.costBreakdown.delayAndServiceImpact],
                        ['Downstream network impact', best.costBreakdown.downstreamNetworkImpact],
                      ].map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="m-0 font-medium tabular-nums text-slate-800">{currency} {Number(amount).toLocaleString()}</dd></div>)}<div className="flex justify-between gap-3 border-t border-slate-100 pt-2"><dt className="text-slate-500">Network note</dt><dd className="m-0 max-w-[60%] text-right text-slate-700">{best.networkImpact}</dd></div></dl></motion.div>}</AnimatePresence>
                    </div>
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <label htmlFor="route-follow-up" className="text-sm font-medium text-slate-800">Ask a follow-up question</label>
                      <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); submitQuestion() }}><input id="route-follow-up" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the route or tradeoff" className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800" /><Button type="submit" aria-label="Send question" disabled={!question.trim()} className="shrink-0 px-3"><Send size={15} /></Button></form>
                      {answer && <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mb-0 mt-3 border-l-2 border-emerald-700 pl-3 text-sm leading-5 text-slate-700">{answer}</motion.p>}
                    </div>
                  </>}
                </motion.div>}
              </AnimatePresence>
            </aside>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:px-8">{recordError && <p role="alert" className="m-0 text-sm text-red-700">{recordError}</p>}<div className="ml-auto mr-2 mb-2 flex flex-wrap justify-end gap-3">{phase === 'complete' && <Button onClick={run}>Run again</Button>}<Button onClick={() => setPhase('idle')} disabled={recording} className="border-slate-300">Close</Button>{phase === 'complete' && best && <Button variant="primary" onClick={() => void recordRecommendation()} disabled={recording || recorded} className="min-h-10 px-4">{recording ? <><LoaderCircle size={15} className="animate-spin" /> Recording</> : recorded ? <><Check size={15} /> Recorded</> : 'Record recommendation & close'}</Button>}</div></footer>
        </motion.section>
      </motion.div>}
    </AnimatePresence>, document.body)}
  </MotionConfig>
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="m-0 text-xs font-medium text-slate-500">{label}</p><p className="m-0 mt-1 text-sm font-semibold tabular-nums text-slate-900">{value}</p></div> }
