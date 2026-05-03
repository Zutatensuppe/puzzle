import fs from 'fs'
import { detectAiMarkers } from '@common/AiImageDetection'

/**
 * Reads an image file and checks for AI generation markers in its raw bytes.
 */
export async function detectAiMarkersFromFile(imagePath: string): Promise<boolean> {
  try {
    const buffer = await fs.promises.readFile(imagePath)
    return detectAiMarkers(buffer.toString('latin1'))
  } catch {
    return false
  }
}
