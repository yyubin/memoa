/**
 * 레벨/경험치 규칙 (순수 함수 — DB 없이 테스트 가능)
 *
 * EXP 는 복습 기록(review_logs)에서 나온다. 한 번 복습할 때마다 평가에 따라:
 *   다시(1) 4 · 어려움(2) 8 · 알맞음(3) 10 · 쉬움(4) 12
 * 틀려도 EXP 는 쌓인다 (복습한 것 자체가 공부니까).
 *
 * 레벨 곡선: 레벨 L → L+1 에 필요한 EXP = 100 × L
 *   → 레벨 L 에 도달하는 누적 EXP = 50 × L × (L − 1)
 *   Lv.2 = 100, Lv.3 = 300, Lv.4 = 600, Lv.5 = 1000, Lv.10 = 4500, Lv.20 = 19000 …
 */

export const EXP_BY_RATING: Record<1 | 2 | 3 | 4, number> = { 1: 4, 2: 8, 3: 10, 4: 12 }
export const MAX_LEVEL = 99

export function expForRating(rating: number): number {
  return EXP_BY_RATING[rating as 1 | 2 | 3 | 4] ?? 0
}

/** 평가별 복습 횟수 → 총 EXP */
export function expFromRatingCounts(counts: Partial<Record<1 | 2 | 3 | 4, number>>): number {
  let total = 0
  for (const r of [1, 2, 3, 4] as const) total += (counts[r] ?? 0) * EXP_BY_RATING[r]
  return total
}

/** 레벨 L 에 도달하기 위한 누적 EXP */
export function expToReach(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  return 50 * l * (l - 1)
}

export interface LevelInfo {
  level: number
  exp: number
  /** 현재 레벨 시작 EXP (진행 막대 왼쪽 라벨) */
  curLevelExp: number
  /** 다음 레벨 EXP (진행 막대 오른쪽 라벨). 만렙이면 curLevelExp 와 같다 */
  nextLevelExp: number
  /** 0 ~ 1 */
  progress: number
  maxed: boolean
}

export function levelFromExp(rawExp: number): LevelInfo {
  const exp = Number.isFinite(rawExp) ? Math.max(0, Math.floor(rawExp)) : 0
  let level = 1
  while (level < MAX_LEVEL && exp >= expToReach(level + 1)) level++
  const curLevelExp = expToReach(level)
  const maxed = level >= MAX_LEVEL
  const nextLevelExp = maxed ? curLevelExp : expToReach(level + 1)
  const progress = maxed ? 1 : (exp - curLevelExp) / (nextLevelExp - curLevelExp)
  return { level, exp, curLevelExp, nextLevelExp, progress, maxed }
}
