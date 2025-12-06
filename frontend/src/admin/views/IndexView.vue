<template>
  <v-container>
    <Nav v-if="loggedIn" />
    <LoginForm v-if="!loggedIn" />
  </v-container>
</template>
<script setup lang="ts">
import { loggedIn } from '../../user'
import Nav from '../components/Nav.vue'
import LoginForm from '../../components/LoginForm.vue'
</script>
