import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Cpu,
  Clock,
  BrainCircuit,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'predictions', label: 'Predictions', icon: BrainCircuit },
  { id: 'digital-twin', label: 'Plant Overview', icon: Cpu },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'analytics', label: 'Analytics', icon: Activity },
];

export default function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, alertSummary }) {
  const criticalCount = alertSummary?.critical || 0;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-screen sticky top-0 flex flex-col bg-gradient-to-b from-[#0c1220] to-[#0a0e18] border-r border-white/5 z-40 relative"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-white font-semibold text-sm tracking-wide whitespace-nowrap"
          >
            NextGen HMI
          </motion.span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const showBadge = item.id === 'alerts' && criticalCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative group ${
                isActive
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-400 rounded-r-full" />
              )}
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
              {!collapsed && (
                <span className="text-[13px] font-medium">{item.label}</span>
              )}
              {showBadge && (
                <span className={`absolute ${collapsed ? 'top-0 right-0' : 'top-1.5 right-2'} bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}>
                  {criticalCount}
                </span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-white/10">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={() => setActiveView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
            activeView === 'settings'
              ? 'bg-white/10 text-white'
              : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]'
          }`}
        >
          <Settings className={`w-[18px] h-[18px] flex-shrink-0 ${activeView === 'settings' ? 'text-blue-400' : ''}`} />
          {!collapsed && <span className="text-[13px] font-medium">Settings</span>}
        </button>
      </div>

      {/* Collapse toggle - positioned at right edge */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 bg-[#1a2332] border border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#243040] transition-colors shadow-md z-50"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </motion.aside>
  );
}
