-- ============================================================
-- Migrazione 003 - dati del DDT di uscita
-- Esegui nel SQL Editor di Supabase.
-- ============================================================

alter table public.spedizioni
  add column if not exists ddt_uscita text;

alter table public.spedizioni
  add column if not exists corriere text;

alter table public.spedizioni
  add column if not exists peso numeric(10, 2);

comment on column public.spedizioni.ddt_uscita is
  'Numero del DDT di uscita';
comment on column public.spedizioni.corriere is
  'Corriere o vettore indicato sul DDT';
comment on column public.spedizioni.peso is
  'Peso in kg indicato sul DDT';

create index if not exists spedizioni_ddt_uscita_idx
  on public.spedizioni (ddt_uscita);
