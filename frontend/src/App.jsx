import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import AlertPanel from './components/AlertPanel'
import SensorChart from './components/SensorChart'
import MachineStatus from './components/MachineStatus'
import AlertSummary from './components/AlertSummary'
import LoadingState from './components/LoadingState'
import DigitalTwin from './components/DigitalTwin'
import EventTimeline from './components/EventTimeline'
import PredictiveAlerts from './components/PredictiveAlerts'
import AlertExplanation from './components/AlertExplanation'
import AlertGroups from './components/AlertGroups'
import VoiceAlerts from './components/VoiceAlerts'
import MachineGraphs from './components/MachineGraphs'
import CollapsibleSection from './components/CollapsibleSection'

const API_BASE = 'http://localhost:8000'
const WS_URL = 'ws://localhost:8000/ws/live-data'

function App() {
  const [role, setRole] = useState('engineer')
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sensorData, setSensorData] = useState({})
  const [machineStatus, setMachineStatus] = useState([])
  const [alerts, setAlerts] = useState([])
  const [predictions, setPredictions] = useState([])
  const [alertGroups, setAlertGroups] = useState([])
  const [machineSensorData, setMachineSensorData] = useState([])
  const [alertSummary, setAlertSummary] = useState({ total: 0, critical: 0, warning: 0, normal: 0 })
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uiConfig, setUiConfig] = useState(null)
  const [filterCategory, setFilterCategory] = useState(null)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const ws = useRef(null)
  const sensorHistory = useRef({})
  const reconnectTimeout = useRef(null)

  // Compute alert summary from actual alerts array so counts always match
  const computedAlertSummary = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.category === 'critical').length,
    warning: alerts.filter(a => a.category === 'warning').length,
    normal: alerts.filter(a => a.category === 'normal').length,
  }), [alerts])

  // ─── Fetch initial data from REST API ────────────────────────────────────
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [sensorsRes, alertsRes, configRes, machinesRes] = await Promise.all([
        fetch(`${API_BASE}/api/sensors/latest`),
        fetch(`${API_BASE}/api/alerts?limit=30`),
        fetch(`${API_BASE}/api/ui-config/${role}`),
        fetch(`${API_BASE}/api/machines`),
      ])

      if (sensorsRes.ok) {
        const sensorsData = await sensorsRes.json()
        if (sensorsData.readings) {
          const readings = {}
          sensorsData.readings.forEach((r) => {
            readings[r.sensor_id] = r
          })
          setSensorData(readings)
        }
      }

      if (machinesRes.ok) {
        const machinesData = await machinesRes.json()
        setMachineStatus(machinesData.machines || [])
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json()
        setAlerts(alertsData.alerts || [])
        if (alertsData.summary) setAlertSummary(alertsData.summary)
      }

      if (configRes.ok) {
        const configData = await configRes.json()
        if (!configData.error) setUiConfig(configData)
      }

      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch initial data:', err)
      setError('Cannot connect to backend. Make sure the server is running on port 8000.')
      setLoading(false)
    }
  }, [role])

  // ─── WebSocket connection ────────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return

    ws.current = new WebSocket(WS_URL)

    ws.current.onopen = () => {
      setConnected(true)
      setError(null)
    }

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'data_update') {
          const readings = {}
          if (data.sensor_readings) {
            data.sensor_readings.forEach((r) => {
              readings[r.sensor_id] = r
              if (!sensorHistory.current[r.sensor_id]) {
                sensorHistory.current[r.sensor_id] = []
              }
              sensorHistory.current[r.sensor_id].push({
                value: r.value,
                timestamp: new Date(r.timestamp).toLocaleTimeString(),
              })
              if (sensorHistory.current[r.sensor_id].length > 30) {
                sensorHistory.current[r.sensor_id].shift()
              }
            })
            setSensorData({ ...readings })
          }

          if (data.machine_status) setMachineStatus(data.machine_status)
          if (data.machine_sensor_data) setMachineSensorData(data.machine_sensor_data)
          if (data.alerts && data.alerts.length > 0) {
            setAlerts((prev) => [...data.alerts, ...prev].slice(0, 50))
          }
          if (data.alert_summary) setAlertSummary(data.alert_summary)
          if (data.predictions) setPredictions(data.predictions)
          if (data.alert_groups) setAlertGroups(data.alert_groups)
        }
      } catch (err) {
        console.error('WebSocket parse error:', err)
      }
    }

    ws.current.onclose = () => {
      setConnected(false)
      reconnectTimeout.current = setTimeout(connectWebSocket, 3000)
    }

    ws.current.onerror = () => {
      ws.current.close()
    }
  }, [])

  useEffect(() => { fetchInitialData() }, [fetchInitialData])

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (ws.current) ws.current.close()
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
    }
  }, [connectWebSocket])

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ui-config/${role}`)
        if (res.ok) {
          const data = await res.json()
          if (!data.error) setUiConfig(data)
        }
      } catch (err) {}
    }
    fetchConfig()
  }, [role])

  // ─── Actions ─────────────────────────────────────────────────────────────
  const acknowledgeAlert = async (alertId) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: 'acknowledge', alert_id: alertId }))
    }
    try {
      await fetch(`${API_BASE}/api/alerts/${alertId}/acknowledge`, { method: 'POST' })
    } catch (err) {}
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)))
  }

  const getHistory = (sensorId) => sensorHistory.current[sensorId] || []

  // ─── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingState message="Connecting to NextGen-HMI backend..." />
  }

  if (error && !connected) {
    return (
      <div className="min-h-screen bg-hmi-dark text-white flex items-center justify-center">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <div className="text-hmi-critical text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchInitialData}
            className="bg-hmi-info hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-hmi-dark text-white overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        alertSummary={computedAlertSummary}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 flex-shrink-0 bg-[#0c1220]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-gray-200 tracking-wide">
              {activeView.charAt(0).toUpperCase() + activeView.slice(1).replace('-', ' ')}
            </h1>
            <div className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ${connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {connected ? 'Live' : 'Offline'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <VoiceAlerts alerts={alerts} enabled={voiceEnabled} setEnabled={setVoiceEnabled} />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-white/5 border border-white/10 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value="operator" className="bg-hmi-dark text-white">Operator</option>
              <option value="engineer" className="bg-hmi-dark text-white">Engineer</option>
              <option value="admin" className="bg-hmi-dark text-white">Admin</option>
            </select>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === 'dashboard' && (
                <DashboardView
                  role={role}
                  sensorData={sensorData}
                  machineStatus={machineStatus}
                  machineSensorData={machineSensorData}
                  alerts={alerts}
                  predictions={predictions}
                  alertGroups={alertGroups}
                  alertSummary={computedAlertSummary}
                  filterCategory={filterCategory}
                  setFilterCategory={setFilterCategory}
                  acknowledgeAlert={acknowledgeAlert}
                  getHistory={getHistory}
                  uiConfig={uiConfig}
                  onAlertClick={setSelectedAlert}
                  selectedMachine={selectedMachine}
                  setSelectedMachine={setSelectedMachine}
                />
              )}
              {activeView === 'alerts' && (
                <AlertsView
                  alerts={alerts}
                  alertGroups={alertGroups}
                  alertSummary={computedAlertSummary}
                  filterCategory={filterCategory}
                  setFilterCategory={setFilterCategory}
                  role={role}
                  acknowledgeAlert={acknowledgeAlert}
                  onAlertClick={setSelectedAlert}
                  machineSensorData={machineSensorData}
                  selectedMachine={selectedMachine}
                  setSelectedMachine={setSelectedMachine}
                />
              )}
              {activeView === 'predictions' && (
                <PredictiveAlerts predictions={predictions} />
              )}
              {activeView === 'digital-twin' && (
                <DigitalTwin
                  sensorData={Object.values(sensorData)}
                  machineStatus={machineStatus}
                  machineSensorData={machineSensorData}
                  alerts={alerts}
                  onOpenGraph={setSelectedMachine}
                />
              )}
              {activeView === 'timeline' && (
                <EventTimeline alerts={alerts} predictions={predictions} />
              )}
              {activeView === 'analytics' && (
                <AnalyticsView
                  sensorData={sensorData}
                  getHistory={getHistory}
                  role={role}
                  uiConfig={uiConfig}
                  filterCategory={filterCategory}
                  alerts={alerts}
                />
              )}
              {activeView === 'settings' && (
                <SettingsView role={role} setRole={setRole} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Alert Explanation Modal */}
      {selectedAlert && (
        <AlertExplanation alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}

      {/* Machine Graphs Popup - accessible from any view */}
      {selectedMachine && (
        <MachineGraphs
          machineId={selectedMachine}
          onClose={() => setSelectedMachine(null)}
        />
      )}
    </div>
  )
}

// ─── Dashboard View ──────────────────────────────────────────────────────────
function DashboardView({ role, sensorData, machineStatus, machineSensorData, alerts, predictions, alertGroups, alertSummary, filterCategory, setFilterCategory, acknowledgeAlert, getHistory, uiConfig, onAlertClick, selectedMachine, setSelectedMachine }) {
  return (
    <div className="space-y-5">
      <CollapsibleSection title="Alert Summary" icon="🔔" defaultOpen={true}>
        <AlertSummary summary={alertSummary} filterCategory={filterCategory} onFilter={setFilterCategory} />
      </CollapsibleSection>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CollapsibleSection title="Active Alerts" icon="⚠️" defaultOpen={true} badge={`${alerts.length}`}>
            <AlertPanel
              alerts={alerts}
              filterCategory={filterCategory}
              role={role}
              onAcknowledge={acknowledgeAlert}
              onAlertClick={onAlertClick}
              onMachineSelect={setSelectedMachine}
            />
          </CollapsibleSection>
        </div>
        <div className="space-y-4">
          <CollapsibleSection title="Machine Status" icon="⚙️" defaultOpen={true} badge={`${machineStatus.length}`}>
            <MachineStatus machines={machineStatus} filterCategory={filterCategory} onMachineSelect={setSelectedMachine} />
          </CollapsibleSection>
          <CollapsibleSection title="Alert Groups" icon="📊" defaultOpen={true}>
            <AlertGroups groups={alertGroups} />
          </CollapsibleSection>
        </div>
      </div>

      {/* Charts */}
      <CollapsibleSection title="Sensor Charts" icon="📈" defaultOpen={true}>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <SensorChart title="Temperature" sensors={['temperature_1', 'temperature_2']} data={sensorData} getHistory={getHistory} colors={['#ef4444', '#f97316']} filterCategory={filterCategory} alerts={alerts} />
          <SensorChart title="Pressure" sensors={['pressure_1', 'pressure_2']} data={sensorData} getHistory={getHistory} colors={['#3b82f6', '#06b6d4']} filterCategory={filterCategory} alerts={alerts} />
          {role === 'engineer' && (
            <>
              <SensorChart title="Vibration" sensors={['vibration_1']} data={sensorData} getHistory={getHistory} colors={['#8b5cf6']} filterCategory={filterCategory} alerts={alerts} />
              <SensorChart title="Flow Rate" sensors={['flow_rate_1']} data={sensorData} getHistory={getHistory} colors={['#10b981']} filterCategory={filterCategory} alerts={alerts} />
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* Predictions preview */}
      {predictions.length > 0 && (
        <CollapsibleSection title="Active Predictions" icon="⚡" defaultOpen={true} badge={`${predictions.length}`}>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {predictions.slice(0, 3).map((p, i) => (
              <div key={i} className="glass rounded-lg p-3 border-l-2 border-hmi-purple">
                <p className="text-xs text-white font-medium">{p.sensor_id?.replace(/_/g, ' ')}</p>
                <p className="text-[10px] text-gray-400 mt-1">{p.message}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

// ─── Alerts View ─────────────────────────────────────────────────────────────
function AlertsView({ alerts, alertGroups, alertSummary, filterCategory, setFilterCategory, role, acknowledgeAlert, onAlertClick, machineSensorData, selectedMachine, setSelectedMachine }) {
  return (
    <div className="space-y-5">
      <CollapsibleSection title="Alert Summary" icon="🔔" defaultOpen={true}>
        <AlertSummary summary={alertSummary} filterCategory={filterCategory} onFilter={setFilterCategory} />
      </CollapsibleSection>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CollapsibleSection title="Active Alerts" icon="⚠️" defaultOpen={true} badge={`${alerts.length}`}>
            <AlertPanel
              alerts={alerts}
              filterCategory={filterCategory}
              role={role}
              onAcknowledge={acknowledgeAlert}
              onAlertClick={onAlertClick}
              onMachineSelect={setSelectedMachine}
            />
          </CollapsibleSection>
        </div>
        <CollapsibleSection title="Alert Groups" icon="📊" defaultOpen={true}>
          <AlertGroups groups={alertGroups} />
        </CollapsibleSection>
      </div>
    </div>
  )
}

// ─── Analytics View ──────────────────────────────────────────────────────────
function AnalyticsView({ sensorData, getHistory, role, uiConfig, filterCategory, alerts }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-white">Sensor Analytics</h2>
      <CollapsibleSection title="Sensor Charts" icon="📈" defaultOpen={true}>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <SensorChart title="Temperature" sensors={['temperature_1', 'temperature_2']} data={sensorData} getHistory={getHistory} colors={['#ef4444', '#f97316']} filterCategory={filterCategory} alerts={alerts} />
          <SensorChart title="Pressure" sensors={['pressure_1', 'pressure_2']} data={sensorData} getHistory={getHistory} colors={['#3b82f6', '#06b6d4']} filterCategory={filterCategory} alerts={alerts} />
          <SensorChart title="Vibration" sensors={['vibration_1']} data={sensorData} getHistory={getHistory} colors={['#8b5cf6']} filterCategory={filterCategory} alerts={alerts} />
          <SensorChart title="Flow Rate" sensors={['flow_rate_1']} data={sensorData} getHistory={getHistory} colors={['#10b981']} filterCategory={filterCategory} alerts={alerts} />
        </div>
      </CollapsibleSection>
    </div>
  )
}

// ─── Settings View ───────────────────────────────────────────────────────────
function SettingsView({ role, setRole }) {
  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold text-white">Settings</h2>
      <div className="glass rounded-xl p-5 space-y-4">
        <div>
          <label className="text-sm text-gray-300 block mb-2">User Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-hmi-surface border border-hmi-border text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-hmi-info"
          >
            <option value="operator">Operator — Simplified View</option>
            <option value="engineer">Engineer — Full Access</option>
            <option value="admin">Admin — Configuration</option>
          </select>
        </div>
        <div className="text-xs text-gray-500">
          <p>• <strong>Operator:</strong> Key metrics, critical alerts only</p>
          <p>• <strong>Engineer:</strong> All sensors, full alert history, analytics</p>
          <p>• <strong>Admin:</strong> System configuration, layout management</p>
        </div>
      </div>
    </div>
  )
}

export default App
