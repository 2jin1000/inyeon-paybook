-- 인연 페이북 · Supabase 스키마
-- 사용법: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 실행합니다.
-- 여러 번 실행해도 안전하도록 작성했습니다.

-- 1) 분류 enum -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_type') then
    create type public.event_type as enum ('부고', '결혼', '개업', '축하', '병문안', '찬조', '기타');
  end if;
end
$$;

-- 2) 테이블 ----------------------------------------------------------------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  target_name  text not null,
  relation     text not null default '',
  event_date   date not null,
  event_type   public.event_type not null default '기타',
  amount       integer not null default 0 check (amount >= 0),
  sent_wreath  boolean not null default false,
  attended     boolean not null default false,
  notes        text not null default '',
  image_path   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists events_user_date_idx on public.events (user_id, event_date desc);
create index if not exists events_user_name_idx on public.events (user_id, target_name);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

-- 3) RLS: 자기 데이터만 읽고 쓴다 -------------------------------------------
alter table public.events enable row level security;

drop policy if exists "events_select_own" on public.events;
create policy "events_select_own" on public.events
  for select using (auth.uid() = user_id);

drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own" on public.events
  for insert with check (auth.uid() = user_id);

drop policy if exists "events_update_own" on public.events;
create policy "events_update_own" on public.events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "events_delete_own" on public.events;
create policy "events_delete_own" on public.events
  for delete using (auth.uid() = user_id);

-- 4) 실시간 구독 (다른 기기의 변경이 바로 반영되도록) --------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end
$$;

-- 5) 청첩장/부고장 이미지 버킷 ----------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', false)
on conflict (id) do nothing;

-- 경로 규칙: <user_id>/<uuid>.jpg  → 폴더 이름이 곧 소유자다.
drop policy if exists "event_images_select_own" on storage.objects;
create policy "event_images_select_own" on storage.objects
  for select using (
    bucket_id = 'event-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "event_images_insert_own" on storage.objects;
create policy "event_images_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'event-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "event_images_update_own" on storage.objects;
create policy "event_images_update_own" on storage.objects
  for update using (
    bucket_id = 'event-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "event_images_delete_own" on storage.objects;
create policy "event_images_delete_own" on storage.objects
  for delete using (
    bucket_id = 'event-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
