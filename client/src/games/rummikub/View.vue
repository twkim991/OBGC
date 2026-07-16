<template>
  <RummikubView v-bind="$attrs" />
</template>

<script setup>
import RummikubView from '../../components/games/RummikubView.vue';

defineOptions({ inheritAttrs: false });
</script>

