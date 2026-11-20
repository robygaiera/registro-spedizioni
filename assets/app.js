import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  APP_TITLE,
  APP_YEAR,
  COMPANY_NAME,
} from './config.js';

const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const DEMO_KEY = 'registro2026.demo.v1';
const PAGE = 1000;
const STEP = 80;

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MONTHS_LONG = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });
const nf = new Intl.NumberFormat('it-IT');
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);

const state = {
  demo: false,
  session: null,
  rows: [],
  filters: { q: '', month: '', stato: '', modello: '' },
  sort: { key: 'data_uscita', dir: 'desc' },
  view: 'tutte',
  pickupDate: nextWorkingDay(todayISO()),
  pickupShowDone: false,
  visible: STEP,
  loading: false,
  saving: false,
  editingId: null,
  initialStato: 'Aperto',
  initialFlags: { ritiro: false, rientrato: false },
  rowTasksPending: new Set(),
  lastFocus: null,
  lastLoad: 0,
};

const el = {
  auth: $('#auth-view'),
  setup: $('#setup-view'),
  app: $('#app'),
  loginForm: $('#login-form'),
  loginEmail: $('#login-email'),
  loginPassword: $('#login-password'),
  loginError: $('#login-error'),
  loginSubmit: $('#login-submit'),
  loginDemo: $('#login-demo'),
  setupDemo: $('#setup-demo'),
  userEmail: $('#user-email'),
  userAvatar: $('#user-avatar'),
  logout: $('#logout'),
  refresh: $('#refresh'),
  sidebar: $('#sidebar'),
  sidebarScrim: $('#sidebar-scrim'),
  sidebarClose: $('#sidebar-close'),
  menuToggle: $('#menu-toggle'),
  systemStatus: $('#system-status'),
  connectionText: $('#connection-text'),
  pageTitle: $('#page-title'),
  pageSubtitle: $('#page-subtitle'),
  crumbCurrent: $('#crumb-current'),
  demoBanner: $('#demo-banner'),
  demoReset: $('#demo-reset'),
  search: $('#search'),
  filterMonth: $('#filter-month'),
  filterStato: $('#filter-stato'),
  filterModello: $('#filter-modello'),
  resetFilters: $('#reset-filters'),
  filterHint: $('#filter-hint'),
  sortMobile: $('#sort-mobile'),
  emptyTitle: $('#empty-state .empty-title'),
  emptyText: $('#empty-state .muted'),
  pickupBar: $('#pickup-bar'),
  pickupPrev: $('#pickup-prev'),
  pickupNext: $('#pickup-next'),
  pickupDateInput: $('#pickup-date-input'),
  pickupLabel: $('#pickup-label'),
  pickupShowDone: $('#pickup-show-done'),
  pickupCount: $('#pickup-count'),
  exportBtn: $('#export'),
  newEntry: $('#new-entry'),
  importDdt: $('#import-ddt'),
  importDdtLabel: $('#import-ddt-label'),
  ddtFileInput: $('#ddt-file-input'),
  resultCount: $('#result-count'),
  loadError: $('#load-error'),
  loadErrorText: $('#load-error-text'),
  retry: $('#retry'),
  table: $('#table'),
  tbody: $('#tbody'),
  tableLoading: $('#table-loading'),
  emptyState: $('#empty-state'),
  emptyReset: $('#empty-reset'),
  loadMore: $('#load-more'),
  drawer: $('#drawer'),
  backdrop: $('#drawer-backdrop'),
  drawerTitle: $('#drawer-title'),
  drawerClose: $('#drawer-close'),
  form: $('#entry-form'),
  fId: $('#f-id'),
  fDataUscita: $('#f-data-uscita'),
  fDataRitiro: $('#f-data-ritiro'),
  fCliente: $('#f-cliente'),
  fIndirizzo: $('#f-indirizzo'),
  fOfferta: $('#f-offerta'),
  fColli: $('#f-colli'),
  fModello: $('#f-modello'),
  fRitiroFatto: $('#f-ritiro-fatto'),
  fRientrato: $('#f-rientrato'),
  fDataRitiro: $('#f-data-ritiro'),
  fRientroEffettivo: $('#f-rientro-effettivo'),
  fModalita: $('#f-modalita'),
  fDdtRientro: $('#f-ddt-rientro'),
  fDdtUscita: $('#f-ddt-uscita'),
  fCorriere: $('#f-corriere'),
  fPeso: $('#f-peso'),
  fNote: $('#f-note'),
  formError: $('#form-error'),
  drawerStato: $('#drawer-stato'),
  taskRitiro: $('#task-ritiro'),
  taskRientrato: $('#task-rientrato'),
  quickActions: $('#quick-actions'),
  quickClose: $('#quick-close'),
  entryDelete: $('#entry-delete'),
  entryCancel: $('#entry-cancel'),
  entrySave: $('#entry-save'),
  modelList: $('#modelli-list'),
  toast: $('#toast'),
};

let supabase = null;
let store = null;
let searchTimer = null;
let toastTimer = null;
let toastHideTimer = null;

const clone = (value) => (
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
);

const newId = () => (
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
);

/* ------------------------------------------------------------------ */
/* avvio                                                              */
/* ------------------------------------------------------------------ */

initChrome();
wireEvents();

const params = new URLSearchParams(location.search);
if (params.get('demo') === '1') {
  startDemo();
} else if (isConfigured()) {
  showView('auth');
  initSupabase();
} else {
  showView('setup');
}

function isConfigured() {
  return (
    typeof SUPABASE_URL === 'string' &&
    SUPABASE_URL.startsWith('https://') &&
    typeof SUPABASE_ANON_KEY === 'string' &&
    SUPABASE_ANON_KEY.length > 40
  );
}

function initChrome() {
  document.title = `${APP_TITLE} ${APP_YEAR} · Silentsystem`;
  const title = $('#app-title');
  const year = $('#app-year');
  if (title) title.textContent = APP_TITLE;
  if (year) year.textContent = APP_YEAR;
  $$('[data-company]').forEach((node) => { node.textContent = COMPANY_NAME; });
}

function showView(name) {
  el.auth.hidden = name !== 'auth';
  el.setup.hidden = name !== 'setup';
  el.app.hidden = name !== 'app';
}

function setSidebar(open) {
  if (!el.sidebar) return;
  el.sidebar.classList.toggle('sidebar-open', open);
  el.sidebarScrim.hidden = !open;
  document.body.classList.toggle('nav-open', open);
  el.menuToggle.setAttribute('aria-expanded', String(open));

  if (open) {
    el.sidebar.querySelector('button, a')?.focus();
  } else if (el.menuToggle.getClientRects().length) {
    el.menuToggle.focus();
  }
}

function initials(value) {
  const text = String(value ?? '').trim();
  if (!text) return '--';
  if (text.includes('@')) return text.slice(0, 2).toUpperCase();
  return text.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

/* ------------------------------------------------------------------ */
/* autenticazione                                                     */
/* ------------------------------------------------------------------ */

async function initSupabase() {
  try {
    const { createClient } = await import(SUPABASE_CDN);
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (data.session) {
      await enterApp(data.session);
    } else {
      showView('auth');
    }

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        state.session = null;
        state.rows = [];
        closeDrawer();
        showView('auth');
      }
    });
  } catch (err) {
    console.error(err);
    showView('auth');
    showLoginError('Impossibile inizializzare Supabase. Controlla la connessione e la configurazione.');
  }
}

async function enterApp(session) {
  state.session = session ?? null;
  state.demo = false;
  const email = session?.user?.email ?? '';
  el.userEmail.textContent = email || 'account';
  el.userAvatar.textContent = initials(email);
  el.systemStatus.textContent = 'SISTEMA ATTIVO';
  el.connectionText.textContent = 'Dati sincronizzati con Supabase.';
  el.demoBanner.hidden = true;
  el.loginDemo.hidden = true;
  showView('app');
  store = supabaseStore(supabase);
  await loadRows();
}

function wireEvents() {
  el.loginForm.addEventListener('submit', handleLogin);

  el.logout.addEventListener('click', async () => {
    if (state.demo) {
      location.href = location.pathname;
      return;
    }
    try {
      await supabase?.auth.signOut();
    } finally {
      state.session = null;
      state.rows = [];
      el.loginForm.reset();
      el.loginError.hidden = true;
      showView('auth');
    }
  });

  el.setupDemo.addEventListener('click', () => { location.search = '?demo=1'; });
  el.loginDemo.addEventListener('click', () => { location.search = '?demo=1'; });

  el.menuToggle.addEventListener('click', () => {
    setSidebar(!el.sidebar.classList.contains('sidebar-open'));
  });
  el.sidebarClose.addEventListener('click', () => setSidebar(false));
  el.sidebarScrim.addEventListener('click', () => setSidebar(false));

  el.refresh.addEventListener('click', async () => {
    if (state.loading) return;
    await loadRows({ silent: true });
    toast('Registro aggiornato');
  });

  el.demoReset.addEventListener('click', () => {
    if (!confirm('Ripristinare i dati di esempio? Le modifiche demo andranno perse.')) return;
    localStorage.removeItem(DEMO_KEY);
    location.reload();
  });

  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.q = el.search.value;
      state.visible = STEP;
      render();
    }, 120);
  });

  el.filterMonth.addEventListener('change', () => {
    state.filters.month = el.filterMonth.value;
    state.visible = STEP;
    render();
  });
  el.filterStato.addEventListener('change', () => {
    state.filters.stato = el.filterStato.value;
    state.visible = STEP;
    render();
  });
  el.filterModello.addEventListener('change', () => {
    state.filters.modello = el.filterModello.value;
    state.visible = STEP;
    render();
  });

  el.sortMobile.addEventListener('change', () => {
    const [key, dir] = el.sortMobile.value.split(':');
    if (!key || !dir) return;
    state.sort = { key, dir };
    state.visible = STEP;
    render();
  });

  $$('.view-tab').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  el.pickupPrev.addEventListener('click', () => setPickupDate(shiftWorkingDay(state.pickupDate, -1)));
  el.pickupNext.addEventListener('click', () => setPickupDate(shiftWorkingDay(state.pickupDate, 1)));
  el.pickupDateInput.addEventListener('change', () => setPickupDate(el.pickupDateInput.value));
  el.pickupShowDone.addEventListener('change', () => {
    state.pickupShowDone = el.pickupShowDone.checked;
    state.visible = STEP;
    render();
  });

  el.fRitiroFatto.addEventListener('change', () => handleTaskToggle('ritiro'));
  el.fRientrato.addEventListener('change', () => handleTaskToggle('rientrato'));
  el.fDataRitiro.addEventListener('change', () => {
    el.fRitiroFatto.checked = Boolean(el.fDataRitiro.value);
    syncTaskUI();
    updateDrawerState();
    updateQuickActions();
  });
  el.fRientroEffettivo.addEventListener('change', () => {
    el.fRientrato.checked = Boolean(el.fRientroEffettivo.value);
    syncTaskUI();
    updateDrawerState();
    updateQuickActions();
  });

  el.quickClose.addEventListener('click', () => handleQuickAction());

  el.resetFilters.addEventListener('click', resetFilters);
  el.emptyReset.addEventListener('click', resetFilters);
  el.retry.addEventListener('click', () => loadRows());

  el.loadMore.addEventListener('click', () => {
    state.visible += STEP;
    render();
  });

  el.newEntry.addEventListener('click', () => openDrawer(null));
  el.exportBtn.addEventListener('click', exportCsv);
  el.importDdt.addEventListener('click', () => {
    el.ddtFileInput.value = '';
    el.ddtFileInput.click();
  });
  el.ddtFileInput.addEventListener('change', () => {
    const file = el.ddtFileInput.files?.[0];
    if (file) importDdtFile(file);
  });

  $$('.sort-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.sort;
      if (state.sort.key === key) {
        state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        const asc = key === 'cliente' || key === 'modello' || key === 'stato';
        state.sort = { key, dir: asc ? 'asc' : 'desc' };
      }
      state.visible = STEP;
      render();
    });
  });

  el.tbody.addEventListener('click', (event) => {
    if (event.target.closest('.row-tasks')) return;
    const tr = event.target.closest('tr[data-id]');
    if (tr) openDrawer(state.rows.find((row) => row.id === tr.dataset.id) ?? null);
  });

  el.tbody.addEventListener('change', (event) => {
    const input = event.target.closest('input[data-row-task]');
    if (!input) return;
    handleRowTask(input.dataset.id, input.dataset.rowTask, input.checked);
  });

  el.tbody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('.row-tasks')) return;
    const tr = event.target.closest('tr[data-id]');
    if (!tr) return;
    event.preventDefault();
    openDrawer(state.rows.find((row) => row.id === tr.dataset.id) ?? null);
  });

  el.drawerClose.addEventListener('click', closeDrawer);
  el.entryCancel.addEventListener('click', closeDrawer);
  el.backdrop.addEventListener('click', closeDrawer);
  el.form.addEventListener('submit', handleSave);
  el.entryDelete.addEventListener('click', handleDelete);

  el.drawer.addEventListener('keydown', trapFocus);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (el.drawer.classList.contains('is-open')) {
      closeDrawer();
    } else if (el.sidebar.classList.contains('sidebar-open')) {
      setSidebar(false);
    }
  });

  window.addEventListener('focus', maybeAutoRefresh);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) maybeAutoRefresh();
  });
}

async function handleLogin(event) {
  event.preventDefault();
  hideLoginError();

  if (!supabase) {
    showLoginError('Connessione in corso. Riprova tra un istante.');
    return;
  }

  const email = el.loginEmail.value.trim();
  const password = el.loginPassword.value;
  if (!email || !password) {
    showLoginError('Inserisci email e password.');
    return;
  }

  setLoginBusy(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showLoginError(authError(error));
      return;
    }
    await enterApp(data.session);
  } catch (err) {
    console.error(err);
    showLoginError('Connessione non disponibile. Riprova.');
  } finally {
    setLoginBusy(false);
  }
}

function setLoginBusy(busy) {
  el.loginSubmit.disabled = busy;
  el.loginSubmit.textContent = busy ? 'Accesso…' : 'Entra';
}

function showLoginError(message) {
  el.loginError.textContent = message;
  el.loginError.hidden = false;
}

function hideLoginError() {
  el.loginError.hidden = true;
}

function authError(error) {
  const message = String(error?.message ?? '');
  if (/invalid login credentials/i.test(message)) return 'Email o password non corretti.';
  if (/email not confirmed/i.test(message)) return 'Email non ancora confermata. Contatta l\'amministratore.';
  if (/failed to fetch|network/i.test(message)) return 'Impossibile raggiungere il server. Controlla la connessione.';
  return message || 'Accesso non riuscito.';
}

/* ------------------------------------------------------------------ */
/* modalita demo                                                      */
/* ------------------------------------------------------------------ */

async function startDemo() {
  try {
    store = await demoStore();
    state.demo = true;
    el.userEmail.textContent = 'modalità demo';
    el.userAvatar.textContent = 'DE';
    el.systemStatus.textContent = 'MODALITÀ DEMO';
    el.connectionText.textContent = 'Dati di esempio solo in questo browser.';
    el.demoBanner.hidden = false;
    el.loginDemo.hidden = true;
    showView('app');
    await loadRows();
  } catch (err) {
    console.error(err);
    try { history.replaceState(null, '', location.pathname); } catch { /* file:// */ }
    showView('setup');
    toast('Demo non disponibile da questo indirizzo.', { error: true });
  }
}

async function demoStore() {
  const response = await fetch('data/demo.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('demo.json non trovato');
  const seed = await response.json();

  const read = () => {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return clone(seed);
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : clone(seed);
    } catch {
      return clone(seed);
    }
  };
  const write = (rows) => localStorage.setItem(DEMO_KEY, JSON.stringify(rows));

  if (!localStorage.getItem(DEMO_KEY)) write(seed);

  return {
    async list() {
      return read();
    },
    async create(payload) {
      const rows = read();
      const row = { ...payload, id: `demo-${newId()}` };
      rows.push(row);
      write(rows);
      return row;
    },
    async update(id, payload) {
      const rows = read();
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) throw new Error('Riga non trovata');
      rows[index] = { ...rows[index], ...payload, id };
      write(rows);
      return rows[index];
    },
    async remove(id) {
      write(read().filter((row) => row.id !== id));
    },
  };
}

/* ------------------------------------------------------------------ */
/* accesso dati                                                       */
/* ------------------------------------------------------------------ */

function supabaseStore(client) {
  return {
    async list() {
      let out = [];
      let from = 0;
      for (;;) {
        const { data, error } = await client
          .from('spedizioni')
          .select('*')
          .order('data_uscita', { ascending: false, nullsFirst: false })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        out = out.concat(data ?? []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return out;
    },
    async create(payload) {
      const { data, error } = await client
        .from('spedizioni')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    async update(id, payload) {
      const { data, error } = await client
        .from('spedizioni')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await client.from('spedizioni').delete().eq('id', id);
      if (error) throw error;
    },
  };
}

async function loadRows({ silent = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  el.loadError.hidden = true;
  el.refresh.classList.add('is-spinning');

  if (!silent) {
    el.tableLoading.hidden = false;
    el.table.hidden = true;
    el.emptyState.hidden = true;
    el.resultCount.textContent = 'Caricamento…';
  }

  try {
    const rows = await store.list();
    state.rows = rows.map(normalizeRow);
    state.lastLoad = Date.now();
    buildFilterOptions();
    render();
  } catch (err) {
    console.error(err);
    if (silent) {
      toast('Aggiornamento non riuscito', { error: true });
    } else {
      el.loadErrorText.textContent = dataError(err);
      el.loadError.hidden = false;
      el.table.hidden = true;
      el.emptyState.hidden = true;
      el.resultCount.textContent = '—';
    }
  } finally {
    state.loading = false;
    el.tableLoading.hidden = true;
    el.refresh.classList.remove('is-spinning');
  }
}

function normalizeRow(row) {
  const out = { ...row };
  out.stato = ['Aperto', 'Ritiro impostato', 'Rientrato', 'Chiuso', 'Annullato'].includes(row.stato)
    ? row.stato
    : 'Aperto';
  out.data_uscita = validDate(row.data_uscita);
  out.data_ritiro = validDate(row.data_ritiro);
  out.rientro_effettivo = validDate(row.rientro_effettivo);
  out.ritiro_impostato = Boolean(row.ritiro_impostato ?? out.data_ritiro);
  out.rientrato = Boolean(row.rientrato ?? ['Rientrato', 'Chiuso'].includes(out.stato));

  for (const key of [
    'indirizzo', 'cliente', 'numero_offerta', 'modello',
    'modalita_rientro', 'ddt_rientro', 'ddt_uscita', 'corriere', 'note',
  ]) {
    out[key] = row[key] === null || row[key] === undefined || String(row[key]).trim() === ''
      ? null
      : String(row[key]).trim();
  }

  const colli = row.colli === null || row.colli === undefined || row.colli === ''
    ? null
    : Number(row.colli);
  out.colli = Number.isFinite(colli) && colli >= 0 ? Math.trunc(colli) : null;

  const peso = row.peso === null || row.peso === undefined || row.peso === ''
    ? null
    : Number(row.peso);
  out.peso = Number.isFinite(peso) && peso >= 0 ? peso : null;
  return out;
}

function validDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : null;
}

function dataError(error) {
  const message = String(error?.message ?? '');
  if (/failed to fetch|network/i.test(message)) return 'Connessione non disponibile. Controlla la rete e riprova.';
  if (/jwt|session/i.test(message)) return 'Sessione scaduta. Ricarica la pagina e accedi di nuovo.';
  if (/permission|policy/i.test(message)) return 'Permesso negato. Verifica le policy RLS di Supabase.';
  return message || 'Impossibile caricare il registro.';
}

/* ------------------------------------------------------------------ */
/* filtri e rendering                                                 */
/* ------------------------------------------------------------------ */

function buildFilterOptions() {
  const months = [...new Set(state.rows.map((row) => row.data_uscita?.slice(0, 7)).filter(Boolean))]
    .sort()
    .reverse();
  const hasUndated = state.rows.some((row) => !row.data_uscita);

  el.filterMonth.replaceChildren(new Option('Tutti i mesi', ''));
  for (const month of months) {
    el.filterMonth.appendChild(new Option(monthLabel(month), month));
  }
  if (hasUndated) el.filterMonth.appendChild(new Option('Senza data', '__none'));
  el.filterMonth.value = state.filters.month;
  if (el.filterMonth.value !== state.filters.month) {
    state.filters.month = '';
    el.filterMonth.value = '';
  }

  const models = [...new Set(state.rows.map((row) => row.modello).filter(Boolean))]
    .sort(collator.compare);
  el.filterModello.replaceChildren(new Option('Tutti i modelli', ''));
  for (const model of models) el.filterModello.appendChild(new Option(model, model));
  el.filterModello.value = state.filters.modello;
  if (el.filterModello.value !== state.filters.modello) {
    state.filters.modello = '';
    el.filterModello.value = '';
  }

  el.modelList.replaceChildren();
  for (const model of models) {
    const option = document.createElement('option');
    option.value = model;
    el.modelList.appendChild(option);
  }
}

function getFiltered() {
  const query = normalize(state.filters.q);

  const filtered = state.rows.filter((row) => {
    if (state.view === 'ritiri') {
      if (['Chiuso', 'Annullato'].includes(row.stato)) return false;
      if (row.rientrato) return false;
      if (row.data_ritiro !== state.pickupDate) return false;
      if (!state.pickupShowDone && row.ritiro_impostato) return false;
    }
    if (state.view === 'rientrare' && !['Aperto', 'Ritiro impostato'].includes(row.stato)) return false;
    if (state.view === 'da_chiudere' && row.stato !== 'Rientrato') return false;
    if (state.view === 'archivio' && !['Chiuso', 'Annullato'].includes(row.stato)) return false;

    if (state.filters.stato && row.stato !== state.filters.stato) return false;
    if (state.filters.modello && row.modello !== state.filters.modello) return false;

    if (state.filters.month) {
      if (state.filters.month === '__none') {
        if (row.data_uscita) return false;
      } else if ((row.data_uscita ?? '').slice(0, 7) !== state.filters.month) {
        return false;
      }
    }

    if (query) {
      const haystack = normalize([
        row.cliente,
        row.indirizzo,
        row.numero_offerta,
        row.modello,
        row.note,
        row.stato,
        row.modalita_rientro,
        row.ddt_rientro,
        row.ddt_uscita,
        row.corriere,
        row.peso,
        row.data_uscita,
        row.data_uscita ? itDate(row.data_uscita) : '',
        row.data_ritiro,
        row.data_ritiro ? itDate(row.data_ritiro) : '',
        row.rientro_effettivo,
        row.rientro_effettivo ? itDate(row.rientro_effettivo) : '',
        row.colli,
      ].filter(Boolean).join(' '));
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  return filtered.sort(compareRows);
}

function compareRows(a, b) {
  const { key, dir } = state.sort;
  const va = a[key];
  const vb = b[key];
  const emptyA = va === null || va === undefined || va === '';
  const emptyB = vb === null || vb === undefined || vb === '';

  if (emptyA && emptyB) return collator.compare(a.cliente ?? '', b.cliente ?? '');
  if (emptyA) return 1;
  if (emptyB) return -1;

  let cmp;
  if (key === 'colli') {
    cmp = Number(va) - Number(vb);
  } else if (key === 'data_uscita' || key === 'data_ritiro' || key === 'rientro_effettivo') {
    cmp = String(va).localeCompare(String(vb));
  } else {
    cmp = collator.compare(String(va), String(vb));
  }
  if (cmp === 0) cmp = collator.compare(a.cliente ?? '', b.cliente ?? '');
  return dir === 'asc' ? cmp : -cmp;
}

function render() {
  const filtered = getFiltered();

  renderMeta(filtered);
  renderViews();
  renderPageHeading();
  renderPickupBar();
  renderTable(filtered);
  renderSort();
  updateFilterChrome(filtered);
}

function pickupRows() {
  return state.rows.filter((row) => (
    row.data_ritiro === state.pickupDate
    && !row.ritiro_impostato
    && !row.rientrato
    && !['Chiuso', 'Annullato'].includes(row.stato)
  ));
}

function pickupDoneCount() {
  return state.rows.filter((row) => (
    row.data_ritiro === state.pickupDate
    && row.ritiro_impostato
    && !['Chiuso', 'Annullato'].includes(row.stato)
  )).length;
}

function renderPickupBar() {
  const visible = state.view === 'ritiri';
  el.pickupBar.hidden = !visible;
  if (!visible) return;

  el.pickupLabel.textContent = longDate(state.pickupDate);
  el.pickupDateInput.value = state.pickupDate;
  el.pickupShowDone.checked = state.pickupShowDone;

  const open = pickupRows().length;
  const done = pickupDoneCount();

  if (open === 0 && done === 0) {
    el.pickupCount.textContent = 'Nessun ritiro';
  } else if (open === 0) {
    el.pickupCount.textContent = `0 da impostare · ${done} fatte`;
  } else {
    el.pickupCount.textContent = `${open} da impostare${done ? ` · ${done} fatte` : ''}`;
  }
}

function renderViews() {
  const counts = { tutte: state.rows.length, ritiri: 0, rientrare: 0, da_chiudere: 0, archivio: 0 };
  counts.ritiri = pickupRows().length;

  for (const row of state.rows) {
    if (row.stato === 'Aperto' || row.stato === 'Ritiro impostato') {
      counts.rientrare += 1;
    } else if (row.stato === 'Rientrato') {
      counts.da_chiudere += 1;
    } else if (row.stato === 'Chiuso' || row.stato === 'Annullato') {
      counts.archivio += 1;
    }
  }

  $$('.view-tab').forEach((button) => {
    const view = button.dataset.view;
    const count = button.querySelector('.view-count');
    if (count) count.textContent = nf.format(counts[view] ?? 0);
    const active = state.view === view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderMeta(rows) {
  if (state.view === 'ritiri') {
    const n = rows.length;
    let text;
    if (n === 0) {
      text = 'Nessun ritiro da impostare';
    } else if (state.pickupShowDone) {
      text = `${nf.format(n)} ritiri per questa data`;
    } else {
      text = `${nf.format(n)} ${n === 1 ? 'ritiro' : 'ritiri'} da impostare`;
    }
    el.resultCount.textContent = text;
    return;
  }

  const total = state.rows.length;
  let text = rows.length === total
    ? `${nf.format(total)} spedizioni`
    : `${nf.format(rows.length)} di ${nf.format(total)} spedizioni`;

  const packages = rows.reduce((sum, row) => sum + (row.colli ?? 0), 0);
  if (packages > 0) text += ` · ${nf.format(packages)} colli`;

  el.resultCount.textContent = text;
}

function renderTable(rows) {
  const visible = rows.slice(0, state.visible);
  el.tbody.innerHTML = visible.map(rowHtml).join('');

  const isEmpty = rows.length === 0;
  el.table.hidden = isEmpty;
  el.emptyState.hidden = !isEmpty;

  if (el.emptyTitle) {
    if (state.view === 'ritiri') {
      el.emptyTitle.textContent = 'Nessun ritiro da impostare';
      if (el.emptyText) {
        el.emptyText.textContent = 'Per questa data non ci sono impostazioni da fare. Prova un altro giorno.';
      }
    } else {
      el.emptyTitle.textContent = state.view === 'tutte'
        ? 'Nessuna spedizione trovata'
        : 'Nessuna spedizione in questa vista';
      if (el.emptyText) {
        el.emptyText.textContent = 'Prova a cambiare ricerca o filtri.';
      }
    }
  }
  el.emptyReset.hidden = state.view === 'ritiri' && !hasFilters();

  const remaining = rows.length - visible.length;
  el.loadMore.hidden = remaining <= 0;
  el.loadMore.textContent = `Mostra altre ${Math.min(STEP, remaining)}`;
}

function rowHtml(row) {
  const main = row.cliente ?? row.indirizzo ?? 'Senza nome';
  const sub = row.cliente && row.indirizzo ? `Dest. ${row.indirizzo}` : '';
  const badge = badgeClass(row.stato);
  const isReturned = Boolean(row.rientrato);

  let returnCell = '—';
  if (row.rientro_effettivo || row.data_ritiro) {
    returnCell = (row.rientro_effettivo
      ? `<span class="return-eff">rientrato ${esc(fmtNumeric(row.rientro_effettivo))}</span>`
      : '')
      + (row.data_ritiro
        ? `<span class="return-prev">imp. ${esc(fmtNumeric(row.data_ritiro))}</span>`
        : '');
  }

  const returnEmpty = !row.data_ritiro && !row.rientro_effettivo;
  const pending = state.rowTasksPending.has(row.id);
  const taskCell = `<td class="col-tasks row-tasks" data-label="Spunte">
    <label class="row-task" title="Impostazione ritiro">
      <input type="checkbox" data-row-task="ritiro" data-id="${esc(row.id)}"${row.ritiro_impostato ? ' checked' : ''}${pending ? ' disabled' : ''}>
      <span>Imp. ritiro</span>
    </label>
    <label class="row-task" title="Rientrato">
      <input type="checkbox" data-row-task="rientrato" data-id="${esc(row.id)}"${row.rientrato ? ' checked' : ''}${pending ? ' disabled' : ''}>
      <span>Rientrato</span>
    </label>
  </td>`;

  return `<tr data-id="${esc(row.id)}" tabindex="0" aria-label="Modifica ${esc(main)}"${isReturned ? ' class="is-returned"' : ''}>
    ${taskCell}
    <td class="col-date" data-label="Data">
      <span class="date-cell${row.data_uscita ? '' : ' is-empty'}">${row.data_uscita ? esc(fmtShort(row.data_uscita)) : '—'}</span>
      ${row.ddt_uscita ? `<span class="date-sub">DDT ${esc(row.ddt_uscita)}</span>` : ''}
    </td>
    <td class="col-notes" data-label="Note"${row.note ? '' : ' data-empty="true"'}><span class="note-cell${row.note ? '' : ' is-empty'}" title="${esc(row.note ?? '')}">${row.note ? esc(row.note) : '—'}</span></td>
    <td class="col-client" data-label="Cliente">
      <span class="client-main">${esc(main)}</span>
      ${sub ? `<span class="client-sub">${esc(sub)}</span>` : ''}
    </td>
    <td class="col-offer offer-cell" data-label="Offerta"${row.numero_offerta ? '' : ' data-empty="true"'}>${row.numero_offerta ? esc(row.numero_offerta) : '—'}</td>
    <td class="col-pickup return-cell" data-label="Ritiro"${returnEmpty ? ' data-empty="true"' : ''}>${returnCell}</td>
    <td class="col-packages packages-cell" data-label="Colli"${row.colli === null ? ' data-empty="true"' : ''}>${row.colli === null ? '—' : esc(nf.format(row.colli))}</td>
    <td class="col-model model-cell" data-label="Modello"${row.modello ? '' : ' data-empty="true"'}>${row.modello ? esc(row.modello) : '—'}</td>
    <td class="col-status" data-label="Stato"><span class="badge ${badge}">${esc(row.stato)}</span></td>
  </tr>`;
}

function badgeClass(stato) {
  switch (stato) {
    case 'Chiuso': return 'badge-closed';
    case 'Rientrato': return 'badge-returned';
    case 'Ritiro impostato': return 'badge-scheduled';
    case 'Annullato': return 'badge-cancelled';
    default: return 'badge-open';
  }
}

function renderSort() {
  const value = `${state.sort.key}:${state.sort.dir}`;
  if ($$('option', el.sortMobile).some((option) => option.value === value)) {
    el.sortMobile.value = value;
  }

  $$('.sort-btn').forEach((button) => {
    const th = button.closest('th');
    th.setAttribute(
      'aria-sort',
      state.sort.key === button.dataset.sort
        ? (state.sort.dir === 'asc' ? 'ascending' : 'descending')
        : 'none',
    );
  });
}

function updateFilterChrome(filtered) {
  const active = hasFilters();
  el.resetFilters.disabled = !active;
  el.filterHint.hidden = !active;
  el.filterHint.textContent = active ? 'Filtri attivi' : '';
  el.exportBtn.disabled = filtered.length === 0;
}

function hasFilters() {
  return Boolean(
    state.filters.q || state.filters.month || state.filters.stato || state.filters.modello,
  );
}

function resetFilters() {
  state.filters = { q: '', month: '', stato: '', modello: '' };
  state.visible = STEP;
  el.search.value = '';
  el.filterMonth.value = '';
  el.filterStato.value = '';
  el.filterModello.value = '';
  render();
}

const VIEW_DEFAULTS = {
  tutte: { key: 'data_uscita', dir: 'desc' },
  ritiri: { key: 'cliente', dir: 'asc' },
  rientrare: { key: 'data_uscita', dir: 'asc' },
  da_chiudere: { key: 'rientro_effettivo', dir: 'asc' },
  archivio: { key: 'data_uscita', dir: 'desc' },
};

const VIEW_META = {
  tutte: ['Registro spedizioni', 'Tutte le spedizioni 2026'],
  ritiri: ['Ritiri da impostare', 'Impostazioni del giorno selezionato'],
  rientrare: ['Da rientrare', 'Materiale ancora fuori'],
  da_chiudere: ['Da chiudere', 'Rientrato, pratica da verificare'],
  archivio: ['Archivio', 'Chiusi e annullati'],
};

function setView(view) {
  if (el.sidebar.classList.contains('sidebar-open')) setSidebar(false);
  if (!VIEW_DEFAULTS[view] || state.view === view) return;
  state.view = view;
  state.sort = { ...VIEW_DEFAULTS[view] };
  state.visible = STEP;
  render();
}

function renderPageHeading() {
  const [title, subtitle] = VIEW_META[state.view] ?? VIEW_META.tutte;
  if (el.pageTitle) el.pageTitle.textContent = title;
  if (el.pageSubtitle) el.pageSubtitle.textContent = subtitle;
  if (el.crumbCurrent) el.crumbCurrent.textContent = title;
}

function setPickupDate(date) {
  if (!validDate(date)) {
    el.pickupDateInput.value = state.pickupDate;
    return;
  }
  state.pickupDate = date;
  state.visible = STEP;
  render();
}

/* ------------------------------------------------------------------ */
/* drawer / form                                                      */
/* ------------------------------------------------------------------ */

function openDrawer(row) {
  if (el.sidebar.classList.contains('sidebar-open')) setSidebar(false);
  state.lastFocus = document.activeElement;
  state.editingId = row?.id ?? null;
  state.initialStato = row?.stato ?? 'Aperto';
  state.initialFlags = {
    ritiro: Boolean(row?.ritiro_impostato ?? row?.data_ritiro),
    rientrato: Boolean(row?.rientrato ?? ['Rientrato', 'Chiuso'].includes(row?.stato)),
  };
  el.formError.hidden = true;

  el.drawerTitle.textContent = row ? 'Modifica spedizione' : 'Nuova spedizione';
  setField(el.fId, row?.id ?? '');
  setField(el.fDataUscita, row?.data_uscita ?? todayISO());
  setField(el.fDataRitiro, row?.data_ritiro ?? '');
  setField(el.fCliente, row?.cliente ?? '');
  setField(el.fIndirizzo, row?.indirizzo ?? '');
  setField(el.fOfferta, row?.numero_offerta ?? '');
  setField(el.fColli, row?.colli ?? '');
  setField(el.fPeso, row?.peso ?? '');
  setField(el.fModello, row?.modello ?? '');
  setField(el.fDdtUscita, row?.ddt_uscita ?? '');
  setField(el.fCorriere, row?.corriere ?? '');
  setField(el.fRientroEffettivo, row?.rientro_effettivo ?? '');
  setField(el.fModalita, row?.modalita_rientro ?? '');
  setField(el.fDdtRientro, row?.ddt_rientro ?? '');
  setField(el.fNote, row?.note ?? '');
  delete el.fDataRitiro.dataset.previous;
  delete el.fRientroEffettivo.dataset.previous;

  el.fRitiroFatto.checked = state.initialFlags.ritiro;
  el.fRientrato.checked = state.initialFlags.rientrato;
  syncTaskUI();
  updateDrawerState();
  updateQuickActions();

  el.entryDelete.hidden = !row;
  el.drawer.classList.add('is-open');
  el.drawer.setAttribute('aria-hidden', 'false');
  el.backdrop.hidden = false;
  el.app.inert = true;
  document.body.classList.add('drawer-open');

  setTimeout(() => el.fDataUscita.focus(), 80);
}

function closeDrawer() {
  el.drawer.classList.remove('is-open');
  el.drawer.setAttribute('aria-hidden', 'true');
  el.app.inert = false;
  document.body.classList.remove('drawer-open');
  state.editingId = null;

  setTimeout(() => {
    if (!el.drawer.classList.contains('is-open')) el.backdrop.hidden = true;
  }, 220);

  const last = state.lastFocus;
  state.lastFocus = null;
  if (last && typeof last.focus === 'function') {
    setTimeout(() => last.focus(), 0);
  }
}

function setField(input, value) {
  input.value = value ?? '';
}

function syncTaskUI() {
  el.taskRitiro.classList.toggle('is-done', el.fRitiroFatto.checked);
  el.taskRientrato.classList.toggle('is-done', el.fRientrato.checked);
}

function handleTaskToggle(kind) {
  if (kind === 'ritiro') {
    if (el.fRitiroFatto.checked) {
      el.fDataRitiro.value = el.fDataRitiro.dataset.previous
        || el.fDataRitiro.value
        || todayISO();
      delete el.fDataRitiro.dataset.previous;
    } else {
      el.fDataRitiro.dataset.previous = el.fDataRitiro.value || '';
      el.fDataRitiro.value = '';
    }
  }
  if (kind === 'rientrato') {
    if (el.fRientrato.checked) {
      el.fRientroEffettivo.value = el.fRientroEffettivo.dataset.previous
        || el.fRientroEffettivo.value
        || todayISO();
      delete el.fRientroEffettivo.dataset.previous;
    } else {
      el.fRientroEffettivo.dataset.previous = el.fRientroEffettivo.value || '';
      el.fRientroEffettivo.value = '';
    }
  }
  syncTaskUI();
  updateDrawerState();
  updateQuickActions();
}

async function handleRowTask(id, task, checked) {
  if (state.rowTasksPending.has(id)) return;
  const index = state.rows.findIndex((row) => row.id === id);
  if (index < 0) return;

  const previous = { ...state.rows[index] };
  const row = { ...previous };
  const today = todayISO();

  if (task === 'ritiro') {
    row.ritiro_impostato = checked;
    row.data_ritiro = checked ? (row.data_ritiro || today) : null;
  } else {
    row.rientrato = checked;
    row.rientro_effettivo = checked ? (row.rientro_effettivo || today) : null;
  }
  row.stato = row.rientrato
    ? 'Rientrato'
    : row.ritiro_impostato ? 'Ritiro impostato' : 'Aperto';

  state.rowTasksPending.add(id);
  state.rows[index] = row;
  render();

  try {
    const updated = await store.update(id, {
      ritiro_impostato: row.ritiro_impostato,
      rientrato: row.rientrato,
      data_ritiro: row.data_ritiro,
      rientro_effettivo: row.rientro_effettivo,
      stato: row.stato,
    });
    const current = state.rows.findIndex((item) => item.id === id);
    if (current >= 0) state.rows[current] = normalizeRow(updated);
    state.rowTasksPending.delete(id);
    render();
  } catch (err) {
    console.error(err);
    const current = state.rows.findIndex((item) => item.id === id);
    if (current >= 0) state.rows[current] = previous;
    state.rowTasksPending.delete(id);
    render();
    toast(dataError(err), { error: true });
  }
}

function computeStato(flags) {
  if (flags.rientrato) return 'Rientrato';
  if (flags.ritiro) return 'Ritiro impostato';
  return 'Aperto';
}

function currentStato() {
  const flags = { ritiro: el.fRitiroFatto.checked, rientrato: el.fRientrato.checked };
  const changed = flags.ritiro !== state.initialFlags.ritiro
    || flags.rientrato !== state.initialFlags.rientrato;

  if (!changed && ['Chiuso', 'Annullato'].includes(state.initialStato)) {
    return state.initialStato;
  }
  return computeStato(flags);
}

function updateDrawerState() {
  const stato = currentStato();
  el.drawerStato.textContent = stato;
  el.drawerStato.className = `badge ${badgeClass(stato)}`;
}

function updateQuickActions() {
  const editing = Boolean(state.editingId);
  const stato = currentStato();
  el.quickActions.hidden = !editing || stato === 'Chiuso' || stato === 'Annullato';
}

async function handleQuickAction() {
  if (!state.editingId || state.saving) return;

  el.formError.hidden = true;
  const payload = readForm();
  if (!payload.cliente && !payload.indirizzo) {
    showFormError('Inserisci almeno il cliente o la destinazione.');
    el.fCliente.focus();
    return;
  }

  const wasReturned = payload.rientrato;
  payload.ritiro_impostato = true;
  payload.rientrato = true;
  if (!wasReturned) payload.rientro_effettivo = payload.rientro_effettivo || todayISO();
  payload.stato = 'Chiuso';

  setSaving(true);
  try {
    const updated = await store.update(state.editingId, payload);
    const index = state.rows.findIndex((row) => row.id === state.editingId);
    if (index >= 0) state.rows[index] = normalizeRow(updated);
    closeDrawer();
    render();
    toast('Pratica chiusa');
  } catch (err) {
    console.error(err);
    showFormError(dataError(err));
  } finally {
    setSaving(false);
  }
}

async function handleSave(event) {
  event.preventDefault();
  if (state.saving) return;
  el.formError.hidden = true;

  const payload = readForm();
  if (!payload.cliente && !payload.indirizzo) {
    showFormError('Inserisci almeno il cliente o la destinazione.');
    el.fCliente.focus();
    return;
  }
  if (payload.colli !== null && (!Number.isInteger(payload.colli) || payload.colli < 0)) {
    showFormError('Il numero di colli deve essere un intero maggiore o uguale a zero.');
    el.fColli.focus();
    return;
  }
  if (payload.peso !== null && (!Number.isFinite(payload.peso) || payload.peso < 0)) {
    showFormError('Il peso deve essere un numero maggiore o uguale a zero.');
    el.fPeso.focus();
    return;
  }

  setSaving(true);
  try {
    if (state.editingId) {
      const updated = await store.update(state.editingId, payload);
      const index = state.rows.findIndex((row) => row.id === state.editingId);
      if (index >= 0) state.rows[index] = normalizeRow(updated);
      closeDrawer();
      buildFilterOptions();
      render();
      toast('Spedizione aggiornata');
    } else {
      const created = await store.create(payload);
      state.rows.push(normalizeRow(created));
      closeDrawer();
      buildFilterOptions();
      render();
      toast('Spedizione aggiunta');
    }
  } catch (err) {
    console.error(err);
    showFormError(dataError(err));
  } finally {
    setSaving(false);
  }
}

function readForm() {
  const value = (input) => input.value.trim();
  const colliRaw = value(el.fColli);
  const pesoRaw = value(el.fPeso);
  const modello = value(el.fModello);
  const ritiroImpostato = el.fRitiroFatto.checked;
  const rientrato = el.fRientrato.checked;
  const dataRitiro = value(el.fDataRitiro) || null;
  const rientroEffettivo = value(el.fRientroEffettivo) || null;

  return {
    data_uscita: value(el.fDataUscita) || null,
    data_ritiro: dataRitiro,
    cliente: value(el.fCliente) || null,
    indirizzo: value(el.fIndirizzo) || null,
    numero_offerta: value(el.fOfferta) || null,
    colli: colliRaw === '' ? null : Number(colliRaw),
    peso: pesoRaw === '' ? null : Number(pesoRaw),
    modello: modello ? modello.replace(/\s+/g, ' ').toUpperCase() : null,
    ddt_uscita: value(el.fDdtUscita) || null,
    corriere: value(el.fCorriere) || null,
    stato: currentStato(),
    rientro_effettivo: rientroEffettivo,
    modalita_rientro: value(el.fModalita) || null,
    ddt_rientro: value(el.fDdtRientro) || null,
    ritiro_impostato: ritiroImpostato,
    rientrato,
    note: value(el.fNote) || null,
  };
}

function showFormError(message) {
  el.formError.textContent = message;
  el.formError.hidden = false;
}

function setSaving(saving) {
  state.saving = saving;
  el.entrySave.disabled = saving;
  el.entryDelete.disabled = saving;
  el.quickClose.disabled = saving;
  el.entrySave.textContent = saving ? 'Salvataggio…' : 'Salva';
}

async function handleDelete() {
  if (!state.editingId || state.saving) return;
  const row = state.rows.find((item) => item.id === state.editingId);
  const label = row?.cliente ?? row?.indirizzo ?? 'questa spedizione';
  if (!confirm(`Eliminare ${label}? L'operazione non può essere annullata.`)) return;

  setSaving(true);
  try {
    await store.remove(state.editingId);
    state.rows = state.rows.filter((item) => item.id !== state.editingId);
    closeDrawer();
    buildFilterOptions();
    render();
    toast('Spedizione eliminata');
  } catch (err) {
    console.error(err);
    showFormError(dataError(err));
  } finally {
    setSaving(false);
  }
}

async function importDdtFile(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    toast('Per ora importo solo PDF digitali.', { error: true });
    return;
  }

  el.importDdt.disabled = true;
  if (el.importDdtLabel) el.importDdtLabel.textContent = 'Leggo DDT…';

  try {
    const parsed = await parseDdtPdf(file);
    openDrawer(null);
    applyParsedDdt(parsed);
    toast(`DDT ${parsed.ddt_uscita} letto: controlla e salva`);
  } catch (err) {
    console.error(err);
    toast(err?.message || 'DDT non riconosciuto. Inserisci la riga a mano.', { error: true });
  } finally {
    el.importDdt.disabled = false;
    if (el.importDdtLabel) el.importDdtLabel.textContent = 'Importa DDT';
    el.ddtFileInput.value = '';
  }
}

function applyParsedDdt(data) {
  setField(el.fDataUscita, data.data_uscita || todayISO());
  setField(el.fDataRitiro, data.data_ritiro || '');
  setField(el.fCliente, data.cliente || '');
  setField(el.fIndirizzo, data.indirizzo || '');
  setField(el.fOfferta, data.numero_offerta || '');
  setField(el.fColli, data.colli ?? '');
  setField(el.fPeso, data.peso ?? '');
  setField(el.fModello, data.modello || '');
  setField(el.fDdtUscita, data.ddt_uscita || '');
  setField(el.fCorriere, data.corriere || '');
  setField(el.fRientroEffettivo, '');
  setField(el.fModalita, '');
  setField(el.fDdtRientro, '');
  setField(el.fNote, '');
  el.fRitiroFatto.checked = false;
  el.fRientrato.checked = false;
  state.initialStato = 'Aperto';
  state.initialFlags = { ritiro: false, rientrato: false };
  delete el.fDataRitiro.dataset.previous;
  delete el.fRientroEffettivo.dataset.previous;
  syncTaskUI();
  updateDrawerState();
  updateQuickActions();
}

async function parseDdtPdf(file) {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;

  try {
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const words = content.items
      .filter((item) => item.str && item.str.trim())
      .map((item) => ({
        text: item.str.trim(),
        x: item.transform[4],
        y: viewport.height - item.transform[5],
      }))
      .sort((a, b) => a.y - b.y || a.x - b.x);

    const groups = [];
    for (const word of words) {
      let group = groups.find((candidate) => Math.abs(candidate.y - word.y) <= 3);
      if (!group) {
        group = { y: word.y, words: [] };
        groups.push(group);
      }
      group.words.push(word);
    }

    const lines = groups.map((group) => {
      const sorted = group.words.sort((a, b) => a.x - b.x);
      return {
        y: group.y,
        x: sorted[0].x,
        words: sorted,
        text: sorted.map((word) => word.text).join(' ').replace(/\s+/g, ' ').trim(),
      };
    });

    const fullText = lines.map((line) => line.text).join(' ');
    if (!/DOCUMENTO\s+DI\s+TRASPORTO/i.test(fullText)) {
      throw new Error('Formato DDT non riconosciuto.');
    }

    const ddtLine = lines.find((line) => /DDT\s+n°/.test(line.text) && /Data:/.test(line.text));
    const ddtMatch = ddtLine?.text.match(/DDT\s+n°\s+(.+?)\s+Data:\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (!ddtMatch) throw new Error('Numero o data DDT non trovati.');

    const ddtUscita = ddtMatch[1].trim();
    const dataUscita = `${ddtMatch[4]}-${ddtMatch[3]}-${ddtMatch[2]}`;

    const half = viewport.width * 0.5;
    const rightText = (line) => line.words
      .filter((word) => word.x > half)
      .map((word) => word.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const leftText = (line) => line.words
      .filter((word) => word.x <= half)
      .map((word) => word.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const recipientHeader = lines.find((line) => line.text.includes('DESTINATARIO'));
    const recipientLines = recipientHeader
      ? lines.filter((line) => line.y > recipientHeader.y + 5 && line.y < recipientHeader.y + 70)
      : [];
    const cliente = recipientLines.map(rightText).find((text) => /[A-Za-z]/.test(text)) ?? null;

    const causaleLine = lines.find((line) => /Causale:/.test(line.text) && /Colli/.test(line.text));
    const causaleMatch = causaleLine?.text.match(/Causale:\s*(.*?)\s+N°\s*Colli\s+(\d+)\s+Kg\s+([\d.,]+)/);
    const colli = causaleMatch ? Number(causaleMatch[2]) : null;
    const peso = causaleMatch ? Number(causaleMatch[3].replace(',', '.')) : null;

    const deliveryHeader = lines.find((line) => /LUOGO\s+di\s+CONSEGNA/i.test(line.text));
    const deliveryLines = deliveryHeader
      ? lines.filter((line) => line.y > deliveryHeader.y + 5 && line.y < deliveryHeader.y + 80)
      : [];
    const destinazione = deliveryLines
      .map(rightText)
      .find((text) => /[A-Za-z]/.test(text) && !/^LUOGO/i.test(text)) ?? null;

    const vettoreHeader = lines.find((line) => /^Vettore/i.test(line.text));
    const vettoreLines = vettoreHeader
      ? lines.filter((line) => line.y > vettoreHeader.y + 5 && line.y < vettoreHeader.y + 55)
      : [];
    const corriere = vettoreLines
      .map(leftText)
      .find((text) => /[A-Za-z]/.test(text) && !/^Vettore/i.test(text)) ?? null;

    const itemsHeader = lines.find((line) => /DESCRIZIONE/.test(line.text) && /QTA/.test(line.text));
    const itemsEnd = vettoreHeader?.y ?? viewport.height;
    const itemLines = itemsHeader
      ? lines.filter((line) => line.y > itemsHeader.y + 5 && line.y < itemsEnd - 5)
      : [];

    const items = [];
    for (const line of itemLines) {
      const num = line.words.find((word) => word.x < viewport.width * 0.12 && /^\d{2}$/.test(word.text))?.text;
      const qty = line.words.find((word) => word.x >= viewport.width * 0.74
        && word.x < viewport.width * 0.83
        && /^\d+$/.test(word.text))?.text;
      const desc = line.words
        .filter((word) => word.x >= viewport.width * 0.15 && word.x < viewport.width * 0.74)
        .map((word) => word.text)
        .join(' ')
        .trim();

      if (num && qty && desc) {
        items.push({ desc, qty: Number(qty) });
      } else if (items.length && desc) {
        items[items.length - 1].desc += ` ${desc}`;
      }
    }

    const offerLine = lines.find((line) => /Rif\.\s*OFF\s*#:/.test(line.text));
    const offerMatch = offerLine?.text.match(/Rif\.\s*OFF\s*#:\s*(.+)$/i);
    const offer = offerMatch ? offerMatch[1].trim() : null;

    if (!cliente || !destinazione) {
      throw new Error('Cliente o destinazione non trovati nel DDT.');
    }

    const modello = items.length
      ? items.map((item) => `${compactDdtModel(item.desc)} ×${item.qty}`).join(' + ')
      : null;

    return {
      data_uscita: dataUscita,
      data_ritiro: nextWorkingDay(dataUscita),
      cliente,
      indirizzo: destinazione,
      numero_offerta: offer,
      colli,
      peso,
      modello,
      ddt_uscita: ddtUscita,
      corriere,
      note: null,
    };
  } finally {
    await document.destroy();
  }
}

function compactDdtModel(description) {
  const text = description
    .replace(/SILENTSYSTEM\s*®?/gi, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/SX-?839\s+CH10/i.test(text)) return '839 CH10 HIFI';
  if (/CABLE\s+USB\s+C/i.test(text)) return 'CABLE USB C 5';
  if (/FAST\s+CHARGING\s+STATION\s+12/i.test(text)) return 'FAST CHARGING 12';
  return text.slice(0, 32).trim();
}

function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const focusable = $$('button, input, select, textarea', el.drawer)
    .filter((node) => !node.disabled && node.getClientRects().length > 0);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ------------------------------------------------------------------ */
/* csv / utilita                                                      */
/* ------------------------------------------------------------------ */

function exportCsv() {
  const rows = getFiltered();
  if (!rows.length) {
    toast('Nessuna riga da esportare', { error: true });
    return;
  }

  const header = [
    'Data uscita', 'Impostazione ritiro', 'Ritiro impostato', 'Rientro effettivo',
    'Rientrato', 'Cliente', 'Destinazione', 'N. offerta', 'DDT uscita', 'Corriere',
    'Colli', 'Peso (kg)', 'Modello', 'Modalità rientro', 'DDT rientro', 'Stato', 'Note',
  ];
  const lines = [header.join(';')];
  for (const row of rows) {
    lines.push([
      row.data_uscita ? itDate(row.data_uscita) : '',
      row.data_ritiro ? itDate(row.data_ritiro) : '',
      row.ritiro_impostato ? 'Sì' : 'No',
      row.rientro_effettivo ? itDate(row.rientro_effettivo) : '',
      row.rientrato ? 'Sì' : 'No',
      row.cliente ?? '',
      row.indirizzo ?? '',
      row.numero_offerta ?? '',
      row.ddt_uscita ?? '',
      row.corriere ?? '',
      row.colli ?? '',
      row.peso ?? '',
      row.modello ?? '',
      row.modalita_rientro ?? '',
      row.ddt_rientro ?? '',
      row.stato,
      row.note ?? '',
    ].map(csvCell).join(';'));
  }

  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `registro-spedizioni-${APP_YEAR}-${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${rows.length} righe esportate`);
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function maybeAutoRefresh() {
  if (state.demo || !state.session || state.loading) return;
  if (Date.now() - state.lastLoad < 45000) return;
  loadRows({ silent: true });
}

function toast(message, { error = false } = {}) {
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  el.toast.textContent = message;
  el.toast.classList.toggle('is-error', error);
  el.toast.hidden = false;
  requestAnimationFrame(() => el.toast.classList.add('is-visible'));
  toastTimer = setTimeout(() => {
    el.toast.classList.remove('is-visible');
    toastHideTimer = setTimeout(() => { el.toast.hidden = true; }, 200);
  }, 2800);
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function monthLabel(ym) {
  const [year, month] = ym.split('-').map(Number);
  const name = MONTHS_LONG[month - 1];
  return name ? `${name} ${year}` : ym;
}

function fmtShort(iso) {
  const [year, month, day] = iso.split('-');
  const name = MONTHS[Number(month) - 1];
  return name ? `${day} ${name} ${year.slice(2)}` : iso;
}

function fmtNumeric(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year.slice(2)}`;
}

function itDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function parseISO(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextWorkingDay(iso) {
  const date = parseISO(iso);
  do {
    date.setDate(date.getDate() + 1);
  } while (date.getDay() === 0 || date.getDay() === 6);
  return toISO(date);
}

function shiftWorkingDay(iso, delta) {
  const date = parseISO(iso);
  do {
    date.setDate(date.getDate() + delta);
  } while (date.getDay() === 0 || date.getDay() === 6);
  return toISO(date);
}

function longDate(iso) {
  const text = parseISO(iso).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
