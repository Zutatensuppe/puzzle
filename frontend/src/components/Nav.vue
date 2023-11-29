<template>
  <div v-if="showNav">
    <v-app-bar>
      <div class="header-bar-container d-flex">
        <div class="justify-start">
          <v-app-bar-nav-icon
            class="mr-1"
            size="small"
            variant="text"
            @click.stop="drawerMenu = !drawerMenu"
          />

          <v-btn
            size="small"
            class="mr-1"
            :to="{name: 'index'}"
            icon="mdi-home"
            variant="text"
          />
        </div>
        <div class="justify-center">
          <img
            src="./../../../common/src/assets/gfx/icon.png"
            class="mr-4"
            :class="{ index: route.name === 'index' }"
          >
          <h4 :class="{ index: route.name === 'index' }">
            {{ route.meta.title }}
          </h4>
          <slot name="title" />
        </div>
        <div class="justify-end">
          <v-btn
            size="small"
            class="mr-1"
            href="https://stand-with-ukraine.pp.ua/"
            target="_blank"
          >
            <icon icon="ukraine-heart" /> <span class="ml-2 mr-2">Stand with Ukraine</span> <icon icon="ukraine-heart" />
          </v-btn>
          <v-btn
            v-if="me && loggedIn"
            class="user-welcome-message"
            @click="drawerUser = !drawerUser"
          >
            Hello, {{ me.name }}
          </v-btn>
          <v-btn
            v-else
            size="small"
            class="ml-1"
            @click="login"
          >
            Login
          </v-btn>
          <v-app-bar-nav-icon
            class="mr-1"
            size="small"
            variant="text"
            @click.stop="toggleAnnouncements"
          >
            <v-badge
              v-if="unseenAnnouncementCount"
              :content="unseenAnnouncementCount"
              color="red-darken-2"
            >
              <v-icon icon="mdi-bullhorn" />
            </v-badge>
            <v-icon
              v-else
              icon="mdi-bullhorn"
            />
          </v-app-bar-nav-icon>
        </div>
      </div>
    </v-app-bar>

    <v-navigation-drawer
      v-model="drawerMenu"
      temporary
    >
      <v-list>
        <v-list-item :to="{ name: 'index' }">
          <v-icon icon="mdi-home" /> Home
        </v-list-item>
        <v-list-item :to="{ name: 'new-game' }">
          <v-icon icon="mdi-puzzle" /> New Game
        </v-list-item>
        <v-list-item :to="{ name: 'bug-reports' }">
          <v-icon icon="mdi-bug" /> Bug Reports
        </v-list-item>
        <v-list-item :to="{ name: 'feature-requests' }">
          <v-icon icon="mdi-shimmer" /> Feature Requests
        </v-list-item>
        <v-list-item
          href="https://discord.gg/uFGXRdUXxU"
          target="_blank"
        >
          <v-icon icon="mdi-chat-outline" /> Discord
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-navigation-drawer
      v-model="drawerUser"
      location="right"
      temporary
    >
      <v-list>
        <v-list-item
          v-if="me?.groups.includes('admin')"
          :to="{ name: 'admin' }"
        >
          <v-icon icon="mdi-security" /> Admin
        </v-list-item>
        <v-list-item @click="doLogout">
          <v-icon icon="mdi-logout" /> Logout
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-navigation-drawer
      v-model="drawerAnnouncements"
      class="announcements-drawer text-body-2"
      location="right"
      temporary
      width="400"
    >
      <v-list class="pa-0">
        <v-list-item
          v-for="(announcement, idx) in announcements.announcements()"
          :key="idx"
          class="pt-3 pb-3 pl-5 pr-5"
        >
          <div class="d-flex justify-space-between mb-2">
            <span class="font-weight-bold">
              <span
                v-if="new Date(announcement.created).getTime() > lastSeenAnnouncement"
                class="text-red-darken-2"
              >
                NEW
              </span>
              {{ announcement.title }}
            </span>
            <span><v-icon icon="mdi-calendar" /> {{ dateformat('YYYY-MM-DD hh:mm', new Date(announcement.created)) }}</span>
          </div>
          <div
            v-for="(line, idx2) of announcement.message.split('\n')"
            :key="idx2"
          >
            {{ line }}
          </div>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import user, { User } from '../user'
import announcements from '../announcements'
import { dateformat } from '../../../common/src/Util'
import storage from '../storage'

const login = () => {
  user.eventBus.emit('triggerLoginDialog')
}

const route = useRoute()
const showNav = computed(() => {
  // TODO: add info wether to show nav to route props
  return !['game', 'replay'].includes(String(route.name))
})

const drawerMenu = ref<boolean>(false)
const drawerAnnouncements = ref<boolean>(false)
const drawerUser = ref<boolean>(false)

let lastSeenAnnouncement = storage.getInt('lastSeenAnnouncement', 0)
const allAnnouncements = announcements.announcements()
const lastAnnouncement = allAnnouncements.length ? new Date(allAnnouncements[0].created).getTime() : 0
let unseenAnnouncementCount = allAnnouncements.filter(a => new Date(a.created).getTime() > lastSeenAnnouncement).length
const toggleAnnouncements = () => {
  drawerAnnouncements.value = !drawerAnnouncements.value
}
watch(drawerAnnouncements, () => {
  if (!drawerAnnouncements.value) {
    lastSeenAnnouncement = lastAnnouncement
    unseenAnnouncementCount = 0
    storage.setInt('lastSeenAnnouncement', lastSeenAnnouncement)
  }
})

const me = ref<User|null>(null)

const loggedIn = computed(() => {
  return !!(me.value && me.value.type === 'user')
})

async function doLogout() {
  await user.logout()
}

const onInit = () => {
  me.value = user.getMe()
  if (!loggedIn.value) {
    drawerUser.value = false
  }
}

onMounted(() => {
  onInit()
  user.eventBus.on('login', onInit)
  user.eventBus.on('logout', onInit)
})

onBeforeUnmount(() => {
  user.eventBus.off('login', onInit)
  user.eventBus.off('logout', onInit)
})
</script>
