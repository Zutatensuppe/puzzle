<template>
  <div v-if="!me || !loggedIn">
    Please log in to access your settings.
  </div>
  <div v-else-if="!data">
    Loading...
  </div>
  <div v-else-if="'reason' in data">
    {{ data.reason }}
  </div>
  <div v-else>
    <v-table v-if="data">
      <tbody>
        <tr>
          <th>Avatar</th>
          <td
            class="avatar-cell"
          >
            <UserAvatar
              :can-edit="true"
              :user-avatar="avatar"
              @avatar-click="onAvatarClick"
              @delete-click="onAvatarDeleteClick"
            />
          </td>
          <td class="text-disabled">
            <ul>
              <li>The avatar will be resized to a square, even if you upload a different aspect ratio.</li>
              <li>To prevent cutting off your avatar, please upload a square image.</li>
              <li>The avatar will be displayed on your profile page and next to your name in various places.</li>
            </ul>
          </td>
        </tr>
        <tr>
          <th>Enable NSFW Content</th>
          <td>
            <v-checkbox
              v-model="nsfwActive"
              density="comfortable"
            />
          </td>
          <td class="text-disabled">
            <ul>
              <li>NSFW Content you upload yourself will always be available to you, regardless of this setting.</li>
              <li>If you check this, you will see public NSFW content uploaded by other users as well.</li>
            </ul>
          </td>
        </tr>
        <tr>
          <th>Unblur NSFW Content</th>
          <td>
            <v-checkbox
              v-model="nsfwUnblurred"
              density="comfortable"
            />
          </td>
          <td class="text-disabled">
            <ul>
              <li>Check this if you want NSFW content to be unblurred by default.</li>
              <li>If you leave this unchecked, you can always choose to unblur content on a case-by-case basis.</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
<script setup lang="ts">
import type { WatchHandle } from 'vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import UserAvatar from '../components/UserAvatar.vue'
import { init, loggedIn, me, onLoginStateChange, useNsfw } from '../user'
import api from '../_api'
import type { Api, UserAvatar as UserAvatarType } from '@common/Types'
import { useDialog } from '../useDialog'
import { uploadAvatar } from '../upload'
import { toast } from '../toast'

const { closeDialog, openUserAvatarUploadDialog } = useDialog()
const { setNsfwUnblurred } = useNsfw()

const data = ref<null | Api.UserSettingsResponseData>(null)

const avatar = ref<UserAvatarType | null>(null)
const nsfwActive = ref<boolean>(false)
const nsfwUnblurred = ref<boolean>(false)

let stopWatch: WatchHandle | null = null
const onInit = async () => {
  if (!me.value || !me.value.id) {
    avatar.value = null
    nsfwActive.value = false
    nsfwUnblurred.value = false
    data.value = null
    return
  }

  const res = await api.pub.getUserSettingsData({ id: me.value.id })

  data.value = await res.json()

  if (stopWatch) {
    stopWatch()
    stopWatch = null
  }

  if ('reason' in data.value) {
    avatar.value = null
    nsfwActive.value = false
    nsfwUnblurred.value = false
  } else {
    avatar.value = data.value.userSettings.avatar
    nsfwActive.value = data.value.userSettings.nsfwActive
    nsfwUnblurred.value = data.value.userSettings.nsfwUnblurred
  }

  stopWatch = watch([nsfwActive, nsfwUnblurred], async ([newNsfwActive, newNsfwUnblurred]) => {
    setNsfwUnblurred(newNsfwUnblurred)
    const res = await api.pub.updateUserSettings({
      nsfwActive: newNsfwActive,
      nsfwUnblurred: newNsfwUnblurred,
    })
    const resData = await res.json()
    if ('reason' in resData) {
      toast('An error occured while updating settings: ' + resData.reason, 'error')
      return
    }
    toast('Settings updated.', 'success')
    await init()
  }, { deep: true })
}

const onAvatarClick = () => {
  const onSaveClick = async (blob: Blob): Promise<void> => {
    const result = await uploadAvatar(blob)

    if ('error' in result) {
      toast(result.error, 'error')
      return
    }

    closeDialog()
    toast('Avatar uploaded successfully.', 'success')
    if (data.value && !('reason' in data.value)) {
      avatar.value = result.avatar
    }
    await init()
  }

  openUserAvatarUploadDialog({
    onSaveClick,
  })
}

const onAvatarDeleteClick = async () => {
  if (!data.value || 'reason' in data.value) {
    return
  }
  const avatarId = data.value.userSettings.avatarId
  if (avatarId && confirm('Really delete the Avatar?')) {
    const res = await api.pub.deleteAvatar({
      avatarId,
    })

    if (res.status !== 200) {
      toast('An error occured during avatar deletion.', 'error')
      return
    }

    toast('Avatar deleted successfully.', 'success')
    avatar.value = null
    await init()
  }
}


let offLoginStateChange: () => void = () => {}
onMounted(async () => {
  await onInit()
  offLoginStateChange = onLoginStateChange(onInit)
})

onUnmounted(() => {
  offLoginStateChange()
})
</script>
