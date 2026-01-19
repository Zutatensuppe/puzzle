<template>
  <div
    ref="puzzleCropper"
    class="puzzle-cropper"
  >
    <canvas
      ref="canvas"
      @mousedown="onMousedown"
      @mousemove="onMousemove"
      @mouseup="onMouseup"
    />
  </div>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { Dim, Point, Rect } from '@common/Geometry'
import { clamp } from '@common/Util'
import type { PuzzleCreationInfo } from '@common/Puzzle'
import type { ImageInfo, ShapeMode } from '@common/Types'
import { drawPuzzlePreview } from '../PuzzleGraphics'
import { NEWGAME_MAX_PIECES, NEWGAME_MIN_PIECES } from '@common/GameCommon'
import { AnimatedGifLoader } from '../AnimatedGifLoader'

const props = defineProps<{
  image: ImageInfo,
  puzzleCreationInfo: PuzzleCreationInfo,
  shapeMode: ShapeMode,
  piecesPreview: boolean
}>()

const emit = defineEmits<{
  (e: 'cropUpdate', val: Rect): void
}>()

const canvas = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
const puzzleCropper = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>

const offset = ref<Point>({ x: 0, y: 0 })

let imgDrawRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
let gifFrames: HTMLImageElement[] = []
let gifDelays: number[] = []
let currentFrameIndex = 0
let animationFrameId: number | null = null
let lastFrameTime = 0
const isGif = ref<boolean>(false)
let isMounted = true

const determinePreviewPieceSize = (): number => {
  if (props.puzzleCreationInfo === null) {
    return 0
  }
  return Math.min(
    imgDrawRect.w / props.puzzleCreationInfo.pieceCountHorizontal,
    imgDrawRect.h / props.puzzleCreationInfo.pieceCountVertical,
  )
}
const determinePreviewDim = (previewPieceSize: number): Dim => {
  if (props.puzzleCreationInfo === null) {
    return { w: 0, h: 0 }
  }
  const previewW = props.puzzleCreationInfo.pieceCountHorizontal * previewPieceSize
  const previewH = props.puzzleCreationInfo.pieceCountVertical * previewPieceSize
  return { w: previewW, h: previewH }
}

const createCropEventData = (): Rect => {
  const dim = determinePreviewDim(determinePreviewPieceSize())
  const w = clamp(Math.round(dim.w * image.width / imgDrawRect.w), 0, image.width)
  const h = clamp(Math.round(dim.h * image.height / imgDrawRect.h), 0, image.height)
  const x = clamp(Math.round(image.width / imgDrawRect.w * offset.value.x), 0, image.width - w)
  const y = clamp(Math.round(image.height / imgDrawRect.h * offset.value.y), 0, image.height - h)
  return { x, y, w, h }
}

const centerCrop = (): void => {
  const imgDrawRect = calculateImageDrawRect()
  const dim = determinePreviewDim(determinePreviewPieceSize())
  offset.value.x = (imgDrawRect.w - dim.w) / 2
  offset.value.y = (imgDrawRect.h - dim.h) / 2
}

const emitCropChange = (): void => {
  emit('cropUpdate', createCropEventData())
}

watch(() => props.puzzleCreationInfo, () => {
  if (props.puzzleCreationInfo === null) {
    return
  }
  centerCrop()
  emitCropChange()
  redraw()
})
watch(() => props.shapeMode, () => {
  redraw()
})

const manuallyCropped = ref<boolean>(false)

let lastMouseDown: MouseEvent | null = null
const onMousedown = (ev: MouseEvent) => {
  if (!props.piecesPreview) {
    return
  }
  lastMouseDown = ev
}
const onMouseup = (_ev: MouseEvent) => {
  if (!props.piecesPreview) {
    return
  }
  lastMouseDown = null
}
const onMousemove = (ev: MouseEvent) => {
  if (!props.piecesPreview) {
    return
  }
  if (!lastMouseDown) {
    return
  }

  const dim = determinePreviewDim(determinePreviewPieceSize())
  const offX = offset.value.x + (ev.offsetX - lastMouseDown.offsetX)
  const offY = offset.value.y + (ev.offsetY - lastMouseDown.offsetY)

  offset.value.x = clamp(offX, 0, imgDrawRect.w - dim.w)
  offset.value.y = clamp(offY, 0, imgDrawRect.h - dim.h)
  manuallyCropped.value = true

  lastMouseDown = ev

  emitCropChange()
  redraw()
}

const calculateImageDrawRect = (): Rect => {
  const imgRatio = image.width / image.height
  const canvasRatio = canvas.value.width / canvas.value.height
  if (imgRatio > canvasRatio) {
    // image more landscape than the canvas
    const w = canvas.value.width
    const h = w / imgRatio
    return { w, h, x: 0, y: 0 }
  }

  // image less or equal landscape than the canvas
  const h = canvas.value.height
  const w = h * imgRatio
  const x = (canvas.value.width - w) / 2
  return { w, h, x, y: 0 }
}

const image = new Image(props.image.width, props.image.height)
const redraw = () => {
  const ctx = canvas.value.getContext('2d')
  if (!ctx) {
    // should not happen
    return
  }

  if (props.puzzleCreationInfo.desiredPieceCount < NEWGAME_MIN_PIECES
    || props.puzzleCreationInfo.desiredPieceCount > NEWGAME_MAX_PIECES
  ) {
    return
  }

  canvas.value.width = canvas.value.clientWidth
  canvas.value.height = canvas.value.clientHeight

  imgDrawRect = calculateImageDrawRect()

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // Draw current frame if it's a GIF, otherwise draw static image
  if (isGif.value && gifFrames.length > 0) {
    const currentFrame = gifFrames[currentFrameIndex]
    if (currentFrame) {
      ctx.drawImage(
        currentFrame,
        0, 0, currentFrame.width, currentFrame.height,
        imgDrawRect.x, imgDrawRect.y,
        imgDrawRect.w, imgDrawRect.h,
      )
    }
  } else {
    ctx.drawImage(
      image,
      0, 0, image.width, image.height,
      imgDrawRect.x, imgDrawRect.y,
      imgDrawRect.w, imgDrawRect.h,
    )
  }

  if (props.piecesPreview) {
    const previewPieceSize = determinePreviewPieceSize()
    const dim = determinePreviewDim(previewPieceSize)

    drawPuzzlePreview(
      dim,
      previewPieceSize,
      props.puzzleCreationInfo,
      props.shapeMode,
      ctx,
      imgDrawRect,
      offset.value,
    )
  }
}

const resizeObserver = new ResizeObserver(_entries => {
  redraw()
})

watch(() => props.piecesPreview, () => {
  redraw()
})

const animateGif = (timestamp: number) => {
  if (!isGif.value || gifFrames.length === 0) return

  const timeSinceLastFrame = timestamp - lastFrameTime

  if (timeSinceLastFrame >= gifDelays[currentFrameIndex]) {
    currentFrameIndex = (currentFrameIndex + 1) % gifFrames.length
    lastFrameTime = timestamp
    redraw()
  }

  animationFrameId = requestAnimationFrame(animateGif)
}

const loadGifFrames = async (): Promise<boolean> => {
  try {
    const gifLoader = AnimatedGifLoader.getInstance()
    const frames = await gifLoader.loadGifFrames(props.image.id)

    if (!frames || frames.length === 0) {
      return false
    }

    // Convert dataUrls to HTMLImageElement objects
    const imagePromises = frames.map((frame, index) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          console.log(`Frame ${index} loaded successfully, dimensions: ${img.width}x${img.height}`)
          resolve(img)
        }
        img.onerror = (e) => {
          console.error(`Failed to load frame ${index}`, e)
          reject(new Error('Failed to load frame'))
        }
        img.src = frame.dataUrl
      })
    })

    gifFrames = await Promise.all(imagePromises)
    gifDelays = frames.map(f => f.delay)

    return true
  } catch (e) {
    console.error('Error loading GIF frames:', e)
    return false
  }
}

const startGifAnimation = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  if (isGif.value && gifFrames.length > 0) {
    lastFrameTime = performance.now()
    animationFrameId = requestAnimationFrame(animateGif)
  }
}

const stopGifAnimation = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

onMounted(async () => {
  resizeObserver.observe(puzzleCropper.value)

  // Check if the image is a GIF
  isGif.value = props.image.url.toLowerCase().endsWith('.gif')

  image.src = props.image.url
  image.onload = async (_ev: Event) => {
    if (isGif.value) {
      // Try to load GIF frames from the server
      const loaded = await loadGifFrames()
      if (!isMounted) return
      if (!loaded) {
        // Fallback to static image if frames couldn't be loaded
        isGif.value = false
      }
    }

    if (!isMounted) return

    centerCrop()
    emitCropChange()

    if (isGif.value) {
      startGifAnimation()
    } else {
      redraw()
    }
  }
})
onBeforeUnmount(() => {
  isMounted = false
  resizeObserver.disconnect()
  stopGifAnimation()
})
</script>
<style>
.puzzle-cropper { position: relative; width:100%; height:100%; overflow: hidden; user-select: none; }
.puzzle-cropper canvas { position: absolute; width: 100%; height: 100%; top: 0; left: 0; }
</style>
