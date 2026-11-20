<script lang="ts">
  /** 메모아 마스코트: 단어를 모으는 고양이 '모아' */
  let { size = 56, mood = 'happy', wiggle = true }: { size?: number; mood?: 'happy' | 'wow' | 'sad' | 'sleep'; wiggle?: boolean } = $props()
</script>

<svg class:wiggle width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
  <!-- 귀 -->
  <path d="M10 30 L12 6 L28 18 Z" fill="#FFC27A" stroke="#4A3B36" stroke-width="3" stroke-linejoin="round" />
  <path d="M54 30 L52 6 L36 18 Z" fill="#FFC27A" stroke="#4A3B36" stroke-width="3" stroke-linejoin="round" />
  <path d="M14 22 L15 12 L22 17 Z" fill="#FF9E9E" />
  <path d="M50 22 L49 12 L42 17 Z" fill="#FF9E9E" />
  <!-- 얼굴 -->
  <ellipse cx="32" cy="37" rx="25" ry="21" fill="#FFC27A" stroke="#4A3B36" stroke-width="3" />
  <!-- 이마 줄무늬 -->
  <path d="M28 18 v5 M32 17 v6 M36 18 v5" stroke="#E8975A" stroke-width="2.5" stroke-linecap="round" />
  <ellipse cx="32" cy="46" rx="11" ry="8" fill="#FFF3E6" />
  <ellipse cx="16" cy="42" rx="5" ry="3.5" fill="#FF9E9E" opacity=".75" />
  <ellipse cx="48" cy="42" rx="5" ry="3.5" fill="#FF9E9E" opacity=".75" />
  <!-- 수염 -->
  <path d="M4 38 h9 M5 44 l8 -2 M60 38 h-9 M59 44 l-8 -2" stroke="#4A3B36" stroke-width="2" stroke-linecap="round" />
  <!-- 코 -->
  <path d="M30 40 h4 l-2 2.5 z" fill="#FF7B9C" stroke="#4A3B36" stroke-width="1.5" stroke-linejoin="round" />
  {#if mood === 'sleep'}
    <path d="M19 33 q4 3 8 0 M37 33 q4 3 8 0" fill="none" stroke="#4A3B36" stroke-width="2.5" stroke-linecap="round" />
    <path d="M28 46 q4 2 8 0" fill="none" stroke="#4A3B36" stroke-width="2" stroke-linecap="round" />
  {:else if mood === 'sad'}
    <circle cx="23" cy="33" r="3" fill="#4A3B36" />
    <circle cx="41" cy="33" r="3" fill="#4A3B36" />
    <path d="M28 48 q4 -3 8 0" fill="none" stroke="#4A3B36" stroke-width="2.5" stroke-linecap="round" />
  {:else if mood === 'wow'}
    <circle cx="23" cy="33" r="3.8" fill="#4A3B36" />
    <circle cx="41" cy="33" r="3.8" fill="#4A3B36" />
    <circle cx="24.3" cy="31.7" r="1.3" fill="#fff" />
    <circle cx="42.3" cy="31.7" r="1.3" fill="#fff" />
    <ellipse cx="32" cy="47.5" rx="2.5" ry="3" fill="#4A3B36" />
  {:else}
    <circle cx="23" cy="33" r="3" fill="#4A3B36" />
    <circle cx="41" cy="33" r="3" fill="#4A3B36" />
    <circle cx="24" cy="32" r="1" fill="#fff" />
    <circle cx="42" cy="32" r="1" fill="#fff" />
    <path d="M27 44 q2.5 3 5 0 q2.5 3 5 0" fill="none" stroke="#4A3B36" stroke-width="2.2" stroke-linecap="round" />
  {/if}
</svg>

<style>
  svg { flex: none; }
</style>
