import { ref } from 'vue'
import _api from './_api'
import type { Api, ImageInfo, UserAvatar } from '@common/Types'

const uploadImageProgress = ref<number>(0)
export const uploadImage = async (data: Api.UploadRequestData): Promise<{ error: string } | { imageInfo: ImageInfo }> => {
  uploadImageProgress.value = 0
  try {
    const res = await _api.pub.upload({
      file: data.file,
      title: data.title,
      copyrightName: data.copyrightName,
      copyrightURL: data.copyrightURL,
      tags: data.tags,
      isPrivate: data.isPrivate,
      isNsfw: data.isNsfw,
      onProgress: (progress: number): void => {
        uploadImageProgress.value = progress
      },
    })

    // ⡀⡀⡀⡀⡀⡀⡀⣠⣴⣶⣶⣶⣶⣤⡀⡀⡀⡀⡀⡀⡀⡀
    // ⡀⡀⡀⡀⡀⣤⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⡀⡀⡀⡀⡀⡀
    // ⡀⡀⡀⡀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢧⡀⡀⡀⡀⡀
    // ⡀⡀⡀⢠⣿⣿⣿⢻⢸⣿⣿⠇⢿⣿⣿⣿⣿⡀⡀⡀⡀⡀
    // ⡀⡀⡈⣾⣿⣿⡟⣘ ⠹⢿   ⣎⢿⣿⣿⡇⡀⡀⡀⡀
    // ⡀⡀⡀⡇⣿⣿⠏⣾⡧    ⣿⡆⠇⣿⣿⡇⡀⡀⡀⡀
    // ⡀⡀⡀⠁⣿⣿⡀          ⢼⣿⣼⡇⡀⡀⡀⡀
    // ⡀⡀⡀⢠⣿⣿⣧⡀  ⡠⢄   ⣾⣿⣿⡻⡀⡀⡀⡀
    // ⡀⡀⡀⠁⣿⣿⣿⣿⡦⣀⡀⡠⢶⣿⣿⣿⣿⣇⢂⡀⡀⡀
    // ⡀⡀⠆⣼⣿⣿⣿⣿⡀⢄⢀⠔⡀⣿⣿⣿⣿⡟⡀⡀⡀⡀
    // ⡀⡀⣿⣿⣿⣿⣿⣿⣿⣿⢿⣿⣿⣿⣿⣿⣿⣿⣿⡀⡀⡀
    // ⡀⢰⡏⠉⠉⠉⠉⠉⠉⠉⠁⠉⠉⠉⠉⠉⠉⠉⠉⣿⡀⡀
    // ⡀ ⣼⡇ 413 Request Entity  ⣿⡀⡀
    // ⢀ ⠟⠃⡀    Too Large     ⣿⡇⡀⡀
    // ⡀⡀⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠇⡀⡀⡀
    // Comment requested during nC_para_ stream :)
    if (res.status === 413) {
      throw 'The image you tried to upload is too large. Max file size is 20MB.'
    }

    if (res.status === 409) {
      console.log('Duplicate image upload detected.')
    }
    const imageInfo = await res.json()
    if (!imageInfo) {
      throw 'The image upload failed for unknown reasons.'
    }

    uploadImageProgress.value = 1
    return { imageInfo }
  } catch (e) {
    uploadImageProgress.value = 0
    return { error: String(e) }
  }
}

const uploadAvatarProgress = ref<number>(0)
export const uploadAvatar = async (data: Blob): Promise<{ error: string } | { avatar: UserAvatar }> => {
  uploadAvatarProgress.value = 0
  try {
    const res = await _api.pub.uploadAvatar({
      file: data,
      onProgress: (progress: number): void => {
        uploadAvatarProgress.value = progress
      },
    })

    if (res.status === 413) {
      throw 'The image you tried to upload is too large. Max file size is 20MB.'
    }

    const avatar = await res.json()
    if (!avatar) {
      throw 'The image upload failed for unknown reasons.'
    }

    uploadAvatarProgress.value = 1
    return { avatar }
  } catch (e) {
    uploadAvatarProgress.value = 0
    return { error: String(e) }
  }
}
