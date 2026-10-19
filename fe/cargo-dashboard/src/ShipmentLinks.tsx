export function ShipmentLinks({ ids, onSelect }: { ids: string[]; onSelect: (id: string) => void }) {
  if (!ids.length) return null
  return <span className="shipment-links">{ids.map((id, index) => <span key={id}>{index > 0 ? ', ' : ''}<button type="button" className="shipment-link" onClick={() => onSelect(id)}>{id}</button></span>)}</span>
}
