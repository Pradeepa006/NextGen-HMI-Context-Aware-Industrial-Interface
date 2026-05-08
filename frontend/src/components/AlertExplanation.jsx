import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Lightbulb, History, Target } from 'lucide-react';

export default function AlertExplanation({ alert, onClose }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!alert?.id) return;
    setLoading(true);
    fetch(`http://localhost:8000/api/alerts/${alert.id}/explanation`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setExplanation(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [alert?.id]);

  if (!alert) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="glass rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${alert.category === 'critical' ? 'text-hmi-critical' : 'text-hmi-warning'}`} />
              <h3 className="text-white font-semibold">Alert Explanation</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Analyzing alert...</div>
          ) : explanation ? (
            <div className="space-y-5">
              {/* Summary */}
              <div className="glass rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">Sensor</span>
                    <p className="text-white">{explanation.sensor_id?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Current Value</span>
                    <p className="text-white font-mono">
                      {explanation.current_value?.toFixed(2)} {explanation.unit}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Category</span>
                    <p className={`font-medium ${
                      explanation.category === 'critical' ? 'text-hmi-critical' : 'text-hmi-warning'
                    }`}>
                      {explanation.category?.toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Severity Score</span>
                    <p className="text-white font-mono">{explanation.severity_score?.toFixed(1)}/10</p>
                  </div>
                </div>
              </div>

              {/* Root Cause */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-hmi-info" />
                  Root Cause
                </h4>
                <p className="text-sm text-gray-300 glass rounded-lg p-3">{explanation.root_cause}</p>
              </div>

              {/* Thresholds */}
              {explanation.thresholds && Object.keys(explanation.thresholds).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Operational Thresholds</h4>
                  <div className="glass rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(explanation.thresholds).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-400">{key}</span>
                        <span className="text-white font-mono">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent History */}
              {explanation.recent_history?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                    <History className="w-4 h-4 text-hmi-cyan" />
                    Recent Values
                  </h4>
                  <div className="flex gap-1 flex-wrap">
                    {explanation.recent_history.map((v, i) => (
                      <span key={i} className="text-[10px] bg-gray-700/50 text-gray-300 px-1.5 py-0.5 rounded font-mono">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Actions */}
              {explanation.suggested_actions?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-hmi-warning" />
                    Suggested Actions
                  </h4>
                  <ul className="space-y-1.5">
                    {explanation.suggested_actions.map((action, i) => (
                      <li key={i} className="text-xs text-gray-300 glass rounded-lg px-3 py-2">
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              Unable to load explanation
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
