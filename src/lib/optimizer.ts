/**
 * FSRS 개인 최적화: 내 복습 기록으로 FSRS-7 매개변수를 다시 학습한다 (Anki의 "Optimize" 와 같은 일).
 * Rust 로 된 fsrs-rs 를 WASM 으로 브라우저에서 돌린다. 서버로 기록을 보내지 않음.
 * 브라우저에서 WASM 스레드를 쓰려면 페이지가 cross-origin isolated 여야 함 (COOP/COEP 헤더).
 */
import { reviewHistory, updateSettings, type HistoryRow } from './api'
import { FSRS7_PARAM_COUNT, setUserWeights } from './fsrs'
import type { FsrsPersonal } from './types'

/** 이보다 적으면 최적화 결과가 오히려 나빠지기 쉬움 */
export const MIN_REVIEWS = 400

export interface OptimizeResult {
  applied: boolean
  reviewCount: number
  logLossDefault: number
  logLossOptimized: number
  settings?: FsrsPersonal
}

/** 카드 상태 → Anki revlog 의 review_state (0 learn, 1 review, 2 relearn) */
function revlogState(prevState: number | null): number {
  if (prevState === 2) return 1
  if (prevState === 3) return 2
  return 0
}

/** 복습 기록 → fsrs-rs 가 읽는 Anki revlog 형식 CSV */
export function historyToCsv(rows: HistoryRow[]): string {
  const ids = new Map<string, number>()
  const lines = ['card_id,review_time,review_rating,review_state,review_duration']
  const sorted = [...rows].sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at))
  for (const r of sorted) {
    let id = ids.get(r.card_id)
    if (id === undefined) ids.set(r.card_id, (id = ids.size + 1))
    lines.push([id, Date.parse(r.reviewed_at), r.rating, revlogState(r.prev_state), Math.max(0, r.duration_ms ?? 0)].join(','))
  }
  return lines.join('\n')
}

export function canOptimizeHere(): boolean {
  return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
}

async function loadBinding() {
  const [{ initOptimizer }, wasm, worker] = await Promise.all([
    import('@open-spaced-repetition/binding/dynamic-wasi'),
    import('@open-spaced-repetition/binding-wasm32-wasi/fsrs-binding.wasm32-wasi.wasm?url'),
    import('@open-spaced-repetition/binding-wasm32-wasi/wasi-worker-browser.mjs?worker'),
  ])
  const Worker = worker.default
  return initOptimizer({ wasm: wasm.default, worker: () => new Worker() })
}

export async function optimize(onProgress?: (ratio: number) => void): Promise<OptimizeResult> {
  if (!canOptimizeHere()) throw new Error('이 브라우저 환경에서는 최적화를 실행할 수 없어요 (cross-origin isolation 필요)')
  const rows = await reviewHistory()
  if (rows.length < MIN_REVIEWS) throw new Error(`복습 기록이 ${MIN_REVIEWS}개 이상 필요해요 (지금 ${rows.length}개)`)

  const binding = await loadBinding()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'
  const items = binding.convertCsvToFsrsItems(new TextEncoder().encode(historyToCsv(rows)), 4, tz, 'FSRS-7')
  if (items.length === 0) throw new Error('최적화에 쓸 수 있는 기록이 아직 없어요')

  const weights = await binding.computeParameters(items, {
    enableShortTerm: true,
    modelVersion: 'FSRS-7',
    numRelearningSteps: 1,
    progress: (cur: number, total: number) => { onProgress?.(total ? cur / total : 0) },
  })
  if (weights.length !== FSRS7_PARAM_COUNT || !weights.every(Number.isFinite)) throw new Error('최적화 결과가 올바르지 않아요')

  const logLossDefault = new binding.FSRSBinding().evaluate(items).logLoss
  const logLossOptimized = new binding.FSRSBinding(weights).evaluate(items).logLoss
  const base = { reviewCount: rows.length, logLossDefault, logLossOptimized }

  // 기본값보다 나을 때만 적용
  if (!(logLossOptimized < logLossDefault)) return { applied: false, ...base }

  const fsrs: FsrsPersonal = { weights, version: 'FSRS-7', optimizedAt: new Date().toISOString(), ...base }
  await updateSettings({ fsrs })
  setUserWeights(weights)
  return { applied: true, ...base, settings: fsrs }
}

export async function resetToDefault() {
  await updateSettings({ fsrs: undefined })
  setUserWeights(null)
}
