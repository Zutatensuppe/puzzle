import { ref, watch } from 'vue'
import user from './user'
import type { Api, GameId, GameInfo, GameSettings, ImageId, ImageInfo, Tag, UserId } from '../../common/src/Types'
import _api from './_api'
import { toast } from './toast'

export enum Dialogs {
  LOGIN_DIALOG = 'login-dialog',
  EDIT_IMAGE_DIALOG = 'edit-image-dialog',
  REPORT_GAME_DIALOG = 'report-game-dialog',
  REPORT_IMAGE_DIALOG = 'report-image-dialog',
  REPORT_PLAYER_DIALOG = 'report-player-dialog',
  IMAGE_INFO_DIALOG = 'image-info-dialog',
  NEW_IMAGE_DIALOG = 'new-image-dialog',
  NEW_GAME_DIALOG = 'new-game-dialog',
  USER_AVATAR_UPLOAD_DIALOG = 'user-avatar-upload-dialog',
}

// global dialog settings
const width = ref<'auto' | number | undefined>(undefined)
const minWidth = ref<number | undefined>(undefined)
const currentDialog = ref<Dialogs | ''>('')
const dialogOpen = ref<boolean>(false)

const closeDialog = () => {
  currentDialog.value = ''
  dialogOpen.value = false
  width.value = undefined
  minWidth.value = undefined
}

watch(dialogOpen, (open, oldOpen) => {
  if (!open && oldOpen !== open) {
    closeDialog()
  }
})


const onInit = () => {
  console.log('onInit')
  // this should probably only close the dialog if it is the login dialog?
  closeDialog()
}
user.eventBus.on('login', onInit)

// edit-image dialog specific
const editImageImage = ref<ImageInfo | undefined>(undefined)
const editImageAutocompleteTags = ref<((input: string, exclude: string[]) => string[]) | undefined>(undefined)
const editOnSaveImageClick = ref<((data: any) => Promise<void>) | undefined>(undefined)

const openEditImageDialog = (
  image: ImageInfo,
  autocompleteTags: (input: string, exclude: string[]) => string[],
  onSaveImageClick: (data: any) => Promise<void>,
) => {
  editImageImage.value = image
  editImageAutocompleteTags.value = autocompleteTags
  editOnSaveImageClick.value = onSaveImageClick

  // =================================================================
  currentDialog.value = Dialogs.EDIT_IMAGE_DIALOG
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
  currentDialog.value = Dialogs.LOGIN_DIALOG
  width.value = 'auto'
  minWidth.value = 450
  dialogOpen.value = true
}

// report game dialog specific
const reportGame = ref<GameInfo|null>(null)
const openReportGameDialog = (game: GameInfo) => {
  reportGame.value = game

  // =================================================================
  currentDialog.value = Dialogs.REPORT_GAME_DIALOG
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
  currentDialog.value = Dialogs.REPORT_IMAGE_DIALOG
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

// report image dialog specific
const reportPlayerId = ref<UserId|null>(null)
const openReportPlayerDialog = (userId: UserId) => {
  reportPlayerId.value = userId

  // =================================================================
  currentDialog.value = Dialogs.REPORT_PLAYER_DIALOG
  width.value = undefined
  minWidth.value = undefined
  dialogOpen.value = true
}

const submitReportPlayer = async (data: { id: UserId, reason: string }) => {
  const res = await _api.pub.reportPlayer(data)
  if (res.status === 200) {
    closeDialog()
    toast('Thank you for your report.', 'success')
  } else {
    toast('An error occured during reporting.', 'error')
  }
}

// image info dialog specific
const imageInfoImage = ref<ImageInfo|null>(null)
const openImageInfoDialog = (image: ImageInfo) => {
  imageInfoImage.value = image

  // =================================================================
  currentDialog.value = Dialogs.IMAGE_INFO_DIALOG
  width.value = undefined
  minWidth.value = undefined
  dialogOpen.value = true
}

// new image dialog specific
const newImageUploadProgress = ref<number>(0)
const newImageUploading = ref<'' | 'postToGallery' | 'setupGame'>('')
const newImageAutocompleteTags = ref<((input: string, exclude: string[]) => string[]) | undefined>(undefined)
const newImagePostToGalleryClick = ref<((data: Api.UploadRequestData) => Promise<void>) | undefined>(undefined)
const newImageSetupGameClick = ref<((data: Api.UploadRequestData) => Promise<void>) | undefined>(undefined)

const openNewImageDialog = (
  autocompleteTags: (input: string, exclude: string[]) => string[],
  postToGalleryClick: (data: Api.UploadRequestData) => Promise<void>,
  setupGameClick: (data: Api.UploadRequestData) => Promise<void>,
) => {
  newImageAutocompleteTags.value = autocompleteTags
  newImagePostToGalleryClick.value = postToGalleryClick
  newImageSetupGameClick.value = setupGameClick

  // =================================================================
  currentDialog.value = Dialogs.NEW_IMAGE_DIALOG
  width.value = undefined
  minWidth.value = undefined
  dialogOpen.value = true
}

// new game dialog specific
const newGameImageInfo = ref<ImageInfo|null>(null)
const newGameOnNewGameClick = ref<((data: GameSettings) => Promise<void>) | undefined>(undefined)
const newGameOnTagClick = ref<((tag: Tag) => void) | undefined>(undefined)

const openNewGameDialog = (
  imageInfo: ImageInfo,
  onNewGameClick: (data: GameSettings) => Promise<void>,
  onTagClick: (tag: Tag) => void,
) => {
  newGameImageInfo.value = imageInfo
  newGameOnNewGameClick.value = onNewGameClick
  newGameOnTagClick.value = onTagClick

  // =================================================================
  currentDialog.value = Dialogs.NEW_GAME_DIALOG
  width.value = undefined
  minWidth.value = undefined
  dialogOpen.value = true
}

// user avatar upload dialog specific
const userAvatarUploadProgress = ref<number>(0)
const userAvatarUploading = ref<'' | 'uploading'>('')
const userAvatarOnSaveClick = ref<((data: Blob) => Promise<void>) | undefined>(undefined)

const openUserAvatarUploadDialog = (
  onSaveClick: (data: Blob) => Promise<void>,
) => {
  userAvatarOnSaveClick.value = onSaveClick

  // =================================================================
  currentDialog.value = Dialogs.USER_AVATAR_UPLOAD_DIALOG
  width.value = undefined
  minWidth.value = undefined
  dialogOpen.value = true
}

export function useDialog() {
  return {
    closeDialog,
    currentDialog,
    dialogOpen,
    editImageAutocompleteTags,
    editImageImage,
    editOnSaveImageClick,
    newImageUploadProgress,
    newImageUploading,
    newImageAutocompleteTags,
    newImagePostToGalleryClick,
    newImageSetupGameClick,
    newGameImageInfo,
    newGameOnNewGameClick,
    newGameOnTagClick,
    imageInfoImage,
    loginDialogData,
    loginDialogTab,
    minWidth,
    openEditImageDialog,
    openNewImageDialog,
    openNewGameDialog,
    openImageInfoDialog,
    openLoginDialog,
    openReportGameDialog,
    openReportImageDialog,
    openReportPlayerDialog,
    openUserAvatarUploadDialog,
    reportGame,
    reportImage,
    reportPlayerId,
    submitReportGame,
    submitReportImage,
    submitReportPlayer,
    userAvatarOnSaveClick,
    userAvatarUploading,
    userAvatarUploadProgress,
    width,
  }
}
