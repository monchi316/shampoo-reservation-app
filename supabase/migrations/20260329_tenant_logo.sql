-- テナント（店舗）ごとの企業ロゴ

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS logo_path text;

