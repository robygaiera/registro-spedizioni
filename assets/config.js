/**
 * Configurazione del cruscotto.
 *
 * Prendi i due valori da Supabase:
 *   Project Settings -> API -> Project URL / Project API keys -> anon public
 *
 * La anon key e' pensata per stare nel browser: la sicurezza vera
 * e' nelle policy RLS definite in supabase/schema.sql.
 * NON incollare qui la service_role key.
 */

export const SUPABASE_URL = 'https://kebjzcjtcgdmgdhudbjm.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_YtPN7DD1BarOz5uOVhjkmw_YuT7D2Tg';

export const APP_TITLE = 'Registro spedizioni';
export const APP_YEAR = '2026';
export const COMPANY_NAME = 'Silentsystem';
