import { AlertTriangle, AlertCircle, Info, Check, Cpu } from 'lucide-react'

const categoryConfig = {
  critical: { icon: AlertTriangle, color: 'text-hmi-critical', bg: 'bg-red-900/30 border-hmi-critical', label: 'CRITICAL' },
  warning: { icon: AlertCircle, color: 'text-hmi-warning', bg: 'bg-yellow-900/20 border-hmi-warning', label: 'WARNING' },
  normal: { icon: Info, color: 'text-hmi-info', bg: 'bg-blue-900/20 border-hmi-info', label: 'INFO' },
}

function getMachineName(alert) {
  const sensorId = alert.sensor_id || ''
  // Extract machine name from sensor_id (e.g. "Relay_temperature" → "Relay", "Turbine" → "Turbine")
  // For legacy sensors like "temperature_1", show as-is
  const parts = sensorId.split('_')
  // Check if first part is a known machine (starts with uppercase)
  if (parts[0] && parts[0][0] === parts[0][0].toUpperCase() && parts[0][0] !== parts[0][0].toLowerCase()) {
    return parts[0].replace(/_/g, ' ')
  }
  return sensorId.replace(/_/g, ' ')
}

export default function AlertPanel({ alerts, role, onAcknowledge, filterCategory, onAlertClick, onMachineSelect }) {
  // Apply category filter from summary card click FIRST
  let filteredAlerts = [...alerts]
  if (filterCategory) {
    filteredAlerts = filteredAlerts.filter((a) => a.category === filterCategory)
  }

  // Then apply role filter
  if (role === 'operator') {
    filteredAlerts = filteredAlerts.filter((a) => a.category !== 'normal')
  }

  return (
    <div className="bg-hmi-panel rounded-xl border border-hmi-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-hmi-warning" />
          Active Alerts
          {filterCategory && (
            <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${
              filterCategory === 'critical' ? 'bg-red-900/30 text-red-400' :
              filterCategory === 'warning' ? 'bg-yellow-900/30 text-yellow-400' :
              'bg-green-900/30 text-green-400'
            }`}>
              {filterCategory.toUpperCase()}
            </span>
          )}
        </h2>
        <span className="text-xs text-gray-400">{filteredAlerts.length} alerts</span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {filteredAlerts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Check className="w-8 h-8 mx-auto mb-2 text-hmi-normal" />
            <p>All systems normal</p>
          </div>
        ) : (
          filteredAlerts.map((alert, idx) => {
            const config = categoryConfig[alert.category] || categoryConfig.normal
            const Icon = config.icon
            const machineName = getMachineName(alert)
            return (
              <div
                key={alert.id || idx}
                className={`alert-enter flex items-start gap-3 p-3 rounded-lg border-l-4 ${config.bg} ${alert.acknowledged ? 'opacity-50' : ''}`}
              >
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onMachineSelect && onMachineSelect(alert.sensor_id) }}
                      className="flex items-center gap-1 text-xs font-semibold text-hmi-cyan hover:text-white bg-hmi-cyan/10 hover:bg-hmi-cyan/20 px-2 py-0.5 rounded transition-all"
                      title="View machine graphs"
                    >
                      <Cpu className="w-3 h-3" />
                      {machineName}
                    </button>
                    <span className="text-xs text-gray-400">Score: {alert.severity_score}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 mt-1 truncate">{alert.message}</p>
                  {role === 'engineer' && alert.detections && (
                    <div className="flex gap-1 mt-1">
                      {alert.detections.map((d, i) => (
                        <span key={i} className="text-[10px] bg-hmi-dark px-1.5 py-0.5 rounded text-gray-400">
                          {d.type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {!alert.acknowledged && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAcknowledge(alert.id) }}
                      className="text-xs bg-hmi-dark hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                    >
                      ACK
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
