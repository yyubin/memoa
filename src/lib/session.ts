import { BASE_KIND, KINDS } from './kinds'
import type { CardKind, CardRow, DeckSettings, Note, ReviewLogRow } from './types'

const LEARN_AHEAD_MS = 20 * 60 * 1000
const KIND_ORDER: CardKind[] = ['meaning_ko', 'sent_ko', 'meaning_en', 'synonym', 'recall', 'cloze', 'antonym', 'sent_en', 'listen']

/**
 * 오늘의 복습 큐.
 * - 학습 중(learning/relearning) 카드 > 복습 카드 > 새 카드 순
 * - 같은 단어의 다른 유형 카드는 같은 날 안 나옴 (sibling bury)
 * - 새 카드는 기본 유형(뜻 맞히기)이 먼저 졸업해야 나머지 유형이 열림
 */
export class StudyQueue {
  private cards = new Map<string, CardRow>()
  private notes: Map<string, Note>
  private touched = new Map<string, Set<string>>() // note_id → 오늘 본 card_id
  private newLeft: number
  private enabled: Set<CardKind>
  /** 섞기 모드: 이번 세션에서 보여준 새 카드 / 복습 카드 수, 목표 새 카드 비율 */
  private shownNew = 0
  private shownReview = 0
  private newRatio = 0

  constructor(
    cards: CardRow[],
    notes: Note[],
    logs: ReviewLogRow[],
    private settings: DeckSettings,
    private endOfDay: Date,
  ) {
    this.notes = new Map(notes.map((n) => [n.id, n]))
    this.enabled = new Set(settings.kinds)
    for (const c of cards) if (!c.suspended && this.notes.has(c.note_id)) this.cards.set(c.id, c)
    for (const l of logs) this.touch(l.note_id, l.card_id)
    const newToday = logs.filter((l) => l.was_new).length
    this.newLeft = Math.max(0, settings.newPerDay - newToday)
    const c = this.counts()
    this.newRatio = c.fresh + c.review > 0 ? c.fresh / (c.fresh + c.review) : 0
  }

  private touch(noteId: string, cardId: string) {
    let s = this.touched.get(noteId)
    if (!s) this.touched.set(noteId, (s = new Set()))
    s.add(cardId)
  }

  private isEnabled(c: CardRow) {
    const note = this.notes.get(c.note_id)!
    return this.enabled.has(c.kind) && KINDS[c.kind].noteType === note.type
  }

  /** 같은 노트의 다른 카드를 오늘 이미 봤으면 묻어둠 */
  private buried(c: CardRow) {
    const s = this.touched.get(c.note_id)
    return !!s && [...s].some((id) => id !== c.id)
  }

  /** 새 카드가 열렸는지: 기본 유형 카드가 이미 review 상태여야 함 (기본 유형이 꺼져 있으면 바로 열림) */
  private unlocked(c: CardRow) {
    const note = this.notes.get(c.note_id)!
    const base = BASE_KIND[note.type]
    if (c.kind === base || !this.enabled.has(base)) return true
    for (const other of this.cards.values()) {
      if (other.note_id === c.note_id && other.kind === base) return other.state >= 2
    }
    return true
  }

  private learning(c: CardRow) {
    return c.state === 1 || c.state === 3
  }

  counts(now = new Date()) {
    let learn = 0, review = 0, fresh = 0
    for (const c of this.cards.values()) {
      if (!this.isEnabled(c)) continue
      const due = new Date(c.due).getTime()
      if (this.learning(c)) { if (due <= this.endOfDay.getTime()) learn++ }
      else if (c.state === 2) { if (due <= this.endOfDay.getTime() && !this.buried(c)) review++ }
      else if (!this.buried(c) && this.unlocked(c)) fresh++
    }
    void now
    return { learn, review, fresh: Math.min(fresh, this.newLeft) }
  }

  next(now = new Date()): CardRow | null {
    const t = now.getTime()
    const enabled = [...this.cards.values()].filter((c) => this.isEnabled(c))
    const byDue = (a: CardRow, b: CardRow) => +new Date(a.due) - +new Date(b.due)

    const learning = enabled.filter((c) => this.learning(c)).sort(byDue)
    const dueLearning = learning.find((c) => +new Date(c.due) <= t)
    if (dueLearning) return dueLearning

    const review = enabled
      .filter((c) => c.state === 2 && +new Date(c.due) <= this.endOfDay.getTime() && !this.buried(c))
      .sort(byDue)
    const fresh = this.newLeft > 0
      ? enabled
          .filter((c) => c.state === 0 && !this.buried(c) && this.unlocked(c))
          .sort((a, b) => {
            const na = this.notes.get(a.note_id)!, nb = this.notes.get(b.note_id)!
            return na.created_at.localeCompare(nb.created_at) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
          })
      : []

    if (review.length && fresh.length) return this.preferNew() ? fresh[0] : review[0]
    if (review.length) return review[0]
    if (fresh.length) return fresh[0]

    const ahead = learning.find((c) => +new Date(c.due) <= t + LEARN_AHEAD_MS)
    return ahead ?? null
  }

  /** 새 카드와 복습 카드가 둘 다 남았을 때 새 카드를 줄 차례인지 */
  private preferNew(): boolean {
    switch (this.settings.newMix) {
      case 'before': return true
      case 'after': return false
      default: {
        // 세션 시작 때 남은 새 카드 비율대로 고르게 섞음 (예: 복습 80 + 새 20 → 대략 4:1)
        const shown = this.shownNew + this.shownReview
        return this.shownNew < this.newRatio * (shown + 1)
      }
    }
  }

  /** 오늘 안에 다시 볼 학습 카드가 남았으면 그 시각 */
  nextLearningAt(): Date | null {
    const ts = [...this.cards.values()]
      .filter((c) => this.isEnabled(c) && this.learning(c) && +new Date(c.due) <= this.endOfDay.getTime())
      .map((c) => +new Date(c.due))
    return ts.length ? new Date(Math.min(...ts)) : null
  }

  note(c: CardRow): Note {
    return this.notes.get(c.note_id)!
  }

  allNotes(): Note[] {
    return [...this.notes.values()]
  }

  applyReview(card: CardRow, next: Pick<CardRow, 'fsrs' | 'due' | 'state'>) {
    if (card.state === 0) { this.newLeft--; this.shownNew++ }
    else if (card.state === 2) this.shownReview++
    this.cards.set(card.id, { ...card, ...next })
    this.touch(card.note_id, card.id)
  }

  undo(card: CardRow, wasTouchedBefore: boolean) {
    if (card.state === 0) { this.newLeft++; this.shownNew-- }
    else if (card.state === 2) this.shownReview--
    this.cards.set(card.id, card)
    if (!wasTouchedBefore) this.touched.get(card.note_id)?.delete(card.id)
  }

  wasTouched(card: CardRow) {
    return !!this.touched.get(card.note_id)?.has(card.id)
  }

  suspend(cardId: string) {
    this.cards.delete(cardId)
  }
}
