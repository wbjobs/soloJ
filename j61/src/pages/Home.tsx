import { StatusBar } from '../components/StatusBar';
import { FilterBar } from '../components/FilterBar';
import { LogList } from '../components/LogList';
import { AlertBanner } from '../components/AlertBanner';
import { useWebSocket } from '../hooks/useWebSocket';
import { Activity } from 'lucide-react';

export default function Home() {
  useWebSocket();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      <AlertBanner />
      
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Activity size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Distributed Log Platform
            </h1>
            <p className="text-xs text-slate-400">Real-time log collection & visualization</p>
          </div>
        </div>
      </header>

      <StatusBar />
      <FilterBar />
      <LogList />
    </div>
  );
}
