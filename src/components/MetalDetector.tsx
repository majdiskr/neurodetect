import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import { MetalType, SensorData, PredictionResult } from '../types';
import { analyzeMetalReading } from '../services/geminiService';
import { Play, Pause, RefreshCw, Zap, Smartphone, AlertTriangle, Waves } from 'lucide-react';

interface MetalDetectorProps {
  onAnalyze: (result: PredictionResult, readings: number[]) => void;
}

const WINDOW_SIZE = 50; // Match the Python window size

const MetalDetector: React.FC<MetalDetectorProps> = ({ onAnalyze }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [dataBuffer, setDataBuffer] = useState<SensorData[]>([]);
  const [currentPrediction, setCurrentPrediction] = useState<PredictionResult>({
    metalType: MetalType.NO_METAL,
    confidence: 0.0,
    features: { mean: 0, std: 0, max: 0, fftMean: 0, fftMax: 0 }
  });
  const [simulationMode, setSimulationMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sensorRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);

  // --- Simulation Logic (since most desktop browsers lack magnetometer) ---
  const simulateReading = useCallback(() => {
    const time = Date.now();
    let base = 45; // Background magnetic field ~45µT
    let noise = Math.random() * 2;
    
    // Inject "Signal" randomly
    if (Math.random() > 0.95) {
       // Simulate passing over metal (sine wave bump + high frequency jitter)
       base += Math.sin(time / 200) * 50; 
       noise += Math.random() * 15; // Iron has high noise/variance
    }

    const val = base + noise;
    
    const reading: SensorData = {
      x: val * 0.5,
      y: val * 0.3,
      z: val * 0.2,
      total: val,
      timestamp: time
    };
    
    handleNewReading(reading);
  }, [isScanning]);

  // --- Sensor Handling ---
  const handleNewReading = (reading: SensorData) => {
    setDataBuffer(prev => {
      const newBuffer = [...prev, reading];
      if (newBuffer.length > WINDOW_SIZE) {
        newBuffer.shift(); // Keep window size constant
      }
      return newBuffer;
    });
  };

  // --- DSP: Calculate Features including FFT ---
  const extractFeatures = (buffer: SensorData[]) => {
    const magnitudes = buffer.map(d => d.total);
    const N = magnitudes.length;
    
    // 1. Time Domain Stats
    const mean = magnitudes.reduce((a, b) => a + b, 0) / N;
    const std = Math.sqrt(magnitudes.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / N);
    const max = Math.max(...magnitudes);

    // 2. Frequency Domain (Simple DFT)
    // We compute magnitude spectrum for the first N/2 frequencies
    // This matches the Python script's `frequency_domain_augmentation` logic
    const centered = magnitudes.map(x => x - mean);
    const fftMagnitudes: number[] = [];
    
    // Compute DFT (O(N^2) is fine for N=50)
    for (let k = 0; k < Math.floor(N / 2); k++) {
        let real = 0;
        let imag = 0;
        for (let n = 0; n < N; n++) {
            // Euler's formula: e^(-i*2*pi*k*n/N) = cos(...) - i*sin(...)
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

  // --- Inference Logic ---
  useEffect(() => {
    if (dataBuffer.length < WINDOW_SIZE) return;

    const { mean, std, max, fftMean, fftMax } = extractFeatures(dataBuffer);

    // Enhanced Heuristics based on Python CNN findings
    // The Python analysis showed "FFT_Max" and "Std" are top features.
    let type = MetalType.NO_METAL;
    let conf = 0.85;

    // Classification Decision Tree Approximation
    if (fftMax > 150) {
      // Very strong periodic signal or massive disturbance
      if (std > 20) {
         type = MetalType.IRON; // High variance + High FFT = Ferromagnetic
         conf = 0.94;
      } else {
         type = MetalType.STAINLESS_STEEL; // Strong signal but cleaner than Iron
         conf = 0.89;
      }
    } else if (std > 10) {
       // Noisy signal but lower frequency components
       type = MetalType.IRON;
       conf = 0.88;
    } else if (fftMax > 80 && mean > 60) {
       // Moderate frequency response, slight mean shift
       type = MetalType.ALUMINUM;
       conf = 0.78;
    } else {
       // Background noise
       type = MetalType.NO_METAL;
       conf = Math.min(0.99, 1 - (std / 50));
    }

    const result = {
      metalType: type,
      confidence: conf,
      features: { mean, std, max, fftMean, fftMax }
    };
    
    setCurrentPrediction(result);
  }, [dataBuffer]);

  const toggleScan = async () => {
    if (isScanning) {
      stopScan();
      return;
    }

    setErrorMsg(null);

    // Check for Simulation Mode override
    if (simulationMode) {
      startSimulation();
      return;
    }

    // Attempt real sensor
    if ('Magnetometer' in window) {
      try {
        const sensor = new window.Magnetometer({ frequency: 60 });
        sensor.addEventListener('reading', () => {
          if (sensor.x == null) return;
          const total = Math.sqrt(sensor.x**2 + sensor.y**2 + sensor.z**2);
          handleNewReading({
            x: sensor.x,
            y: sensor.y,
            z: sensor.z,
            total,
            timestamp: Date.now()
          });
        });
        sensor.addEventListener('error', (e: any) => {
          setErrorMsg(`Sensor Error: ${e.error.name}. Switching to simulation.`);
          setSimulationMode(true);
          startSimulation();
        });
        sensor.start();
        sensorRef.current = sensor;
        setIsScanning(true);
      } catch (err) {
        setErrorMsg("Magnetometer not supported or permission denied. Using Simulation.");
        setSimulationMode(true);
        startSimulation();
      }
    } else {
      setErrorMsg("Device does not support Magnetometer API. Using Simulation.");
      setSimulationMode(true);
      startSimulation();
    }
  };

  const startSimulation = () => {
    setIsScanning(true);
    intervalRef.current = window.setInterval(simulateReading, 1000 / 60); // 60Hz
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

  // Color mapping based on metal type
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
      {/* Top Status Bar */}
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
          <span className="text-cyan-400 font-mono font-bold">CNN-1D (Approximated)</span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-amber-500/10 border border-amber-500/50 text-amber-200 p-3 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          {errorMsg}
        </div>
      )}

      {/* Main Visualization Ring */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-[300px]">
        {/* Outer pulsating ring */}
        <div className={`absolute w-64 h-64 rounded-full border-4 transition-all duration-300 ${getStatusColor()} ${isScanning ? 'opacity-20 scale-110 animate-ping' : 'opacity-0'}`}></div>
        
        {/* Inner Circle */}
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

      {/* Real-time Chart */}
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

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3">
         <button 
           onClick={toggleScan}
           className={`p-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 ${isScanning ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' : 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'}`}
         >
           {isScanning ? <Pause size={20} /> : <Play size={20} />}
           {isScanning ? 'STOP SCAN' : 'START SCAN'}
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
            <span className="text-xs text-slate-500">Mode:</span>
            <button 
              onClick={() => {
                stopScan();
                setSimulationMode(!simulationMode);
              }}
              className={`text-xs px-2 py-1 rounded border ${simulationMode ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
            >
              {simulationMode ? 'SIMULATION' : 'SENSOR'}
            </button>
         </div>
         <span className="text-[10px] text-slate-600 font-mono">
            {dataBuffer.length} samples (Window: {WINDOW_SIZE})
         </span>
      </div>
    </div>
  );
};

export default MetalDetector;