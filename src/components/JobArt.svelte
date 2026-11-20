<script lang="ts">
  /**
   * 직업 캐릭터 라인아트 (흑백, 굵은 외곽선).
   * 색은 --ink / --card 토큰을 써서 다크 모드에서 자동으로 반전된다.
   */
  import type { JobId } from '../lib/jobs'

  let {
    job,
    size = 280,
    sparkles = false,
    label = '',
  }: { job?: JobId | string; size?: number | string; sparkles?: boolean; label?: string } = $props()

  /** 마법진 둘레의 룬 글자 (작은 획 조합) */
  function runeRing(cx: number, cy: number, r: number, n: number) {
    let d = ''
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const x = +(cx + r * Math.cos(a)).toFixed(1)
      const y = +(cy + r * Math.sin(a)).toFixed(1)
      d += i % 2 ? `M${x - 3} ${y - 4} l6 4 l-6 4 ` : `M${x} ${y - 4} v8 M${x - 3} ${y - 1} l3 -3 l3 3 `
    }
    return d
  }

  /** 4갈래 반짝이 별 */
  function star(cx: number, cy: number, s: number) {
    const k = s * 0.16
    return `M${cx} ${cy - s} Q${cx + k} ${cy - k} ${cx + s} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + s} Q${cx - k} ${cy + k} ${cx - s} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - s} Z`
  }
</script>

<!--
  애니메이션 준비용 그룹 (모든 직업 공통 이름):
    .shadow      바닥 그림자 선
    .sparkle     반짝이 별 (기본으로 반짝임, reduced-motion 이면 정지)
    .body        몸통+다리 (기준점: 발 가운데)
    .head        머리/투구/모자 (기준점: 목)
    .eyes        눈 (깜빡임용, 기준점: 눈 가운데 → scaleY)
    .arm-weapon  무기 든 팔+무기 (기준점: 어깨, 직업별 style 로 지정)
    .arm-off     반대팔/방패/보조손 (기준점: 어깨)
    .fx          직업 효과 (기본 숨김: opacity 0)
  좌표는 viewBox "-20 0 280 270" 의 사용자 좌표 그대로 (translate 없음 → transform-origin px 가 곧 좌표).
-->
<svg
  class="art job-{job || 'none'}"
  width={size}
  viewBox="-20 0 280 270"
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}
>
  {#if sparkles}
    <g class="sparkles">
      <path class="ink sparkle s1" d={star(6, 66, 16)} />
      <path class="ink sparkle s2" d={star(32, 96, 7)} />
      <path class="ink sparkle s3" d={star(234, 206, 16)} />
      <path class="ink sparkle s4" d={star(214, 236, 7)} />
    </g>
  {/if}

  <g class="shadow">
    <path class="ln" d="M56 258 h44 M116 258 h60 M84 264 h26" stroke-width="3" />
  </g>

  {#if job === 'paladin'}
    <g class="body">
      <path class="pap" d="M100 192 L98 236 L116 236 L117 192 Z" />
      <path class="pap" d="M124 192 L126 236 L144 236 L142 192 Z" />
      <path class="ln" d="M101 208 h13 M127 208 h13" stroke-width="3" />
      <path class="ink" d="M96 232 h22 v10 h-30 q0 -10 8 -10 Z" />
      <path class="ink" d="M124 232 h22 q8 0 8 10 h-30 Z" />
      <path class="ink" d="M86 132 Q120 118 154 132 L158 198 L82 198 Z" />
      <path class="pap" d="M82 182 h76 v12 h-76 Z" />
      <path class="pap" d="M113 179 h14 v18 h-14 Z" />
    </g>
    <g class="arm-off" style="transform-origin: 92px 136px">
      <path class="pap" d="M44 128 L98 118 L102 166 Q92 196 70 212 Q48 192 44 160 Z" />
      <path class="ln" d="M71 124 L71 208 M46 150 L100 142" stroke-width="3" />
      <path class="ln" d="M52 168 l10 -10 M54 182 l14 -14 M60 194 l8 -8" stroke-width="2.5" />
      <g class="fx">
        <path class="ln" d="M52 136 l12 -2 M54 144 l8 -1.5" stroke-width="3" />
        <path class="ink nos" d={star(36, 124, 10)} />
        <path class="ink nos" d={star(30, 150, 5)} />
      </g>
    </g>
    <g class="head">
      <path class="pap" d="M98 98 Q102 130 120 136 Q138 130 142 98 Z" />
      <path class="ln" d="M109 108 q-2 8 0 14 M120 110 q-2 10 0 18 M131 108 q2 8 0 14" stroke-width="3" />
      <path class="ink" d="M116 44 Q116 16 150 12 Q140 22 144 30 Q130 30 128 44 Z" />
      <rect class="pap" x="90" y="40" width="60" height="64" rx="16" />
      <rect class="ink" x="95" y="62" width="50" height="14" rx="4" />
      <g class="eyes">
        <circle class="pap nos" cx="108" cy="69" r="3" />
        <circle class="pap nos" cx="132" cy="69" r="3" />
      </g>
      <path class="ln" d="M120 42 v18 M102 88 h6 M102 95 h6 M132 88 h6 M132 95 h6" stroke-width="3" />
    </g>
    <g class="arm-weapon" style="transform-origin: 150px 134px">
      <g transform="rotate(40 172 146)">
        <path class="pap" d="M165 152 h14 v110 l-7 13 l-7 -13 Z" />
        <path class="ln" d="M172 160 v96" stroke-width="2.5" />
        <rect class="ink" x="146" y="140" width="52" height="12" rx="5" />
        <rect class="pap" x="166" y="108" width="12" height="32" rx="3" />
        <circle class="pap" cx="172" cy="100" r="8" />
      </g>
      <path class="ink" d="M146 130 Q166 122 182 118 L188 138 Q168 146 150 154 Z" />
      <circle class="pap" cx="187" cy="129" r="10" />
    </g>
  {:else if job === 'gunner'}
    <g class="body">
      <!-- 코트 자락 (바람에 날림) -->
      <path class="ink" d="M88 140 Q66 196 50 236 L80 230 L98 204 Z" />
      <path class="ink" d="M152 140 Q176 196 194 232 L162 228 L142 204 Z" />
      <path class="pap" d="M100 196 L98 234 L116 234 L117 196 Z" />
      <path class="pap" d="M124 196 L126 234 L144 234 L142 196 Z" />
      <path class="ink" d="M96 226 h20 v16 h-28 q0 -10 8 -10 Z" />
      <path class="ink" d="M126 226 h20 v6 q8 0 8 10 h-28 Z" />
      <path class="ln" d="M98 214 h18 M126 214 h18" stroke-width="3" />
      <!-- 롱코트 -->
      <path class="ink" d="M86 128 Q120 116 154 128 L150 206 L90 206 Z" />
      <path class="pap" d="M110 126 L120 172 L130 126 Z" />
      <!-- 탄띠 -->
      <path class="pap" d="M94 134 L150 190 L144 197 L88 141 Z" />
      <path class="ln" d="M100 148 l6 -6 M111 159 l6 -6 M122 170 l6 -6 M133 181 l6 -6" stroke-width="3" />
      <path class="ink" d="M88 190 h64 v10 h-64 Z" />
      <rect class="pap" x="113" y="187" width="14" height="16" rx="3" />
      <!-- 허리 권총집 -->
      <path class="pap" d="M150 194 h12 l2 26 l-14 2 Z" />
      <path class="ink nos" d="M152 190 h10 v8 h-10 Z" />
      <!-- 깃 + 목도리 -->
      <path class="pap" d="M96 116 L106 136 L120 126 Z" />
      <path class="pap" d="M144 116 L134 136 L120 126 Z" />
      <path class="ink" d="M100 114 Q120 126 140 114 L142 124 Q120 138 98 124 Z" />
      <path class="ink" d="M100 122 Q80 130 56 126 Q66 138 98 134 Z" />
      <path class="ink" d="M98 128 Q78 142 60 146 Q76 150 100 136 Z" />
    </g>
    <g class="head">
      <circle class="pap" cx="120" cy="99" r="23" />
      <!-- 옆으로 넘긴 뾰족 머리 (앞머리는 눈썹 위까지) -->
      <path class="ink" d="M96 98 Q91 66 116 60 L110 46 L128 55 L138 42 L141 59 L158 56 L149 70 Q156 82 149 96 Q145 84 136 80 L130 88 L122 80 L112 88 L102 84 Q98 90 96 98 Z" />
      <!-- 머리 위로 올린 고글 -->
      <path class="ink" d="M97 72 Q120 58 147 66 L146 74 Q120 66 98 80 Z" />
      <circle class="pap" cx="112" cy="68" r="7" />
      <circle class="pap" cx="133" cy="64" r="7" />
      <path class="ln" d="M109 65 l4 4 M130 61 l4 4" stroke-width="2" />
      <g class="eyes">
        <path class="ink nos" d="M105 100 L117 98 L116 104 Z" />
        <path class="ink nos" d="M135 100 L123 98 L124 104 Z" />
      </g>
      <path class="ln" d="M105 93 l11 -1 M135 93 l-11 -1" stroke-width="3" />
      <path class="ln" d="M114 112 q6 3 12 -2" stroke-width="2.5" />
    </g>
    <g class="arm-weapon" style="transform-origin: 90px 138px">
      <g transform="rotate(-35 120 170)">
        <!-- 저격 소총 -->
        <path class="ink" d="M42 160 L10 152 L4 170 L12 186 L46 176 Z" />
        <path class="ln paps" d="M14 168 h22" stroke-width="2.5" />
        <rect class="ink" x="44" y="157" width="72" height="19" rx="3" />
        <path class="ln paps" d="M52 167 h56" stroke-width="2.5" />
        <rect class="pap" x="114" y="163" width="76" height="8" rx="2" />
        <rect class="ink" x="186" y="159" width="14" height="16" rx="2" />
        <path class="ln" d="M192 159 v16" stroke-width="2" />
        <rect class="pap" x="70" y="143" width="48" height="11" rx="5" />
        <rect class="ink" x="66" y="144" width="7" height="9" rx="2" />
        <rect class="ink" x="115" y="144" width="7" height="9" rx="2" />
        <path class="ln" d="M84 154 v4 M104 154 v4" stroke-width="3" />
        <path class="ink" d="M62 176 L56 196 L67 198 L74 176 Z" />
        <path class="ink" d="M86 176 L84 192 L96 192 L98 176 Z" />
        <g class="fx">
          <path class="ink" d="M200 168 L214 156 L212 164 L228 160 L216 170 L230 178 L212 174 L214 184 Z" />
          <circle class="pap" cx="232" cy="150" r="7" />
          <circle class="pap" cx="244" cy="138" r="5" />
          <circle class="pap" cx="252" cy="126" r="3.5" />
        </g>
      </g>
      <path class="ln" d="M90 138 Q98 168 113 180" stroke-width="16" />
      <circle class="pap" cx="115" cy="181" r="9" />
    </g>
    <g class="arm-off" style="transform-origin: 150px 136px">
      <path class="ln" d="M150 136 Q154 144 154 150" stroke-width="16" />
      <circle class="pap" cx="155" cy="151" r="9" />
    </g>
  {:else if job === 'spellblade'}
    <!-- 뒤에서 천천히 도는 마법진 -->
    <g class="magic">
      <circle class="ln dash" cx="120" cy="150" r="104" stroke-width="2.5" />
      <circle class="ln" cx="120" cy="150" r="92" stroke-width="2" />
      <path class="ln" d={runeRing(120, 150, 98, 10)} stroke-width="2" />
    </g>
    <g class="body">
      <!-- 망토 -->
      <path class="ink" d="M90 126 Q52 190 48 244 Q84 232 120 242 Q156 232 192 244 Q190 190 150 126 Z" />
      <path class="ln paps" d="M62 236 l8 -8 l8 8 M164 236 l8 -8 l8 8" stroke-width="2.5" />
      <path class="pap" d="M102 196 L100 234 L116 234 L117 196 Z" />
      <path class="pap" d="M124 196 L125 234 L141 234 L139 196 Z" />
      <path class="ink" d="M96 228 h20 v14 h-28 q0 -10 8 -10 Z" />
      <path class="ink" d="M125 228 h18 v4 q8 0 8 10 h-26 Z" />
      <!-- 룬 문양 갑옷 -->
      <path class="pap" d="M88 132 Q120 120 152 132 L156 204 L84 204 Z" />
      <path class="ink" d="M108 138 L132 138 L128 204 L112 204 Z" />
      <path class="pap" d="M120 148 l9 13 l-9 13 l-9 -13 Z" />
      <circle class="ink nos" cx="120" cy="161" r="3" />
      <path class="ink" d="M84 188 h72 v9 h-72 Z" />
      <ellipse class="pap" cx="88" cy="136" rx="14" ry="9" />
      <path class="ink" d="M138 124 Q168 114 172 140 L160 146 Q152 134 140 138 Z" />
      <path class="ink" d="M104 116 L120 128 L136 116 L138 126 L120 136 L102 126 Z" />
    </g>
    <g class="head">
      <path class="ink" d="M96 92 Q86 114 92 132 Q100 116 103 98 Z" />
      <circle class="pap" cx="120" cy="96" r="23" />
      <path class="ink" d="M95 100 Q88 64 118 57 Q152 58 148 96 L142 80 L135 90 L128 72 L118 87 L109 75 L101 92 Z" />
      <!-- 서클릿 + 보석 -->
      <path class="ln" d="M97 84 Q120 76 143 84" stroke-width="3" />
      <path class="pap" d="M120 72 l6 8 l-6 8 l-6 -8 Z" />
      <circle class="ink nos" cx="120" cy="80" r="2" />
      <g class="eyes">
        <circle class="ink nos" cx="111" cy="100" r="3" />
        <circle class="pap" cx="129" cy="100" r="3.5" stroke-width="2.5" />
      </g>
      <!-- 마력이 깃든 눈 -->
      <path class="ln" d="M129 108 v6 M126 111 h6 M136 96 l4 -3" stroke-width="2" />
      <path class="ln" d="M104 93 l9 2 M136 92 l-9 2 M115 111 h10" stroke-width="3" />
    </g>
    <g class="arm-off" style="transform-origin: 88px 136px">
      <path class="pap" d="M80 134 L96 140 L88 170 L72 166 Z" />
      <circle class="pap" cx="79" cy="171" r="9" />
      <!-- 손 위의 마력 불꽃 -->
      <path class="ink" d="M70 160 Q54 146 64 126 Q66 138 74 138 Q70 124 84 112 Q84 132 92 138 Q98 152 86 162 Z" />
      <path class="pap" d="M76 156 Q68 148 75 136 Q79 146 84 148 Q86 157 76 156 Z" />
      <rect class="pap" x="50" y="124" width="7" height="7" transform="rotate(45 53.5 127.5)" />
      <rect class="pap" x="96" y="118" width="6" height="6" transform="rotate(45 99 121)" />
    </g>
    <g class="arm-weapon" style="transform-origin: 150px 132px">
      <g transform="rotate(25 172 150)">
        <!-- 룬이 새겨진 마검 -->
        <path class="ln" d="M186 126 q9 -12 2 -24 q10 -10 3 -24 q8 -8 2 -20 M158 110 q-8 -10 -2 -22 q-8 -10 0 -22" stroke-width="2.5" />
        <path class="pap" d="M162 140 V46 L172 18 L182 46 V140 Z" />
        <path class="ink" d="M169.5 134 V52 L172 46 L174.5 52 V134 Z" />
        <path class="ln" d="M164 122 l4 -4 M164 104 h4 M180 114 l-4 -4 M180 88 h-4 M164 74 l4 4 M180 62 l-4 4" stroke-width="2" />
        <path class="ink" d="M144 140 Q172 130 200 140 L195 151 Q172 144 149 151 Z" />
        <path class="pap" d="M172 136 l7 8 l-7 8 l-7 -8 Z" />
        <rect class="pap" x="167" y="151" width="10" height="25" rx="3" />
        <path class="pap" d="M172 176 l6 6 l-6 7 l-6 -7 Z" />
        <g class="fx">
          <path class="ln" d="M156 52 h-8 M188 52 h8 M156 84 h-10 M188 84 h10 M156 116 h-8 M188 116 h8" stroke-width="3" />
        </g>
      </g>
      <g class="fx">
        <path class="ink nos" d={star(214, 62, 9)} />
        <path class="ink nos" d={star(234, 92, 5)} />
        <path class="ink nos" d={star(196, 28, 5)} />
      </g>
      <path class="pap" d="M144 132 L158 130 L174 156 L160 166 Z" />
      <circle class="pap" cx="167" cy="161" r="9" />
    </g>
  {:else if job === 'witch'}
    <g class="arm-weapon" style="transform-origin: 136px 130px">
      <path class="pap" d="M176 60 L182 60 L184 212 L178 212 Z" />
      <path class="pap" d="M168 214 L194 214 L206 250 Q181 257 156 250 Z" />
      <path class="ln" d="M174 222 l-6 26 M181 222 v28 M188 222 l6 26" stroke-width="2.5" />
      <rect class="ink" x="166" y="206" width="30" height="10" rx="3" />
      <path class="ink" d="M136 128 Q160 134 172 138 L172 154 Q152 150 132 146 Z" />
      <circle class="pap" cx="180" cy="146" r="9" />
    </g>
    <g class="body">
      <path class="ink" d="M100 124 Q120 116 140 124 L162 236 Q120 246 78 236 Z" />
      <path class="ln paps" d="M84 228 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6" stroke-width="3" />
      <path class="ink" d="M90 248 Q96 238 116 240 L116 248 Z" />
      <path class="ink" d="M124 240 Q144 238 152 248 L124 248 Z" />
    </g>
    <g class="head">
      <path class="ink" d="M94 90 Q84 140 94 164 L146 164 Q156 140 146 90 Z" />
      <path class="pap" d="M106 124 L120 142 L134 124 Z" />
      <circle class="pap" cx="120" cy="98" r="22" />
      <path class="ink" d="M98 94 Q100 76 120 76 Q140 76 142 94 Q132 84 120 88 Q108 84 98 94 Z" />
      <g class="eyes">
        <circle class="ink nos" cx="111" cy="101" r="3" />
        <circle class="ink nos" cx="129" cy="101" r="3" />
      </g>
      <path class="ln" d="M115 110 q5 4 10 0" stroke-width="3" />
      <ellipse class="pap" cx="120" cy="78" rx="52" ry="9" />
      <path class="ink" d="M96 76 Q112 52 114 20 Q132 6 162 26 Q142 26 138 34 Q140 56 146 76 Z" />
      <path class="pap" d="M100 66 Q121 60 142 66 L144 73 Q121 67 98 73 Z" />
      <rect class="ink" x="114" y="63" width="12" height="9" rx="2" />
      <path class="pap nos" d={star(124, 44, 5)} />
    </g>
    <g class="arm-off" style="transform-origin: 104px 130px">
      <path class="ink" d="M104 128 Q82 146 76 168 L92 172 Q98 156 110 144 Z" />
      <rect class="pap" x="77" y="134" width="12" height="12" rx="2" />
      <rect class="ink" x="75" y="128" width="16" height="7" rx="2" />
      <circle class="pap" cx="83" cy="158" r="14" />
      <path class="ink" d="M69.5 160 Q83 153 96.5 160 A14 14 0 0 1 69.5 160 Z" />
      <circle class="pap nos" cx="79" cy="164" r="2" />
      <circle class="pap nos" cx="87" cy="166" r="1.5" />
      <circle class="pap" cx="84" cy="176" r="9" />
      <path class="ink nos" d={star(62, 138, 7)} />
      <g class="fx">
        <circle class="pap" cx="80" cy="118" r="4" />
        <circle class="pap" cx="90" cy="104" r="3" />
        <circle class="pap" cx="78" cy="92" r="2.5" />
        <path class="ink nos" d={star(100, 118, 6)} />
      </g>
    </g>
  {:else}
    <!-- 직업 미선택 -->
    <circle class="ln dash" cx="120" cy="140" r="78" stroke-width="4" />
    <text class="q" x="120" y="172" text-anchor="middle">?</text>
  {/if}
</svg>

<style>
  .art {
    display: block; height: auto; max-width: 100%; overflow: visible;
    stroke: var(--ink); stroke-width: 4; stroke-linejoin: round; stroke-linecap: round;
  }
  .ink { fill: var(--ink); }
  .pap { fill: var(--card); }
  .ln { fill: none; }
  .ln.paps { stroke: var(--card); }
  .nos { stroke: none; }
  .dash { stroke-dasharray: 10 12; }
  .q { font-family: var(--font-title); font-size: 96px; fill: var(--ink); }

  /* 애니메이션 기준점 */
  .body { transform-box: fill-box; transform-origin: 50% 100%; }
  .head { transform-box: fill-box; transform-origin: 50% 100%; }
  .eyes { transform-box: fill-box; transform-origin: center; }
  /* 팔은 어깨 좌표(각 그룹 style 의 transform-origin, 사용자 좌표 px) 기준 */
  .arm-weapon, .arm-off { transform-box: view-box; }
  .fx { opacity: 0; }
  .magic { transform-box: fill-box; transform-origin: center; animation: magic-spin 48s linear infinite; }
  @keyframes magic-spin { to { transform: rotate(360deg); } }

  .sparkle { transform-box: fill-box; transform-origin: center; animation: twinkle 2.8s ease-in-out infinite; }
  .s2 { animation-delay: -.7s; }
  .s3 { animation-delay: -1.4s; }
  .s4 { animation-delay: -2.1s; }
  @keyframes twinkle {
    0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
    50% { transform: scale(.6) rotate(20deg); opacity: .55; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sparkle, .magic { animation: none; }
  }
</style>
