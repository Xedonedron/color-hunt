import { colord, extend } from "colord";
import labPlugin from "colord/plugins/lab";

extend([labPlugin]);

interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface AnalysisResult {
  finalDominantColor: string;
  deltaE: number;
  similarity: number;
  grade: string;
}

/**
 * Perform the "Dominant Color + Weighted Area Analysis"
 * Compatible with Browser (Uint8ClampedArray) and Node.js (Buffer)
 */
export function analyzeImageColors(
  pixels: Uint8ClampedArray | Buffer,
  width: number,
  height: number,
  targetHex: string
): AnalysisResult {
  // 1. Identify grid cells (3x3)
  const cellW = Math.floor(width / 3);
  const cellH = Math.floor(height / 3);
  
  // Weights map (3x3)
  // Center (E) - 40%
  // Adjacent (B,D,F,H) - 10% each (Total 40%)
  // Corners (A,C,G,I) - 5% each (Total 20%)
  const weights = [
    0.05, 0.10, 0.05, // Row 1: A B C
    0.10, 0.40, 0.10, // Row 2: D E F
    0.05, 0.10, 0.05  // Row 3: G H I
  ];
  
  const cellDominantColors: RGB[] = [];

  // 2. Extract dominant color for each area
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const dominant = getAreaDominantColor(pixels, width, height, col * cellW, row * cellH, cellW, cellH);
      cellDominantColors.push(dominant);
    }
  }

  // 3. Weighted Color Combination (Weighted Average in LAB space)
  let totalL = 0;
  let totalA = 0;
  let totalB = 0;

  cellDominantColors.forEach((rgb, i) => {
    const lab = colord(rgb).toLab();
    const weight = weights[i];
    totalL += lab.l * weight;
    totalA += lab.a * weight;
    totalB += lab.b * weight;
  });

  // Calculate the final perceived dominant color
  const finalColorHex = colord({ l: totalL, a: totalA, b: totalB }).toHex();
  
  // 4. Calculate Delta-E Similarity to Target
  const targetLab = colord(targetHex).toLab();
  const dL = totalL - targetLab.l;
  const dA = totalA - targetLab.a;
  const dB = totalB - targetLab.b;
  const deltaE = Math.sqrt(dL * dL + dA * dA + dB * dB);

  // 5. Similarity Scoring (0-100)
  // We use the user suggested grading: 95+ Perfect, 80+ Great, 60+ Good
  // Formula: Map DeltaE to score. 0 DeltaE = 100. 50+ DeltaE = 0.
  let similarity = Math.max(0, 100 - (deltaE * 1.6)); // Adjusted multiplier for better feedback
  
  let grade = "Miss";
  if (similarity >= 95) grade = "Perfect";
  else if (similarity >= 80) grade = "Great";
  else if (similarity >= 60) grade = "Good";

  return {
    finalDominantColor: finalColorHex,
    deltaE: parseFloat(deltaE.toFixed(2)),
    similarity: Math.round(similarity),
    grade
  };
}

/**
 * Gets dominant color from a specific area using bucket quantization
 */
function getAreaDominantColor(
  pixels: Uint8ClampedArray | Buffer,
  fullWidth: number,
  fullHeight: number,
  startX: number,
  startY: number,
  width: number,
  height: number
): RGB {
  const colorCounts: Record<string, number> = {};
  const bucketSize = 12; // Quantization factor for clustering
  
  let maxCount = 0;
  let dominant = { r: 255, g: 255, b: 255 };

  for (let y = startY; y < startY + height; y++) {
    for (let x = startX; x < startX + width; x++) {
      const idx = (y * fullWidth + x) * 4;
      if (idx >= pixels.length) continue;

      const r = Math.round(pixels[idx] / bucketSize) * bucketSize;
      const g = Math.round(pixels[idx + 1] / bucketSize) * bucketSize;
      const b = Math.round(pixels[idx + 2] / bucketSize) * bucketSize;
      
      const key = `${r},${g},${b}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
      
      if (colorCounts[key] > maxCount) {
        maxCount = colorCounts[key];
        dominant = { r, g, b };
      }
    }
  }

  return dominant;
}

/**
 * Wrapper for browser-side video element analysis
 * Returns dominant color and full analysis result
 */
export function extractAndAnalyzeTarget(video: HTMLVideoElement, targetHex: string): AnalysisResult {
  const canvas = document.createElement("canvas");
  const size = 64; // Smaller resize for performance
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  
  ctx.drawImage(video, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  
  return analyzeImageColors(imageData.data, size, size, targetHex);
}

// Keep legacy exports for transition if needed
export const extractDominantColor = (video: HTMLVideoElement) => extractAndAnalyzeTarget(video, "#000000").finalDominantColor;
export const calculateColorScore = (capturedHex: string, targetHex: string) => {
  const res = analyzeImageColors(new Uint8ClampedArray(4), 1, 1, targetHex);
  // This is a dummy for legacy, real scoring should use analyzeImageColors directly
  return res.similarity;
};
