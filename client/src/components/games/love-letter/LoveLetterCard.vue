<template>
  <button
    v-if="interactive"
    type="button"
    class="role-card"
    :class="[`role-${card?.character || 'back'}`, { selected, disabled }]"
    :disabled="disabled"
    :aria-pressed="selected"
    @click="$emit('select', card)"
  >
    <CardContent :card="card" :compact="compact" />
  </button>
  <article v-else class="role-card" :class="[`role-${card?.character || 'back'}`, { compact }]">
    <CardContent :card="card" :compact="compact" />
  </article>
</template>

<script setup>
import { defineComponent, h } from 'vue';

defineProps({
  card: { type: Object, default: null },
  interactive: Boolean,
  selected: Boolean,
  disabled: Boolean,
  compact: Boolean,
});
defineEmits(['select']);

const labels = {
  spy: ['첩자', '사용하거나 버리고 살아남은 유일한 첩자라면 호감 토큰 +1'],
  guard: ['경비병', '상대의 인물을 맞히면 그 플레이어가 탈락'],
  priest: ['성직자', '상대 한 명의 손패를 나만 확인'],
  baron: ['남작', '상대와 손패를 비교해 낮은 쪽이 탈락'],
  handmaid: ['시녀', '다음 내 차례까지 다른 효과로부터 보호'],
  prince: ['왕자', '한 명이 손패를 버리고 새 카드를 뽑음'],
  chancellor: ['재상', '두 장을 더 보고 한 장만 남김'],
  king: ['왕', '상대 한 명과 손패를 교환'],
  countess: ['백작부인', '왕 또는 왕자와 함께라면 반드시 사용'],
  princess: ['공주', '이 카드를 사용하거나 버리면 즉시 탈락'],
};

const CardContent = defineComponent({
  props: { card: Object, compact: Boolean },
  setup(props) {
    return () => {
      if (!props.card?.id) return h('div', { class: 'card-back-content' }, [h('strong', 'OBGC'), h('span', 'LOVE LETTER')]);
      const [name, copy] = labels[props.card.character] || ['인물', ''];
      return h('div', { class: 'card-content' }, [
        h('div', { class: 'card-value' }, String(props.card.value)),
        h('div', { class: 'portrait', 'aria-hidden': 'true' }, name.slice(0, 1)),
        h('div', { class: 'card-name' }, [h('strong', name), h('span', String(props.card.value))]),
        props.compact ? null : h('p', copy),
      ]);
    };
  },
});
</script>

<style scoped>
.role-card { width: 156px; height: 218px; position: relative; display: block; padding: 0; overflow: hidden; border: 1px solid #d9d6d1; border-radius: 10px; background: #fff; color: #262421; box-shadow: 0 9px 26px rgba(35,31,27,.09); text-align: left; }
button.role-card { cursor: pointer; transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
button.role-card:hover:not(:disabled) { transform: translateY(-5px); border-color: #3568b8; box-shadow: 0 14px 32px rgba(35,31,27,.14); }
.role-card.selected { transform: translateY(-8px); border: 2px solid #3568b8; box-shadow: 0 14px 30px rgba(53,104,184,.18); }
.role-card.disabled { opacity: .48; cursor: not-allowed; }
.role-card.compact { width: 94px; height: 132px; border-radius: 7px; box-shadow: 0 5px 14px rgba(35,31,27,.08); }
.card-content { height: 100%; display: grid; grid-template-rows: auto 1fr auto auto; padding: 11px; background: linear-gradient(160deg, color-mix(in srgb, var(--role-tone,#8a8178) 8%, white), white 54%); }
.card-value { font: 800 20px/1 ui-monospace, monospace; color: var(--role-tone,#69635d); }
.portrait { width: 72px; height: 72px; place-self: center; display: grid; place-items: center; border: 1px solid color-mix(in srgb,var(--role-tone,#8a8178) 28%,white); border-radius: 50%; background: color-mix(in srgb,var(--role-tone,#8a8178) 10%,white); color: var(--role-tone,#69635d); font: 700 26px/1 serif; }
.card-name { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #ebe8e4; padding-top: 8px; }
.card-name strong { font-size: 14px; }
.card-name span { color: #8a8580; font: 700 11px/1 ui-monospace, monospace; }
.card-content p { min-height: 36px; margin: 7px 0 0; color: #77716b; font-size: 9px; line-height: 1.35; }
.compact .card-content { padding: 7px; }
.compact .card-value { font-size: 13px; }
.compact .portrait { width: 42px; height: 42px; font-size: 16px; }
.compact .card-name { padding-top: 5px; }
.compact .card-name strong { font-size: 10px; }
.role-spy { --role-tone:#59606b; } .role-guard { --role-tone:#3f6e9d; } .role-priest { --role-tone:#6b5f9b; }
.role-baron { --role-tone:#8a613c; } .role-handmaid { --role-tone:#4b8a72; } .role-prince { --role-tone:#456eb2; }
.role-chancellor { --role-tone:#716096; } .role-king { --role-tone:#a27027; } .role-countess { --role-tone:#9b516d; } .role-princess { --role-tone:#b4234e; }
.role-back { background: #34302d; color: white; }
.card-back-content { height: 100%; display: grid; place-content: center; gap: 8px; text-align: center; }
.card-back-content::before { content:''; position:absolute; inset:9px; border:1px solid rgba(255,255,255,.2); border-radius:5px; }
.card-back-content strong { font: 800 14px/1 ui-monospace,monospace; letter-spacing:.12em; }.card-back-content span { color:#bbb4ad; font-size:8px; letter-spacing:.16em; }
@media (max-width: 560px) { .role-card { width: 136px; height: 190px; } }
</style>
