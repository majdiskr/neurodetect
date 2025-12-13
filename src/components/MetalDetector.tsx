import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import { MetalType, SensorData, PredictionResult } from '../types';
import { Play, Pause, Zap, AlertTriangle, Waves, Settings, ShieldAlert, FlaskConical, SlidersHorizontal, RotateCcw } from 'lucide-react';

interface MetalDetectorProps {
  onAnalyze: (result: PredictionResult, readings: number[]) => void;
}

const WINDOW_SIZE = 50;
const DEFAULT_SIM_BASE = 45;
const DEFAULT_SIM_NOISE = 2;

const MetalDetector: React.FC<MetalDetectorProps> = ({ onAnalyze }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [dataBuffer, setDataBuffer] = useState<SensorData[]>([]);
  
  // Simulation Settings
  const [simSettings, setSimSettings] = useState({ base: DEFAULT_SIM_BASE, noise: DEFAULT_SIM_NOISE });
  const simSettingsRef = useRef(simSettings); // Ref to access latest state inside interval callback

  const [currentPrediction, setCurrentPrediction] = useState<PredictionResult>({
    metalType: MetalType.NO_METAL,
    confidence: 0.0,
    features: { mean: 0, std: 0, max: 0, fftMean: 0, fftMax: 0 }
  });
  const [errorMsg, setErrorMsg] = useState<React.ReactNode | null>(null);

  const sensorRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  // Update ref when settings change
  useEffect(() => {
    simSettingsRef.current = simSettings;
  }, [simSettings]);

  // --- Simulation Logic ---
  const simulateReading = useCallback(() => {
    const time = Date.now();
    
    // Get latest values from ref
    let { base, noise: noiseLevel } = simSettingsRef.current;
    
    let currentBase = base;
    let currentNoise = Math.random() * noiseLevel;

    // Randomly inject signals to simulate passing over metal (only if base is low/normal)
    // If user has manually cranked the base high, we don't need random spikes as much
    if (base < 80 && Math.random() > 0.96) {
       // Simulate a wave passing by
       currentBase += Math.sin(time / 200) * 50; 
       currentNoise += Math.random() * 15; 
    }

    const val = currentBase + currentNoise;
    
    handleNewReading({
      x: val * 0.5,
      y: val * 0.3,
      z: val * 0.2,
      total: val,
      timestamp: time
    });
  }, []);

  const handleNewReading = (reading: SensorData) => {
    setDataBuffer(prev => {
      const newBuffer = [...prev, reading];
      if (newBuffer.length > WINDOW_SIZE) {
        newBuffer.shift(); 
      }
      return newBuffer;
    });
  };

  const extractFeatures = (buffer: SensorData[]) => {
    const magnitudes = buffer.map(d => d.total);
    const N = magnitudes.length;
    
    const mean = magnitudes.reduce((a, b) => a + b, 0) / N;
    const std = Math.sqrt(magnitudes.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / N);
    const max = Math.max(...magnitudes);

    const centered = magnitudes.map(x => x - mean);
    const fftMagnitudes: number[] = [];
    
    for (let k = 0; k < Math.floor(N / 2); k++) {
        let real = 0;
        let imag = 0;
        for (let n = 0; n < N; n++) {
            const theta = -2 * Math.PI * k * n / N;
            real += centered[n] * Math.cos(theta);
            imag += centered[n] * Math.sin(theta);
        }
        fftMagnitudes.push(Math.sqrt(real * real + imag * imag));
    }

    const fftMean = fftMagnitudes.length > 0 ? fftMagnitudes.reduce((a, b) => a + b, 0) / fftMagnitudes.length : 0;
    const fftMax = fftMagnitudes.length > 0 ? Math.max(...fftMagnitudes) : 0;

    return { mean, std, max, fftMean, fftMax };
  };

  useEffect(() => {
    if (dataBuffer.length < WINDOW_SIZE) return;

    const { mean, std, max, fftMean, fftMax } = extractFeatures(dataBuffer);

    let type = MetalType.NO_METAL;
    let conf = 0.85;

    // Adjusted thresholds based on Python model analysis
    if (fftMax > 150) {
      if (std > 20) {
         type = MetalType.IRON; 
         conf = 0.94;
      } else {
         type = MetalType.STAINLESS_STEEL; 
         conf = 0.89;
      }
    } else if (std > 10) {
       type = MetalType.IRON;
       conf = 0.88;
    } else if (fftMax > 80 && mean > 60) {
       type = MetalType.ALUMINUM;
       conf = 0.78;
    } else {
       type = MetalType.NO_METAL;
       conf = Math.min(0.99, 1 - (std / 50));
    }

    setCurrentPrediction({
      metalType: type,
      confidence: conf,
      features: { mean, std, max, fftMean, fftMax }
    });
  }, [dataBuffer]);

  const toggleScan = async () => {
    if (isScanning) {
      stopScan();
      return;
    }

    setErrorMsg(null);

    // 1. Simulation Mode Check
    if (simulationMode) {
      startSimulation();
      return;
    }

    // 2. Real Sensor Check
    if (!('Magnetometer' in window)) {
      showSensorError("Sensor API Missing. Switching to Simulation is recommended.");
      return;
    }

    try {
      // @ts-ignore
      const permissions = await navigator.permissions.query({ name: 'magnetometer' as any });
      if (permissions.state === 'denied') {
        showSensorError("Permission Denied. Switch to Simulation?");
        return;
      }

      // @ts-ignore
      const sensor = new window.Magnetometer({ frequency: 10 });
      
      sensor.addEventListener('reading', () => {
        if (sensor.x == null) return;
        const total = Math.sqrt(sensor.x**2 + sensor.y**2 + sensor.z**2);
        handleNewReading({
          x: sensor.x, y: sensor.y, z: sensor.z, total, timestamp: Date.now()
        });
      });
      
      sensor.addEventListener('error', (e: any) => {
        console.error("Sensor Error:", e);
        showSensorError("Sensor Hardware Error. Switch to Simulation?");
        setIsScanning(false);
      });

      sensor.start();
      sensorRef.current = sensor;
      setIsScanning(true);
    } catch (err: any) {
      console.error(err);
      const isSecure = window.isSecureContext;
      const debugText = isSecure ? "Secure Context: True" : "Secure Context: False (Must be True)";
      showSensorError(`Startup Error: ${err.message}. ${debugText}. Switch to Simulation?`);
      setIsScanning(false);
    }
  };

  const showSensorError = (msg: string) => {
    setErrorMsg(
      <div className="flex flex-col gap-2">
        <span className="text-amber-400 font-bold flex items-center gap-2"><ShieldAlert size={16}/> {msg}</span>
        <button 
          onClick={() => { setSimulationMode(true); setErrorMsg(null); }}
          className="mt-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/50 rounded px-3 py-2 text-xs font-bold w-full"
        >
          Enable Simulation Mode
        </button>
      </div>
    );
  };

  const startSimulation = () => {
    setIsScanning(true);
    intervalRef.current = window.setInterval(simulateReading, 1000 / 60);
  };

  const stopScan = () => {
    setIsScanning(false);
    if (sensorRef.current) {
      sensorRef.current.stop();
      sensorRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleManualAnalyze = () => {
    const magnitudes = dataBuffer.map(d => d.total);
    onAnalyze(currentPrediction, magnitudes);
  };

  const handleSimChange = (key: 'base' | 'noise', value: string) => {
    setSimSettings(prev => ({ ...prev, [key]: parseFloat(value) }));
  };

  const resetSimSettings = () => {
    setSimSettings({ base: DEFAULT_SIM_BASE, noise: DEFAULT_SIM_NOISE });
  };

  const getStatusColor = () => {
    switch (currentPrediction.metalType) {
      case MetalType.IRON: return 'text-red-500 border-red-500 shadow-red-500/50';
      case MetalType.ALUMINUM: return 'text-blue-400 border-blue-400 shadow-blue-400/50';
      case MetalType.STAINLESS_STEEL: return 'text-purple-400 border-purple-400 shadow-purple-400/50';
      case MetalType.NO_METAL: return 'text-emerald-400 border-emerald-400 shadow-emerald-400/50';
      default: return 'text-gray-400 border-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700 backdrop-blur-md">
        <div>
          <h2 className="text-slate-400 text-xs uppercase tracking-widest font-bold">Status</h2>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-white font-mono">{isScanning ? 'SCANNING' : 'IDLE'}</span>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-slate-400 text-xs uppercase tracking-widest font-bold">Model</h2>
          <span className="text-cyan-400 font-mono font-bold">CNN-1D (Real-Time)</span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-amber-500/10 border border-amber-500/50 text-amber-200 p-3 rounded-lg text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
          <Settings size={16} className="mt-1 shrink-0" />
          <div className="w-full">{errorMsg}</div>
        </div>
      )}

      {/* Simulation Controls - Only visible in Sim Mode */}
      {simulationMode && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs text-amber-400 font-bold flex items-center gap-1">
              <SlidersHorizontal size={12} /> SIMULATION CONTROLS
            </h3>
            <button onClick={resetSimSettings} className="text-slate-400 hover:text-white transition-colors" title="Reset Defaults">
              <RotateCcw size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="text-[10px] text-slate-400 block mb-1">Base Strength (µT)</label>
               <input 
                 type="range" min="20" max="200" step="1" 
                 value={simSettings.base} 
                 onChange={(e) => handleSimChange('base', e.target.value)}
                 className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
               />
               <div className="text-right text-[10px] text-cyan-300 font-mono">{simSettings.base}</div>
            </div>
            <div>
               <label className="text-[10px] text-slate-400 block mb-1">Noise Level</label>
               <input 
                 type="range" min="0" max="50" step="1" 
                 value={simSettings.noise} 
                 onChange={(e) => handleSimChange('noise', e.target.value)}
                 className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
               />
               <div className="text-right text-[10px] text-purple-300 font-mono">{simSettings.noise}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center relative min-h-[300px]">
        <div className={`absolute w-64 h-64 rounded-full border-4 transition-all duration-300 ${getStatusColor()} ${isScanning ? 'opacity-20 scale-110 animate-ping' : 'opacity-0'}`}></div>
        <div className={`relative w-56 h-56 rounded-full bg-slate-800 border-4 flex flex-col items-center justify-center transition-colors duration-500 ${getStatusColor()} ${isScanning ? 'shadow-[0_0_40px_rgba(0,0,0,0.3)]' : ''}`}>
          <span className="text-xs text-slate-400 mb-1">DETECTED MATERIAL</span>
          <h1 className="text-2xl font-black uppercase text-center leading-tight px-2">
            {currentPrediction.metalType}
          </h1>
          <span className="text-xs text-slate-500 mt-2 font-mono">
            CONF: {(currentPrediction.confidence * 100).toFixed(1)}%
          </span>
          
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono text-slate-400">
             <div className="text-center">
               <div className="font-bold text-white">{currentPrediction.features.mean.toFixed(0)}</div>
               <div className="text-[10px]">MEAN µT</div>
             </div>
             <div className="text-center">
               <div className="font-bold text-white">{currentPrediction.features.std.toFixed(1)}</div>
               <div className="text-[10px]">STD</div>
             </div>
             <div className="text-center col-span-2 mt-1 flex flex-col items-center text-cyan-400">
               <Waves size={12} className="mb-1 opacity-70" />
               <div className="font-bold text-white">{currentPrediction.features.fftMax.toFixed(1)}</div>
               <div className="text-[10px]">FFT PEAK</div>
             </div>
          </div>
        </div>
      </div>

      <div className="h-32 bg-slate-900/50 rounded-xl border border-slate-700 p-2 relative overflow-hidden">
        <div className="absolute top-2 left-2 text-[10px] text-slate-500 font-mono">MAGNETIC FLUX MAGNITUDE (µT)</div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataBuffer}>
            <YAxis domain={['auto', 'auto']} hide />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke={isScanning ? "#22d3ee" : "#475569"} 
              strokeWidth={2} 
              dot={false} 
              isAnimationActive={false} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3">
         <button 
           onClick={toggleScan}
           className={`p-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 ${isScanning ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' : 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'}`}
         >
           {isScanning ? <Pause size={20} /> : <Play size={20} />}
           {isScanning ? 'STOP' : 'START'}
         </button>

         <button 
           onClick={handleManualAnalyze}
           disabled={dataBuffer.length < 10}
           className="bg-slate-800 text-white border border-slate-600 p-4 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
         >
           <Zap size={20} className="text-yellow-400" />
           AI ANALYZE
         </button>
      </div>

      <div className="flex justify-between items-center px-2">
         <div className="flex items-center gap-2">
           <button 
             onClick={() => { stopScan(); setSimulationMode(!simulationMode); }}
             className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${simulationMode ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
           >
             <FlaskConical size={10} />
             {simulationMode ? 'SIMULATION' : 'SENSOR MODE'}
           </button>
         </div>
         <span className="text-[10px] text-slate-600 font-mono">
            {dataBuffer.length} samples
         </span>
      </div>
    </div>
  );
};

export default MetalDetector;
