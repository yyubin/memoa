import { describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({ reviewHistory: vi.fn(), updateSettings: vi.fn() }))

import { becameLeech, desiredCards, DEFAULT_SETTINGS } from './kinds'
import { StudyQueue } from './session'
import { historyToCsv } from './optimizer'
import { reviewCard, setUserWeights, usingPersonalWeights } from './fsrs'
import type { CardRow, Note, VocabData } from './types'
import type { HistoryRow } from './api'

const vocab = (word: string): VocabData => ({
  word,
  senses: [{ pos: 'v.', ko: '뜻', en: 'def', synonyms: [], antonyms: [], distractors: [], examples: [] }],
  collocations: [],
})
const note = (id: string, created: string): Note => ({
  id, deck_id: 'd', type: 'vocab', word: id, data: vocab(id), tags: [], created_at: created, updated_at: created,
})
const card = (n: Note, state: number, due = '2026-01-01T00:00:00Z'): CardRow => ({
  id: `${n.id}-c`, note_id: n.id, deck_id: 'd', kind: 'meaning_ko', sense_idx: 0, fsrs: null, due, state, suspended: false,
})

const end = new Date('2026-01-02T04:00:00Z')
const now = new Date('2026-01-01T12:00:00Z')

/** 큐를 끝까지 돌려서 새(N)/복습(R) 순서를 문자열로 */
function drain(newMix: 'mix' | 'after' | 'before', reviews: number, fresh: number) {
  const notes: Note[] = []
  const cards: CardRow[] = []
  for (let i = 0; i < reviews; i++) { const n = note(`r${i}`, `2025-01-${String(i + 1).padStart(2, '0')}`); notes.push(n); cards.push(card(n, 2)) }
  for (let i = 0; i < fresh; i++) { const n = note(`n${i}`, `2025-02-${String(i + 1).padStart(2, '0')}`); notes.push(n); cards.push(card(n, 0)) }
  const q = new StudyQueue(cards, notes, [], { ...DEFAULT_SETTINGS, kinds: ['meaning_ko'], newPerDay: 100, newMix }, end)
  let out = ''
  for (let c = q.next(now); c; c = q.next(now)) {
    out += c.state === 0 ? 'N' : 'R'
    q.applyReview(c, { fsrs: null, due: '2026-02-01T00:00:00Z', state: 2 })
  }
  return out
}

describe('새 카드 섞기', () => {
  it('mix: 복습 8 + 새 2 → 고르게 섞임', () => {
    const s = drain('mix', 8, 2)
    expect(s).toHaveLength(10)
    expect(s.split('N')).toHaveLength(3)
    expect(s.indexOf('N', 1)).toBeGreaterThan(2) // 두 새 카드가 붙어 나오지 않음
    expect(s.endsWith('NN')).toBe(false)
  })

  it('after / before', () => {
    expect(drain('after', 3, 2)).toBe('RRRNN')
    expect(drain('before', 3, 2)).toBe('NNRRR')
  })

  it('새 카드가 더 많아도 섞임', () => {
    const s = drain('mix', 2, 6)
    expect(s.replace(/R/g, '')).toHaveLength(6)
    expect(s.startsWith('RR')).toBe(false)
    expect(s.endsWith('RR')).toBe(false)
  })
})

describe('어려운 카드', () => {
  it('기준에 처음 닿을 때, 그 뒤엔 절반마다', () => {
    const hits = [] as number[]
    for (let l = 1; l <= 20; l++) if (becameLeech(l - 1, l, 8)) hits.push(l)
    expect(hits).toEqual([8, 12, 16, 20])
  })
  it('까먹지 않았으면 아님', () => {
    expect(becameLeech(8, 8, 8)).toBe(false)
    expect(becameLeech(3, 4, 0)).toBe(false)
  })
  it('desiredCards 와 무관하게 동작 (sanity)', () => {
    expect(desiredCards(note('x', '2026-01-01')).length).toBeGreaterThan(0)
  })
})

describe('FSRS 개인 최적화', () => {
  it('복습 기록 → Anki revlog CSV, 실제 최적화기로 학습 가능', async () => {
    // 카드 120장 × 6회 가짜 기록
    const rows: HistoryRow[] = []
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    for (let c = 0; c < 120; c++) {
      let t = Date.UTC(2026, 0, 1, 10) + c * 60_000
      let state = 0
      let ivl = 1
      for (let i = 0; i < 6; i++) {
        const rating = rnd() < 0.85 ? 3 : 1
        rows.push({ card_id: `card-${c}`, rating, reviewed_at: new Date(t).toISOString(), duration_ms: 4000, prev_state: state })
        state = rating === 1 ? (state === 0 ? 1 : 3) : 2
        ivl = rating === 1 ? 0.01 : Math.max(1, ivl * 2.5)
        t += ivl * 86_400_000
      }
    }
    const csv = historyToCsv(rows)
    expect(csv.split('\n')[0]).toBe('card_id,review_time,review_rating,review_state,review_duration')
    expect(csv.split('\n')).toHaveLength(rows.length + 1)

    const binding = await import('@open-spaced-repetition/binding')
    const items = binding.convertCsvToFsrsItems(new TextEncoder().encode(csv), 4, 'Asia/Seoul', 'FSRS-7')
    expect(items.length).toBeGreaterThan(100)
    const weights = await binding.computeParameters(items, { enableShortTerm: true, modelVersion: 'FSRS-7', numRelearningSteps: 1 })
    expect(weights).toHaveLength(34)

    // 학습된 매개변수로 스케줄러가 실제로 동작
    setUserWeights(weights)
    expect(usingPersonalWeights()).toBe(true)
    const r = await reviewCard({ fsrs: null }, 3, new Date('2026-01-01T00:00:00Z'))
    expect(r.state).toBeGreaterThan(0)
    setUserWeights(null)
    expect(usingPersonalWeights()).toBe(false)
  }, 30_000)

  it('잘못된 매개변수는 무시', () => {
    setUserWeights([1, 2, 3])
    expect(usingPersonalWeights()).toBe(false)
  })
})
