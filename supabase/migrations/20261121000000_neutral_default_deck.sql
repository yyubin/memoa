-- 가입 시 만들어지는 기본 단어장 이름을 중립적인 '내 단어장'으로 변경
-- 함수 본문은 20261120000000_init.sql 과 동일하고 기본 단어장 이름만 다름.
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

  insert into public.decks (user_id, name, emoji) values (new.id, '내 단어장', '📚');
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
