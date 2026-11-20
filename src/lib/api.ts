import { supabase } from './supabase'
import { desiredCards } from './kinds'
import type { CardRow, Deck, Note, NoteType, Profile, ReviewLogRow, SentenceData, VocabData } from './types'

type Result<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/** Supabase 는 한 번에 1000행까지만 주므로 페이지를 넘기며 전부 가져온다 */
async function fetchAll<T>(build: (from: number, to: number) => Result<T>): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return out
}

function check<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error
  return res.data as NonNullable<T>
}

function checkMaybe<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

/** 하루의 시작 = 새벽 4시 (밤늦게 공부해도 같은 날로 침) */
export function dayStart(now = new Date()): Date {
  const d = new Date(now)
  if (d.getHours() < 4) d.setDate(d.getDate() - 1)
  d.setHours(4, 0, 0, 0)
  return d
}
export function dayEnd(now = new Date()): Date {
  const d = dayStart(now)
  d.setDate(d.getDate() + 1)
  return d
}

// ─────────────── 프로필 / 초대 ───────────────

export async function getProfile(): Promise<Profile> {
  return check(await supabase.from('profiles').select('id, nickname, is_admin').single())
}

export async function updateNickname(nickname: string) {
  const { data: u } = await supabase.auth.getUser()
  check(await supabase.from('profiles').update({ nickname }).eq('id', u.user!.id))
}

export async function createInvite(): Promise<string> {
  return check(await supabase.rpc('create_invite')) as string
}

export async function listInvites() {
  return check(
    await supabase.from('invites').select('code, used_at, expires_at, created_at').order('created_at', { ascending: false }).limit(20),
  )
}

export async function aiUsageToday(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const row = checkMaybe(await supabase.from('ai_usage').select('count').eq('day', today).maybeSingle())
  return row?.count ?? 0
}

// ─────────────── 덱 ───────────────

export async function listDecks(): Promise<Deck[]> {
  return check(await supabase.from('decks').select('*').order('created_at'))
}

export async function getDeck(id: string): Promise<Deck> {
  return check(await supabase.from('decks').select('*').eq('id', id).single())
}

export async function createDeck(name: string, emoji: string): Promise<Deck> {
  return check(await supabase.from('decks').insert({ name, emoji }).select().single())
}

export async function updateDeck(id: string, patch: Partial<Pick<Deck, 'name' | 'emoji' | 'settings'>>) {
  check(await supabase.from('decks').update(patch).eq('id', id))
}

export async function deleteDeck(id: string) {
  check(await supabase.from('decks').delete().eq('id', id))
}

export interface DeckCounts { newCards: number; due: number; total: number }

export async function deckCounts(deckId: string): Promise<DeckCounts> {
  const end = dayEnd().toISOString()
  const base = () => supabase.from('cards').select('id', { count: 'exact', head: true }).eq('deck_id', deckId).eq('suspended', false)
  const [n, d, t] = await Promise.all([
    base().eq('state', 0),
    base().gt('state', 0).lte('due', end),
    supabase.from('notes').select('id', { count: 'exact', head: true }).eq('deck_id', deckId),
  ])
  return { newCards: n.count ?? 0, due: d.count ?? 0, total: t.count ?? 0 }
}

// ─────────────── 노트 ───────────────

export async function listNotes(deckId: string): Promise<Note[]> {
  return fetchAll<Note>((from, to) =>
    supabase.from('notes').select('*').eq('deck_id', deckId).order('created_at', { ascending: false }).range(from, to),
  )
}

export async function getNote(id: string): Promise<Note> {
  return check(await supabase.from('notes').select('*').eq('id', id).single())
}

export interface NoteInput {
  id?: string
  deck_id: string
  type: NoteType
  data: VocabData | SentenceData
  tags?: string[]
}

function headword(input: NoteInput): string {
  return input.type === 'vocab' ? (input.data as VocabData).word.trim() : (input.data as SentenceData).en.trim().slice(0, 80)
}

/** 노트 저장 + 카드 동기화 (새로 생긴 유형은 추가, 사라진 유형은 삭제) */
export async function saveNote(input: NoteInput): Promise<Note> {
  const row = {
    deck_id: input.deck_id,
    type: input.type,
    word: headword(input),
    data: input.data,
    tags: input.tags ?? [],
    updated_at: new Date().toISOString(),
  }
  const note: Note = input.id
    ? check(await supabase.from('notes').update(row).eq('id', input.id).select().single())
    : check(await supabase.from('notes').insert(row).select().single())
  await syncCards(note)
  return note
}

export async function findNoteByWord(deckId: string, word: string): Promise<Note | null> {
  return checkMaybe(await supabase.from('notes').select('*').eq('deck_id', deckId).eq('type', 'vocab').ilike('word', word).limit(1).maybeSingle())
}

async function syncCards(note: Note) {
  const existing = check(await supabase.from('cards').select('id, kind, sense_idx').eq('note_id', note.id)) as Pick<CardRow, 'id' | 'kind' | 'sense_idx'>[]
  const want = desiredCards(note)
  const key = (c: { kind: string; sense_idx: number }) => `${c.kind}#${c.sense_idx}`
  const wantKeys = new Set(want.map(key))
  const haveKeys = new Set(existing.map(key))

  const toInsert = want.filter((c) => !haveKeys.has(key(c))).map((c) => ({ ...c, note_id: note.id, deck_id: note.deck_id }))
  const toDelete = existing.filter((c) => !wantKeys.has(key(c))).map((c) => c.id)

  if (toInsert.length) check(await supabase.from('cards').insert(toInsert))
  if (toDelete.length) check(await supabase.from('cards').delete().in('id', toDelete))
  // 덱을 옮긴 경우
  check(await supabase.from('cards').update({ deck_id: note.deck_id }).eq('note_id', note.id).neq('deck_id', note.deck_id))
}

export async function deleteNote(id: string) {
  check(await supabase.from('notes').delete().eq('id', id))
}

// ─────────────── 카드 / 복습 ───────────────

export async function listCards(deckId: string): Promise<CardRow[]> {
  return fetchAll<CardRow>((from, to) =>
    supabase.from('cards').select('id, note_id, deck_id, kind, sense_idx, fsrs, due, state, suspended').eq('deck_id', deckId).order('id').range(from, to),
  )
}

export async function todayLogs(): Promise<ReviewLogRow[]> {
  return fetchAll<ReviewLogRow>((from, to) =>
    supabase.from('review_logs').select('id, card_id, note_id, rating, reviewed_at, was_new').gte('reviewed_at', dayStart().toISOString()).order('reviewed_at').range(from, to),
  )
}

export interface ReviewWrite {
  card: Pick<CardRow, 'id' | 'note_id' | 'fsrs' | 'due' | 'state'>
  next: Pick<CardRow, 'fsrs' | 'due' | 'state'>
  rating: number
  durationMs: number
  logId: string
}

export async function writeReview(w: ReviewWrite) {
  const now = new Date().toISOString()
  check(await supabase.from('cards').update({ ...w.next, updated_at: now }).eq('id', w.card.id))
  check(
    await supabase.from('review_logs').upsert({
      id: w.logId,
      card_id: w.card.id,
      note_id: w.card.note_id,
      rating: w.rating,
      reviewed_at: now,
      duration_ms: Math.round(w.durationMs),
      was_new: w.card.state === 0,
      card_before: { fsrs: w.card.fsrs, due: w.card.due, state: w.card.state },
    }),
  )
}

export async function undoReview(w: ReviewWrite) {
  check(await supabase.from('cards').update({ fsrs: w.card.fsrs, due: w.card.due, state: w.card.state }).eq('id', w.card.id))
  check(await supabase.from('review_logs').delete().eq('id', w.logId))
}

export async function setSuspended(cardId: string, suspended: boolean) {
  check(await supabase.from('cards').update({ suspended }).eq('id', cardId))
}

// ─────────────── AI ───────────────

export interface EnrichResponse {
  results: Record<string, VocabData & { is_word: boolean }>
  errors: Record<string, string>
  usage: { used: number; limit: number }
}

async function invokeAI<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('enrich', { body })
  if (error) {
    let msg = error.message
    try {
      const res = await (error as { context?: Response }).context?.json()
      if (res?.error) msg = res.error
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  return data!
}

export function enrichWords(words: string[]): Promise<EnrichResponse> {
  return invokeAI<EnrichResponse>({ words })
}

export type PhotoField = 'ko' | 'en' | 'synonyms' | 'antonyms' | 'examples'
export interface PhotoResponse {
  kind: 'word_list' | 'passage' | 'other'
  entries: (VocabData & { is_word: boolean; from_photo: PhotoField[] })[]
  truncated: number
  usage: { used: number; limit: number }
}

export function extractPhoto(image: { base64: string; mediaType: string }, hint = ''): Promise<PhotoResponse> {
  return invokeAI<PhotoResponse>({ mode: 'photo', image: image.base64, media_type: image.mediaType, hint })
}
