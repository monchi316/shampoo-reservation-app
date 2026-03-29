-- マルチテナント前提の土台: デフォルトテナント、メニュー料金、営業時間、予約に tenant_id

CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid PRIMARY KEY,
    name text NOT NULL DEFAULT 'Default',
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tenants (id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'Default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tenant_scheduling_settings (
    tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
    business_hours_mode text NOT NULL DEFAULT 'uniform' CHECK (
        business_hours_mode IN ('uniform', 'weekly')
    ),
    uniform_open time,
    uniform_close time,
    avg_service_minutes_per_car int NOT NULL DEFAULT 60 CHECK (
        avg_service_minutes_per_car > 0
        AND avg_service_minutes_per_car <= 1440
    ),
    avg_travel_minutes int NOT NULL DEFAULT 30 CHECK (
        avg_travel_minutes >= 0
        AND avg_travel_minutes <= 480
    ),
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tenant_scheduling_settings (
    tenant_id,
    business_hours_mode,
    uniform_open,
    uniform_close,
    avg_service_minutes_per_car,
    avg_travel_minutes
)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'uniform',
    '09:00',
    '18:00',
    60,
    30
)
ON CONFLICT (tenant_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.business_hours_weekly (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    day_of_week smallint NOT NULL CHECK (
        day_of_week >= 0
        AND day_of_week <= 6
    ),
    is_closed boolean NOT NULL DEFAULT false,
    open_time time,
    close_time time,
    UNIQUE (tenant_id, day_of_week)
);

INSERT INTO
    public.business_hours_weekly (tenant_id, day_of_week, is_closed, open_time, close_time)
SELECT
    '00000000-0000-4000-8000-000000000001'::uuid,
    d,
    CASE
        WHEN d = 0 THEN true
        ELSE false
    END,
    CASE
        WHEN d = 0 THEN NULL
        ELSE '09:00'::time
    END,
    CASE
        WHEN d = 0 THEN NULL
        ELSE '18:00'::time
    END
FROM
    generate_series(0, 6) AS d
ON CONFLICT (tenant_id, day_of_week) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.business_hours_exceptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    exception_date date NOT NULL,
    is_closed boolean NOT NULL DEFAULT false,
    open_time time,
    close_time time,
    UNIQUE (tenant_id, exception_date)
);

CREATE TABLE IF NOT EXISTS public.service_menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    slug text NOT NULL,
    label text NOT NULL,
    price int NOT NULL DEFAULT 0 CHECK (price >= 0),
    sort_order int NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    UNIQUE (tenant_id, slug)
);

INSERT INTO
    public.service_menu_items (tenant_id, slug, label, price, sort_order)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'size_s',
    '洗車 Sサイズ',
    8000,
    10
),
(
    '00000000-0000-4000-8000-000000000001',
    'size_m',
    '洗車 Mサイズ',
    9000,
    20
),
(
    '00000000-0000-4000-8000-000000000001',
    'size_l',
    '洗車 Lサイズ',
    10000,
    30
),
(
    '00000000-0000-4000-8000-000000000001',
    'interior_addon',
    '内装清掃オプション（1台あたり）',
    3000,
    40
)
ON CONFLICT (tenant_id, slug) DO NOTHING;

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants (id);

UPDATE public.reservations
SET
    tenant_id = '00000000-0000-4000-8000-000000000001'
WHERE
    tenant_id IS NULL;

ALTER TABLE public.reservations
ALTER COLUMN tenant_id
SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE public.reservations
ALTER COLUMN tenant_id
SET NOT NULL;
