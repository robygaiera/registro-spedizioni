-- ============================================================
-- Registro spedizioni 2026 - schema Supabase
-- Esegui questo file nel SQL Editor di Supabase.
-- ============================================================

create table if not exists public.spedizioni (
  id              uuid primary key default gen_random_uuid(),
  data_uscita     date,
  indirizzo       text,
  cliente         text,
  numero_offerta  text,
  data_ritiro     date,
  rientro_effettivo date,
  modalita_rientro text
                  check (
                    modalita_rientro is null
                    or modalita_rientro in (
                      'Etichetta nostra', 'A carico cliente', 'Ritiro nostro',
                      'Di persona', 'Altro'
                    )
                  ),
  ddt_rientro     text,
  ddt_uscita      text,
  corriere        text,
  peso            numeric(10, 2),
  ritiro_impostato boolean not null default false,
  rientrato       boolean not null default false,
  colli           integer check (colli is null or colli >= 0),
  modello         text,
  stato           text not null default 'Aperto'
                  check (stato in ('Aperto', 'Ritiro impostato', 'Rientrato', 'Chiuso', 'Annullato')),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid()
);

comment on table public.spedizioni is
  'Registro spedizioni 2026. Accesso consentito solo agli utenti autenticati.';

create index if not exists spedizioni_data_uscita_idx
  on public.spedizioni (data_uscita desc nulls last);
create index if not exists spedizioni_cliente_idx
  on public.spedizioni (lower(cliente));
create index if not exists spedizioni_stato_idx
  on public.spedizioni (stato);
create index if not exists spedizioni_data_ritiro_idx
  on public.spedizioni (data_ritiro);
create index if not exists spedizioni_rientro_effettivo_idx
  on public.spedizioni (rientro_effettivo);
create index if not exists spedizioni_ddt_uscita_idx
  on public.spedizioni (ddt_uscita);

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
comment on column public.spedizioni.ddt_uscita is
  'Numero del DDT di uscita';
comment on column public.spedizioni.corriere is
  'Corriere o vettore indicato sul DDT';
comment on column public.spedizioni.peso is
  'Peso in kg indicato sul DDT';

-- ------------------------------------------------------------
-- updated_at automatico
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spedizioni_touch_updated_at on public.spedizioni;
create trigger spedizioni_touch_updated_at
  before update on public.spedizioni
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Sicurezza: RLS attiva, niente accesso anonimo
-- ------------------------------------------------------------
alter table public.spedizioni enable row level security;

revoke all on public.spedizioni from anon;
grant select, insert, update, delete on public.spedizioni to authenticated;

drop policy if exists "spedizioni_lettura" on public.spedizioni;
create policy "spedizioni_lettura"
  on public.spedizioni for select
  to authenticated
  using (true);

drop policy if exists "spedizioni_inserimento" on public.spedizioni;
create policy "spedizioni_inserimento"
  on public.spedizioni for insert
  to authenticated
  with check (true);

drop policy if exists "spedizioni_modifica" on public.spedizioni;
create policy "spedizioni_modifica"
  on public.spedizioni for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "spedizioni_cancellazione" on public.spedizioni;
create policy "spedizioni_cancellazione"
  on public.spedizioni for delete
  to authenticated
  using (true);

-- ------------------------------------------------------------
-- Promemoria
-- ------------------------------------------------------------
-- 1. Authentication -> Providers -> Email: disattiva "Allow new users to sign up".
-- 2. Authentication -> Users -> Add user: crea gli account autorizzati
--    (spunta "Auto Confirm User").
-- 3. NON usare la service_role key nel browser.
