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
            src="./../assets/gfx/icon.png"
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
          <v-switch
            class="mr-1"
            :model-value="showNsfw"
            hide-details
            label="Show All NSFW"
            @update:model-value="toggleNsfw"
          />
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
          <AnnouncementsIcon
            @click.stop="drawerAnnouncements = !drawerAnnouncements"
          />
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
    <AnnouncementsDrawer
      :visible="drawerAnnouncements"
      @close="drawerAnnouncements = false"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import user, { useNsfw, User } from '../user'
import AnnouncementsDrawer from './AnnouncementsDrawer.vue'
import AnnouncementsIcon from './AnnouncementsIcon.vue'

const login = () => {
  user.eventBus.emit('triggerLoginDialog')
}

const { showNsfw, toggleNsfw } = useNsfw()

const route = useRoute()
const showNav = computed(() => {
  // TODO: add info wether to show nav to route props
  return !['game', 'replay'].includes(String(route.name))
})

const drawerMenu = ref<boolean>(false)
const drawerAnnouncements = ref<boolean>(false)
const drawerUser = ref<boolean>(false)

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
