import React from 'react';
import { motion } from 'framer-motion';
import { Layers, AlertTriangle } from 'lucide-react';

export default function AlertGroups({ groups }) {
  const activeGroups = groups || [];

  if (activeGroups.length === 0) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <Layers className="w-8 h-8 mx-auto text-gray-600 mb-2" />
        <p className="text-gray-400 text-sm">No alert groups</p>
        <p className="text-gray-500 text-xs">Similar alerts will be grouped here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
        <Layers className="w-4 h-4 text-hmi-cyan" />
        Smart Alert Groups
        <span className="text-xs text-gray-500">({activeGroups.length})</span>
      </h3>
      <div className="space-y-2">
        {activeGroups.map((group, i) => (
          <motion.div
            key={group.key || i}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-lg p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-8 rounded-full ${
                group.category === 'critical' ? 'bg-hmi-critical' : 'bg-hmi-warning'
              }`} />
              <div>
                <p className="text-white text-sm font-medium">
                  {group.sensor_type?.replace(/_/g, ' ')} — {group.category}
                </p>
                <p className="text-gray-400 text-xs">
                  {group.count} related alerts
                  {group.latest_time && ` · Last: ${new Date(group.latest_time).toLocaleTimeString()}`}
                </p>
              </div>
            </div>
            <span className={`text-lg font-bold ${
              group.category === 'critical' ? 'text-hmi-critical' : 'text-hmi-warning'
            }`}>
              {group.count}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
