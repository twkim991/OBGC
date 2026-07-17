<template>
  <LoveLetterView v-bind="$attrs" />
</template>

<script setup>
import LoveLetterView from '../../components/games/LoveLetterView.vue';
defineOptions({ inheritAttrs: false });
</script>
