-- ============================================================================
-- Toduo — схема Supabase
-- Выполните этот файл целиком в Supabase → SQL Editor (New query → вставить → Run).
-- Скрипт идемпотентный: можно запускать повторно.
-- ============================================================================

-- ── Расширения ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Таблица профилей ────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- Автосоздание профиля при регистрации пользователя.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Сообщения (чат) ─────────────────────────────────────────────────────────
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_created_at on public.messages (created_at);

-- ── Задачи ──────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id          bigint generated always as identity primary key,
  title       text not null,
  description text,
  status      text not null default 'brief'
              check (status in ('brief', 'in_progress', 'done')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── Вложения задач (файлы / ссылки) по этапам ───────────────────────────────
create table if not exists public.task_attachments (
  id         bigint generated always as identity primary key,
  task_id    bigint not null references public.tasks (id) on delete cascade,
  stage      text not null check (stage in ('brief', 'process', 'result')),
  kind       text not null check (kind in ('file', 'link')),
  url        text not null,
  name       text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_attach_task on public.task_attachments (task_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Приватный инструмент на двоих: любой вошедший пользователь имеет полный доступ.
alter table public.profiles         enable row level security;
alter table public.messages         enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_attachments enable row level security;

-- profiles: читают все вошедшие; правит каждый только свой профиль.
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update" on public.profiles for update to authenticated using (auth.uid() = id);

-- messages / tasks / task_attachments: полный доступ вошедшим.
drop policy if exists "messages all" on public.messages;
create policy "messages all" on public.messages
  for all to authenticated using (true) with check (true);

drop policy if exists "tasks all" on public.tasks;
create policy "tasks all" on public.tasks
  for all to authenticated using (true) with check (true);

drop policy if exists "attachments all" on public.task_attachments;
create policy "attachments all" on public.task_attachments
  for all to authenticated using (true) with check (true);

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Добавляем таблицы в публикацию (идемпотентно).
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.task_attachments;
  exception when duplicate_object then null;
  end;
end $$;

-- ── Storage: бакет для вложений ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Публичное чтение файлов; запись/удаление — только вошедшим.
drop policy if exists "attachments public read"  on storage.objects;
drop policy if exists "attachments auth write"   on storage.objects;
drop policy if exists "attachments auth delete"  on storage.objects;
create policy "attachments public read" on storage.objects
  for select using (bucket_id = 'attachments');
create policy "attachments auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'attachments');
create policy "attachments auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'attachments');

-- Готово ✔
