import { findTarget } from './kinds'
import type { Grade } from './fsrs'
import type { CardKind, CardRow, Example, Note, Sense, SentenceData, VocabData } from './types'

export type Mode = 'flip' | 'choice' | 'type'

export interface Question {
  kind: CardKind
  mode: Mode
  note: Note
  sense: Sense | null
  example: Example | null
  /** 예문 하이라이트 / 빈칸 위치 */
  span: [number, number] | null
  options: string[]
  answerIdx: number
  answers: string[]
}

const MODE: Record<CardKind, Mode> = {
  meaning_ko: 'flip',
  meaning_en: 'flip',
  recall: 'type',
  synonym: 'choice',
  antonym: 'choice',
  cloze: 'type',
  listen: 'type',
  sent_ko: 'flip',
  sent_en: 'flip',
}

type Rng = () => number

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)]
}

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** 4지선다 보기: 정답 1 + 오답 3. 부족하면 같은 품사의 다른 단어로 채움 */
function buildOptions(correct: string, preferred: string[], exclude: string[], pool: string[], rng: Rng): { options: string[]; answerIdx: number } {
  const banned = new Set([correct, ...exclude].map(norm))
  const wrong: string[] = []
  const add = (w: string) => {
    if (wrong.length >= 3 || !w.trim() || banned.has(norm(w))) return
    banned.add(norm(w))
    wrong.push(w)
  }
  shuffle(preferred, rng).forEach(add)
  shuffle(pool, rng).forEach(add)
  const options = shuffle([correct, ...wrong], rng)
  return { options, answerIdx: options.indexOf(correct) }
}

/** 같은 품사 단어 풀 (오답 보기 보충용) */
function wordPool(notes: Note[], self: Note, pos: string | undefined): string[] {
  const out: string[] = []
  for (const n of notes) {
    if (n.id === self.id || n.type !== 'vocab') continue
    const d = n.data as VocabData
    if (!pos || d.senses.some((s) => s.pos === pos)) out.push(d.word)
  }
  return out
}

export function buildQuestion(card: CardRow, note: Note, allNotes: Note[], rng: Rng = Math.random): Question {
  const q: Question = {
    kind: card.kind,
    mode: MODE[card.kind],
    note,
    sense: null,
    example: null,
    span: null,
    options: [],
    answerIdx: -1,
    answers: [],
  }
  if (note.type === 'sentence') return q

  const d = note.data as VocabData
  const sense = d.senses[card.sense_idx] ?? d.senses[0] ?? null
  q.sense = sense

  const withTarget = (sense?.examples ?? [])
    .map((e) => ({ e, span: findTarget(e.en, e.target, d.word) }))
    .filter((x) => x.span)
  if (withTarget.length) {
    const x = pick(withTarget, rng)
    q.example = x.e
    q.span = x.span
  }

  switch (card.kind) {
    case 'recall':
    case 'listen':
      q.answers = [d.word]
      break
    case 'cloze':
      q.answers = q.example && q.span ? [q.example.en.slice(q.span[0], q.span[1]), d.word] : [d.word]
      break
    case 'synonym': {
      if (!sense) break
      const correct = pick(sense.synonyms, rng)
      const r = buildOptions(correct, sense.distractors, [...sense.synonyms, d.word], wordPool(allNotes, note, sense.pos), rng)
      q.options = r.options
      q.answerIdx = r.answerIdx
      break
    }
    case 'antonym': {
      if (!sense) break
      const correct = pick(sense.antonyms, rng)
      // 동의어를 오답으로 섞어서 헷갈리게
      const r = buildOptions(correct, [...sense.synonyms, ...sense.distractors], [...sense.antonyms, d.word], wordPool(allNotes, note, sense.pos), rng)
      q.options = r.options
      q.answerIdx = r.answerIdx
      break
    }
  }
  return q
}

export type TypedVerdict = 'correct' | 'close' | 'synonym' | 'wrong'

export function gradeTyped(input: string, q: Question): TypedVerdict {
  const a = norm(input)
  if (!a) return 'wrong'
  if (q.answers.some((ans) => norm(ans) === a)) return 'correct'
  if (q.answers.some((ans) => norm(ans).length >= 4 && levenshtein(norm(ans), a) <= 1)) return 'close'
  if (q.sense?.synonyms.some((s) => norm(s) === a)) return 'synonym'
  return 'wrong'
}

/** 자동 채점 결과 → 추천 평가 (사용자가 바꿀 수 있음) */
export function suggestGrade(correct: boolean | TypedVerdict, elapsedMs: number): Grade {
  if (correct === false || correct === 'wrong' || correct === 'synonym') return 1
  if (correct === 'close') return 2
  return elapsedMs > 12000 ? 2 : 3
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export function sentenceData(note: Note): SentenceData {
  return note.data as SentenceData
}
export function vocabData(note: Note): VocabData {
  return note.data as VocabData
}

export function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.9
  speechSynthesis.speak(u)
}
