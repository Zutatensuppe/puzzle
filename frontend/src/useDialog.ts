import { ref } from 'vue'
import user from './user'
import { ImageInfo } from '../../common/src/Types'

// global dialog settings
const width = ref<'auto' | number | undefined>(undefined)
const minWidth = ref<number | undefined>(undefined)
const currentDialog = ref<'login-dialog' | 'edit-image-dialog' |''>('')
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
  currentDialog.value = 'login-dialog'
  width.value = 'auto'
  minWidth.value = 450
  dialogOpen.value = true
}

const dialogClass = ref<string|undefined>(undefined)

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
    editImageImage,
    editImageAutocompleteTags,
    editOnSaveImageClick,
  }
}
