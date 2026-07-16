<template>
  <MapleOneCardView v-bind="$attrs" />
</template>

<script setup>
import MapleOneCardView from '../../components/games/MapleOneCardView.vue';

defineOptions({ inheritAttrs: false });
</script>
