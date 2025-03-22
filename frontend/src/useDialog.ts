import { ref } from 'vue'
import user from './user'

// global dialog settings
const width = ref<'auto' | number | undefined>('auto')
const minWidth = ref<number | undefined>(450)
const currentDialog = ref<'login-dialog' | ''>('')
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
  dialogOpen.value = true
}

export function useDialog() {
  return {
    dialogOpen,
    width,
    minWidth,
    closeDialog,
    currentDialog,
    loginDialogTab,
    loginDialogData,
    openLoginDialog,
  }
}
