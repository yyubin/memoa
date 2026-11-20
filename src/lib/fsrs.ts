import { DefaultScheduler, Rating } from 'ts-fsrs'
import type { CardRow, StoredFsrs } from './types'

export { Rating }
export type Grade = 1 | 2 | 3 | 4

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler<'FSRS-7'>>>
type DefaultSchedulerCard = Parameters<Scheduler['review']>[0]['card']
let schedulerPromise: Promise<Scheduler> | null = null
let userWeights: number[] | null = null

/** FSRS-7 매개변수 개수 (개인 최적화 결과 검증용) */
export const FSRS7_PARAM_COUNT = 34

/** 개인 최적화된 매개변수를 쓰도록 설정 (null = 기본값). 다음 계산부터 적용 */
export function setUserWeights(weights: number[] | null | undefined) {
  const next = weights && weights.length === FSRS7_PARAM_COUNT && weights.every(Number.isFinite) ? [...weights] : null
  if (JSON.stringify(next) === JSON.stringify(userWeights)) return
  userWeights = next
  schedulerPromise = null
}

export function usingPersonalWeights() {
  return userWeights !== null
}

export function getScheduler(): Promise<Scheduler> {
  schedulerPromise ??= DefaultScheduler({
    version: 'FSRS-7',
    desiredRetention: 0.9,
    enableFuzz: true,
    learningSteps: ['1m', '10m'],
    relearningSteps: ['10m'],
    maximumInterval: 3650,
    ...(userWeights ? { weights: userWeights } : {}),
  })
  return schedulerPromise
}

function hydrate(stored: StoredFsrs): DefaultSchedulerCard {
  return {
    ...stored,
    dueAt: new Date(stored.dueAt),
    lastReviewAt: stored.lastReviewAt ? new Date(stored.lastReviewAt) : null,
  } as unknown as DefaultSchedulerCard
}

function dehydrate(card: DefaultSchedulerCard): StoredFsrs {
  return JSON.parse(JSON.stringify(card)) as StoredFsrs
}

function toFsrsCard(s: Scheduler, row: Pick<CardRow, 'fsrs'>, now: Date): DefaultSchedulerCard {
  return row.fsrs ? hydrate(row.fsrs) : s.newCard({ now })
}

export interface ReviewOutcome {
  fsrs: StoredFsrs
  due: string
  state: number
}

export async function reviewCard(row: Pick<CardRow, 'fsrs'>, grade: Grade, now = new Date()): Promise<ReviewOutcome> {
  const s = await getScheduler()
  const card = toFsrsCard(s, row, now)
  const { card: next } = s.review({ card, grade, now })
  const stored = dehydrate(next)
  return { fsrs: stored, due: stored.dueAt, state: Number((next as { state: number }).state) }
}

/** 각 버튼을 눌렀을 때 다음 복습까지 남는 시간 */
export async function previewIntervals(row: Pick<CardRow, 'fsrs'>, now = new Date()): Promise<Record<Grade, string>> {
  const s = await getScheduler()
  const card = toFsrsCard(s, row, now)
  const out = {} as Record<Grade, string>
  for (const item of s.preview({ card, now })) {
    const due = (item.card as { dueAt: Date }).dueAt
    out[item.grade as Grade] = formatInterval(due.getTime() - now.getTime())
  }
  return out
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000))
  if (min < 60) return `${min}분`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}시간`
  const day = Math.round(hr / 24)
  if (day < 31) return `${day}일`
  const month = day / 30.4
  if (month < 12) return `${Math.round(month)}달`
  return `${(day / 365).toFixed(1).replace(/\.0$/, '')}년`
}
