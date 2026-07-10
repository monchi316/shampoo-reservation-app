alter table public.tenants
  add column if not exists line_message_template_reservation_cancel text;
