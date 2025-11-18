import { ref, watch } from 'vue'
import user from './user'
import type { Api, GameInfo, GameSettings, ImageInfo, Tag, UserId } from '../../common/src/Types'
import _api from './_api'

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
}

// global dialog settings
const currentDialog = ref<Dialogs | ''>('')
const dialogOpen = ref<boolean>(false)

const closeDialog = () => {
  currentDialog.value = ''
  dialogOpen.value = false
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

const openEditImageDialog = (args: DialogArgs[Dialogs.EDIT_IMAGE_DIALOG]) => {
  editImageImage.value = args.image
  editImageAutocompleteTags.value = args.autocompleteTags
  editOnSaveImageClick.value = args.onSaveImageClick

  // =================================================================
  currentDialog.value = Dialogs.EDIT_IMAGE_DIALOG
  dialogOpen.value = true
}

// login dialog specific
const loginDialogTab = ref<'login' | 'register' | 'forgot-password' | 'reset-password' | undefined>(undefined)
const loginDialogData = ref<{ passwordResetToken: string } | undefined>(undefined)

const openLoginDialog = (args: DialogArgs[Dialogs.LOGIN_DIALOG]) => {
  loginDialogData.value = args.data
  loginDialogTab.value = args.tab || 'login'

  // =================================================================
  currentDialog.value = Dialogs.LOGIN_DIALOG
  dialogOpen.value = true
}

// report game dialog specific
const reportGame = ref<GameInfo|null>(null)
const openReportGameDialog = (args: DialogArgs[Dialogs.REPORT_GAME_DIALOG]) => {
  reportGame.value = args.game

  // =================================================================
  currentDialog.value = Dialogs.REPORT_GAME_DIALOG
  dialogOpen.value = true
}

// report image dialog specific
const reportImage = ref<ImageInfo|null>(null)
const openReportImageDialog = (args: DialogArgs[Dialogs.REPORT_IMAGE_DIALOG]) => {
  reportImage.value = args.image

  // =================================================================
  currentDialog.value = Dialogs.REPORT_IMAGE_DIALOG
  dialogOpen.value = true
}

// report image dialog specific
const reportPlayerId = ref<UserId|null>(null)
const openReportPlayerDialog = (args: DialogArgs[Dialogs.REPORT_PLAYER_DIALOG]) => {
  reportPlayerId.value = args.userId

  // =================================================================
  currentDialog.value = Dialogs.REPORT_PLAYER_DIALOG
  dialogOpen.value = true
}

// image info dialog specific
const imageInfoImage = ref<ImageInfo|null>(null)
const openImageInfoDialog = (args: DialogArgs[Dialogs.IMAGE_INFO_DIALOG]) => {
  imageInfoImage.value = args.image

  // =================================================================
  currentDialog.value = Dialogs.IMAGE_INFO_DIALOG
  dialogOpen.value = true
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
  currentDialog.value = Dialogs.NEW_IMAGE_DIALOG
  dialogOpen.value = true
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
  currentDialog.value = Dialogs.NEW_GAME_DIALOG
  dialogOpen.value = true
}

// user avatar upload dialog specific
const userAvatarUploadProgress = ref<number>(0)
const userAvatarUploading = ref<'' | 'uploading'>('')
const userAvatarOnSaveClick = ref<((data: Blob) => Promise<void>) | undefined>(undefined)

const openUserAvatarUploadDialog = (args: DialogArgs[Dialogs.USER_AVATAR_UPLOAD_DIALOG]) => {
  userAvatarOnSaveClick.value = args.onSaveClick

  // =================================================================
  currentDialog.value = Dialogs.USER_AVATAR_UPLOAD_DIALOG
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
    userAvatarOnSaveClick,
    userAvatarUploading,
    userAvatarUploadProgress,
  }
}
