import { ref, watch } from 'vue'
import { me, onLoginStateChange } from './user'
import type { Api, GameInfo, GameSettings, ImageInfo, Tag, UserId } from '../../common/src/Types'
import _api from './_api'
import type { GameInterface } from './Game'

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
  CONFIRM_DELETE_GAME_DIALOG = 'confirm-delete-game-dialog',
  CUTTING_OVERLAY_DIALOG = 'cutting-overlay-dialog',
  HELP_OVERLAY_DIALOG = 'help-overlay-dialog',
  INFO_OVERLAY_DIALOG = 'info-overlay-dialog',
  SETTINGS_OVERLAY_DIALOG = 'settings-overlay-dialog',
}

type DialogArgs = {
  [Dialogs.LOGIN_DIALOG]: {
    tab: 'login' | 'register' | 'forgot-password' | 'reset-password'
    data?: {
      passwordResetToken: string
    }
  }
  [Dialogs.EDIT_IMAGE_DIALOG]: {
    image: ImageInfo
    autocompleteTags: (input: string, exclude: string[]) => string[]
    onSaveImageClick: (data: any) => Promise<void>
  }
  [Dialogs.REPORT_GAME_DIALOG]: {
    game: GameInfo
  }
  [Dialogs.REPORT_IMAGE_DIALOG]: {
    image: ImageInfo
  }
  [Dialogs.REPORT_PLAYER_DIALOG]: {
    userId: UserId
  }
  [Dialogs.IMAGE_INFO_DIALOG]: {
    image: ImageInfo
  }
  [Dialogs.NEW_IMAGE_DIALOG]: {
    autocompleteTags: (input: string, exclude: string[]) => string[]
    postToGalleryClick: (data: Api.UploadRequestData) => Promise<void>
    setupGameClick: (data: Api.UploadRequestData) => Promise<void>
  }
  [Dialogs.NEW_GAME_DIALOG]: {
    imageInfo: ImageInfo
    onNewGameClick: (data: GameSettings) => Promise<void>
    onTagClick: (tag: Tag) => void
  }
  [Dialogs.USER_AVATAR_UPLOAD_DIALOG]: {
    onSaveClick: (data: Blob) => Promise<void>
  }
  [Dialogs.CONFIRM_DELETE_GAME_DIALOG]: {
    game: GameInfo
    onConfirmDeleteGame: (game: GameInfo) => Promise<void>
  }
  [Dialogs.INFO_OVERLAY_DIALOG]: {
    game: GameInterface
  }
  [Dialogs.SETTINGS_OVERLAY_DIALOG]: {
    game: GameInterface
  }
}

// global dialog settings
const currentDialog = ref<Dialogs | ''>('')
const currentDialogPersistent = ref<boolean>(false)
const dialogOpen = ref<boolean>(false)

const openDialog = (
  dialog: Dialogs,
  persistent: boolean = false,
) => {
  currentDialog.value = dialog
  dialogOpen.value = true
  currentDialogPersistent.value = persistent
}

const closeDialog = (dialog?: Dialogs) => {
  // if specific dialog is to be closed, only close if current dialog is of that kind
  // otherwise just close the current dialog
  const shouldClose = dialog ? dialog === currentDialog.value : true
  if (!shouldClose) return

  currentDialog.value = ''
  dialogOpen.value = false
  currentDialogPersistent.value = false
}

watch(dialogOpen, (open, oldOpen) => {
  if (!open && oldOpen !== open) {
    closeDialog()
  }
})

const onInit = () => {
  if (!me.value) {
    return
  }
  // this should probably only close the dialog if it is the login dialog?
  closeDialog()
}
onLoginStateChange(onInit)

// edit-image dialog specific
const editImageImage = ref<ImageInfo | undefined>(undefined)
const editImageAutocompleteTags = ref<((input: string, exclude: string[]) => string[]) | undefined>(undefined)
const editOnSaveImageClick = ref<((data: any) => Promise<void>) | undefined>(undefined)

const openEditImageDialog = (args: DialogArgs[Dialogs.EDIT_IMAGE_DIALOG]) => {
  editImageImage.value = args.image
  editImageAutocompleteTags.value = args.autocompleteTags
  editOnSaveImageClick.value = args.onSaveImageClick

  // =================================================================
  openDialog(Dialogs.EDIT_IMAGE_DIALOG)
}

// login dialog specific
const loginDialogTab = ref<'login' | 'register' | 'forgot-password' | 'reset-password' | undefined>(undefined)
const loginDialogData = ref<{ passwordResetToken: string } | undefined>(undefined)

const openLoginDialog = (args: DialogArgs[Dialogs.LOGIN_DIALOG]) => {
  loginDialogData.value = args.data
  loginDialogTab.value = args.tab || 'login'

  // =================================================================
  openDialog(Dialogs.LOGIN_DIALOG)
}

// report game dialog specific
const reportGame = ref<GameInfo|null>(null)
const openReportGameDialog = (args: DialogArgs[Dialogs.REPORT_GAME_DIALOG]) => {
  reportGame.value = args.game

  // =================================================================
  openDialog(Dialogs.REPORT_GAME_DIALOG)
}

// report image dialog specific
const reportImage = ref<ImageInfo|null>(null)
const openReportImageDialog = (args: DialogArgs[Dialogs.REPORT_IMAGE_DIALOG]) => {
  reportImage.value = args.image

  // =================================================================
  openDialog(Dialogs.REPORT_IMAGE_DIALOG)
}

// report image dialog specific
const reportPlayerId = ref<UserId|null>(null)
const openReportPlayerDialog = (args: DialogArgs[Dialogs.REPORT_PLAYER_DIALOG]) => {
  reportPlayerId.value = args.userId

  // =================================================================
  openDialog(Dialogs.REPORT_PLAYER_DIALOG)
}

// image info dialog specific
const imageInfoImage = ref<ImageInfo|null>(null)
const openImageInfoDialog = (args: DialogArgs[Dialogs.IMAGE_INFO_DIALOG]) => {
  imageInfoImage.value = args.image

  // =================================================================
  openDialog(Dialogs.IMAGE_INFO_DIALOG)
}

// new image dialog specific
const newImageUploadProgress = ref<number>(0)
const newImageUploading = ref<'' | 'postToGallery' | 'setupGame'>('')
const newImageAutocompleteTags = ref<((input: string, exclude: string[]) => string[]) | undefined>(undefined)
const newImagePostToGalleryClick = ref<((data: Api.UploadRequestData) => Promise<void>) | undefined>(undefined)
const newImageSetupGameClick = ref<((data: Api.UploadRequestData) => Promise<void>) | undefined>(undefined)

const openNewImageDialog = (args: DialogArgs[Dialogs.NEW_IMAGE_DIALOG]) => {
  newImageAutocompleteTags.value = args.autocompleteTags
  newImagePostToGalleryClick.value = args.postToGalleryClick
  newImageSetupGameClick.value = args.setupGameClick

  // =================================================================
  openDialog(Dialogs.NEW_IMAGE_DIALOG)
}

// new game dialog specific
const newGameImageInfo = ref<ImageInfo|null>(null)
const newGameOnNewGameClick = ref<((data: GameSettings) => Promise<void>) | undefined>(undefined)
const newGameOnTagClick = ref<((tag: Tag) => void) | undefined>(undefined)

const openNewGameDialog = (args: DialogArgs[Dialogs.NEW_GAME_DIALOG]) => {
  newGameImageInfo.value = args.imageInfo
  newGameOnNewGameClick.value = args.onNewGameClick
  newGameOnTagClick.value = args.onTagClick

  // =================================================================
  openDialog(Dialogs.NEW_GAME_DIALOG)
}

// user avatar upload dialog specific
const userAvatarUploadProgress = ref<number>(0)
const userAvatarUploading = ref<'' | 'uploading'>('')
const userAvatarOnSaveClick = ref<((data: Blob) => Promise<void>) | undefined>(undefined)

const openUserAvatarUploadDialog = (args: DialogArgs[Dialogs.USER_AVATAR_UPLOAD_DIALOG]) => {
  userAvatarOnSaveClick.value = args.onSaveClick

  // =================================================================
  openDialog(Dialogs.USER_AVATAR_UPLOAD_DIALOG)
}

// confirm delete game dialog specific
const confirmDeleteGame = ref<GameInfo|null>(null)
const onConfirmDeleteGame = ref<((game: GameInfo) => Promise<void>)|undefined>(undefined)
const openConfirmDeleteDialog = (args: DialogArgs[Dialogs.CONFIRM_DELETE_GAME_DIALOG]) => {
  confirmDeleteGame.value = args.game
  onConfirmDeleteGame.value = args.onConfirmDeleteGame

  // =================================================================
  openDialog(Dialogs.CONFIRM_DELETE_GAME_DIALOG)
  dialogOpen.value = true
}

// ingame: cutting overlay
const openCuttingOverlayDialog = () => {
  // =================================================================
  openDialog(Dialogs.CUTTING_OVERLAY_DIALOG, true)
}

// ingame: help overlay
const openHelpOverlayDialog = () => {
  // =================================================================
  openDialog(Dialogs.HELP_OVERLAY_DIALOG)
}

// ingame: info overlay
const infoGame = ref<GameInterface|null>(null)
const openInfoOverlayDialog = (args: DialogArgs[Dialogs.INFO_OVERLAY_DIALOG]) => {
  infoGame.value = args.game

  // =================================================================
  openDialog(Dialogs.INFO_OVERLAY_DIALOG)
}

// ingame: settings overlay
const settingsGame = ref<GameInterface|null>(null)
const openSettingsOverlayDialog = (args: DialogArgs[Dialogs.SETTINGS_OVERLAY_DIALOG]) => {
  settingsGame.value = args.game

  // =================================================================
  openDialog(Dialogs.SETTINGS_OVERLAY_DIALOG)
}


export function useDialog() {
  return {
    closeDialog,
    currentDialog,
    currentDialogPersistent,
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
    openEditImageDialog,
    openNewImageDialog,
    openNewGameDialog,
    openImageInfoDialog,
    openLoginDialog,
    openReportGameDialog,
    openReportImageDialog,
    openReportPlayerDialog,
    openUserAvatarUploadDialog,
    openConfirmDeleteDialog,
    openCuttingOverlayDialog,
    openHelpOverlayDialog,
    openInfoOverlayDialog,
    openSettingsOverlayDialog,
    infoGame,
    reportGame,
    settingsGame,
    reportImage,
    reportPlayerId,
    userAvatarOnSaveClick,
    userAvatarUploading,
    userAvatarUploadProgress,
    confirmDeleteGame,
    onConfirmDeleteGame,
  }
}
