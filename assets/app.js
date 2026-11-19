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
  visible: STEP,
  loading: false,
  saving: false,
  editingId: null,
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
  fCauzione: $('#f-cauzione'),
  fStato: $('#f-stato'),
  fNote: $('#f-note'),
  formError: $('#form-error'),
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
    const tr = event.target.closest('tr[data-id]');
    if (tr) openDrawer(state.rows.find((row) => row.id === tr.dataset.id) ?? null);
  });

  el.tbody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
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
  out.stato = ['Aperto', 'Chiuso', 'Annullato'].includes(row.stato) ? row.stato : 'Aperto';
  out.data_uscita = validDate(row.data_uscita);
  out.data_ritiro = validDate(row.data_ritiro);

  for (const key of ['indirizzo', 'cliente', 'numero_offerta', 'modello', 'cauzione', 'note']) {
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
        row.cauzione,
        row.note,
        row.stato,
        row.data_uscita,
        row.data_uscita ? itDate(row.data_uscita) : '',
        row.data_ritiro,
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
  } else if (key === 'data_uscita' || key === 'data_ritiro') {
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
  renderTable(filtered);
  renderSort();
  updateFilterChrome(filtered);
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

  const remaining = rows.length - visible.length;
  el.loadMore.hidden = remaining <= 0;
  el.loadMore.textContent = `Mostra altre ${Math.min(STEP, remaining)}`;
}

function rowHtml(row) {
  const main = row.cliente ?? row.indirizzo ?? 'Senza nome';
  const sub = row.cliente && row.indirizzo ? row.indirizzo : '';
  const badge = row.stato === 'Chiuso'
    ? 'badge-closed'
    : row.stato === 'Annullato' ? 'badge-cancelled' : 'badge-open';

  return `<tr data-id="${esc(row.id)}" tabindex="0" aria-label="Modifica ${esc(main)}">
    <td class="col-date" data-label="Data">
      <span class="date-cell${row.data_uscita ? '' : ' is-empty'}">${row.data_uscita ? esc(fmtShort(row.data_uscita)) : '—'}</span>
    </td>
    <td class="col-client" data-label="Cliente">
      <span class="client-main">${esc(main)}</span>
      ${sub ? `<span class="client-sub">${esc(sub)}</span>` : ''}
    </td>
    <td class="col-offer offer-cell" data-label="Offerta"${row.numero_offerta ? '' : ' data-empty="true"'}>${row.numero_offerta ? esc(row.numero_offerta) : '—'}</td>
    <td class="col-pickup pickup-cell" data-label="Ritiro"${row.data_ritiro ? '' : ' data-empty="true"'}>${row.data_ritiro ? esc(fmtShort(row.data_ritiro)) : '—'}</td>
    <td class="col-packages packages-cell" data-label="Colli"${row.colli === null ? ' data-empty="true"' : ''}>${row.colli === null ? '—' : esc(nf.format(row.colli))}</td>
    <td class="col-model model-cell" data-label="Modello"${row.modello ? '' : ' data-empty="true"'}>${row.modello ? esc(row.modello) : '—'}</td>
    <td class="col-deposit deposit-cell" data-label="Cauzione"${row.cauzione ? '' : ' data-empty="true"'}>${row.cauzione ? esc(row.cauzione) : '—'}</td>
    <td class="col-status" data-label="Stato"><span class="badge ${badge}">${esc(row.stato)}</span></td>
    <td class="col-notes" data-label="Note"${row.note ? '' : ' data-empty="true"'}><span class="note-cell${row.note ? '' : ' is-empty'}" title="${esc(row.note ?? '')}">${row.note ? esc(row.note) : '—'}</span></td>
  </tr>`;
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

/* ------------------------------------------------------------------ */
/* drawer / form                                                      */
/* ------------------------------------------------------------------ */

function openDrawer(row) {
  state.lastFocus = document.activeElement;
  state.editingId = row?.id ?? null;
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
  setField(el.fCauzione, row?.cauzione ?? '');
  setField(el.fStato, row?.stato ?? 'Aperto');
  setField(el.fNote, row?.note ?? '');

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

async function handleSave(event) {
  event.preventDefault();
  if (state.saving) return;
  el.formError.hidden = true;

  const payload = readForm();
  if (!payload.cliente && !payload.indirizzo) {
    showFormError('Inserisci almeno il cliente o l\'indirizzo.');
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

  return {
    data_uscita: value(el.fDataUscita) || null,
    data_ritiro: value(el.fDataRitiro) || null,
    cliente: value(el.fCliente) || null,
    indirizzo: value(el.fIndirizzo) || null,
    numero_offerta: value(el.fOfferta) || null,
    colli: colliRaw === '' ? null : Number(colliRaw),
    modello: modello ? modello.replace(/\s+/g, ' ').toUpperCase() : null,
    cauzione: value(el.fCauzione) || null,
    stato: el.fStato.value,
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
    'Data uscita', 'Indirizzo', 'Cliente', 'N. offerta', 'Data ritiro',
    'Colli', 'Modello', 'Cauzione', 'Stato', 'Note',
  ];
  const lines = [header.join(';')];
  for (const row of rows) {
    lines.push([
      row.data_uscita ? itDate(row.data_uscita) : '',
      row.indirizzo ?? '',
      row.cliente ?? '',
      row.numero_offerta ?? '',
      row.data_ritiro ? itDate(row.data_ritiro) : '',
      row.colli ?? '',
      row.modello ?? '',
      row.cauzione ?? '',
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

function itDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
