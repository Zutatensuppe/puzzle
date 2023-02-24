import { App } from 'vue';
import Vue3Toastify, { toast as vue3Toast, ToastOptions, type ToastContainerOptions } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

export const init = (app: App) => {
  app.use(Vue3Toastify, {
    autoClose: 3000,
    theme: 'dark',
    position: 'bottom-right',
    closeButton: false,
  } as ToastContainerOptions)
}

export const toast = (message: string, type: 'error' | 'success', timeout?: number) => {
  const options: ToastOptions = {}
  if (timeout) {
    options.autoClose = timeout
  }
  if (type === 'success') {
    vue3Toast.success(message, options)
  } else {
    vue3Toast.error(message, options)
  }
}
