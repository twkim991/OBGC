<template>
  <DavinciCodeView v-bind="$attrs" />
</template>

<script setup>
import DavinciCodeView from '../../components/games/DavinciCodeView.vue';

defineOptions({ inheritAttrs: false });
</script>
