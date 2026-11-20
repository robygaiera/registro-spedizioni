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
  logout: $('#logout'),
  refresh: $('#refresh'),
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
  exportBtn: $('#export'),
  newEntry: $('#new-entry'),
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
  document.title = `${APP_TITLE} ${APP_YEAR}`;
  $('#app-title').textContent = APP_TITLE;
  $('#app-year').textContent = APP_YEAR;
  $$('[data-company]').forEach((node) => { node.textContent = COMPANY_NAME; });
}

function showView(name) {
  el.auth.hidden = name !== 'auth';
  el.setup.hidden = name !== 'setup';
  el.app.hidden = name !== 'app';
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
  el.userEmail.textContent = session?.user?.email ?? '';
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
    if (event.key === 'Escape' && el.drawer.classList.contains('is-open')) {
      closeDrawer();
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
    'modalita_rientro', 'ddt_rientro', 'note',
  ]) {
    out[key] = row[key] === null || row[key] === undefined || String(row[key]).trim() === ''
      ? null
      : String(row[key]).trim();
  }

  const colli = row.colli === null || row.colli === undefined || row.colli === ''
    ? null
    : Number(row.colli);
  out.colli = Number.isFinite(colli) && colli >= 0 ? Math.trunc(colli) : null;
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
  renderTable(filtered);
  renderSort();
  updateFilterChrome(filtered);
}

function renderViews() {
  const counts = { tutte: state.rows.length, rientrare: 0, da_chiudere: 0, archivio: 0 };

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
    el.emptyTitle.textContent = state.view === 'tutte'
      ? 'Nessuna spedizione trovata'
      : 'Nessuna spedizione in questa vista';
  }

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
    </td>
    <td class="col-client" data-label="Cliente">
      <span class="client-main">${esc(main)}</span>
      ${sub ? `<span class="client-sub">${esc(sub)}</span>` : ''}
    </td>
    <td class="col-offer offer-cell" data-label="Offerta"${row.numero_offerta ? '' : ' data-empty="true"'}>${row.numero_offerta ? esc(row.numero_offerta) : '—'}</td>
    <td class="col-pickup return-cell" data-label="Ritiro"${returnEmpty ? ' data-empty="true"' : ''}>${returnCell}</td>
    <td class="col-packages packages-cell" data-label="Colli"${row.colli === null ? ' data-empty="true"' : ''}>${row.colli === null ? '—' : esc(nf.format(row.colli))}</td>
    <td class="col-model model-cell" data-label="Modello"${row.modello ? '' : ' data-empty="true"'}>${row.modello ? esc(row.modello) : '—'}</td>
    <td class="col-status" data-label="Stato"><span class="badge ${badge}">${esc(row.stato)}</span></td>
    <td class="col-notes" data-label="Note"${row.note ? '' : ' data-empty="true"'}><span class="note-cell${row.note ? '' : ' is-empty'}" title="${esc(row.note ?? '')}">${row.note ? esc(row.note) : '—'}</span></td>
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
  rientrare: { key: 'data_uscita', dir: 'asc' },
  da_chiudere: { key: 'rientro_effettivo', dir: 'asc' },
  archivio: { key: 'data_uscita', dir: 'desc' },
};

function setView(view) {
  if (!VIEW_DEFAULTS[view] || state.view === view) return;
  state.view = view;
  state.sort = { ...VIEW_DEFAULTS[view] };
  state.visible = STEP;
  render();
}

/* ------------------------------------------------------------------ */
/* drawer / form                                                      */
/* ------------------------------------------------------------------ */

function openDrawer(row) {
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
  setField(el.fModello, row?.modello ?? '');
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
    modello: modello ? modello.replace(/\s+/g, ' ').toUpperCase() : null,
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
    'Rientrato', 'Cliente', 'Destinazione', 'N. offerta', 'Colli', 'Modello',
    'Modalità rientro', 'DDT rientro', 'Stato', 'Note',
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
      row.colli ?? '',
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

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
