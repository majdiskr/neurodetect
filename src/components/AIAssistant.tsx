import React, { useEffect, useState } from 'react';
import { X, Bot, Sparkles, Loader2 } from 'lucide-react';
import { PredictionResult, MetalType } from '../types';
import { analyzeMetalReading, getSafetyTips } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: PredictionResult | null;
  sensorReadings: number[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, prediction, sensorReadings }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [tips, setTips] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && prediction) {
      const fetchData = async () => {
        setLoading(true);
        const [analysisRes, tipsRes] = await Promise.all([
           analyzeMetalReading(prediction, sensorReadings),
           getSafetyTips(prediction.metalType)
        ]);
        setAnalysis(analysisRes);
        setTips(tipsRes);
        setLoading(false);
      };
      fetchData();
    }
  }, [isOpen, prediction]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="bg-cyan-500/20 p-2 rounded-lg">
              <Bot className="text-cyan-400" size={24} />
            </div>
            <div>
              <h3 className="text-white font-bold">Gemini Analysis</h3>
              <p className="text-xs text-slate-400">AI-Powered Interpretation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Loader2 size={40} className="animate-spin text-cyan-500 mb-4" />
                <p>Analyzing signal patterns...</p>
             </div>
          ) : (
            <>
              {/* Detection Summary */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold text-slate-500">Detected</span>
                  <span className="text-cyan-400 font-mono text-xs">{(prediction?.confidence || 0) * 100}% Confidence</span>
                </div>
                <div className="text-xl font-bold text-white flex items-center gap-2">
                  {prediction?.metalType}
                  <Sparkles size={16} className="text-yellow-400" />
                </div>
              </div>

              {/* Gemini Text */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Signal Analysis</h4>
                <div className="text-slate-300 text-sm leading-relaxed prose prose-invert">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              </div>

              {/* Safety Tips */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Handling Tips</h4>
                <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-3 text-slate-300 text-sm">
                   <ReactMarkdown>{tips}</ReactMarkdown>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <button onClick={onClose} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;