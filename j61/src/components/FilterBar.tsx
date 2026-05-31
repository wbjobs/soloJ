import { Filter, RotateCcw, ChevronDown, Search, Bell, BellOff } from 'lucide-react';
import { useLogStore, SERVICES, LOG_LEVELS } from '../store/useLogStore';
import type { LogLevel } from '../../shared/types';
import { useState } from 'react';

const levelColors: Record<LogLevel, string> = {
  DEBUG: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  INFO: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  WARN: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const serviceColors: Record<string, string> = {
  'user-service': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'order-service': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'payment-service': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

export function FilterBar() {
  const selectedService = useLogStore((state) => state.selectedService);
  const selectedLevels = useLogStore((state) => state.selectedLevels);
  const setSelectedService = useLogStore((state) => state.setSelectedService);
  const toggleLevel = useLogStore((state) => state.toggleLevel);
  const resetFilters = useLogStore((state) => state.resetFilters);
  const autoScroll = useLogStore((state) => state.autoScroll);
  const setAutoScroll = useLogStore((state) => state.setAutoScroll);
  const searchKeyword = useLogStore((state) => state.searchKeyword);
  const setSearchKeyword = useLogStore((state) => state.setSearchKeyword);
  const alertEnabled = useLogStore((state) => state.alertEnabled);
  const setAlertEnabled = useLogStore((state) => state.setAlertEnabled);

  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);

  return (
    <div className="bg-slate-800/60 backdrop-blur border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Filters</span>
          </div>

          <div className="relative w-64">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Search logs..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setServiceDropdownOpen(!serviceDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors min-w-[180px] justify-between"
            >
              <span className="text-sm text-slate-300">
                {selectedService || 'All Services'}
              </span>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {serviceDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg shadow-xl z-10 overflow-hidden">
                <button
                  onClick={() => {
                    setSelectedService(null);
                    setServiceDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                    !selectedService ? 'bg-slate-700/50 text-blue-400' : 'text-slate-300'
                  }`}
                >
                  All Services
                </button>
                {SERVICES.map((service) => (
                  <button
                    key={service}
                    onClick={() => {
                      setSelectedService(service);
                      setServiceDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                      selectedService === service
                        ? 'bg-slate-700/50 text-blue-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {LOG_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                  selectedLevels.includes(level)
                    ? levelColors[level]
                    : 'bg-slate-900/30 text-slate-500 border-slate-700 opacity-50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setAlertEnabled(!alertEnabled)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              alertEnabled
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-slate-900/30 text-slate-500 border border-slate-700'
            }`}
            title={alertEnabled ? 'Disable alerts' : 'Enable alerts'}
          >
            {alertEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            <span className="text-sm font-medium">
              {alertEnabled ? 'Alerts ON' : 'Alerts OFF'}
            </span>
          </button>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-300">Auto-scroll</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
        <span className="text-xs text-slate-500">Services:</span>
        {SERVICES.map((service) => (
          <span
            key={service}
            className={`px-2 py-0.5 rounded text-xs font-medium border ${
              serviceColors[service] || 'bg-slate-700 text-slate-300 border-slate-600'
            }`}
          >
            {service}
          </span>
        ))}
      </div>
    </div>
  );
}
