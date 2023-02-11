<template>
  <div class="puzzle-cropper" ref="puzzleCropper">
    <canvas ref="canvas" @mousedown="onMousedown" @mousemove="onMousemove" @mouseup="onMouseup" />
  </div>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, Ref, watch } from 'vue';
import { Dim, Point, Rect } from '../../common/Geometry';
import { clamp } from '../../common/Util';
import { PuzzleCreationInfo } from '../../common/Puzzle';
import { ImageInfo, ShapeMode } from '../../common/Types';
import { drawPuzzlePreview } from '../PuzzleGraphics'
import { NEWGAME_MAX_PIECES, NEWGAME_MIN_PIECES } from '../../common/GameCommon';

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
  lastMouseDown = ev
}
const onMouseup = (ev: MouseEvent) => {
  lastMouseDown = null
}
const onMousemove = (ev: MouseEvent) => {
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
  let imgDrawWidth = image.width
  let imgDrawHeight = image.height
  let dx = 0
  let dy = 0
  if (imgRatio > canvasRatio) {
    // image more landscape than the canvas
    imgDrawWidth = canvas.value.width
    imgDrawHeight = canvas.value.width / imgRatio
    dy = canvas.value.height / 2 - imgDrawHeight / 2
  } else {
    // image less or equal landscape than the canvas
    imgDrawHeight = canvas.value.height
    imgDrawWidth = canvas.value.height * imgRatio
    dx = canvas.value.width / 2 - imgDrawWidth / 2
  }
  return { w: imgDrawWidth, h: imgDrawHeight, x: dx, y: dy}
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
  ctx.drawImage(
    image,
    0, 0, image.width, image.height,
    imgDrawRect.x, imgDrawRect.y,
    imgDrawRect.w, imgDrawRect.h,
  )

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
      offset.value
    )
  }
}

const resizeObserver = new ResizeObserver(entries => {
  redraw()
});

onMounted(() => {
  resizeObserver.observe(puzzleCropper.value)

  image.src = props.image.url
  image.onload = (ev: Event) => {
    centerCrop()
    emitCropChange()
    redraw()
  }
})
onBeforeUnmount(() => {
  resizeObserver.disconnect()
})
</script>
<style>
.puzzle-cropper { position: relative; width:100%; height:100%; overflow: hidden; user-select: none; }
.puzzle-cropper canvas { position: absolute; width: 100%; height: 100%; top: 0; left: 0; }
</style>
