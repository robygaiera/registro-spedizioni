-- ============================================================
-- Migrazione 002 - ciclo di rientro
-- Esegui questo file nel SQL Editor di Supabase, una volta sola.
-- Non cancella dati: aggiunge colonne e aggiorna i vincoli.
-- ============================================================

alter table public.spedizioni
  add column if not exists rientro_effettivo date;

alter table public.spedizioni
  add column if not exists modalita_rientro text;

alter table public.spedizioni
  add column if not exists ddt_rientro text;

comment on column public.spedizioni.data_ritiro is
  'Data prevista di rientro del materiale';
comment on column public.spedizioni.rientro_effettivo is
  'Data in cui il materiale e rientrato in magazzino';
comment on column public.spedizioni.modalita_rientro is
  'Etichetta nostra / A carico cliente / Ritiro nostro / Di persona / Altro';

-- ------------------------------------------------------------
-- stato: aggiunge "Rientrato"
-- Il vincolo originale e anonimo, quindi lo cerco e lo ricreo.
-- ------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.spedizioni'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%stato%'
  loop
    execute format('alter table public.spedizioni drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.spedizioni
  add constraint spedizioni_stato_check
  check (stato in ('Aperto', 'Rientrato', 'Chiuso', 'Annullato'));

alter table public.spedizioni
  drop constraint if exists spedizioni_modalita_rientro_check;

alter table public.spedizioni
  add constraint spedizioni_modalita_rientro_check
  check (
    modalita_rientro is null
    or modalita_rientro in (
      'Etichetta nostra',
      'A carico cliente',
      'Ritiro nostro',
      'Di persona',
      'Altro'
    )
  );

create index if not exists spedizioni_data_ritiro_idx
  on public.spedizioni (data_ritiro);
create index if not exists spedizioni_rientro_effettivo_idx
  on public.spedizioni (rientro_effettivo);

-- ------------------------------------------------------------
-- Verifica rapida
-- ------------------------------------------------------------
-- select stato, count(*) from public.spedizioni group by stato order by 1;
