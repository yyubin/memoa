// 메모아 AI 함수
//  mode "words": 단어 목록 → 한글 뜻 / 영영 뜻 / 동의어 / 반의어 / 예문 자동 생성 (공용 캐시 사용)
//  mode "photo": 사진(단어장·교재·지문) → 단어 추출. 사진에 있는 뜻/유의어 등은 그대로 쓰고 빠진 것만 채움
// - 로그인한 사용자만 호출 가능 (JWT 확인)
// - 사용자별 하루 한도 (단어 수 기준)
import Anthropic from "npm:@anthropic-ai/sdk@1.11.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.11.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.7";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.2";

const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5-5";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "40");
const ADMIN_DAILY_LIMIT = Number(Deno.env.get("AI_ADMIN_DAILY_LIMIT") ?? "300");
const MAX_WORDS_PER_REQUEST = 10;
const MAX_WORDS_PER_PHOTO = 30;
const MAX_IMAGE_BYTES = 4_500_000;
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173")
  .split(",").map((s) => s.trim());

// ─────────────── 스키마 ───────────────
const Example = z.object({
  en: z.string().describe("Academic-register English sentence (academic reading style), 12-25 words"),
  ko: z.string().describe("Natural Korean translation"),
  target: z.string().describe("The exact surface form of the headword as it appears in `en` (e.g. 'mitigated')"),
});

const Sense = z.object({
  pos: z.enum(["n.", "v.", "adj.", "adv.", "prep.", "conj.", "phr."]),
  ko: z.string().describe("Concise Korean meaning(s), comma-separated, e.g. '완화하다, 경감시키다'"),
  en: z.string().describe("Short learner-dictionary English definition"),
  synonyms: z.array(z.string()).describe("2-5 synonyms valid for THIS sense, in the style of 'closest in meaning to' vocabulary questions"),
  antonyms: z.array(z.string()).describe("0-3 antonyms for this sense; empty if none are natural"),
  distractors: z.array(z.string()).describe("3-4 same-part-of-speech words of similar difficulty that are NOT synonyms of this sense, plausible as wrong options in a 'closest in meaning' question"),
  examples: z.array(Example).describe("1-2 examples"),
});

const Entry = z.object({
  is_word: z.boolean().describe("false if the input is not a real English word or phrase"),
  word: z.string().describe("Headword in dictionary form, lowercase unless proper"),
  ipa: z.string().describe("IPA (American), e.g. /ˈmɪtɪɡeɪt/"),
  senses: z.array(Sense).describe("1-3 senses, most relevant to academic English first"),
  collocations: z.array(z.string()).describe("0-4 common collocations"),
});
type Entry = z.infer<typeof Entry>;

const PhotoEntry = Entry.extend({
  from_photo: z.array(z.enum(["ko", "en", "synonyms", "antonyms", "examples"]))
    .describe("Which fields were taken from the photo (not generated)"),
});
const PhotoResult = z.object({
  kind: z.enum(["word_list", "passage", "other"]).describe("word_list: vocabulary book/list; passage: reading text; other: not usable"),
  entries: z.array(PhotoEntry),
});
type PhotoEntry = z.infer<typeof PhotoEntry>;

// ─────────────── 프롬프트 ───────────────
const ENTRY_RULES = `- Prioritize senses that appear in academic reading/lectures (science, history, social science).
- Korean meanings: short and natural, the way Korean vocabulary books phrase them.
- Synonyms must be interchangeable with the headword in the given sense; prefer words commonly used as answer choices in standardized vocabulary questions.
- Distractors must be clearly wrong for that sense yet look plausible; never include a synonym.
- Example sentences: academic register, each must contain the headword (any inflection) and \`target\` must match it exactly.`;

const WORD_SYSTEM = `You build flashcard data for Korean learners building advanced academic English vocabulary.
For the given English word or phrase, produce a dictionary entry.
${ENTRY_RULES}
If the input is a typo or not English, set is_word=false and fill other fields minimally.`;

const PHOTO_SYSTEM = `You build flashcard data for Korean learners building advanced academic English vocabulary, from a photo they took.
1. Decide what the photo is:
   - word_list: a vocabulary book/list/notes. Extract EVERY headword shown.
   - passage: a reading text. Extract words that are underlined, highlighted, circled or otherwise marked; if nothing is marked, pick the advanced academic words a learner is least likely to know.
   - other: nothing usable → return no entries.
2. Information printed or handwritten in the photo has priority. If the photo gives a Korean meaning, synonyms (유의어/동의어/=/≒), antonyms (반의어/↔), or example sentences for a word, copy them faithfully (fix obvious OCR-level typos only) and list those fields in from_photo. Keep the photo's synonyms first; you may append a few more.
3. Then complete every field the photo did not provide, following these rules:
${ENTRY_RULES}
At most ${MAX_WORDS_PER_PHOTO} entries, in the order they appear. Set is_word=true for real words.`;

const anthropic = new Anthropic(); // ANTHROPIC_API_KEY (Edge Function secret)

function fallbackOpts() {
  // 서버측 거절 대비 폴백 (Haiku 는 미지원)
  return MODEL.startsWith("claude-haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
}

async function generateWord(word: string): Promise<Entry> {
  const res = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: WORD_SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(Entry) },
    ...fallbackOpts(),
    messages: [{ role: "user", content: `Word: ${word}` }],
  });
  if (res.stop_reason === "refusal") throw new Error("AI가 이 단어 생성을 거절했어요");
  if (!res.parsed_output) throw new Error("AI 응답을 해석하지 못했어요");
  return res.parsed_output;
}

type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

async function extractPhoto(base64: string, mediaType: ImageType, hint: string) {
  // 단어가 많으면 출력이 길어서 스트리밍으로 받음
  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    system: PHOTO_SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(PhotoResult) },
    ...fallbackOpts(),
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: hint ? `Learner's note: ${hint}` : "Extract the vocabulary from this photo." },
      ],
    }],
  });
  const res = await stream.finalMessage();
  if (res.stop_reason === "refusal") throw new Error("AI가 이 사진 처리를 거절했어요");
  if (!res.parsed_output) throw new Error("사진에서 단어를 읽지 못했어요");
  return res.parsed_output;
}

// ─────────────── HTTP ───────────────
function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

const normalize = (w: string) => w.trim().toLowerCase().replace(/\s+/g, " ");
const isWordish = (w: string) => w.length > 0 && w.length <= 60 && /^[a-z][a-z' -]*$/.test(w);

async function getUsage(admin: SupabaseClient, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: usage }, { data: profile }] = await Promise.all([
    admin.from("ai_usage").select("count").eq("user_id", userId).eq("day", today).maybeSingle(),
    admin.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
  ]);
  return { today, used: usage?.count ?? 0, limit: profile?.is_admin ? ADMIN_DAILY_LIMIT : DAILY_LIMIT };
}

async function addUsage(admin: SupabaseClient, userId: string, today: string, total: number) {
  await admin.from("ai_usage").upsert({ user_id: userId, day: today, count: total });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  if (!user) return json(req, { error: "로그인이 필요해요" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { error: "잘못된 요청" }, 400); }

  // ───── 사진 ─────
  if (body.mode === "photo") {
    const image = typeof body.image === "string" ? body.image : "";
    const mediaType = body.media_type as ImageType;
    const hint = typeof body.hint === "string" ? body.hint.slice(0, 200) : "";
    if (!image || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType)) {
      return json(req, { error: "사진 형식이 올바르지 않아요" }, 400);
    }
    if (image.length * 0.75 > MAX_IMAGE_BYTES) return json(req, { error: "사진이 너무 커요" }, 413);

    const u = await getUsage(admin, user.id);
    if (u.used >= u.limit) return json(req, { error: `오늘 AI 한도(${u.limit}개)를 다 썼어요` }, 429);

    try {
      const result = await extractPhoto(image, mediaType, hint);
      const remaining = u.limit - u.used;
      const seen = new Set<string>();
      const entries: PhotoEntry[] = [];
      for (const e of result.entries) {
        const key = normalize(e.word);
        if (!e.is_word || !isWordish(key) || seen.has(key)) continue;
        seen.add(key);
        entries.push({ ...e, word: key });
      }
      const kept = entries.slice(0, remaining);
      const used = u.used + Math.max(1, kept.length);
      await addUsage(admin, user.id, u.today, used);
      return json(req, {
        kind: result.kind,
        entries: kept,
        truncated: entries.length - kept.length,
        usage: { used, limit: u.limit },
      });
    } catch (err) {
      console.error("photo failed", err);
      const msg = err instanceof Anthropic.RateLimitError
        ? "AI가 바빠요. 잠시 후 다시 시도해 주세요"
        : err instanceof Error && /[가-힣]/.test(err.message) ? err.message : "사진 처리에 실패했어요";
      return json(req, { error: msg }, 502);
    }
  }

  // ───── 단어 목록 ─────
  if (!Array.isArray(body.words)) return json(req, { error: "words 배열이 필요해요" }, 400);
  const words = [...new Set(
    body.words.filter((w): w is string => typeof w === "string").map(normalize).filter(isWordish),
  )].slice(0, MAX_WORDS_PER_REQUEST);
  if (words.length === 0) return json(req, { error: "영어 단어를 입력해 주세요" }, 400);

  // 1) 공용 캐시
  const { data: cached } = await admin.from("word_cache").select("word, data").in("word", words);
  const results: Record<string, Entry> = {};
  for (const row of cached ?? []) results[row.word] = row.data as Entry;
  const misses = words.filter((w) => !results[w]);

  // 2) 한도
  const u = await getUsage(admin, user.id);
  const allowed = misses.slice(0, Math.max(0, u.limit - u.used));
  const errors: Record<string, string> = {};
  for (const w of misses.slice(allowed.length)) errors[w] = `오늘 AI 한도(${u.limit}개)를 다 썼어요`;

  // 3) 생성 (병렬)
  if (allowed.length > 0) {
    await addUsage(admin, user.id, u.today, u.used + allowed.length);
    const settled = await Promise.allSettled(allowed.map(generateWord));
    const toCache: { word: string; data: Entry; model: string }[] = [];
    settled.forEach((r, i) => {
      const w = allowed[i];
      if (r.status === "fulfilled") {
        results[w] = r.value;
        if (r.value.is_word) toCache.push({ word: w, data: r.value, model: MODEL });
      } else {
        console.error("generate failed", w, r.reason);
        errors[w] = r.reason instanceof Anthropic.RateLimitError
          ? "AI가 바빠요. 잠시 후 다시 시도해 주세요"
          : "생성에 실패했어요";
      }
    });
    if (toCache.length) await admin.from("word_cache").upsert(toCache);
  }

  return json(req, { results, errors, usage: { used: u.used + allowed.length, limit: u.limit } });
});
