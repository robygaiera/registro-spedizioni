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
  colli           integer check (colli is null or colli >= 0),
  modello         text,
  cauzione        text,
  stato           text not null default 'Aperto'
                  check (stato in ('Aperto', 'Chiuso', 'Annullato')),
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
