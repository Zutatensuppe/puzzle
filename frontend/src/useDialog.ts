import { ref } from 'vue'
import user from './user'
import { GameId, GameInfo, ImageId, ImageInfo } from '../../common/src/Types'
import _api from './_api'
import { toast } from './toast'

// global dialog settings
const width = ref<'auto' | number | undefined>(undefined)
const minWidth = ref<number | undefined>(undefined)
const dialogClass = ref<string|undefined>(undefined)
const currentDialog = ref<'login-dialog' | 'edit-image-dialog' | 'report-game-dialog' | 'report-image-dialog' | ''>('')
const dialogOpen = ref<boolean>(false)

const closeDialog = () => {
  currentDialog.value = ''
  dialogOpen.value = false
}

const onInit = () => {
  console.log('onInit')
  // this should probably only close the dialog if it is the login dialog?
  closeDialog()
}
user.eventBus.on('login', onInit)

// edit-image dialog specific
const editImageImage = ref<ImageInfo | undefined>(undefined)
const editImageAutocompleteTags = ref<((input: string, exclude: string[]) => string[]) | undefined>(undefined)
const editOnSaveImageClick = ref<(((data: any) => Promise<void>)) | undefined>(undefined)

const openEditImageDialog = (
  image: ImageInfo,
  autocompleteTags: (input: string, exclude: string[]) => string[],
  onSaveImageClick: (data: any) => Promise<void>,
) => {
  editImageImage.value = image
  editImageAutocompleteTags.value = autocompleteTags
  editOnSaveImageClick.value = onSaveImageClick

  // =================================================================
  currentDialog.value = 'edit-image-dialog'
  dialogClass.value = 'edit-image'
  width.value = undefined
  minWidth.value = undefined
  dialogOpen.value = true
}

// login dialog specific
const loginDialogTab = ref<'login' | 'register' | 'forgot-password' | 'reset-password' | undefined>(undefined)
const loginDialogData = ref<{ passwordResetToken: string } | undefined>(undefined)

const openLoginDialog = (
  tab: 'login' | 'register' | 'forgot-password' | 'reset-password' = 'login',
  data?: {
    passwordResetToken: string
  },
) => {
  loginDialogData.value = data
  loginDialogTab.value = tab

  // =================================================================
  currentDialog.value = 'login-dialog'
  dialogClass.value = undefined
  width.value = 'auto'
  minWidth.value = 450
  dialogOpen.value = true
}

// report game dialog specific
const reportGame = ref<GameInfo|null>(null)
const openReportGameDialog = (game: GameInfo) => {
  reportGame.value = game

  // =================================================================
  currentDialog.value = 'report-game-dialog'
  dialogClass.value = 'report-game'
  width.value = undefined
  minWidth.value = undefined
  dialogOpen.value = true
}

const submitReportGame = async (data: { id: GameId, reason: string }) => {
  const res = await _api.pub.reportGame(data)
  if (res.status === 200) {
    closeDialog()
    toast('Thank you for your report.', 'success')
  } else {
    toast('An error occured during reporting.', 'error')
  }
}

// report image dialog specific
const reportImage = ref<ImageInfo|null>(null)
const openReportImageDialog = (image: ImageInfo) => {
  reportImage.value = image

  // =================================================================
  currentDialog.value = 'report-image-dialog'
  dialogClass.value = 'report-image'
  width.value = undefined
  minWidth.value = undefined
  dialogOpen.value = true
}

const submitReportImage = async (data: { id: ImageId, reason: string }) => {
  const res = await _api.pub.reportImage(data)
  if (res.status === 200) {
    closeDialog()
    toast('Thank you for your report.', 'success')
  } else {
    toast('An error occured during reporting.', 'error')
  }
}

export function useDialog() {
  return {
    dialogClass,
    dialogOpen,
    width,
    minWidth,
    closeDialog,
    currentDialog,
    loginDialogTab,
    loginDialogData,
    openLoginDialog,
    openEditImageDialog,
    openReportGameDialog,
    submitReportGame,
    reportGame,
    openReportImageDialog,
    submitReportImage,
    reportImage,
    editImageImage,
    editImageAutocompleteTags,
    editOnSaveImageClick,
  }
}
