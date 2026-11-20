-- ============================================================
-- Migrazione 002 - ciclo di rientro
-- Esegui questo file nel SQL Editor di Supabase.
-- E' idempotente: puoi rieseguirlo senza perdere dati.
-- ============================================================

alter table public.spedizioni
  add column if not exists rientro_effettivo date;

alter table public.spedizioni
  add column if not exists modalita_rientro text;

alter table public.spedizioni
  add column if not exists ddt_rientro text;

alter table public.spedizioni
  add column if not exists ritiro_impostato boolean not null default false;

alter table public.spedizioni
  add column if not exists rientrato boolean not null default false;

comment on column public.spedizioni.data_ritiro is
  'Data di impostazione del ritiro (primo giorno lavorativo post offerta)';
comment on column public.spedizioni.rientro_effettivo is
  'Data in cui il materiale e rientrato in magazzino';
comment on column public.spedizioni.modalita_rientro is
  'Etichetta nostra / A carico cliente / Ritiro nostro / Di persona / Altro';
comment on column public.spedizioni.ritiro_impostato is
  'Spunta: impostazione del ritiro confermata';
comment on column public.spedizioni.rientrato is
  'Spunta: materiale rientrato in magazzino';

-- ------------------------------------------------------------
-- stato: aggiunge "Ritiro impostato"
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
  check (stato in ('Aperto', 'Ritiro impostato', 'Rientrato', 'Chiuso', 'Annullato'));

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
-- Allinea i dati gia presenti alle due spunte
-- ------------------------------------------------------------
-- Chiuse o con data di rientro: rientrate
update public.spedizioni
set rientrato = true
where (stato = 'Chiuso' or rientro_effettivo is not null)
  and rientrato = false;

update public.spedizioni
set ritiro_impostato = true
where (stato = 'Chiuso' or rientro_effettivo is not null)
  and ritiro_impostato = false;

-- Impostazioni con data passata: presumibilmente gia fatte
update public.spedizioni
set ritiro_impostato = true
where data_ritiro < current_date
  and ritiro_impostato = false;

-- Impostazioni con data di oggi o futura: ancora da fare
update public.spedizioni
set ritiro_impostato = false
where stato in ('Aperto', 'Ritiro impostato')
  and data_ritiro >= current_date
  and ritiro_impostato = true;

update public.spedizioni
set stato = 'Ritiro impostato'
where stato = 'Aperto'
  and ritiro_impostato = true;

update public.spedizioni
set stato = 'Rientrato'
where stato in ('Aperto', 'Ritiro impostato')
  and rientrato = true;

-- ------------------------------------------------------------
-- Verifica rapida
-- ------------------------------------------------------------
-- select stato, ritiro_impostato, rientrato, count(*)
-- from public.spedizioni group by 1,2,3 order by 1,2,3;
