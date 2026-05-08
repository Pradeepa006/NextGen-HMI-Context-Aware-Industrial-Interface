import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

export default function PredictiveAlerts({ predictions }) {
  const activePredictions = predictions || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-hmi-purple" />
          Predictive Alerts
        </h2>
        <span className="text-xs text-gray-400">{activePredictions.length} active</span>
      </div>

      {activePredictions.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <BrainCircuit className="w-10 h-10 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">No predictive alerts active</p>
          <p className="text-gray-500 text-xs mt-1">AI is monitoring sensor trends</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence mode="popLayout">
            {activePredictions.map((pred, i) => (
              <motion.div
                key={pred.id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-4 border-l-2 border-hmi-purple"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-hmi-purple" />
                    <span className="text-white font-medium text-sm">
                      {pred.sensor_id?.replace(/_/g, ' ') || 'Sensor'}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    pred.category === 'critical'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {pred.category || 'warning'}
                  </span>
                </div>

                <p className="text-xs text-gray-300 mb-3">{pred.message}</p>

                <div className="grid grid-cols-3 gap-3">
                  {/* Confidence */}
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 mb-1">Confidence</div>
                    <div className="relative w-10 h-10 mx-auto">
                      <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#374151" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="14" fill="none"
                          stroke="#8b5cf6"
                          strokeWidth="3"
                          strokeDasharray={`${(pred.confidence || 0) * 88} 88`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-hmi-purple font-bold">
                        {Math.round((pred.confidence || 0) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Time to breach */}
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 mb-1">Time Est.</div>
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-white font-mono">
                        {pred.steps_to_breach ? `~${pred.steps_to_breach * 2}s` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Trend */}
                  <div className="text-center">
                    <div className="text-[10px] text-gray-500 mb-1">Slope</div>
                    <span className={`text-xs font-mono ${pred.slope > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {pred.slope != null ? (pred.slope > 0 ? '+' : '') + pred.slope.toFixed(3) : 'N/A'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
