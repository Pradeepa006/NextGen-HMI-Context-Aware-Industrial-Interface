import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function SensorChart({ title, sensors, data, getHistory, colors, filterCategory, alerts = [] }) {
  // When a category filter is active, check if any of this chart's sensors have alerts in that category
  const hasRelevantAlert = filterCategory
    ? alerts.some((a) => sensors.includes(a.sensor_id) && a.category === filterCategory)
    : true

  // If filtering and this chart has no relevant alerts, dim it
  const dimmed = filterCategory && !hasRelevantAlert

  // Build chart data from history
  const primarySensor = sensors[0]
  const history = getHistory(primarySensor)

  // Merge histories for multi-sensor charts
  const chartData = history.map((point, idx) => {
    const entry = { timestamp: point.timestamp }
    sensors.forEach((sensorId) => {
      const sHistory = getHistory(sensorId)
      entry[sensorId] = sHistory[idx]?.value ?? null
    })
    return entry
  })

  const currentValues = sensors.map((s) => data[s])

  return (
    <div className={`bg-hmi-panel rounded-xl border border-hmi-border p-4 transition-opacity ${dimmed ? 'opacity-30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-200">
          {title}
          {filterCategory && hasRelevantAlert && (
            <span className="ml-2 text-[10px] bg-hmi-critical/20 text-hmi-critical px-1.5 py-0.5 rounded">
              {filterCategory.toUpperCase()}
            </span>
          )}
        </h3>
        <div className="flex gap-3">
          {currentValues.map((v, i) => (
            v && (
              <span key={i} className="text-xs">
                <span className="text-gray-400">{sensors[i].split('_').pop()}: </span>
                <span className="font-mono font-bold" style={{ color: colors[i] }}>
                  {v.value} {v.unit}
                </span>
              </span>
            )
          ))}
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 10, fill: '#718096' }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10, fill: '#718096' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a2332', border: '1px solid #2d3748', borderRadius: '8px' }}
              labelStyle={{ color: '#a0aec0' }}
            />
            {sensors.map((sensorId, i) => (
              <Line
                key={sensorId}
                type="monotone"
                dataKey={sensorId}
                stroke={colors[i]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
