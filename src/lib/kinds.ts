import type { CardKind, Deck, DeckSettings, Note, SentenceData, VocabData } from './types'

export interface KindInfo {
  label: string
  emoji: string
  desc: string
  noteType: 'vocab' | 'sentence'
}

export const KINDS: Record<CardKind, KindInfo> = {
  meaning_ko: { label: '뜻 맞히기', emoji: '🍙', desc: '단어 보고 한글 뜻 떠올리기', noteType: 'vocab' },
  meaning_en: { label: '영영 뜻', emoji: '📖', desc: '단어 보고 영어 정의 떠올리기', noteType: 'vocab' },
  recall: { label: '단어 떠올리기', emoji: '✍️', desc: '뜻 보고 단어 직접 쓰기', noteType: 'vocab' },
  synonym: { label: '동의어 (토플형)', emoji: '🔁', desc: '"closest in meaning to" 4지선다', noteType: 'vocab' },
  antonym: { label: '반의어', emoji: '🙃', desc: '반대말 고르기', noteType: 'vocab' },
  cloze: { label: '예문 빈칸', emoji: '🧩', desc: '예문 빈칸에 알맞은 형태 쓰기', noteType: 'vocab' },
  listen: { label: '듣고 쓰기', emoji: '🎧', desc: '발음 듣고 철자 쓰기', noteType: 'vocab' },
  sent_ko: { label: '문장 해석', emoji: '💬', desc: '영어 문장 보고 해석 떠올리기', noteType: 'sentence' },
  sent_en: { label: '문장 영작', emoji: '📝', desc: '한글 보고 영어 문장 떠올리기', noteType: 'sentence' },
}

export const ALL_KINDS = Object.keys(KINDS) as CardKind[]

export const DEFAULT_SETTINGS: DeckSettings = {
  newPerDay: 20,
  kinds: ALL_KINDS.filter((k) => k !== 'listen'),
}

export function deckSettings(deck: Deck): DeckSettings {
  return { ...DEFAULT_SETTINGS, ...deck.settings }
}

/** 노트의 '기본' 카드: 이게 한 번 졸업(review 상태)해야 나머지 유형이 새 카드로 등장 */
export const BASE_KIND: Record<'vocab' | 'sentence', CardKind> = {
  vocab: 'meaning_ko',
  sentence: 'sent_ko',
}

const MAX_SENSES_FOR_QUIZ = 2

/** 노트에서 만들 수 있는 모든 카드 (kind, sense_idx). 덱 설정과 무관하게 생성하고, 복습할 때 설정으로 거른다. */
export function desiredCards(note: Pick<Note, 'type' | 'data'>): { kind: CardKind; sense_idx: number }[] {
  const out: { kind: CardKind; sense_idx: number }[] = []
  if (note.type === 'sentence') {
    const d = note.data as SentenceData
    if (d.en.trim() && d.ko.trim()) out.push({ kind: 'sent_ko', sense_idx: 0 }, { kind: 'sent_en', sense_idx: 0 })
    return out
  }
  const d = note.data as VocabData
  const senses = d.senses ?? []
  if (senses.some((s) => s.ko.trim())) out.push({ kind: 'meaning_ko', sense_idx: 0 })
  if (senses.some((s) => s.en.trim())) out.push({ kind: 'meaning_en', sense_idx: 0 })
  if (senses.some((s) => s.ko.trim() || s.en.trim())) out.push({ kind: 'recall', sense_idx: 0 })
  senses.slice(0, MAX_SENSES_FOR_QUIZ).forEach((s, i) => {
    if (s.synonyms.length > 0) out.push({ kind: 'synonym', sense_idx: i })
    if (s.antonyms.length > 0) out.push({ kind: 'antonym', sense_idx: i })
    if (s.examples.some((e) => findTarget(e.en, e.target, d.word))) out.push({ kind: 'cloze', sense_idx: i })
  })
  if (d.word.trim()) out.push({ kind: 'listen', sense_idx: 0 })
  return out
}

/** 예문 안에서 단어가 나오는 위치 [start, end) 찾기 */
export function findTarget(sentence: string, target: string, word: string): [number, number] | null {
  for (const cand of [target, word]) {
    if (!cand?.trim()) continue
    const re = new RegExp(`\\b${escapeRe(cand.trim())}\\b`, 'i')
    const m = re.exec(sentence)
    if (m) return [m.index, m.index + m[0].length]
  }
  return null
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
