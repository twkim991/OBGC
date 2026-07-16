<template>
  <YutnoriView v-bind="$attrs" />
</template>

<script setup>
import YutnoriView from '../../components/games/YutnoriView.vue';

defineOptions({ inheritAttrs: false });
</script>
