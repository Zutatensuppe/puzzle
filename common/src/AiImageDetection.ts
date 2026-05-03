const AI_TOOL_PATTERN = /midjourney|dall[-.\s]?e|firefly|stable\s*diffusion|novelai/i

// Stable Diffusion (Automatic1111) PNG metadata pattern
const SD_PARAMS_PATTERN = /\bSteps:\s*\d+.*?Sampler:/s

// ComfyUI workflow JSON pattern
const COMFYUI_PATTERN = /"class_type"\s*:/

// C2PA digital source type for AI content
const C2PA_AI_SOURCE = 'trainedAlgorithmicMedia'

/**
 * Detects AI generation markers in a latin1-decoded string of image bytes.
 * Works in both browser and Node.js environments.
 */
export function detectAiMarkers(text: string): boolean {
  if (SD_PARAMS_PATTERN.test(text)) return true
  if (COMFYUI_PATTERN.test(text)) return true
  if (text.includes(C2PA_AI_SOURCE)) return true
  if (AI_TOOL_PATTERN.test(text)) return true
  return false
}
