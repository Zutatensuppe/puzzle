<template>
  <Nav @show-login="showLogin = true;" />
  <v-container :fluid="true" class="new-game-view p-0">
    <v-card>
      <v-tabs>
        <v-tab :to="{ name: 'bug-reports' }">Bug Reports</v-tab>
        <v-tab :to="{ name: 'feature-requests' }">Feature Requests</v-tab>
      </v-tabs>
      <v-container :fluid="true">
        <div data-canny />
      </v-container>
    </v-card>
  </v-container>
  <LoginDialog v-if="showLogin" v-model="showLogin" @close="showLogin=false" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import LoginDialog from '../components/LoginDialog.vue';
import Nav from '../components/Nav.vue';
import user, { User } from '../user'

const me = ref<User|null>(null)
const showLogin = ref<boolean>(false);

const rerender = () => {
  const iframe = document.getElementById('canny-iframe')
  if (iframe) {
    iframe.parentElement?.removeChild(iframe)
  }
  Canny('render', {
    boardToken: 'c696a91d-e81a-7036-13b4-4971012a6d48',
    basePath: null, // See step 2
    ssoToken: me.value && me.value.cannyToken ? me.value.cannyToken : null,
  });
}

onMounted(() => {
  (function(w,d,i,s){function l(){if(!d.getElementById(i)){var f=d.getElementsByTagName(s)[0],e=d.createElement(s);e.type="text/javascript",e.async=!0,e.src="https://canny.io/sdk.js",f.parentNode.insertBefore(e,f)}}if("function"!=typeof w.Canny){var c=function(){c.q.push(arguments)};c.q=[],w.Canny=c,"complete"===d.readyState?l():w.attachEvent?w.attachEvent("onload",l):w.addEventListener("load",l,!1)}})(window,document,"canny-jssdk","script");
  me.value = user.getMe()
  rerender()
  user.eventBus.on('login', () => {
    me.value = user.getMe()
    showLogin.value = false
    rerender()
  })
  user.eventBus.on('logout', () => {
    me.value = user.getMe()
    rerender()
  })
})
</script>
