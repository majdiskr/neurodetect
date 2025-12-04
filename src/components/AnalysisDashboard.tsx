import React from 'react';
import {  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ModelMetrics } from '../types';
import { CheckCircle2, TrendingUp, Cpu, Activity } from 'lucide-react';

const MODEL_DATA: ModelMetrics[] = [
  { name: 'CNN-1D', accuracy: 97.18, type: 'Neural Network', color: '#22d3ee' },
  { name: 'Attention', accuracy: 95.76, type: 'Neural Network', color: '#818cf8' },
  { name: 'LSTM', accuracy: 95.48, type: 'Neural Network', color: '#c084fc' },
  { name: 'Deep MLP', accuracy: 94.35, type: 'Neural Network', color: '#f472b6' },
  { name: 'XGBoost', accuracy: 95.20, type: 'Traditional ML', color: '#fbbf24' },
];

const AnalysisDashboard: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto pb-20 scrollbar-hide">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Activity className="text-cyan-400" />
        Model Performance
      </h2>

      {/* Hero Stat */}
      <div className="bg-gradient-to-r from-cyan-900/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10">
          <Cpu size={120} />
        </div>
        <div className="relative z-10">
          <p className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-1">Active Architecture</p>
          <h1 className="text-4xl font-black text-white mb-2">CNN-1D</h1>
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 w-fit px-3 py-1 rounded-full border border-emerald-500/30">
            <CheckCircle2 size={16} />
            <span className="font-mono font-bold">97.18% Accuracy</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6">
        <h3 className="text-slate-400 text-xs font-bold uppercase mb-4">Benchmark Comparison (Test Set)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MODEL_DATA} layout="vertical" margin={{ left: 0, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" domain={[80, 100]} stroke="#475569" tick={{fill: '#475569', fontSize: 10}} />
              <YAxis dataKey="name" type="category" width={80} stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 11}} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                itemStyle={{ color: '#e2e8f0' }}
                cursor={{fill: '#1e293b', opacity: 0.5}}
              />
              <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={20}>
                {MODEL_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Importance Info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
           <div className="text-purple-400 mb-2"><TrendingUp size={24} /></div>
           <div className="text-2xl font-bold text-white">64</div>
           <div className="text-xs text-slate-400">Total Features</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
           <div className="text-blue-400 mb-2"><Activity size={24} /></div>
           <div className="text-2xl font-bold text-white">~1.8k</div>
           <div className="text-xs text-slate-400">Training Samples</div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
           <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
           Training Insights
        </h3>
        <ul className="space-y-3 text-sm text-slate-300">
           <li className="flex gap-2">
             <span className="text-cyan-500">•</span>
             Neural Networks outperformed traditional ML by +2.1%.
           </li>
           <li className="flex gap-2">
             <span className="text-cyan-500">•</span>
             Key distinguishing features: Magnetic flux variance & Frequency domain peaks.
           </li>
           <li className="flex gap-2">
             <span className="text-cyan-500">•</span>
             Most common confusion: Aluminum vs Stainless Steel (similar low-magnetic signature).
           </li>
        </ul>
      </div>
    </div>
  );
};

export default AnalysisDashboard;