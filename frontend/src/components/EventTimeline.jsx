import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, BrainCircuit, Filter } from 'lucide-react';

export default function EventTimeline({ alerts, predictions }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all'); // all, alerts, predictions

  useEffect(() => {
    // Combine alerts and predictions into unified timeline
    const alertEvents = (alerts || []).map(a => ({
      ...a,
      eventType: 'alert',
      time: a.timestamp,
    }));
    const predEvents = (predictions || []).map(p => ({
      ...p,
      eventType: 'prediction',
      time: p.timestamp,
    }));

    const combined = [...alertEvents, ...predEvents]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 50);

    setEvents(combined);
  }, [alerts, predictions]);

  const filtered = filter === 'all' ? events : events.filter(e => e.eventType === filter.replace('s', ''));

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-hmi-info" />
          Event Timeline
        </h2>
        <div className="flex gap-1">
          {['all', 'alerts', 'predictions'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full transition-all ${
                filter === f
                  ? 'bg-hmi-info/20 text-hmi-info border border-hmi-info/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-hmi-border" />

        <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No events yet</div>
            ) : (
              filtered.map((event, i) => (
                <motion.div
                  key={event.id || `${event.eventType}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-start gap-3 pl-2 py-2 group"
                >
                  {/* Dot */}
                  <div className={`relative z-10 mt-1.5 w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    event.eventType === 'prediction'
                      ? 'border-hmi-purple bg-hmi-purple/30'
                      : event.category === 'critical'
                      ? 'border-hmi-critical bg-hmi-critical/30'
                      : event.category === 'warning'
                      ? 'border-hmi-warning bg-hmi-warning/30'
                      : 'border-hmi-normal bg-hmi-normal/30'
                  }`} />

                  {/* Content */}
                  <div className="flex-1 glass rounded-lg p-3 glass-hover cursor-default">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {event.eventType === 'prediction' ? (
                          <BrainCircuit className="w-3.5 h-3.5 text-hmi-purple" />
                        ) : (
                          <AlertTriangle className={`w-3.5 h-3.5 ${
                            event.category === 'critical' ? 'text-hmi-critical' : 'text-hmi-warning'
                          }`} />
                        )}
                        <span className="text-xs font-medium text-white">
                          {event.sensor_id?.replace(/_/g, ' ') || event.machine_id || 'System'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">{formatTime(event.time)}</span>
                    </div>
                    <p className="text-xs text-gray-300">{event.message}</p>
                    {event.eventType === 'prediction' && event.confidence && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 flex-1 rounded-full bg-gray-700 overflow-hidden">
                          <div
                            className="h-full bg-hmi-purple rounded-full"
                            style={{ width: `${Math.round(event.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-hmi-purple">{Math.round(event.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
