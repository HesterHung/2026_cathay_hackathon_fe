import { useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { pendingPoolUnits } from './domain'
import { WorkspaceSidebar, type WorkspaceNavItem } from './WorkspaceSidebar'
import { UldExposureMap } from './UldExposureMap'
import { demoOffloadMetrics } from './domain'
import { ReplacementReadinessChart, RouteExposureChart } from './UldInsightCharts'

type NavItem = WorkspaceNavItem

export function OverviewControlTower({ onNavigate }: { onNavigate: (item: NavItem) => void }) {
  const [filter, setFilter] = useState('')
  const totalWeight = pendingPoolUnits.reduce((sum, unit) => sum + unit.weightKg, 0)
  const eligible = pendingPoolUnits.filter((unit) => unit.eligibleForNoShowReplacement).length
  const notEligible = pendingPoolUnits.length - eligible
  const routes = [...new Map(pendingPoolUnits.map((unit) => [`${unit.origin}-${unit.destination}`, { route: `${unit.origin}–${unit.destination}`, weight: unit.weightKg }])).values()]
  const columns = useMemo<ColumnDef<(typeof pendingPoolUnits)[number]>[]>(() => [
    { id: 'route', header: 'Route', accessorFn: (unit) => `${unit.origin} ${unit.destination}`, cell: ({ row }) => <strong>{row.original.origin}–{row.original.destination}</strong> },
    { accessorKey: 'weightKg', header: 'Weight', cell: ({ getValue }) => `${Number(getValue()).toLocaleString()} kg` },
    { accessorKey: 'commodity', header: 'Commodity' },
    { id: 'action', header: 'Next step', enableSorting: false, cell: ({ row }) => <button className="overview-queue-action" onClick={() => onNavigate('Pending Pool')}>{row.original.eligibleForNoShowReplacement ? 'Review fit' : 'Review limits'}</button> },
    { id: 'status', header: 'Status', enableSorting: false, cell: ({ row }) => <span className={`status-pill ${row.original.eligibleForNoShowReplacement ? 'success' : 'neutral'}`}>{row.original.eligibleForNoShowReplacement ? 'Ready to assess' : 'Needs review'}</span> },
  ], [onNavigate])
  const table = useReactTable({ data: pendingPoolUnits, columns, state: { globalFilter: filter }, onGlobalFilterChange: setFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel() })
  const actualRate = demoOffloadMetrics.actualOffloadRate
  const forecastRate = demoOffloadMetrics.predictedOffloadRate
  return <div className="app-shell"><WorkspaceSidebar active="Overview" onNavigate={onNavigate} /><main className="main-content overview-page">
    <header className="topbar"><div className="crumb">CATHAY ROUTER <span>/</span> OVERVIEW</div><div className="top-actions"><span className="data-freshness"><span className="live-dot" />Demo ULD snapshot · 16 Oct 2026</span><span className="demo-label">SIMULATED</span></div></header>
    <div className="page-heading"><div><h1>Overview</h1></div><span className="demo-label">ULD OPERATIONS</span></div>
    <section className="kpi-grid overview-kpis overview-uld-kpis" aria-label="ULD exposure summary">
      <article className="kpi-card success"><div className="kpi-top"><span>ULDs exposed</span></div><strong>{pendingPoolUnits.length}</strong><small>In the current offload pool</small></article>
      <article className="kpi-card blue"><div className="kpi-top"><span>Exposed weight</span></div><strong>{totalWeight.toLocaleString()} kg</strong><small>Across affected ULDs</small></article>
      <article className="kpi-card warning"><div className="kpi-top"><span>Actual offload rate</span></div><strong>{actualRate === null ? '—' : `${(actualRate * 100).toFixed(1)}%`}</strong><small>{demoOffloadMetrics.actualOffloadedShipments} of {demoOffloadMetrics.eligibleShipments} shipments</small></article>
      <article className="kpi-card danger"><div className="kpi-top"><span>Forecast offload rate</span></div><strong>{forecastRate === null ? '—' : `${(forecastRate * 100).toFixed(1)}%`}</strong><small>Upcoming eligible shipments</small></article>
    </section>
    <UldExposureMap units={pendingPoolUnits} />
    <section className="overview-uld-summary">
      <article className="panel overview-uld-weight"><div className="panel-heading"><div><h2>ULD exposure by route</h2></div><span className="report-state">kg</span></div><RouteExposureChart routes={routes} /></article>
      <article className="panel overview-uld-readiness"><div className="panel-heading"><div><h2>Replacement readiness</h2></div><span className="count-badge">{eligible} / {pendingPoolUnits.length}</span></div><ReplacementReadinessChart eligible={eligible} notEligible={notEligible} /><div className="overview-eligibility-labels"><span>Eligible <b>{eligible}</b></span><span>Review <b>{notEligible}</b></span></div><button className="text-button" onClick={() => onNavigate('Pending Pool')}>Review ULD pool <span aria-hidden="true">→</span></button></article>
    </section>
    <section className="panel overview-uld-table"><div className="panel-heading"><div><h2>ULD action queue</h2></div><div className="overview-table-tools"><input aria-label="Filter ULD action queue" placeholder="Filter routes or cargo" value={filter} onChange={(event) => setFilter(event.target.value)} /><span className="demo-label">DEMO DATA</span></div></div><div className="table-wrap"><table><thead>{table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th key={header.id}><button className="table-sort-button" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}</button></th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table>{table.getRowModel().rows.length === 0 && <p className="overview-empty-row">No ULDs match this filter</p>}</div></section>
    <footer>Simulated ULD exposure · financial linkage unavailable</footer>
  </main></div>
}
