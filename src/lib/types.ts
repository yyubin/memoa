export type Pos = 'n.' | 'v.' | 'adj.' | 'adv.' | 'prep.' | 'conj.' | 'phr.'
export const POS_LIST: Pos[] = ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'phr.']

export interface Example {
  en: string
  ko: string
  /** 예문 안에 실제로 등장하는 단어 형태 (예: mitigated) */
  target: string
}

export interface Sense {
  pos: Pos
  ko: string
  en: string
  synonyms: string[]
  antonyms: string[]
  /** 동의어 문제의 오답 보기 후보 */
  distractors: string[]
  examples: Example[]
}

export interface VocabData {
  word: string
  ipa?: string
  senses: Sense[]
  collocations: string[]
  ai?: boolean
}

export interface SentenceData {
  en: string
  ko: string
  keyPhrases: string[]
  source?: string
}

export type NoteType = 'vocab' | 'sentence'

export interface Note<T = VocabData | SentenceData> {
  id: string
  deck_id: string
  type: NoteType
  word: string
  data: T
  tags: string[]
  created_at: string
  updated_at: string
}
export type VocabNote = Note<VocabData>
export type SentenceNote = Note<SentenceData>

export type CardKind =
  | 'meaning_ko'
  | 'meaning_en'
  | 'recall'
  | 'synonym'
  | 'antonym'
  | 'cloze'
  | 'listen'
  | 'sent_ko'
  | 'sent_en'

/** DB 에 저장되는 FSRS 상태 (날짜는 ISO 문자열) */
export type StoredFsrs = Record<string, unknown> & { dueAt: string; lastReviewAt: string | null }

export interface CardRow {
  id: string
  note_id: string
  deck_id: string
  kind: CardKind
  sense_idx: number
  fsrs: StoredFsrs | null
  due: string
  state: number
  suspended: boolean
}

export interface DeckSettings {
  newPerDay: number
  kinds: CardKind[]
}

export interface Deck {
  id: string
  name: string
  emoji: string
  settings: Partial<DeckSettings>
  created_at: string
}

export interface Profile {
  id: string
  nickname: string
  is_admin: boolean
}

export interface ReviewLogRow {
  id: string
  card_id: string
  note_id: string
  rating: number
  reviewed_at: string
  was_new: boolean
}
