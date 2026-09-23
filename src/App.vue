<script setup>
import Navbar from './components/Navbar.vue'
import Toast from './components/Toast.vue'
</script>

<template>
  <div class="min-h-screen text-slate-800">
    <Navbar />
    <Toast />
    <router-view />
  </div>
</template>
