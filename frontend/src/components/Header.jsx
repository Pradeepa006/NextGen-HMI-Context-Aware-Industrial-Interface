import { Activity, Wifi, WifiOff, User } from 'lucide-react'

export default function Header({ role, setRole, connected, alertSummary }) {
  return (
    <header className="bg-hmi-panel border-b border-hmi-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Activity className="w-6 h-6 text-hmi-info" />
        <h1 className="text-xl font-bold">NextGen-HMI</h1>
        <span className="text-xs text-gray-400 bg-hmi-dark px-2 py-1 rounded">AI-Powered Industrial Control</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className={`flex items-center gap-1 text-xs ${connected ? 'text-hmi-normal' : 'text-hmi-critical'}`}>
          {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {connected ? 'Live' : 'Disconnected'}
        </div>

        {/* Alert Badge */}
        {alertSummary.critical > 0 && (
          <span className="bg-hmi-critical text-white text-xs px-2 py-1 rounded-full animate-pulse-critical">
            {alertSummary.critical} Critical
          </span>
        )}

        {/* Role Selector */}
        <div className="flex items-center gap-2 bg-hmi-dark rounded-lg p-1">
          <User className="w-4 h-4 text-gray-400 ml-2" />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-transparent text-sm text-white border-none outline-none cursor-pointer pr-2"
          >
            <option value="operator" className="bg-hmi-dark">Operator</option>
            <option value="engineer" className="bg-hmi-dark">Engineer</option>
          </select>
        </div>
      </div>
    </header>
  )
}
