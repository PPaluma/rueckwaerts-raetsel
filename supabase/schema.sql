-- ============================================================================
--  Rückwärts-Rätsel / Backwords – Online-Duelle
--  Diese Datei einmal komplett im Supabase SQL Editor ausführen.
--  Sie darf auch mehrfach ausgeführt werden (Updates).
-- ============================================================================

create extension if not exists fuzzystrmatch with schema extensions;

-- ---------------------------------------------------------------- Tabellen
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null,
  created_at  timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

create table if not exists public.games (
  id           uuid primary key default gen_random_uuid(),
  p1           uuid not null references public.profiles(id) on delete cascade,
  p2           uuid references public.profiles(id) on delete cascade,
  lang         text not null default 'de'     check (lang in ('de','en')),
  mode         text not null default 'easy'   check (mode in ('easy','hard','extreme')),
  status       text not null default 'active' check (status in ('open','active','finished')),
  turn         uuid,
  next_action  text check (next_action in ('speak','guess','rerecord')),
  score1       int  not null default 0,
  score2       int  not null default 0,
  jokers1      text[] not null default '{}',
  jokers2      text[] not null default '{}',
  rounds       int  not null default 6,
  winner       uuid,
  end_reason   text,
  gave_up_by   uuid,
  created_at   timestamptz not null default now(),
  last_move_at timestamptz not null default now()
);
create index if not exists games_p1 on public.games(p1);
create index if not exists games_p2 on public.games(p2);
create index if not exists games_open on public.games(lang, mode, created_at) where status = 'open';

create table if not exists public.moves (
  id          bigint generated always as identity primary key,
  game_id     uuid not null references public.games(id) on delete cascade,
  round       int  not null,
  speaker     uuid not null,
  guesser     uuid,
  word        text not null,
  audio_path  text not null,
  audio_ver   int  not null default 1,
  state       text not null default 'pending' check (state in ('pending','rerecord','done')),
  guess       text,
  correct     boolean,
  jokers      text[] not null default '{}',
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists moves_game on public.moves(game_id);

create table if not exists public.push_subs (
  endpoint    text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  lang        text not null default 'de',
  created_at  timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subs(user_id);

-- ---------------------------------------------------------------- Version 2: Story-Modus, Gelten-lassen, Melden, Sticker
alter table public.games drop constraint if exists games_mode_check;
alter table public.games add constraint games_mode_check check (mode in ('easy','hard','extreme','story'));
alter table public.games drop constraint if exists games_next_action_check;
alter table public.games add constraint games_next_action_check check (next_action in ('speak','guess','rerecord','story'));
alter table public.games add column if not exists story jsonb;
alter table public.moves alter column audio_path drop not null;
alter table public.moves add column if not exists imit_path text;
alter table public.moves add column if not exists reviewed boolean not null default false;
alter table public.moves add column if not exists reported boolean not null default false;

create table if not exists public.stickers (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  from_user   uuid references public.profiles(id) on delete set null,
  game_id     uuid references public.games(id) on delete set null,
  word        text,
  created_at  timestamptz not null default now()
);
create index if not exists stickers_user on public.stickers(user_id);
alter table public.stickers enable row level security;

-- Kein direkter Zugriff aus der App: alles läuft über die Funktionen unten.
alter table public.profiles  enable row level security;
alter table public.games     enable row level security;
alter table public.moves     enable row level security;
alter table public.push_subs enable row level security;

-- ---------------------------------------------------------------- Profil beim Registrieren
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- Hilfsfunktionen
create or replace function public.rr_norm(s text) returns text
language sql immutable as $$
  select regexp_replace(
           replace(replace(replace(replace(lower(coalesce(s, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
           '[^a-z]', '', 'g')
$$;

create or replace function public.rr_correct(p_guess text, p_word text) returns boolean
language sql immutable set search_path = public, extensions as $$
  select case
    when public.rr_norm(p_guess) = '' then false
    when public.rr_norm(p_guess) = public.rr_norm(p_word) then true
    else extensions.levenshtein(left(public.rr_norm(p_guess), 255), left(public.rr_norm(p_word), 255))
         <= floor(length(public.rr_norm(p_word)) / 8.0)
  end
$$;

-- Buchstaben-Joker: "Kühlschrank" -> "K _ _ _ _ _ _ _ _ _ _"
create or replace function public.rr_pattern(p_word text) returns text
language plpgsql immutable as $$
declare out text := ''; ch text; i int; first boolean := true;
begin
  for i in 1 .. char_length(p_word) loop
    ch := substr(p_word, i, 1);
    if ch ~ '[[:alpha:]]' then
      out := out || case when first then upper(ch) else '_' end;
      first := false;
    elsif ch = ' ' then
      out := out || '/';
      first := true;
    else
      out := out || ch;
    end if;
    if i < char_length(p_word) then out := out || ' '; end if;
  end loop;
  return out;
end $$;

create or replace function public.rr_err(code text) returns void
language plpgsql as $$ begin raise exception using errcode = 'P0001', message = code; end $$;

-- Die komplette Sicht eines Spielers auf ein Duell (ohne geheime Wörter)
create or replace function public.rr_view(p_game uuid, me uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g public.games; opp uuid; pend public.moves; pend_json jsonb := null; hist jsonb; story_json jsonb := null;
begin
  select * into g from public.games where id = p_game;
  if not found or me is null or (me is distinct from g.p1 and me is distinct from g.p2) then
    perform public.rr_err('game_not_found');
  end if;
  opp := case when me = g.p1 then g.p2 else g.p1 end;

  if g.mode = 'story' then
    story_json := jsonb_build_object(
      'title', g.story->>'title',
      'n', (select count(*) from public.moves where game_id = g.id),
      'tokens', (select coalesce(jsonb_agg(
                   case when g.status = 'finished' or m.speaker = me then g.story->'tokens'->>(m.round) end
                   order by m.round), '[]'::jsonb) from public.moves m where m.game_id = g.id),
      'mine', (select coalesce(jsonb_agg(m.speaker = me order by m.round), '[]'::jsonb) from public.moves m where m.game_id = g.id),
      'spoken', (select count(*) from public.moves m where m.game_id = g.id and m.audio_path is not null),
      'imitated', (select count(*) from public.moves m where m.game_id = g.id and m.imit_path is not null),
      'todo_imitate', case when g.turn = me then (select coalesce(jsonb_agg(jsonb_build_object('idx', m.round, 'audio_path', m.audio_path) order by m.round), '[]'::jsonb)
                        from public.moves m where m.game_id = g.id and m.guesser = me and m.audio_path is not null and m.imit_path is null) else '[]'::jsonb end,
      'todo_speak', case when g.turn = me then (select coalesce(jsonb_agg(jsonb_build_object('idx', m.round, 'word', m.word) order by m.round), '[]'::jsonb)
                        from public.moves m where m.game_id = g.id and m.speaker = me and m.audio_path is null) else '[]'::jsonb end,
      'clips', case when g.status = 'finished' then (select coalesce(jsonb_agg(jsonb_build_object('idx', m.round, 'audio_path', m.audio_path, 'imit_path', m.imit_path, 'by_me', m.speaker = me) order by m.round), '[]'::jsonb)
                        from public.moves m where m.game_id = g.id) end);
    hist := '[]'::jsonb;
  else
    if g.turn = me and g.next_action = 'guess' then
      select * into pend from public.moves where game_id = g.id and guesser = me and state = 'pending' order by id limit 1;
      if found then
        pend_json := jsonb_build_object(
          'move_id', pend.id, 'round', pend.round, 'audio_path', pend.audio_path, 'audio_ver', pend.audio_ver,
          'jokers', to_jsonb(pend.jokers),
          'pattern', case when 'letters' = any(pend.jokers) then public.rr_pattern(pend.word) end,
          'ai_word', case when 'ai' = any(pend.jokers) then pend.word end);
      end if;
    elsif g.turn = me and g.next_action = 'rerecord' then
      select * into pend from public.moves where game_id = g.id and speaker = me and state = 'rerecord' order by id limit 1;
      if found then
        pend_json := jsonb_build_object('move_id', pend.id, 'round', pend.round, 'word', pend.word);
      end if;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
             'round', m.round, 'by_me', m.speaker = me, 'state', m.state,
             'word', case when m.state = 'done' or m.speaker = me then m.word end,
             'guess', m.guess, 'correct', m.correct, 'jokers', to_jsonb(m.jokers),
             'audio_path', case when m.state = 'done' or m.speaker = me then m.audio_path end,
             'imit_path', case when m.state = 'done' then m.imit_path end,
             'reported', m.reported,
             'needs_review', m.speaker = me and m.state = 'done' and not m.correct and not m.reviewed
                             and coalesce(trim(m.guess), '') <> '')
           order by m.round, m.id), '[]'::jsonb)
      into hist from public.moves m where m.game_id = g.id;
  end if;

  return jsonb_build_object(
    'id', g.id, 'lang', g.lang, 'mode', g.mode, 'status', g.status, 'rounds', g.rounds,
    'me', me, 'my_name', (select username from public.profiles where id = me),
    'opponent', opp, 'opponent_name', (select username from public.profiles where id = opp),
    'i_am_p1', me = g.p1,
    'my_score',  case when me = g.p1 then g.score1 else g.score2 end,
    'opp_score', case when me = g.p1 then g.score2 else g.score1 end,
    'my_turn', g.turn = me,
    'next_action', case when g.turn = me then g.next_action end,
    'opp_action',  case when g.turn = opp then g.next_action end,
    'my_jokers', to_jsonb(case when me = g.p1 then g.jokers1 else g.jokers2 end),
    'winner', g.winner, 'won', case when g.status = 'finished' then g.winner = me end,
    'draw', g.status = 'finished' and g.winner is null,
    'end_reason', g.end_reason, 'gave_up_by_me', g.gave_up_by = me,
    'can_claim_timeout', g.status = 'active' and g.turn = opp and g.last_move_at < now() - interval '3 days',
    'created_at', g.created_at, 'last_move_at', g.last_move_at,
    'pending', pend_json, 'history', hist, 'story', story_json);
end $$;

-- Spiel nach einem Rate-Zug weiterschalten
create or replace function public.rr_advance(p_game uuid, me uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.games; opp uuid; spoken int; w uuid;
begin
  select * into g from public.games where id = p_game for update;
  opp := case when me = g.p1 then g.p2 else g.p1 end;
  select count(*) into spoken from public.moves where game_id = g.id and speaker = me;
  if spoken < g.rounds then
    update public.games set turn = me, next_action = 'speak', last_move_at = now() where id = g.id;
  elsif exists (select 1 from public.moves where game_id = g.id and guesser = opp and state <> 'done') then
    update public.games set turn = opp, next_action = 'guess', last_move_at = now() where id = g.id;
  else
    select * into g from public.games where id = p_game;
    w := case when g.score1 > g.score2 then g.p1 when g.score2 > g.score1 then g.p2 end;
    update public.games set status = 'finished', turn = null, next_action = null, winner = w,
           end_reason = 'played', last_move_at = now() where id = g.id;
  end if;
end $$;

-- ---------------------------------------------------------------- Funktionen für die App
create or replace function public.get_game(p_game uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.rr_view(p_game, auth.uid())
$$;

create or replace function public.my_games() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'sort')::int, x->>'last_move_at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', g.id, 'lang', g.lang, 'mode', g.mode, 'status', g.status, 'rounds', g.rounds,
      'opponent_name', (select username from public.profiles where id = case when g.p1 = auth.uid() then g.p2 else g.p1 end),
      'my_score',  case when g.p1 = auth.uid() then g.score1 else g.score2 end,
      'opp_score', case when g.p1 = auth.uid() then g.score2 else g.score1 end,
      'my_turn', g.turn = auth.uid(),
      'next_action', case when g.turn = auth.uid() then g.next_action end,
      'opp_action',  case when g.turn is not null and g.turn <> auth.uid() then g.next_action end,
      'won', case when g.status = 'finished' then g.winner = auth.uid() end,
      'draw', g.status = 'finished' and g.winner is null,
      'end_reason', g.end_reason, 'gave_up_by_me', g.gave_up_by = auth.uid(),
      'done_moves', (select count(*) from public.moves m where m.game_id = g.id and m.state = 'done'),
      'reviews', (select count(*) from public.moves m where m.game_id = g.id and m.speaker = auth.uid() and m.state = 'done'
                    and not m.correct and not m.reviewed and coalesce(trim(m.guess), '') <> ''),
      'story_title', g.story->>'title',
      'can_claim_timeout', g.status = 'active' and g.turn is not null and g.turn <> auth.uid()
                           and g.last_move_at < now() - interval '3 days',
      'last_move_at', g.last_move_at,
      'sort', case when g.status = 'finished' then 2 when g.turn = auth.uid() then 0 else 1 end) as x
    from public.games g
    where auth.uid() in (g.p1, g.p2)
      and (g.status <> 'finished' or g.last_move_at > now() - interval '14 days')
    order by g.last_move_at desc
    limit 60
  ) t
$$;

create or replace function public.my_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'played', count(*) filter (where g.status = 'finished'),
    'won',    count(*) filter (where g.status = 'finished' and g.winner = auth.uid()),
    'lost',   count(*) filter (where g.status = 'finished' and g.winner is not null and g.winner <> auth.uid()),
    'draw',   count(*) filter (where g.status = 'finished' and g.winner is null),
    'guessed', (select count(*) from public.moves m where m.guesser = auth.uid() and m.state = 'done'),
    'correct', (select count(*) from public.moves m where m.guesser = auth.uid() and m.correct))
  from public.games g where auth.uid() in (g.p1, g.p2)
$$;

create or replace function public.search_users(p_q text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(username order by lower(username)), '[]'::jsonb) from (
    select username from public.profiles
    where id <> auth.uid() and length(coalesce(p_q, '')) >= 1
      and left(lower(username), length(p_q)) = lower(p_q)
    order by lower(username) limit 8) t
$$;

create or replace function public.create_game(p_opponent text, p_lang text, p_mode text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); opp uuid; gid uuid;
begin
  if me is null then perform public.rr_err('not_logged_in'); end if;
  select id into opp from public.profiles where lower(username) = lower(trim(p_opponent));
  if opp is null then perform public.rr_err('user_not_found'); end if;
  if opp = me then perform public.rr_err('cannot_play_self'); end if;
  if p_mode = 'story' then perform public.rr_err('wrong_mode'); end if;
  insert into public.games(p1, p2, lang, mode, status, turn, next_action)
  values (me, opp, p_lang, p_mode, 'active', me, 'speak') returning id into gid;
  return gid;
end $$;

create or replace function public.random_game(p_lang text, p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games;
begin
  if me is null then perform public.rr_err('not_logged_in'); end if;
  if p_mode = 'story' then perform public.rr_err('story_needs_friend'); end if;
  -- 1) offenes Spiel eines anderen übernehmen (sein erstes Wort ist schon eingesprochen)
  select * into g from public.games
   where status = 'open' and lang = p_lang and mode = p_mode and p1 <> me and turn is null
     and not exists (select 1 from public.games a where a.status = 'active'
                       and ((a.p1 = me and a.p2 = games.p1) or (a.p2 = me and a.p1 = games.p1)))
   order by created_at limit 1 for update skip locked;
  if found then
    update public.games set p2 = me, status = 'active', turn = me, next_action = 'guess', last_move_at = now()
     where id = g.id;
    update public.moves set guesser = me where game_id = g.id;
    return jsonb_build_object('id', g.id, 'joined', true);
  end if;
  -- 2) eigenes offenes Spiel weiterverwenden
  select * into g from public.games where status = 'open' and p1 = me and lang = p_lang and mode = p_mode limit 1;
  if found then return jsonb_build_object('id', g.id, 'joined', false); end if;
  -- 3) neues offenes Spiel
  insert into public.games(p1, lang, mode, status, turn, next_action)
  values (me, p_lang, p_mode, 'open', me, 'speak') returning * into g;
  return jsonb_build_object('id', g.id, 'joined', false);
end $$;

create or replace function public.submit_word(p_game uuid, p_word text, p_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games; opp uuid; r int;
begin
  select * into g from public.games where id = p_game for update;
  if not found or me is distinct from g.p1 and me is distinct from g.p2 then perform public.rr_err('game_not_found'); end if;
  if g.mode = 'story' then perform public.rr_err('wrong_mode'); end if;
  if g.status = 'finished' then perform public.rr_err('game_finished'); end if;
  if g.turn is distinct from me or g.next_action <> 'speak' then perform public.rr_err('not_your_turn'); end if;
  if p_path not like g.id::text || '/%' then perform public.rr_err('bad_path'); end if;
  if char_length(trim(coalesce(p_word, ''))) not between 1 and 120 then perform public.rr_err('bad_word'); end if;
  opp := case when me = g.p1 then g.p2 else g.p1 end;
  select count(*) + 1 into r from public.moves where game_id = g.id and speaker = me;
  if r > g.rounds then perform public.rr_err('no_rounds_left'); end if;
  insert into public.moves(game_id, round, speaker, guesser, word, audio_path)
  values (g.id, r, me, opp, trim(p_word), p_path);
  if g.status = 'open' then
    update public.games set turn = null, next_action = null, last_move_at = now() where id = g.id;
  else
    update public.games set turn = opp, next_action = 'guess', last_move_at = now() where id = g.id;
  end if;
  return public.rr_view(g.id, me);
end $$;

drop function if exists public.submit_guess(uuid, text);
create or replace function public.submit_guess(p_game uuid, p_guess text, p_imit_path text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games; m public.moves; ok boolean;
begin
  select * into g from public.games where id = p_game for update;
  if not found or me is distinct from g.p1 and me is distinct from g.p2 then perform public.rr_err('game_not_found'); end if;
  if g.mode = 'story' then perform public.rr_err('wrong_mode'); end if;
  if g.turn is distinct from me or g.next_action <> 'guess' then perform public.rr_err('not_your_turn'); end if;
  if p_imit_path is not null and p_imit_path not like g.id::text || '/%' then perform public.rr_err('bad_path'); end if;
  select * into m from public.moves where game_id = g.id and guesser = me and state = 'pending' order by id limit 1 for update;
  if not found then perform public.rr_err('nothing_to_guess'); end if;
  ok := public.rr_correct(p_guess, m.word);
  update public.moves set state = 'done', guess = left(trim(coalesce(p_guess, '')), 120), correct = ok, done_at = now(),
         imit_path = p_imit_path
   where id = m.id;
  if ok then
    if me = g.p1 then update public.games set score1 = score1 + 1 where id = g.id;
    else update public.games set score2 = score2 + 1 where id = g.id; end if;
  end if;
  perform public.rr_advance(g.id, me);
  return jsonb_build_object('correct', ok, 'word', m.word, 'round', m.round, 'game', public.rr_view(g.id, me));
end $$;

create or replace function public.use_joker(p_game uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games; m public.moves; used text[];
begin
  if p_kind not in ('ai', 'again', 'letters') then perform public.rr_err('bad_joker'); end if;
  select * into g from public.games where id = p_game for update;
  if not found or me is distinct from g.p1 and me is distinct from g.p2 then perform public.rr_err('game_not_found'); end if;
  if g.turn is distinct from me or g.next_action <> 'guess' then perform public.rr_err('not_your_turn'); end if;
  used := case when me = g.p1 then g.jokers1 else g.jokers2 end;
  if p_kind = any(used) then perform public.rr_err('joker_used'); end if;
  select * into m from public.moves where game_id = g.id and guesser = me and state = 'pending' order by id limit 1 for update;
  if not found then perform public.rr_err('nothing_to_guess'); end if;

  if me = g.p1 then update public.games set jokers1 = jokers1 || p_kind where id = g.id;
  else update public.games set jokers2 = jokers2 || p_kind where id = g.id; end if;
  update public.moves set jokers = jokers || p_kind where id = m.id;

  if p_kind = 'again' then
    update public.moves set state = 'rerecord' where id = m.id;
    update public.games set turn = m.speaker, next_action = 'rerecord', last_move_at = now() where id = g.id;
    return jsonb_build_object('kind', 'again');
  elsif p_kind = 'ai' then
    return jsonb_build_object('kind', 'ai', 'word', m.word);
  else
    return jsonb_build_object('kind', 'letters', 'pattern', public.rr_pattern(m.word));
  end if;
end $$;

create or replace function public.rerecord(p_game uuid, p_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games; m public.moves;
begin
  select * into g from public.games where id = p_game for update;
  if not found or me is distinct from g.p1 and me is distinct from g.p2 then perform public.rr_err('game_not_found'); end if;
  if g.turn is distinct from me or g.next_action <> 'rerecord' then perform public.rr_err('not_your_turn'); end if;
  if p_path not like g.id::text || '/%' then perform public.rr_err('bad_path'); end if;
  select * into m from public.moves where game_id = g.id and speaker = me and state = 'rerecord' order by id limit 1 for update;
  if not found then perform public.rr_err('nothing_to_rerecord'); end if;
  update public.moves set audio_path = p_path, audio_ver = audio_ver + 1, state = 'pending' where id = m.id;
  update public.games set turn = m.guesser, next_action = 'guess', last_move_at = now() where id = g.id;
  return public.rr_view(g.id, me);
end $$;

create or replace function public.give_up(p_game uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games; opp uuid;
begin
  select * into g from public.games where id = p_game for update;
  if not found or me is distinct from g.p1 and me is distinct from g.p2 then perform public.rr_err('game_not_found'); end if;
  if g.status = 'finished' then perform public.rr_err('game_finished'); end if;
  if g.status = 'open' then
    delete from public.games where id = g.id;
    return jsonb_build_object('deleted', true);
  end if;
  opp := case when me = g.p1 then g.p2 else g.p1 end;
  update public.games set status = 'finished', turn = null, next_action = null, winner = opp,
         end_reason = 'gave_up', gave_up_by = me, last_move_at = now() where id = g.id;
  return public.rr_view(g.id, me);
end $$;

create or replace function public.claim_timeout(p_game uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games; opp uuid;
begin
  select * into g from public.games where id = p_game for update;
  if not found or me is distinct from g.p1 and me is distinct from g.p2 then perform public.rr_err('game_not_found'); end if;
  opp := case when me = g.p1 then g.p2 else g.p1 end;
  if g.status <> 'active' or g.turn is distinct from opp or g.last_move_at > now() - interval '3 days' then
    perform public.rr_err('no_timeout');
  end if;
  update public.games set status = 'finished', turn = null, next_action = null, winner = me,
         end_reason = 'timeout', gave_up_by = opp, last_move_at = now() where id = g.id;
  return public.rr_view(g.id, me);
end $$;

create or replace function public.save_push(p_endpoint text, p_p256dh text, p_auth text, p_lang text) returns void
language sql security definer set search_path = public as $$
  insert into public.push_subs(endpoint, user_id, p256dh, auth, lang)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, coalesce(p_lang, 'de'))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh,
                                       auth = excluded.auth, lang = excluded.lang
$$;

create or replace function public.delete_push(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- Sprecher lässt eine falsch getippte Antwort gelten (oder lehnt sie ab)
create or replace function public.review_guess(p_game uuid, p_round int, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games; m public.moves; w uuid;
begin
  select * into g from public.games where id = p_game for update;
  if not found or me is distinct from g.p1 and me is distinct from g.p2 then perform public.rr_err('game_not_found'); end if;
  select * into m from public.moves where game_id = g.id and speaker = me and round = p_round and state = 'done' for update;
  if not found or m.correct or m.reviewed then perform public.rr_err('nothing_to_review'); end if;
  update public.moves set reviewed = true, correct = case when p_accept then true else correct end where id = m.id;
  if p_accept then
    if m.guesser = g.p1 then update public.games set score1 = score1 + 1 where id = g.id;
    else update public.games set score2 = score2 + 1 where id = g.id; end if;
    select * into g from public.games where id = p_game;
    if g.status = 'finished' and g.end_reason = 'played' then
      w := case when g.score1 > g.score2 then g.p1 when g.score2 > g.score1 then g.p2 end;
      update public.games set winner = w where id = g.id;
    end if;
  end if;
  return public.rr_view(g.id, me);
end $$;

-- Rater meldet: Gegner hat das Wort schlecht ausgesprochen -> Sticker für den Gegner
create or replace function public.report_move(p_game uuid, p_round int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m public.moves;
begin
  select * into m from public.moves where game_id = p_game and guesser = me and round = p_round and state = 'done' for update;
  if not found then perform public.rr_err('nothing_to_report'); end if;
  if m.reported then perform public.rr_err('already_reported'); end if;
  update public.moves set reported = true where id = m.id;
  insert into public.stickers(user_id, from_user, game_id, word) values (m.speaker, me, p_game, m.word);
  return jsonb_build_object('reported', true);
end $$;

create or replace function public.my_stickers() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'from', p.username, 'word', s.word, 'created_at', s.created_at)
                            order by s.created_at desc), '[]'::jsonb)
  from public.stickers s left join public.profiles p on p.id = s.from_user
  where s.user_id = auth.uid()
$$;

create or replace function public.remove_sticker(p_id bigint) returns void
language sql security definer set search_path = public as $$
  delete from public.stickers where id = p_id and user_id = auth.uid()
$$;

-- ---------------------------------------------------------------- Story-Modus
-- p_story = {"title": "...", "tokens": ["Es", "war", "einmal", ...], "words": ["Es", "war", ...], "assign": [0,1,1,0,...]}
create or replace function public.create_story_game(p_opponent text, p_lang text, p_story jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); opp uuid; gid uuid; n int; i int; a int;
begin
  if me is null then perform public.rr_err('not_logged_in'); end if;
  select id into opp from public.profiles where lower(username) = lower(trim(p_opponent));
  if opp is null then perform public.rr_err('user_not_found'); end if;
  if opp = me then perform public.rr_err('cannot_play_self'); end if;
  n := jsonb_array_length(p_story->'words');
  if n < 2 or n > 60 or jsonb_array_length(p_story->'tokens') <> n or jsonb_array_length(p_story->'assign') <> n then
    perform public.rr_err('bad_story');
  end if;
  insert into public.games(p1, p2, lang, mode, status, turn, next_action, rounds, story)
  values (me, opp, p_lang, 'story', 'active', me, 'story', n,
          jsonb_build_object('title', left(p_story->>'title', 80), 'tokens', p_story->'tokens'))
  returning id into gid;
  for i in 0 .. n - 1 loop
    a := (p_story->'assign'->>i)::int;
    insert into public.moves(game_id, round, speaker, guesser, word, audio_path, state)
    values (gid, i, case when a = 0 then me else opp end, case when a = 0 then opp else me end,
            left(p_story->'words'->>i, 120), null, 'pending');
  end loop;
  return gid;
end $$;

create or replace function public.rr_story_advance(p_game uuid, me uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.games; opp uuid;
begin
  select * into g from public.games where id = p_game for update;
  opp := case when me = g.p1 then g.p2 else g.p1 end;
  if exists (select 1 from public.moves where game_id = g.id and ((guesser = me and audio_path is not null and imit_path is null)
                                                                 or (speaker = me and audio_path is null))) then
    update public.games set last_move_at = now() where id = g.id;
  elsif exists (select 1 from public.moves where game_id = g.id and guesser = opp and audio_path is not null and imit_path is null) then
    update public.games set turn = opp, next_action = 'story', last_move_at = now() where id = g.id;
  elsif not exists (select 1 from public.moves where game_id = g.id and imit_path is null) then
    update public.games set status = 'finished', turn = null, next_action = null, winner = null,
           end_reason = 'story', last_move_at = now() where id = g.id;
  else
    update public.games set turn = opp, next_action = 'story', last_move_at = now() where id = g.id;
  end if;
end $$;

create or replace function public.story_speak(p_game uuid, p_idx int, p_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games;
begin
  select * into g from public.games where id = p_game for update;
  if not found or me is distinct from g.p1 and me is distinct from g.p2 then perform public.rr_err('game_not_found'); end if;
  if g.mode <> 'story' then perform public.rr_err('wrong_mode'); end if;
  if g.turn is distinct from me then perform public.rr_err('not_your_turn'); end if;
  if p_path not like g.id::text || '/%' then perform public.rr_err('bad_path'); end if;
  update public.moves set audio_path = p_path where game_id = g.id and round = p_idx and speaker = me;
  if not found then perform public.rr_err('bad_index'); end if;
  perform public.rr_story_advance(g.id, me);
  return public.rr_view(g.id, me);
end $$;

create or replace function public.story_imitate(p_game uuid, p_idx int, p_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.games;
begin
  select * into g from public.games where id = p_game for update;
  if not found or me is distinct from g.p1 and me is distinct from g.p2 then perform public.rr_err('game_not_found'); end if;
  if g.mode <> 'story' then perform public.rr_err('wrong_mode'); end if;
  if g.turn is distinct from me then perform public.rr_err('not_your_turn'); end if;
  if p_path not like g.id::text || '/%' then perform public.rr_err('bad_path'); end if;
  update public.moves set imit_path = p_path, state = 'done', done_at = now()
   where game_id = g.id and round = p_idx and guesser = me and audio_path is not null;
  if not found then perform public.rr_err('bad_index'); end if;
  perform public.rr_story_advance(g.id, me);
  return public.rr_view(g.id, me);
end $$;

-- ---------------------------------------------------------------- Rechte
do $$
declare f text;
begin
  foreach f in array array[
    'get_game(uuid)', 'my_games()', 'my_stats()', 'search_users(text)', 'create_game(text,text,text)',
    'random_game(text,text)', 'submit_word(uuid,text,text)', 'submit_guess(uuid,text,text)', 'use_joker(uuid,text)',
    'rerecord(uuid,text)', 'give_up(uuid)', 'claim_timeout(uuid)', 'save_push(text,text,text,text)', 'delete_push(text)',
    'review_guess(uuid,int,boolean)', 'report_move(uuid,int)', 'my_stickers()', 'remove_sticker(bigint)',
    'create_story_game(text,text,jsonb)', 'story_speak(uuid,int,text)', 'story_imitate(uuid,int,text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['rr_view(uuid,uuid)', 'rr_advance(uuid,uuid)', 'rr_story_advance(uuid,uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- Speicher für Sprachaufnahmen
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 2097152, array['audio/wav'])
on conflict (id) do nothing;

create or replace function public.can_access_audio(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.games g
                 where g.id::text = split_part(p_name, '/', 1) and auth.uid() in (g.p1, g.p2))
$$;
grant execute on function public.can_access_audio(text) to authenticated;

drop policy if exists "rr audio read"   on storage.objects;
drop policy if exists "rr audio upload" on storage.objects;
create policy "rr audio read" on storage.objects for select to authenticated
  using (bucket_id = 'audio' and public.can_access_audio(name));
create policy "rr audio upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and public.can_access_audio(name));
