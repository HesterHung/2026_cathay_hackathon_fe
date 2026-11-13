import ReactECharts from 'echarts-for-react'

const grid = { left: 40, right: 18, top: 22, bottom: 28, containLabel: true }
const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64716a', fontSize: 12 }, splitLine: { lineStyle: { color: '#edf0ed' } } }

export function RouteExposureChart({ routes }: { routes: { route: string; weight: number }[] }) {
  return <ReactECharts style={{ height: Math.max(150, routes.length * 48) }} notMerge lazyUpdate option={{
    color: ['#147d69'], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value: number) => `${value.toLocaleString()} kg` },
    grid: { ...grid, left: 78, right: 52, top: 8, bottom: 16 },
    xAxis: { type: 'value', ...axis, axisLabel: { ...axis.axisLabel, formatter: (value: number) => `${value} kg` } },
    yAxis: { type: 'category', inverse: true, data: routes.map((route) => route.route), axisLabel: { color: '#37453d', fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar', barWidth: 18, label: { show: true, position: 'right', color: '#37453d', formatter: ({ value }: { value: number }) => `${value.toLocaleString()} kg` }, data: routes.map((route) => route.weight) }],
  }} />
}

export function ReplacementReadinessChart({ eligible, notEligible }: { eligible: number; notEligible: number }) {
  return <ReactECharts style={{ height: 115 }} notMerge lazyUpdate option={{
    color: ['#147d69', '#d7ddd9'], tooltip: { trigger: 'item', formatter: '{b}: {c} ULDs' },
    series: [{ type: 'pie', radius: ['64%', '90%'], center: ['50%', '50%'], startAngle: 90, label: { show: false }, labelLine: { show: false }, data: [{ value: eligible, name: 'Eligible' }, { value: notEligible, name: 'Review required' }] }],
    graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: `${eligible}/${eligible + notEligible}`, fill: '#20332c', fontSize: 20, fontWeight: 600, textAlign: 'center' } }],
  }} />
}

export function OffloadRateTrendChart() {
  return <ReactECharts style={{ height: 286 }} notMerge lazyUpdate option={{
    color: ['#137a68', '#c48026'], tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value}%` }, grid,
    xAxis: { type: 'category', data: ['Oct 1', 'Oct 8', 'Oct 15', 'Oct 22', 'Oct 29', 'Nov 5'], ...axis },
    yAxis: { type: 'value', min: 0, max: 12, ...axis, axisLabel: { ...axis.axisLabel, formatter: '{value}%' } },
    series: [
      { name: 'Actual', type: 'line', smooth: false, symbolSize: 7, lineStyle: { width: 3 }, data: [4.2, 5.1, 6.1, 4.8, 3.9, 4.4], areaStyle: { opacity: 0.08 } },
      { name: 'Forecast', type: 'line', smooth: false, symbol: 'emptyCircle', symbolSize: 7, lineStyle: { width: 2, type: 'dashed' }, data: [4.7, 5.4, 5.8, 5.2, 4.6, 4.9] },
    ],
  }} />
}

export function StationUtilizationChart() {
  return <ReactECharts style={{ height: 250 }} notMerge lazyUpdate option={{
    color: ['#147d69', '#d7e5df'], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value: number) => `${value}%` },
    legend: { bottom: 0, textStyle: { color: '#59675f', fontSize: 12 } }, grid: { ...grid, top: 18, bottom: 42 },
    xAxis: { type: 'value', max: 100, ...axis, axisLabel: { ...axis.axisLabel, formatter: '{value}%' } },
    yAxis: { type: 'category', data: ['HKG', 'SIN', 'FRA', 'LHR', 'LAX'], axisLabel: { color: '#37453d', fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ name: 'Loaded', type: 'bar', stack: 'total', barWidth: 18, data: [82, 69, 74, 77, 71] }, { name: 'Empty', type: 'bar', stack: 'total', barWidth: 18, data: [18, 31, 26, 23, 29] }],
  }} />
}

export function TurnaroundChart() {
  return <ReactECharts style={{ height: 250 }} notMerge lazyUpdate option={{
    color: ['#c48026'], tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value} h` }, grid: { ...grid, left: 48, top: 16 },
    xAxis: { type: 'value', name: 'Hours', nameTextStyle: { color: '#64716a' }, ...axis },
    yAxis: { type: 'category', data: ['HKG', 'SIN', 'FRA', 'LHR', 'LAX'], axisLabel: { color: '#37453d', fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar', barWidth: 16, label: { show: true, position: 'right', color: '#37453d', formatter: '{c} h' }, data: [2.1, 3.0, 4.8, 3.5, 4.1] }],
  }} />
}

export function ServiceabilityChart() {
  return <ReactECharts style={{ height: 250 }} notMerge lazyUpdate option={{
    color: ['#147d69', '#d39a3a', '#b85b53'], tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
    legend: { orient: 'vertical', right: 14, top: 'middle', itemGap: 18, textStyle: { color: '#37453d', fontSize: 13 } },
    series: [{ type: 'pie', radius: ['48%', '74%'], center: ['34%', '50%'], avoidLabelOverlap: true, label: { show: true, position: 'center', formatter: '91%\nServiceable', color: '#20332c', fontSize: 16, lineHeight: 22 }, labelLine: { show: false }, data: [{ value: 91, name: 'Serviceable' }, { value: 6, name: 'Repair' }, { value: 3, name: 'Quarantine' }] }],
  }} />
}

export function OffloadDriversChart() {
  const names = ['Capacity mismatch', 'Late ULD arrival', 'Handling limits', 'Weather delay']
  return <ReactECharts style={{ height: 250 }} notMerge lazyUpdate option={{
    color: ['#147d69'], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { ...grid, left: 110, right: 38, top: 12 },
    xAxis: { type: 'value', ...axis, axisLabel: { ...axis.axisLabel, formatter: '{value}%' } },
    yAxis: { type: 'category', inverse: true, data: names, axisLabel: { color: '#37453d', fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar', barWidth: 16, label: { show: true, position: 'right', formatter: '{c}%', color: '#37453d' }, data: [38, 27, 21, 14] }],
  }} />
}
