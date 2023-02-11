<template>
  <div class="puzzle-cropper">
    <canvas ref="canvas" />
    <canvas ref="canvasPreview" @mousedown="onMousedown" @mousemove="onMousemove" @mouseup="onMouseup" :style="canvasPreviewStyle"/>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, Ref, watch } from 'vue';
import { Dim, Rect } from '../../common/Geometry';
import { clamp } from '../../common/Util';
import { PuzzleCreationInfo } from '../../common/Puzzle';
import { ImageInfo, ShapeMode } from '../../common/Types';
import { drawPuzzlePreview } from '../PuzzleGraphics'

const props = defineProps<{
  image: ImageInfo,
  puzzleCreationInfo: PuzzleCreationInfo,
  shapeMode: ShapeMode,
}>()

const emit = defineEmits<{
  (e: 'cropUpdate', val: Rect): void
}>()

const canvas = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
const canvasPreview = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>

const offX = ref<number>(0)
const offY = ref<number>(0)

let imgDrawRect: Rect = { x: 0, y: 0, w: 0, h: 0 }

const determinePreviewDim = (): Dim => {
  const previewPieceSize = Math.min(
    imgDrawRect.w / props.puzzleCreationInfo.pieceCountHorizontal,
    imgDrawRect.h / props.puzzleCreationInfo.pieceCountVertical,
  )
  const previewW = props.puzzleCreationInfo.pieceCountHorizontal * previewPieceSize
  const previewH = props.puzzleCreationInfo.pieceCountVertical * previewPieceSize
  return { w: previewW, h: previewH }
}

const createCropEventData = (): Rect => {
  const dim = determinePreviewDim()
  const w = clamp(Math.round(dim.w * image.width / imgDrawRect.w), 0, image.width)
  const h = clamp(Math.round(dim.h * image.height / imgDrawRect.h), 0, image.height)
  const x = clamp(Math.round(image.width / imgDrawRect.w * offX.value), 0, image.width - w)
  const y = clamp(Math.round(image.height / imgDrawRect.h * offY.value), 0, image.height - h)
  return { x, y, w, h }
}

watch(() => props.puzzleCreationInfo, () => {
  offX.value = 0
  offY.value = 0

  emit('cropUpdate', createCropEventData())
  redraw()
})
watch(() => props.shapeMode, () => {
  redraw()
})


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

  const dim = determinePreviewDim()
  const _offX = offX.value + (ev.offsetX - lastMouseDown.offsetX)
  const _offY = offY.value + (ev.offsetY - lastMouseDown.offsetY)

  offX.value = clamp(_offX, 0, imgDrawRect.w - dim.w)
  offY.value = clamp(_offY, 0, imgDrawRect.h - dim.h)

  emit('cropUpdate', createCropEventData())
}

const canvasPreviewStyle = computed(() => {
  return {
    top: offY.value + 'px',
    left: offX.value + 'px',
  }
})

const image = new Image(props.image.width, props.image.height)
const redraw = () => {
  const ctxPreview = canvasPreview.value.getContext('2d')
  if (!ctxPreview) {
    // should not happen
    return
  }

  ctxPreview.clearRect(0, 0, canvasPreview.value.width, canvasPreview.value.height)
  drawPuzzlePreview(
    props.puzzleCreationInfo,
    props.shapeMode,
    ctxPreview,
    imgDrawRect,
  )
}

onMounted(() => {
  canvas.value.width = canvas.value.clientWidth
  canvas.value.height = canvas.value.clientHeight
  canvasPreview.value.width = canvas.value.clientWidth
  canvasPreview.value.height = canvas.value.clientHeight

  image.src = props.image.url
  image.onload = (ev: Event) => {
    const ctx = canvas.value.getContext('2d')
    if (!ctx) {
      // should not happen
      return
    }

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
    imgDrawRect = { w: imgDrawWidth, h: imgDrawHeight, x: dx, y: dy}
    ctx.drawImage(
      image,
      0, 0, image.width, image.height,
      imgDrawRect.x, imgDrawRect.y,
      imgDrawRect.w, imgDrawRect.h,
    )

    redraw()
  }
})
</script>
<style>
.puzzle-cropper { position: relative; width:100%; height:100%; overflow: hidden; user-select: none; }
.puzzle-cropper canvas { position: absolute; width: 100%; height: 100%; top: 0; left: 0; }
</style>
