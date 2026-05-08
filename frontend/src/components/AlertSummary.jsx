import { AlertTriangle, AlertCircle, Info, Bell } from 'lucide-react'

export default function AlertSummary({ summary, filterCategory, onFilter }) {
  const cards = [
    { label: 'Total Alerts', value: summary.total, icon: Bell, color: 'text-gray-200', accent: 'from-gray-600/20 to-gray-700/10', ring: 'ring-gray-400/30', category: 'all' },
    { label: 'Critical', value: summary.critical, icon: AlertTriangle, color: 'text-red-400', accent: 'from-red-500/10 to-red-900/5', ring: 'ring-red-500/30', category: 'critical' },
    { label: 'Warnings', value: summary.warning, icon: AlertCircle, color: 'text-amber-400', accent: 'from-amber-500/10 to-amber-900/5', ring: 'ring-amber-500/30', category: 'warning' },
    { label: 'Normal', value: summary.normal, icon: Info, color: 'text-emerald-400', accent: 'from-emerald-500/10 to-emerald-900/5', ring: 'ring-emerald-500/30', category: 'normal' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        const isActive = card.category === 'all'
          ? filterCategory === null
          : filterCategory === card.category
        return (
          <div
            key={card.label}
            onClick={() => {
              if (card.category === 'all') {
                onFilter(null)
              } else {
                onFilter(isActive ? null : card.category)
              }
            }}
            className={`bg-gradient-to-br ${card.accent} rounded-xl border p-4 flex items-center gap-3 cursor-pointer transition-all duration-150
              ${isActive ? `border-white/20 ring-2 ${card.ring} scale-[1.02]` : 'border-white/5 hover:border-white/10'}`}
          >
            <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{card.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
