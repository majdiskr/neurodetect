import { GoogleGenAI } from "@google/genai";
import { PredictionResult, MetalType } from "../types";

// Handle both Vite environment variables and process.env fallback
const apiKey = (import.meta as any).env?.VITE_API_KEY || process.env.API_KEY || '';

let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({ apiKey });
}

export const analyzeMetalReading = async (
  prediction: PredictionResult,
  recentReadings: number[]
): Promise<string> => {
  if (!aiClient) {
    return "Gemini API key not configured. Please check your settings.";
  }

  try {
    const readingSample = recentReadings.slice(-20).join(', ');
    
    const prompt = `
      You are an expert metallurgist and data scientist assisting a user with a Smart Metal Detector mobile app.
      
      The app's CNN-1D model has analyzed magnetic sensor data.
      
      Current Prediction: ${prediction.metalType}
      Confidence: ${(prediction.confidence * 100).toFixed(1)}%
      
      Statistical Features Extracted:
      - Mean Magnitude: ${prediction.features.mean.toFixed(2)} µT
      - Standard Deviation: ${prediction.features.std.toFixed(2)}
      - Max Peak: ${prediction.features.max.toFixed(2)} µT
      - Frequency Domain Peak (FFT Max): ${prediction.features.fftMax.toFixed(2)} (Signal Strength/Periodicity)

      Recent raw magnitude readings (sample): [${readingSample}]

      Please provide a brief, technical, but easy-to-understand analysis of this detection. 
      1. Mention how the Frequency Peak (FFT) or Variance (Std) influenced the classification.
      2. If it is "No Metal", explain what the background radiation usually looks like.
      3. Keep it under 3 sentences.
    `;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Analysis complete. No text returned.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to connect to AI analysis service at this time.";
  }
};

export const getSafetyTips = async (metalType: MetalType): Promise<string> => {
  if (!aiClient) return "Configure API Key for safety tips.";
  
  const prompt = `Give me 2 bullet points on safety or handling handling precautions for ${metalType} in an industrial context.`;
  
  try {
     const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No tips available.";
  } catch (error) {
    return "Error fetching safety tips.";
  }
}