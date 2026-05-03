import { describe, expect, it } from 'vitest'
import { detectAiMarkers } from './AiImageDetection'

describe('detectAiMarkers', () => {
  const testCases: { name: string, content: string, expected: boolean }[] = [
    {
      name: 'detects Stable Diffusion A1111 parameters',
      content: 'some image data\nSteps: 20, Sampler: Euler a, CFG scale: 7',
      expected: true,
    },
    {
      name: 'detects ComfyUI workflow JSON',
      content: '{"3": {"class_type": "KSampler", "inputs": {}}}',
      expected: true,
    },
    {
      name: 'detects C2PA trainedAlgorithmicMedia assertion',
      content: 'jumbf box data trainedAlgorithmicMedia more data',
      expected: true,
    },
    {
      name: 'detects Midjourney in metadata text',
      content: 'Software: Midjourney v5.2',
      expected: true,
    },
    {
      name: 'detects DALL-E in metadata text',
      content: 'Created with DALL-E 3',
      expected: true,
    },
    {
      name: 'detects DALL·E with middle dot',
      content: 'Software: DALL.E',
      expected: true,
    },
    {
      name: 'detects Adobe Firefly',
      content: 'CreatorTool: Adobe Firefly',
      expected: true,
    },
    {
      name: 'detects Stable Diffusion by name',
      content: 'generator: stable diffusion xl',
      expected: true,
    },
    {
      name: 'detects NovelAI',
      content: 'Software: NovelAI',
      expected: true,
    },
    {
      name: 'returns false for plain image data',
      content: 'PNG IHDR random pixel data without any markers',
      expected: false,
    },
    {
      name: 'returns false for regular EXIF-like text',
      content: 'Software: Adobe Photoshop CC 2024\nArtist: John Doe',
      expected: false,
    },
    {
      name: 'returns false for empty string',
      content: '',
      expected: false,
    },
    {
      name: 'does not false-positive on word "steps" in unrelated context',
      content: 'Follow these steps: 1. Open file 2. Edit. Sampler of goods.',
      expected: false,
    },
  ]

  testCases.forEach(({ name, content, expected }) => {
    it(name, () => {
      expect(detectAiMarkers(content)).toBe(expected)
    })
  })
})
