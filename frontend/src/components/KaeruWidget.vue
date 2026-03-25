<template>
  <v-container
    :fluid="true"
    :class="`kaeru-${board}-view p-0`"
  >
    <v-card>
      <v-tabs :model-value="board">
        <v-tab
          :to="{ name: 'bug-reports' }"
          value="bug-reports"
        >
          Bug Reports
        </v-tab>
        <v-tab
          :to="{ name: 'feature-requests' }"
          value="feature-requests"
        >
          Feature Requests
        </v-tab>
      </v-tabs>
      <v-container :fluid="true">
        <div id="kaeru-widget" />
      </v-container>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { me, onLoginStateChange } from '../user'
import conf from '../config'

const props = defineProps<{
  board: string,
  appMountPath: string,
  project: string,
}>()

const onInit = () => {
  // @ts-ignore
  if (typeof window.kaeru === 'undefined') {
    return
  }
  // @ts-ignore
  window.kaeru.render({
    project: props.project,
    board: props.board,
    ssoToken: me.value?.kaeruToken ?? null,
    appMountPath: props.appMountPath,
    theme: { accent: '#2196f3', radius: '0px', 'avatar-radius': '0px' },
  })
}

let offLoginStateChange: () => void = () => {}
onMounted(() => {
  const kaeruBaseUrl = conf.get().kaeruBaseUrl
  const scriptId = 'kaeru-sdk'
  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script')
    script.id = scriptId
    script.src = `${kaeruBaseUrl}/widget/sdk.js`
    script.dataset.kaeruBaseUrl = kaeruBaseUrl
    script.async = true
    script.onload = () => onInit()
    document.head.appendChild(script)
  } else {
    onInit()
  }
  offLoginStateChange = onLoginStateChange(onInit)
})

onUnmounted(() => {
  offLoginStateChange()
})
</script>
