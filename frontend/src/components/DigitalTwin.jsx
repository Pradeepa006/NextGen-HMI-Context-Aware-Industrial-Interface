import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Thermometer, Gauge, Activity, Droplets, Zap, Wind, Search, BarChart3 } from 'lucide-react';

const categoryIcons = {
  'Electrical': Zap,
  'Heavy Machinery': Cpu,
  'Process Equipment': Wind,
};

const machineCategories = {
  'Electrical': ['Cables', 'Drives', 'Excitor', 'Generator', 'Motor', 'Relay', 'Solar', 'Switchgear', 'Transformer'],
  'Heavy Machinery': ['Cold_Rolling_Mill', 'Compactor', 'Compressor', 'Conveyor', 'Crusher', 'Fan', 'GearBox', 'Grinder_Mill', 'Nodulizer', 'Pulley', 'Pump', 'Roller', 'Rolls_of_Rolling_Mill', 'Turbine', 'Weigh_Feeder'],
  'Process Equipment': ['Boiler', 'Burner', 'Column', 'Condensor', 'Cyclone_Separator', 'ESP', 'Fired_Heater', 'Heat_Exchanger', 'Pipeline'],
};

function getStatusColor(machine) {
  if (!machine) return { bg: 'bg-gray-700/30', ring: '', text: 'text-gray-400', dot: 'bg-gray-500' };
  switch (machine.status) {
    case 'running':
      return { bg: 'bg-emerald-500/10', ring: 'ring-1 ring-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' };
    case 'warning':
      return { bg: 'bg-amber-500/10', ring: 'ring-1 ring-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400' };
    case 'fault':
      return { bg: 'bg-red-500/10', ring: 'ring-1 ring-red-500/30', text: 'text-red-400', dot: 'bg-red-400 animate-pulse' };
    default:
      return { bg: 'bg-gray-600/10', ring: 'ring-1 ring-gray-600/30', text: 'text-gray-400', dot: 'bg-gray-500' };
  }
}

export default function DigitalTwin({ sensorData, machineStatus, machineSensorData, alerts, onOpenGraph }) {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const machines = machineStatus || [];

  // Group machine sensor data by machine name
  const sensorByMachine = {};
  (machineSensorData || []).forEach(reading => {
    if (!sensorByMachine[reading.machine]) sensorByMachine[reading.machine] = [];
    sensorByMachine[reading.machine].push(reading);
  });

  // Filter machines
  const filteredMachines = machines.filter(m => {
    const name = m.machine_id || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeCategory === 'all') return matchesSearch;
    const categoryMachines = machineCategories[activeCategory] || [];
    return matchesSearch && categoryMachines.includes(name);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-white">Digital Twin — Plant Overview</h2>
        <span className="text-xs text-gray-400">{machines.length} machines · Real-time @ 2s</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search machines..."
            className="w-full bg-hmi-surface border border-hmi-border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-hmi-info"
          />
        </div>
        <div className="flex gap-1">
          {['all', ...Object.keys(machineCategories)].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                activeCategory === cat
                  ? 'bg-hmi-info/20 text-hmi-info border border-hmi-info/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Machine Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filteredMachines.map((machine, i) => {
          const colors = getStatusColor(machine);
          const machineSensors = sensorByMachine[machine.machine_id] || [];
          const hasAlert = alerts?.some(a => a.sensor_id?.startsWith(machine.machine_id));

          return (
            <motion.div
              key={machine.machine_id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelectedMachine(selectedMachine === machine.machine_id ? null : machine.machine_id)}
              className={`glass rounded-xl p-4 cursor-pointer transition-all hover:brightness-110 ${colors.ring} ${
                hasAlert ? 'glow-critical' : ''
              } ${selectedMachine === machine.machine_id ? 'ring-2 ring-hmi-info' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-xs truncate">
                  {machine.machine_id?.replace(/_/g, ' ')}
                </span>
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} uppercase font-medium`}>
                  {machine.status}
                </span>
                <span className="text-[10px] text-gray-500">
                  {machine.load > 0 ? `${Math.round(machine.load)}%` : '—'}
                </span>
              </div>
              {machine.load > 0 && (
                <div className="mt-2 h-1 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      machine.status === 'fault' ? 'bg-red-500' : machine.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${machine.load}%` }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Selected Machine Detail */}
      <AnimatePresence>
        {selectedMachine && sensorByMachine[selectedMachine] && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl p-5 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">
                {selectedMachine.replace(/_/g, ' ')} — Live Sensor Data
              </h3>
              {onOpenGraph && (
                <button
                  onClick={() => onOpenGraph(selectedMachine)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-hmi-info/10 border border-hmi-info/30 text-hmi-info hover:bg-hmi-info/20 transition-all text-sm font-medium"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>View Details / Graph</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {sensorByMachine[selectedMachine].map((reading, i) => {
                const isAnomaly = reading.is_anomaly;
                const pct = reading.max_threshold > reading.min_threshold
                  ? ((reading.value - reading.min_threshold) / (reading.max_threshold - reading.min_threshold)) * 100
                  : 50;
                const overThreshold = pct > 100 || pct < 0;

                return (
                  <motion.div
                    key={reading.sensor_id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`glass rounded-lg p-3 text-center ${
                      isAnomaly ? 'ring-1 ring-red-500/50' : overThreshold ? 'ring-1 ring-amber-500/30' : ''
                    }`}
                  >
                    <div className="text-[10px] text-gray-400 mb-1 truncate">{reading.parameter?.replace(/_/g, ' ')}</div>
                    <div className={`text-sm font-mono font-bold ${isAnomaly ? 'text-red-400' : overThreshold ? 'text-amber-400' : 'text-white'}`}>
                      {reading.value}
                    </div>
                    <div className="text-[9px] text-gray-500">{reading.unit}</div>
                    <div className="mt-1.5 h-1 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
