export type WorkspaceNavItem = 'Overview' | 'Disruption Alerts' | 'Predicted Offload' | 'Pending Pool' | 'Recovery Solution' | 'Shipments' | 'Analytics' | 'Business Insights' | 'Settings' | 'Unknown'

const navigation: { item: Exclude<WorkspaceNavItem, 'Unknown'>; label: string; icon?: string }[] = [
  { item: 'Overview', label: 'Overview', icon: 'grid' },
  { item: 'Disruption Alerts', label: 'Disruption Alerts', icon: 'alert' },
  { item: 'Predicted Offload', label: 'Predicted Offload', icon: 'chart' },
  { item: 'Pending Pool', label: 'Pending Pool', icon: 'box' },
  { item: 'Shipments', label: 'Cargo Value & Profiles', icon: 'box' },
  { item: 'Business Insights', label: 'Business Insights', icon: 'chart' },
  { item: 'Settings', label: 'Settings', icon: 'settings' },
]

const iconPaths: Record<string, string> = {
  plane: 'm3 11 18-5-6 18-3-8-9-5Zm9 5 4-4',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  chart: 'M4 19V5m0 14h16M8 16v-5m4 5V7m4 9v-8',
  alert: 'M10.3 3.2 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01',
  box: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
  route: 'M5 19c7 0 7-14 14-14M5 5h.01M19 19h.01',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.5 7.5 0 0 0-.1-1.2l-2-1.5 2-3.4-2.4-1-2.1 1.2L14.5 3h-4l-.4 2.7A8 8 0 0 0 8 6.9l-2.4-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.1 1.2l.4 2.7h4l.4-2.7a8 8 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name] ?? iconPaths.grid} /></svg>
}

export function WorkspaceSidebar({ active, onNavigate }: { active: WorkspaceNavItem; onNavigate: (item: WorkspaceNavItem) => void }) {
  return <aside className="sidebar workspace-sidebar"><div className="brand"><span className="brand-mark"><Icon name="plane" size={18} /></span><span>CATHAY <b>ROUTER</b></span></div><div className="nav-label">Workspace</div><nav>{navigation.map(({ item, label, icon }) => <button key={item} className={active === item ? 'active' : ''} onClick={() => onNavigate(item)}>{icon ? <Icon name={icon} /> : null}<span>{label}</span></button>)}</nav><div className="sidebar-footer"><div className="nav-label">Operations control</div><div className="demo-status"><span />Development environment</div><div className="profile"><div className="avatar">AL</div><div><strong>Alex Lee</strong><small>Network operator</small></div></div></div></aside>
}
