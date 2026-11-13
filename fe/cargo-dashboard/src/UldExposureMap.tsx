import { useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps/core'
import type { PendingPoolUnit } from './domain'

type UldExposureMapProps = { units: PendingPoolUnit[] }
type MapGeography = { id?: string | number; properties?: { name?: string } }

const destinationCountryByAirport: Record<string, { id: string; name: string }> = {
  LHR: { id: '826', name: 'United Kingdom' },
  FRA: { id: '276', name: 'Germany' },
  LAX: { id: '840', name: 'United States' },
}

function heatColor(value: number, max: number) {
  if (!value) return '#e7ece8'
  const ratio = Math.min(1, value / max)
  if (ratio >= 0.8) return '#a63f36'
  if (ratio >= 0.55) return '#cc6c55'
  return '#e3a48e'
}

export function UldExposureMap({ units }: UldExposureMapProps) {
  const [focusedCountry, setFocusedCountry] = useState<string | null>(null)
  const exposureByCountry = useMemo(() => {
    const totals = new Map<string, { name: string; weight: number; units: number }>()
    units.forEach((unit) => {
      const country = destinationCountryByAirport[unit.destination]
      if (!country) return
      const current = totals.get(country.id) ?? { name: country.name, weight: 0, units: 0 }
      current.weight += unit.weightKg
      current.units += 1
      totals.set(country.id, current)
    })
    return [...totals.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => b.weight - a.weight)
  }, [units])
  const maxWeight = Math.max(1, ...exposureByCountry.map((country) => country.weight))
  const totalCountries = exposureByCountry.reduce((sum, country) => sum + country.units, 0)

  return <section className="panel overview-uld-map"><div className="panel-heading"><div><h2>ULD offload exposure by destination</h2><p>Destination countries shaded by affected ULD weight</p></div><span className="demo-label">SIMULATED</span></div>
    <div className="uld-map-layout"><div className="uld-world-map"><ComposableMap projection="geoEqualEarth" width={800} height={400} projectionConfig={{ scale: 145 }} aria-label="World map of ULD offload exposure by destination country"><Geographies geography="/world-countries-110m.json">{({ geographies }) => geographies.map((geography) => {
      const feature = geography as unknown as MapGeography
      const id = String(feature.id ?? '')
      const country = exposureByCountry.find((entry) => entry.id === id)
      const fill = heatColor(country?.weight ?? 0, maxWeight)
      return <Geography key={geography.rsmKey} geography={geography} fill={fill} stroke="#ffffff" strokeWidth={0.55} tabIndex={country ? 0 : -1} onFocus={() => country && setFocusedCountry(country.name)} onBlur={() => setFocusedCountry(null)} onMouseEnter={() => country && setFocusedCountry(country.name)} onMouseLeave={() => setFocusedCountry(null)} aria-label={country ? `${country.name}: ${country.weight.toLocaleString()} kilograms across ${country.units} ULDs` : feature.properties?.name ?? 'No recorded exposure'}><title>{country ? `${country.name}: ${country.weight.toLocaleString()} kg, ${country.units} ULD${country.units === 1 ? '' : 's'}` : `${feature.properties?.name ?? 'Country'}: no recorded exposure`}</title></Geography>
    })}</Geographies></ComposableMap></div>
      <div className="uld-map-ranking"><span className="uld-map-legend"><i />Higher ULD exposure</span>{exposureByCountry.map((country, index) => <div key={country.id} className="uld-map-rank"><span><i className={`rank-tone tone-${index + 1}`} />{country.name}</span><strong>{country.weight.toLocaleString()} kg</strong></div>)}<p className="uld-map-focus">{focusedCountry ? `Selected: ${focusedCountry}` : `${totalCountries} ULDs across ${exposureByCountry.length} destination countries`}</p></div>
    </div>
  </section>
}
