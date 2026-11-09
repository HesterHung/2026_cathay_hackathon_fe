export interface PreventionPlan {
  flightId: string
  targetUldNo: string
  atRiskAwbs: string[]
  status: string
  riskLevel: string
  riskTypes: string[]
  offloadProbability: number
  predictedOffloadRate: number
  affectedShipmentCount: number
  capacityShortfallKg: number
  reasons: string[]
  valueAtRisk: number
  currency: string
}

export interface PreventionPlansPage {
  items: PreventionPlan[]
  totalCases: number
  totalShipmentsAtRisk: number
  pagination: { page: number; totalPages: number; hasNextPage: boolean }
}

export interface ApiSnapshot {
  data: PreventionPlansPage
  fetchedAt: string
}

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
export const preventionPlansUrl = `${apiBaseUrl}/api/v1/prevention-plans`

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid API response: ${label} must be an object.`)
  return value as Record<string, unknown>
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid API response: ${label} must be a non-empty string.`)
  return value
}

function finite(value: unknown, label: string, min = 0, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid API response: ${label} is outside its allowed range.`)
  return value
}

function wholeNumber(value: unknown, label: string, min = 0): number {
  const parsed = finite(value, label, min)
  if (!Number.isInteger(parsed)) throw new Error(`Invalid API response: ${label} must be a whole number.`)
  return parsed
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Invalid API response: ${label} must be a list.`)
  return value.map((item, index) => string(item, `${label}[${index}]`))
}

export function adaptPreventionPlans(payload: unknown): PreventionPlansPage {
  const root = record(payload, 'response')
  if (!Array.isArray(root.items)) throw new Error('Invalid API response: items must be a list.')
  const items = root.items.map((raw, index) => {
    const item = record(raw, `items[${index}]`)
    const risk = record(item.forecastRisk, `items[${index}].forecastRisk`)
    return {
      flightId: string(item.flightId, `items[${index}].flightId`),
      targetUldNo: string(item.targetUldNo, `items[${index}].targetUldNo`),
      atRiskAwbs: stringArray(item.atRiskAwbs, `items[${index}].atRiskAwbs`),
      status: string(item.status, `items[${index}].status`),
      riskLevel: string(item.riskLevel, `items[${index}].riskLevel`),
      riskTypes: stringArray(item.riskTypes, `items[${index}].riskTypes`),
      offloadProbability: finite(item.offloadProbability, `items[${index}].offloadProbability`, 0, 1),
      predictedOffloadRate: finite(item.predictedOffloadRate, `items[${index}].predictedOffloadRate`, 0, 1),
      affectedShipmentCount: wholeNumber(item.affectedShipmentCount, `items[${index}].affectedShipmentCount`),
      capacityShortfallKg: finite(risk.capacityShortfallKg, `items[${index}].forecastRisk.capacityShortfallKg`),
      reasons: stringArray(risk.reasons, `items[${index}].forecastRisk.reasons`),
      valueAtRisk: finite(item.valueAtRisk, `items[${index}].valueAtRisk`),
      currency: (() => {
        const currency = string(item.currency, `items[${index}].currency`)
        if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Invalid API response: items[${index}].currency must be a three-letter uppercase code.`)
        return currency
      })(),
    }
  })
  const pagination = record(root.pagination, 'pagination')
  if (typeof pagination.hasNextPage !== 'boolean') throw new Error('Invalid API response: pagination.hasNextPage must be boolean.')
  return {
    items,
    totalCases: wholeNumber(root.totalCases, 'totalCases'),
    totalShipmentsAtRisk: wholeNumber(root.totalShipmentsAtRisk, 'totalShipmentsAtRisk'),
    pagination: {
      page: wholeNumber(pagination.page, 'pagination.page', 1),
      totalPages: wholeNumber(pagination.totalPages, 'pagination.totalPages', 1),
      hasNextPage: pagination.hasNextPage,
    },
  }
}

export async function fetchPreventionPlans(signal?: AbortSignal): Promise<ApiSnapshot> {
  const response = await fetch(preventionPlansUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`API request failed (${response.status} ${response.statusText || 'HTTP error'}).`)
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('API returned invalid JSON.')
  }
  return { data: adaptPreventionPlans(payload), fetchedAt: new Date().toISOString() }
}
