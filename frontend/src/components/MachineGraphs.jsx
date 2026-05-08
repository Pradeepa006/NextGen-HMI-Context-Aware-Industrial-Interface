import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, Thermometer, Gauge, Zap, Waves, Droplets } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const API_BASE = 'http://localhost:8000';

const PARAMETERS = [
  { id: 'temperature', label: 'Temperature', unit: '°C', color: '#ef4444', icon: Thermometer },
  { id: 'pressure', label: 'Pressure', unit: 'bar', color: '#3b82f6', icon: Gauge },
  { id: 'resistance', label: 'Resistance', unit: 'Ω', color: '#f59e0b', icon: Zap },
  { id: 'current', label: 'Current', unit: 'A', color: '#8b5cf6', icon: Zap },
  { id: 'vibration', label: 'Vibration', unit: 'mm/s', color: '#10b981', icon: Waves },
  { id: 'flow_rate', label: 'Flow Rate', unit: 'L/min', color: '#06b6d4', icon: Droplets },
];

export default function MachineGraphs({ machineId, onClose }) {
  const [selectedParams, setSelectedParams] = useState(['temperature']);
  const [chartData, setChartData] = useState([]);
  const [latestValues, setLatestValues] = useState({});
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  // Extract machine name (handle cases like "Relay" or "Relay_temperature")
  const machineName = machineId?.includes('_')
    ? (() => {
        const parts = machineId.split('_');
        if (parts[0][0] === parts[0][0].toUpperCase() && parts[0][0] !== parts[0][0].toLowerCase()) {
          const lastPart = parts[parts.length - 1];
          const paramNames = PARAMETERS.map(p => p.id);
          if (paramNames.includes(lastPart)) {
            return parts.slice(0, -1).join('_');
          }
          return machineId;
        }
        return machineId;
      })()
    : machineId;

  const toggleParam = (paramId) => {
    setSelectedParams(prev => {
      if (prev.includes(paramId)) {
        // Don't allow deselecting all
        if (prev.length === 1) return prev;
        return prev.filter(p => p !== paramId);
      }
      return [...prev, paramId];
    });
  };

  const fetchHistory = useCallback(async () => {
    try {
      // Fetch history for all selected parameters in parallel
      const responses = await Promise.all(
        selectedParams.map(param =>
          fetch(`${API_BASE}/api/machines/${machineName}/history?parameter=${param}&limit=60`)
            .then(r => r.ok ? r.json() : { history: [] })
        )
      );

      // Merge data by timestamp into a unified chart dataset
      const timeMap = {};
      selectedParams.forEach((param, idx) => {
        const history = responses[idx]?.history || [];
        history.forEach(d => {
          const time = new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          if (!timeMap[time]) timeMap[time] = { time };
          timeMap[time][param] = d.value;
        });
      });

      const merged = Object.values(timeMap).sort((a, b) => {
        // Sort by time string
        return a.time.localeCompare(b.time);
      });

      setChartData(merged);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
    setLoading(false);
  }, [machineName, selectedParams]);

  // Fetch all latest values for the summary cards
  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/machines/${machineName}/sensors`);
      if (res.ok) {
        const data = await res.json();
        const values = {};
        (data.sensors || []).forEach(s => {
          values[s.parameter] = s.value;
        });
        setLatestValues(values);
      }
    } catch (err) {}
  }, [machineName]);

  // Initial fetch + polling every 2 seconds
  useEffect(() => {
    setLoading(true);
    setChartData([]);
    fetchHistory();
    fetchLatest();

    intervalRef.current = setInterval(() => {
      fetchHistory();
      fetchLatest();
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchHistory, fetchLatest]);

  if (!machineId) return null;

  const activeParams = PARAMETERS.filter(p => selectedParams.includes(p.id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="glass rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-hmi-info" />
            <div>
              <h2 className="text-white font-bold text-lg">{machineName.replace(/_/g, ' ')}</h2>
              <p className="text-gray-400 text-xs">Live sensor data · Updates every 2s from DB · Click parameters to multi-select</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Parameter Cards - multi-select */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
          {PARAMETERS.map(param => {
            const Icon = param.icon;
            const isActive = selectedParams.includes(param.id);
            const value = latestValues[param.id];
            return (
              <button
                key={param.id}
                onClick={() => toggleParam(param.id)}
                className={`p-3 rounded-xl text-center transition-all relative ${
                  isActive
                    ? 'ring-2 ring-offset-1 ring-offset-transparent'
                    : 'hover:bg-white/5 opacity-60'
                } glass`}
                style={isActive ? { borderColor: param.color, boxShadow: `0 0 12px ${param.color}40`, ringColor: param.color } : {}}
              >
                {isActive && (
                  <div className="absolute top-1 right-1 w-3 h-3 rounded-full flex items-center justify-center" style={{ backgroundColor: param.color }}>
                    <span className="text-[7px] text-white font-bold">✓</span>
                  </div>
                )}
                <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: param.color }} />
                <div className="text-white font-mono text-sm font-bold">
                  {value != null ? (typeof value === 'number' ? value.toFixed(1) : value) : '—'}
                </div>
                <div className="text-[9px] text-gray-400 mt-0.5">{param.label}</div>
                <div className="text-[8px] text-gray-500">{param.unit}</div>
              </button>
            );
          })}
        </div>

        {/* Selected params legend */}
        <div className="flex flex-wrap gap-2 mb-3">
          {activeParams.map(p => (
            <span key={p.id} className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full glass" style={{ border: `1px solid ${p.color}40` }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.label} ({p.unit})
            </span>
          ))}
        </div>

        {/* Main Graph - multiple lines */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">
              {activeParams.map(p => p.label).join(', ')} — {machineName.replace(/_/g, ' ')}
            </h3>
            <span className="text-[10px] text-gray-500">{chartData.length} data points</span>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              Loading data from database...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              Collecting data... (will appear in ~2s)
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    width={55}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  {activeParams.map(param => (
                    <Line
                      key={param.id}
                      type="monotone"
                      dataKey={param.id}
                      name={`${param.label} (${param.unit})`}
                      stroke={param.color}
                      strokeWidth={2}
                      dot={false}
                      animationDuration={300}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500">
          <span>Data stored in MongoDB · machine_readings collection</span>
          <span>Auto-refresh: 2 seconds · {selectedParams.length} parameter{selectedParams.length > 1 ? 's' : ''} selected</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
