<template>
  <HalliGalliView v-bind="$attrs" />
</template>

<script setup>
import HalliGalliView from '../../components/games/HalliGalliView.vue';

defineOptions({ inheritAttrs: false });
</script>
