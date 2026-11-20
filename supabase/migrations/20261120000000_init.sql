-- 메모아 초기 스키마
-- 원칙: 모든 사용자 데이터는 user_id = auth.uid() 인 행만 접근 (RLS)
--       AI 캐시/사용량은 Edge Function(service role)만 쓰기

create extension if not exists pgcrypto;

-- ───────────────────────── 프로필 ─────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  nickname    text not null default '모아친구' check (char_length(nickname) between 1 and 20),
  is_admin    boolean not null default false,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ───────────────────────── 초대 코드 ─────────────────────────
create table public.invites (
  code        text primary key,
  created_by  uuid not null references auth.users on delete cascade,
  used_by     uuid references auth.users on delete set null,
  used_at     timestamptz,
  expires_at  timestamptz default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);

-- ───────────────────────── 덱 / 노트 / 카드 / 로그 ─────────────────────────
create table public.decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  emoji       text not null default '📚',
  settings    jsonb not null default '{}'::jsonb,   -- { newPerDay, kinds: [...] }
  created_at  timestamptz not null default now()
);

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  deck_id     uuid not null references public.decks on delete cascade,
  type        text not null check (type in ('vocab', 'sentence')),
  word        text not null,                           -- vocab: 단어 / sentence: 영문 앞부분(검색용)
  data        jsonb not null,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  note_id     uuid not null references public.notes on delete cascade,
  deck_id     uuid not null references public.decks on delete cascade,
  kind        text not null,
  sense_idx   int  not null default 0,
  fsrs        jsonb,                                   -- null = 아직 안 배운 새 카드
  due         timestamptz not null default now(),
  state       smallint not null default 0,             -- 0 new, 1 learning, 2 review, 3 relearning
  suspended   boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (note_id, kind, sense_idx)
);

create table public.review_logs (
  id           uuid primary key,                        -- 클라이언트 생성 (재전송 시 중복 방지)
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  card_id      uuid not null references public.cards on delete cascade,
  note_id      uuid not null references public.notes on delete cascade,
  rating       smallint not null check (rating between 1 and 4),
  reviewed_at  timestamptz not null default now(),
  duration_ms  int,
  was_new      boolean not null default false,
  card_before  jsonb                                    -- 되돌리기용
);

create index cards_due_idx     on public.cards (user_id, deck_id, due) where not suspended;
create index cards_note_idx    on public.cards (note_id);
create index notes_deck_idx    on public.notes (deck_id, created_at desc);
create index logs_user_day_idx on public.review_logs (user_id, reviewed_at desc);

-- ───────────────────────── AI 공용 캐시 / 사용량 ─────────────────────────
create table public.word_cache (
  word        text primary key,                         -- 소문자 정규화
  data        jsonb not null,
  model       text not null,
  created_at  timestamptz not null default now()
);

create table public.ai_usage (
  user_id  uuid not null references auth.users on delete cascade,
  day      date not null default current_date,
  count    int  not null default 0,
  primary key (user_id, day)
);

-- ───────────────────────── 권한 (기본 노출 대신 명시적으로) ─────────────────────────
revoke all on public.profiles, public.invites, public.decks, public.notes, public.cards,
              public.review_logs, public.word_cache, public.ai_usage from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (nickname, settings) on public.profiles to authenticated;   -- is_admin 은 수정 불가
grant select on public.invites to authenticated;
grant select, insert, update, delete on public.decks, public.notes, public.cards to authenticated;
grant select, insert, delete on public.review_logs to authenticated;
grant select on public.word_cache, public.ai_usage to authenticated;

alter table public.profiles    enable row level security;
alter table public.invites     enable row level security;
alter table public.decks       enable row level security;
alter table public.notes       enable row level security;
alter table public.cards       enable row level security;
alter table public.review_logs enable row level security;
alter table public.word_cache  enable row level security;
alter table public.ai_usage    enable row level security;

create policy "own profile read"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = (select auth.uid()));

create policy "own invites" on public.invites for select to authenticated using (created_by = (select auth.uid()));

create policy "own decks" on public.decks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own notes" on public.notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid())));

create policy "own cards" on public.cards for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid()) and n.deck_id = cards.deck_id));

create policy "own logs read"   on public.review_logs for select to authenticated using (user_id = (select auth.uid()));
create policy "own logs delete" on public.review_logs for delete to authenticated using (user_id = (select auth.uid()));
create policy "own logs insert" on public.review_logs for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid()) and c.note_id = review_logs.note_id));

create policy "cache readable" on public.word_cache for select to authenticated using (true);
create policy "own usage"      on public.ai_usage  for select to authenticated using (user_id = (select auth.uid()));

-- ───────────────────────── 가입 처리 (초대 코드 확인) ─────────────────────────
-- 첫 가입자 = 관리자 (초대 코드 불필요). 이후 가입자는 유효한 초대 코드가 있어야 함.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_code  text := upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
  v_nick  text := nullif(trim(coalesce(new.raw_user_meta_data->>'nickname', '')), '');
  v_first boolean;
begin
  perform pg_advisory_xact_lock(hashtext('memoa_signup'));
  v_first := not exists (select 1 from public.profiles);

  if not v_first then
    update public.invites
       set used_by = new.id, used_at = now()
     where code = v_code and used_by is null and (expires_at is null or expires_at > now());
    if not found then
      raise exception 'INVALID_INVITE' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, nickname, is_admin)
  values (new.id, left(coalesce(v_nick, '모아친구'), 20), v_first);

  insert into public.decks (user_id, name, emoji) values (new.id, '토플 단어', '📚');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 관리자만 초대 코드 발급
create or replace function public.create_invite() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception '관리자만 초대 코드를 만들 수 있어요';
  end if;
  v_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
  insert into public.invites (code, created_by) values (v_code, auth.uid());
  return v_code;
end $$;

revoke execute on function public.create_invite() from public, anon;
grant execute on function public.create_invite() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
