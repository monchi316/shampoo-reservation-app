-- Reservation reminder job: schema additions

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS reminder_error text;

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS reminder_template text;

