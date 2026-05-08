import { Server, CheckCircle, AlertTriangle, XCircle, PauseCircle, BarChart3 } from 'lucide-react'

const statusConfig = {
  running: { icon: CheckCircle, color: 'text-hmi-normal', bg: 'bg-green-900/20', label: 'Running' },
  idle: { icon: PauseCircle, color: 'text-gray-400', bg: 'bg-gray-800/50', label: 'Idle' },
  warning: { icon: AlertTriangle, color: 'text-hmi-warning', bg: 'bg-yellow-900/20', label: 'Warning' },
  fault: { icon: XCircle, color: 'text-hmi-critical', bg: 'bg-red-900/20', label: 'Fault' },
}

// Map alert categories to machine statuses
const categoryToStatus = {
  critical: ['fault'],
  warning: ['warning'],
  normal: ['running', 'idle'],
}

export default function MachineStatus({ machines, filterCategory, onMachineSelect }) {
  // Filter machines based on selected category
  const filteredMachines = filterCategory
    ? machines.filter((m) => (categoryToStatus[filterCategory] || []).includes(m.status))
    : machines

  return (
    <div className="bg-hmi-panel rounded-xl border border-hmi-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-5 h-5 text-hmi-info" />
        <h2 className="text-lg font-semibold">Machine Status</h2>
        <span className="text-xs bg-hmi-dark px-2 py-0.5 rounded text-gray-400">
          {filteredMachines.length} / {machines.length} machines
        </span>
        {filterCategory && (
          <span className="text-xs bg-hmi-dark px-2 py-0.5 rounded text-gray-400">
            Filtered: {filterCategory}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {filteredMachines.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            {filterCategory ? `No machines with ${filterCategory} status` : 'Waiting for data...'}
          </p>
        ) : (
          filteredMachines.map((machine) => {
            const config = statusConfig[machine.status] || statusConfig.idle
            const Icon = config.icon
            return (
              <div
                key={machine.machine_id}
                className={`flex items-center justify-between p-3 rounded-lg ${config.bg} border border-hmi-border`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${config.color}`} />
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {machine.machine_id.replace('_', ' ')}
                    </p>
                    <p className={`text-xs ${config.color}`}>{config.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Uptime</p>
                    <p className="text-sm font-mono">{machine.uptime_hours}h</p>
                  </div>
                  {onMachineSelect && (
                    <button
                      onClick={() => onMachineSelect(machine.machine_id)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-hmi-info/10 border border-hmi-info/30 text-hmi-info hover:bg-hmi-info/20 transition-all text-xs font-medium"
                      title="View Graph"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Graph</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
