-- Prevent duplicate car master rows by maker+model.
-- This makes upsert(..., { onConflict: "maker,model" }) work as intended.
create unique index if not exists cars_maker_model_key
on public.cars (maker, model);
