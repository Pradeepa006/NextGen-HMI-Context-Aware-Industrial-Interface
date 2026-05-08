import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default function VoiceAlerts({ alerts, enabled, setEnabled }) {
  const lastSpokenRef = useRef(new Set());
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    if (!enabled) {
      synthRef.current.cancel();
      return;
    }
    if (!alerts || alerts.length === 0) return;

    const criticals = alerts.filter(
      a => a.category === 'critical' && !lastSpokenRef.current.has(a.id)
    );

    criticals.forEach(alert => {
      lastSpokenRef.current.add(alert.id);
      const msg = new SpeechSynthesisUtterance(
        `Critical alert: ${alert.sensor_id?.replace(/_/g, ' ')}. ${alert.message}`
      );
      msg.rate = 1.1;
      msg.pitch = 1.0;
      msg.volume = 0.8;
      synthRef.current.speak(msg);
    });

    // Keep set small
    if (lastSpokenRef.current.size > 100) {
      const arr = [...lastSpokenRef.current];
      lastSpokenRef.current = new Set(arr.slice(-50));
    }
  }, [alerts, enabled]);

  return (
    <button
      onClick={() => setEnabled(!enabled)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        enabled
          ? 'bg-hmi-info/20 text-hmi-info border border-hmi-info/30'
          : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
      title={enabled ? 'Voice alerts ON' : 'Voice alerts OFF'}
    >
      {enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
      Voice
    </button>
  );
}
