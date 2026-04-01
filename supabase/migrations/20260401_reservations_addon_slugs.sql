-- 車両ごとの追加オプション（slug配列）を予約行に保持
alter table public.reservations
add column if not exists addon_slugs text[] not null default '{}';

