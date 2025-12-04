export enum MetalType {
  IRON = 'Iron',
  STAINLESS_STEEL = 'Stainless Steel',
  ALUMINUM = 'Aluminum',
  NO_METAL = 'No Metal',
  UNKNOWN = 'Analyzing...'
}

export interface SensorData {
  x: number;
  y: number;
  z: number;
  total: number; // Magnitude
  timestamp: number;
}

export interface ModelMetrics {
  name: string;
  accuracy: number;
  type: 'Neural Network' | 'Traditional ML';
  color: string;
}

export interface PredictionResult {
  metalType: MetalType;
  confidence: number;
  features: {
    mean: number;
    std: number;
    max: number;
    fftMean: number;
    fftMax: number;
  };
}

// Global declaration for Magnetometer API
declare global {
  interface Window {
    Magnetometer: any;
    SensorErrorEvent: any;
  }
}