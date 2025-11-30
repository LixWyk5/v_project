// Import canvas implementation
import { addTextWatermarkCanvas, addImageWatermarkCanvas, WatermarkOptions as CanvasWatermarkOptions } from './canvasWatermark';

// WASM 支持（可选，未来可以启用）
// 当前使用 Canvas 作为主要实现，更可靠且易于调试
let wasmInitialized = false;

async function initWasm(): Promise<void> {
  wasmInitialized = true;
  return Promise.resolve();
}

export interface WatermarkOptions {
  text?: string;
  image?: Uint8Array;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';
  opacity?: number;
  fontSize?: number;
  fontColor?: string;
  offsetX?: number;
  offsetY?: number;
  angle?: number; // For tile mode
  spacing?: number; // For tile mode
}

export async function addTextWatermark(
  imageData: Uint8Array,
  options: WatermarkOptions
): Promise<Uint8Array> {
  if (!options.text) {
    throw new Error('Watermark text is required');
  }
  
  // Convert to CanvasWatermarkOptions format
  const canvasOptions: CanvasWatermarkOptions = {
    text: options.text,
    position: options.position,
    opacity: options.opacity,
    fontSize: options.fontSize,
    fontColor: options.fontColor,
    offsetX: options.offsetX,
    offsetY: options.offsetY,
    angle: options.angle,
    spacing: options.spacing,
  };
  
  return await addTextWatermarkCanvas(imageData, canvasOptions);
}

export async function addImageWatermark(
  imageData: Uint8Array,
  watermarkImageData: Uint8Array,
  options: WatermarkOptions
): Promise<Uint8Array> {
  // Convert to CanvasWatermarkOptions format
  const canvasOptions: CanvasWatermarkOptions = {
    position: options.position,
    opacity: options.opacity,
    offsetX: options.offsetX,
    offsetY: options.offsetY,
    angle: options.angle,
    spacing: options.spacing,
  };
  
  return await addImageWatermarkCanvas(imageData, watermarkImageData, canvasOptions);
}

export async function isWasmAvailable(): Promise<boolean> {
  return true;
}
