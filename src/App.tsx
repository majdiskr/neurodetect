import React, { useState, useEffect } from 'react';
import MetalDetector from './components/MetalDetector';
import AnalysisDashboard from './components/AnalysisDashboard';
import AIAssistant from './components/AIAssistant';
import { PredictionResult } from './types';
import { Scan, BarChart2, Info, Download } from 'lucide-react';

enum Tab {
  DETECTOR = 'detector',
  DASHBOARD = 'dashboard',
  INFO = 'info'
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DETECTOR);
  const [showAI, setShowAI] = useState(false);
  const [lastPrediction, setLastPrediction] = useState<PredictionResult | null>(null);
  const [sensorReadings, setSensorReadings] = useState<number[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleAnalyzeRequest = (prediction: PredictionResult, readings: number[]) => {
    setLastPrediction(prediction);
    setSensorReadings(readings);
    setShowAI(true);
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-white flex flex-col font-sans overflow-hidden relative">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 pb-24 z-10 overflow-hidden relative">
        <div className="h-full max-w-md mx-auto relative">
           
           {/* Header */}
           <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center text-slate-900 font-black text-lg">
                    N
                  </div>
                  <h1 className="text-xl font-bold tracking-tight">NeuroDetect</h1>
               </div>
               
               {/* PWA Install Button */}
               {deferredPrompt && !isInstalled && (
                 <button 
                   onClick={handleInstallClick}
                   className="flex items-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-lg transition-colors border border-cyan-500/30 animate-pulse"
                 >
                   <Download size={16} />
                   <span className="text-xs font-bold uppercase">Install</span>
                 </button>
               )}
           </div>

           <div className="h-[calc(100%-60px)] relative">
              {activeTab === Tab.DETECTOR && (
                <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <MetalDetector onAnalyze={handleAnalyzeRequest} />
                </div>
              )}

              {activeTab === Tab.DASHBOARD && (
                <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <AnalysisDashboard />
                </div>
              )}

              {activeTab === Tab.INFO && (
                 <div className="h-full overflow-y-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-300 prose prose-invert prose-sm">
                    <h2 className="text-cyan-400">About NeuroDetect</h2>
                    <p>
                      This application is the interface for the <strong>Enhanced Smart Metal Detector</strong> project. 
                    </p>
                    <p>
                      It utilizes a CNN-1D Neural Network trained on ~1800 samples of magnetic sensor data to classify materials into Iron, Stainless Steel, Aluminum, or No Metal with <strong>97.18% accuracy</strong>.
                    </p>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 not-prose">
                      <h4 className="text-white font-bold mb-2">How to use</h4>
                      <ol className="list-decimal list-inside text-slate-300 space-y-2 text-sm">
                        <li>Ensure you are on a mobile device with a Magnetometer.</li>
                        <li>Click <strong>Start Scan</strong>.</li>
                        <li>If "Sensor Error" appears, click <strong>Enable Simulation Mode</strong> to test with synthetic data.</li>
                        <li>Click <strong>AI Analyze</strong> for Gemini insights.</li>
                      </ol>
                    </div>
                 </div>
              )}
           </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 w-full z-20 bg-slate-900/80 backdrop-blur-lg border-t border-slate-800">
        <div className="max-w-md mx-auto flex justify-around p-4">
          <button 
            onClick={() => setActiveTab(Tab.DETECTOR)}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === Tab.DETECTOR ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Scan size={24} />
            <span className="text-[10px] font-bold uppercase">Scanner</span>
          </button>
          
          <button 
             onClick={() => setActiveTab(Tab.DASHBOARD)}
             className={`flex flex-col items-center gap-1 transition-colors ${activeTab === Tab.DASHBOARD ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <BarChart2 size={24} />
            <span className="text-[10px] font-bold uppercase">Metrics</span>
          </button>

          <button 
             onClick={() => setActiveTab(Tab.INFO)}
             className={`flex flex-col items-center gap-1 transition-colors ${activeTab === Tab.INFO ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Info size={24} />
            <span className="text-[10px] font-bold uppercase">Info</span>
          </button>
        </div>
      </div>

      {/* AI Modal */}
      <AIAssistant 
        isOpen={showAI} 
        onClose={() => setShowAI(false)} 
        prediction={lastPrediction} 
        sensorReadings={sensorReadings}
      />
    </div>
  );
};

export default App;
