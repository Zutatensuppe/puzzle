<template>
  <v-container
    :fluid="true"
    class="user-profile-view"
  >
    <div
      v-if="userProfile"
      :class="{ blurred: currentDialog }"
    >
      <div class="user-profile-table-wrapper">
        <div class="user-profile-table-div">
          <table class="user-profile-table">
            <tbody>
              <tr>
                <td
                  rowspan="10"
                  class="avatar-cell"
                >
                  <div
                    v-if="canEdit"
                    class="avatar is-clickable"
                    :class="{ 'no-avatar': !userProfile.user.avatar }"
                    :style="avatarStyle"
                    @click="onAvatarClick"
                  >
                    <v-icon
                      v-if="userProfile.user.avatar"
                      v-tooltip="'Delete this avatar'"
                      icon="mdi-trash-can"
                      @click.stop="onAvatarDeleteClick"
                    />
                    <span v-else>
                      Click to upload your avatar.
                    </span>
                  </div>
                  <div
                    v-else
                    class="avatar"
                    :class="{ 'no-avatar': !userProfile.user.avatar }"
                    :style="avatarStyle"
                  />
                </td>
              </tr>
              <tr>
                <td>User ID</td>
                <td>{{ userProfile.user.id }}</td>
              </tr>
              <tr>
                <td>Username</td>
                <td>{{ userProfile.user.username }}</td>
              </tr>
              <tr>
                <td>Join Date</td>
                <td>{{ joinDate }}</td>
              </tr>
              <tr>
                <td>Total Games Played</td>
                <td>{{ userProfile.stats.totalGamesCount }}</td>
              </tr>
              <tr>
                <td>Total Pieces Connected</td>
                <td>{{ userProfile.stats.totalPiecesCount }}</td>
              </tr>
              <tr>
                <td>Images Uploaded</td>
                <td>{{ userProfile.stats.imagesUploadedCount }}</td>
              </tr>
              <tr>
                <td>Rank alltime</td>
                <td>
                  <RankIcon
                    :rank="userProfile.stats.leaderboardRanks.alltime.rank"
                    :unranked-fallback="'<no rank>'"
                  />
                  <span
                    v-if="userProfile.stats.leaderboardRanks.alltime.piecesCount"
                    class="text-disabled"
                  >
                    ({{ userProfile.stats.leaderboardRanks.alltime.piecesCount }} pieces)
                  </span>
                </td>
              </tr>
              <tr>
                <td>Rank (last 30 days)</td>
                <td>
                  <RankIcon
                    :rank="userProfile.stats.leaderboardRanks.month.rank"
                    :unranked-fallback="'<no rank>'"
                  />
                  <span
                    v-if="userProfile.stats.leaderboardRanks.month.piecesCount"
                    class="text-disabled"
                  >
                    ({{ userProfile.stats.leaderboardRanks.month.piecesCount }} pieces)
                  </span>
                </td>
              </tr>
              <tr>
                <td>Rank (last 7 days)</td>
                <td>
                  <RankIcon
                    :rank="userProfile.stats.leaderboardRanks.week.rank"
                    :unranked-fallback="'<no rank>'"
                  />
                  <span
                    v-if="userProfile.stats.leaderboardRanks.week.piecesCount"
                    class="text-disabled"
                  >
                    ({{ userProfile.stats.leaderboardRanks.week.piecesCount }} pieces)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="user-profile-actions">
            <div
              v-tooltip="'Report this player'"
              class="report-button player-report"
              @click.stop="openReportPlayerDialog(userProfile.user.id)"
            />
          </div>
        </div>
      </div>
      <!--
      <v-tabs v-model="tab">
        <v-tab value="games">Games</v-tab>
        <v-tab value="latest-images">Latest Images</v-tab>
      </v-tabs>
      -->
      <v-window
        v-model="tab"
        class="mt-6"
        :class="{ blurred: currentDialog }"
      >
        <!--<v-window-item value="games">
          <h2>Games</h2>
          <v-container
            :fluid="true"
            class="pl-0 pr-0 game-teasers-holder finished-games"
          >
            <UserProfileGamesTable :games="userProfile.games" @go-to-game="goToGame" @go-to-replay="goToReplay" />
          </v-container>
        </v-window-item>
        -->
        <v-window-item value="latest-images">
          <h2>Latest Images by {{ userProfile.user.username }}</h2>
          <ImageLibrary
            v-if="userProfile.images.length"
            :images="userProfile.images"
            :edit="false"
            @image-clicked="onImageClicked"
          />
          <div
            v-else
            class="text-disabled"
          >
            This user has not uploaded any public images.
            <div />
          </div>
        </v-window-item>
      </v-window>
    </div>
    <div v-else-if="loading">
      Loading profile...
    </div>
    <div v-else>
      No profile found
    </div>
  </v-container>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../_api'
import { toast } from '../toast'
import type { CompleteUserProfile, GameSettings, ImageInfo, Tag, UserId } from '../../../common/src/Types'
import { ImageSearchSort } from '../../../common/src/Types'
import ImageLibrary from '../components/ImageLibrary.vue'
import { useDialog } from '../useDialog'
import user from '../user'
import { uploadAvatar } from '../upload'
import { resizeUrl } from '../../../common/src/ImageService'
import RankIcon from '../components/RankIcon.vue'
// import UserProfileGamesTable from '../components/UserProfileGamesTable.vue'

const { closeDialog, openReportPlayerDialog, openNewGameDialog, openUserAvatarUploadDialog, currentDialog } = useDialog()

const tab = ref<'latest-images'|'latest-finished-games'>('latest-images')
const route = useRoute()
const router = useRouter()

const loading = ref<boolean>(true)
const userProfile = ref<CompleteUserProfile|null>(null)

const joinDate = computed(() => {
  if (!userProfile.value) {
    return ''
  }
  // TODO: use date format that is same everywhere
  return new Date(`${userProfile.value.user.joinDate}`).toLocaleDateString()
})

const onImageClicked = (newImage: ImageInfo) => {
  openNewGameDialog(
    newImage,
    onNewGame,
    onTagClick,
  )
}

const onNewGame = async (gameSettings: GameSettings) => {
  const res = await api.pub.newGame({ gameSettings })
  const game = await res.json()
  if ('id' in game) {
    closeDialog()
    void router.push({ name: 'game', params: { id: game.id } })
  } else {
    toast('An error occured while creating the game.', 'error')
  }
}

const avatarStyle = computed(() => {
  const imgUrl = userProfile.value?.user.avatar?.url
  if (!imgUrl) {
    return null
  }

  return {
    backgroundImage: `url(${resizeUrl(imgUrl, 400, 400, 'cover')})`,
  }
})

const canEdit = computed(() => {
  return id.value && id.value === user.getMe()?.id
})

const onAvatarClick = () => {
  const fn = async (data: Blob): Promise<void> => {
    const result = await uploadAvatar(data)
    closeDialog()

    if ('error' in result) {
      toast(result.error, 'error')
      return
    }

    await load()
  }
  openUserAvatarUploadDialog(fn)
}

const onAvatarDeleteClick = async () => {
  const avatarId = userProfile.value?.user.avatar?.id
  if (avatarId && confirm('Really delete the Avatar?')) {
    const res = await api.pub.deleteAvatar({
      avatarId,
    })
    if (res.status === 200) {
      toast('Avatar deleted.', 'success')
      await load()
    } else {
      toast('An error occured during avatar deletion.', 'error')
    }
  }
}

const onTagClick = (tag: Tag): void => {
  closeDialog()
  void router.push({ name: 'new-game', query: { sort: ImageSearchSort.DATE_DESC, search: tag.title } })
}

// const goToGame = ((game: GameInfo) => {
//   void router.push({ name: 'game', params: { id: game.id } })
// })

// const goToReplay = ((game: GameInfo) => {
//   void router.push({ name: 'replay', params: { id: game.id } })
// })

let id = ref<UserId>()
const load = async () => {
  if (!id.value) {
    return
  }

  // maybe this can or should be split up in multiple requests later
  const res = await api.pub.getUserProfileData({ id: id.value })
  const data = await res.json()
  if ('reason' in data) {
    toast('An error occured while loading the profile.', 'error')
  } else {
    userProfile.value = data.userProfile
  }
}

const onLoginStateChange = async () => {
  userProfile.value = null
  loading.value = true
  const tmpId = parseInt(`${route.params.id}`, 10) as UserId
  if (isNaN(tmpId) || tmpId <= 0) {
    toast('An error occured while loading the profile.', 'error')
    loading.value = false
    return
  }
  id.value = tmpId
  await load()
  loading.value = false
}

onMounted(async () => {
  await onLoginStateChange()

  user.eventBus.on('login', onLoginStateChange)
  user.eventBus.on('logout', onLoginStateChange)
})
onUnmounted(() => {
  user.eventBus.off('login', onLoginStateChange)
  user.eventBus.off('logout', onLoginStateChange)
})

watch(() => route.params.id, async () => {
  await onLoginStateChange()
})
</script>
