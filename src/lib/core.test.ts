import { describe, expect, it } from 'vitest'
import { desiredCards, findTarget, DEFAULT_SETTINGS } from './kinds'
import { buildQuestion, gradeTyped, suggestGrade, levenshtein } from './quiz'
import { StudyQueue } from './session'
import { reviewCard, previewIntervals, formatInterval } from './fsrs'
import type { CardRow, Note, VocabData } from './types'

const mitigate: VocabData = {
  word: 'mitigate',
  ipa: '/ˈmɪtɪɡeɪt/',
  senses: [{
    pos: 'v.', ko: '완화하다', en: 'to make less severe',
    synonyms: ['alleviate', 'ease', 'lessen'], antonyms: ['aggravate'],
    distractors: ['abandon', 'reveal', 'imitate'],
    examples: [{ en: 'Trees mitigated the effects of pollution.', ko: '나무가 오염의 영향을 완화했다.', target: 'mitigated' }],
  }],
  collocations: [],
}

function note(id: string, data: VocabData, created = '2026-01-01'): Note {
  return { id, deck_id: 'd', type: 'vocab', word: data.word, data, tags: [], created_at: created, updated_at: created }
}

function cardsFor(n: Note): CardRow[] {
  return desiredCards(n).map((c, i) => ({
    id: `${n.id}-${i}`, note_id: n.id, deck_id: 'd', kind: c.kind, sense_idx: c.sense_idx,
    fsrs: null, due: '2026-01-01T00:00:00Z', state: 0, suspended: false,
  }))
}

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }

describe('cards', () => {
  it('generates every applicable kind', () => {
    const kinds = desiredCards(note('n1', mitigate)).map((c) => c.kind)
    expect(kinds).toEqual(['meaning_ko', 'meaning_en', 'recall', 'synonym', 'antonym', 'cloze', 'listen'])
  })

  it('skips kinds without data', () => {
    const bare = { ...mitigate, senses: [{ ...mitigate.senses[0], synonyms: [], antonyms: [], examples: [] }] }
    expect(desiredCards(note('n', bare)).map((c) => c.kind)).toEqual(['meaning_ko', 'meaning_en', 'recall', 'listen'])
  })

  it('finds inflected target in sentence', () => {
    expect(findTarget('Trees mitigated it.', 'mitigated', 'mitigate')).toEqual([6, 15])
    expect(findTarget('No match here.', 'x', 'mitigate')).toBeNull()
  })
})

describe('quiz', () => {
  const n = note('n1', mitigate)
  const other = note('n2', { ...mitigate, word: 'abate', senses: [{ ...mitigate.senses[0] }] })

  it('synonym question: one correct answer, no other synonym among wrong options', () => {
    const card = cardsFor(n).find((c) => c.kind === 'synonym')!
    for (let k = 0; k < 20; k++) {
      const q = buildQuestion(card, n, [n, other])
      expect(q.options).toHaveLength(4)
      expect(mitigate.senses[0].synonyms).toContain(q.options[q.answerIdx])
      const wrong = q.options.filter((_, i) => i !== q.answerIdx)
      for (const w of wrong) expect(mitigate.senses[0].synonyms).not.toContain(w)
      expect(new Set(q.options).size).toBe(4)
    }
  })

  it('antonym question includes the antonym', () => {
    const card = cardsFor(n).find((c) => c.kind === 'antonym')!
    const q = buildQuestion(card, n, [n], seq([0.1, 0.5, 0.9]))
    expect(q.options[q.answerIdx]).toBe('aggravate')
  })

  it('cloze accepts the inflected form', () => {
    const card = cardsFor(n).find((c) => c.kind === 'cloze')!
    const q = buildQuestion(card, n, [n])
    expect(gradeTyped('Mitigated ', q)).toBe('correct')
    expect(gradeTyped('mitigatd', q)).toBe('close')
    expect(gradeTyped('alleviate', q)).toBe('synonym')
    expect(gradeTyped('', q)).toBe('wrong')
  })

  it('suggests grades', () => {
    expect(suggestGrade(false, 1000)).toBe(1)
    expect(suggestGrade('close', 1000)).toBe(2)
    expect(suggestGrade(true, 20000)).toBe(2)
    expect(suggestGrade(true, 2000)).toBe(3)
  })

  it('levenshtein', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })
})

describe('queue', () => {
  const end = new Date('2026-01-02T04:00:00Z')
  const now = new Date('2026-01-01T12:00:00Z')

  it('shows base card first and locks other kinds until it graduates', () => {
    const n = note('n1', mitigate)
    const q = new StudyQueue(cardsFor(n), [n], [], DEFAULT_SETTINGS, end)
    const first = q.next(now)!
    expect(first.kind).toBe('meaning_ko')
    // 다른 유형은 잠겨있고, 형제 카드는 묻힘 → 첫 카드 외에 새 카드 없음
    expect(q.counts(now).fresh).toBe(1)
  })

  it('buries siblings once a note was reviewed today', () => {
    const a = note('a', mitigate, '2026-01-01')
    const b = note('b', { ...mitigate, word: 'abate' }, '2026-01-02')
    const cards = [...cardsFor(a), ...cardsFor(b)].map((c) => (c.kind === 'meaning_ko' ? c : { ...c }))
    const q = new StudyQueue(cards, [a, b], [], DEFAULT_SETTINGS, end)
    const c1 = q.next(now)!
    expect(c1.note_id).toBe('a')
    q.applyReview(c1, { fsrs: null, due: '2026-01-05T00:00:00Z', state: 2 })
    const c2 = q.next(now)!
    expect(c2.note_id).toBe('b')
  })

  it('respects the daily new-card limit', () => {
    const notes = Array.from({ length: 5 }, (_, i) => note(`n${i}`, { ...mitigate, word: `w${i}` }, `2026-01-0${i + 1}`))
    const q = new StudyQueue(notes.flatMap(cardsFor), notes, [], { ...DEFAULT_SETTINGS, newPerDay: 2 }, end)
    expect(q.counts(now).fresh).toBe(2)
  })

  it('returns due learning cards before new ones', () => {
    const n = note('n1', mitigate)
    const n2 = note('n2', { ...mitigate, word: 'abate' })
    const cards = [...cardsFor(n), ...cardsFor(n2)]
    const learn = { ...cards.find((c) => c.note_id === 'n2' && c.kind === 'meaning_ko')!, state: 1, due: '2026-01-01T11:59:00Z' }
    const q = new StudyQueue(cards.map((c) => (c.id === learn.id ? learn : c)), [n, n2], [], DEFAULT_SETTINGS, end)
    expect(q.next(now)!.id).toBe(learn.id)
  })
})

describe('fsrs', () => {
  it('reviews a new card and round-trips through JSON', async () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const r1 = await reviewCard({ fsrs: null }, 3, now)
    expect(r1.state).toBeGreaterThan(0)
    const stored = JSON.parse(JSON.stringify(r1.fsrs))
    const r2 = await reviewCard({ fsrs: stored }, 3, new Date(r1.due))
    expect(new Date(r2.due).getTime()).toBeGreaterThan(new Date(r1.due).getTime())
    const preview = await previewIntervals({ fsrs: null }, now)
    expect(Object.keys(preview)).toEqual(['1', '2', '3', '4'])
  })

  it('formats intervals in Korean', () => {
    expect(formatInterval(60_000)).toBe('1분')
    expect(formatInterval(3 * 3600_000)).toBe('3시간')
    expect(formatInterval(5 * 86400_000)).toBe('5일')
  })
})
