-- 予約受付の最短リードタイム（現在時刻から何日/何時間後以降の予約なら受け付けるか）
-- 例: booking_lead_days=0, booking_lead_hours=3 なら「開始時刻が現在から3時間以内」は受け付けません。

ALTER TABLE public.tenant_scheduling_settings
ADD COLUMN IF NOT EXISTS booking_lead_days int NOT NULL DEFAULT 0;

ALTER TABLE public.tenant_scheduling_settings
ADD COLUMN IF NOT EXISTS booking_lead_hours int NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'booking_lead_days_range'
    ) THEN
        ALTER TABLE public.tenant_scheduling_settings
        ADD CONSTRAINT booking_lead_days_range
        CHECK (booking_lead_days >= 0 AND booking_lead_days <= 30);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'booking_lead_hours_range'
    ) THEN
        ALTER TABLE public.tenant_scheduling_settings
        ADD CONSTRAINT booking_lead_hours_range
        CHECK (booking_lead_hours >= 0 AND booking_lead_hours <= 23);
    END IF;
END $$;

