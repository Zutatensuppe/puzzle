<template>
  <v-container
    :fluid="true"
    class="user-profile-view"
  >
    <div v-if="userProfile">
      <div class="user-profile-table-wrapper">
        <div class="user-profile-table-div">
          <table class="user-profile-table">
            <tbody>
              <tr>
                <td
                  rowspan="6"
                  class="avatar-cell"
                >
                  <div class="no-avatar" />
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
            :images="userProfile.images"
            :edit="false"
            @image-clicked="onImageClicked"
          />
        </v-window-item>
      </v-window>
    </div>
  </v-container>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../_api'
import { toast } from '../toast'
import type { CompleteUserProfile, GameSettings, ImageInfo, Tag, UserId } from '../../../common/src/Types'
import { ImageSearchSort } from '../../../common/src/Types'
import ImageLibrary from '../components/ImageLibrary.vue'
import { useDialog } from '../useDialog'
import user from '../user'
// import UserProfileGamesTable from '../components/UserProfileGamesTable.vue'

const { closeDialog, openReportPlayerDialog, openNewGameDialog } = useDialog()

const tab = ref<'latest-images'|'latest-finished-games'>('latest-images')
const route = useRoute()
const router = useRouter()

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
  await load()
}

onMounted(async () => {
  const tmpId = parseInt(`${route.params.id}`, 10) as UserId
  if (isNaN(tmpId) || tmpId <= 0) {
    toast('An error occured while loading the profile.', 'error')
    return
  }
  id.value = tmpId
  await load()

  user.eventBus.on('login', onLoginStateChange)
  user.eventBus.on('logout', onLoginStateChange)
})
onUnmounted(() => {
  user.eventBus.off('login', onLoginStateChange)
  user.eventBus.off('logout', onLoginStateChange)
})
</script>
