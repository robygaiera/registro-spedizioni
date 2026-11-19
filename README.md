# Registro spedizioni 2026

Cruscotto web del registro spedizioni: tabella filtrabile, modificabile e condivisa.
Sito statico (HTML/CSS/JS) su GitHub Pages, dati e login su Supabase.

- **Nessun dato reale nel repository.** I dati veri vivono solo su Supabase; in locale finiscono nella cartella `private/`, ignorata da git.
- **Login vero** con email e password (Supabase Auth), non una password scritta nel codice.
- **Modifiche condivise** tra tutti i dispositivi, senza export/import.
- **Demo pubblica** con dati inventati per provare l'interfaccia.

---

## 1. Provare subito l'interfaccia (demo)

Dalla cartella del progetto:

```bash
python3 -m http.server 8000
```

Apri <http://localhost:8000/?demo=1>.

La demo usa `data/demo.json` (nomi, indirizzi, offerte e note **finti**) e salva le modifiche nel `localStorage` del browser. Non serve Supabase e non tocca il registro reale.

> Aprire `index.html` con doppio clic non funziona: i moduli ES e il `fetch` richiedono un server HTTP. Va bene quello qui sopra o GitHub Pages.

---

## 2. Configurare Supabase (una volta sola)

### 2.1 Crea il progetto

1. Vai su [supabase.com](https://supabase.com), crea un account e un **New project** (piano gratuito).
2. Scegli una password del database e conservala.
3. Aspetta che il progetto sia pronto (1-2 minuti).

### 2.2 Crea la tabella

Nel **SQL Editor** di Supabase:

1. Apri `supabase/schema.sql`, copia tutto, incolla e premi **Run**.
2. Apri `private/seed.sql`, copia tutto, incolla e premi **Run**.

`private/seed.sql` contiene le 875 righe reali estratte dal file Excel. È stato generato in locale ed è **ignorato da git**: non finirà mai su GitHub. Se manca, rigeneralo con:

```bash
pip3 install -r tools/requirements.txt
python3 tools/build_data.py "/percorso/Registro SPEDIZIONI 2026.xlsx"
```

Il seed si rifiuta di partire se la tabella non è vuota, quindi non puoi sovrascrivere dati per sbaglio.

### 2.3 Crea gli utenti

1. **Authentication → Providers → Email**: disattiva **Allow new users to sign up**. Così nessuno può registrarsi da solo.
2. **Authentication → Users → Add user**: inserisci email e password delle persone autorizzate e spunta **Auto Confirm User**.
3. Per cambiare una password: dalla stessa schermata, menu dell'utente → reset password (o invia un reset via email).

### 2.4 Collega il sito

In **Project Settings → API** copia:

- **Project URL** (es. `https://abcdefgh.supabase.co`)
- **anon public key**

Apri `assets/config.js` e incolla i valori:

```js
export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

Ricarica il sito: compare la schermata di login.

> La **anon key** è progettata per stare nel browser ed è normale che sia pubblica. La protezione è nelle policy RLS di `schema.sql`: senza login, Supabase non restituisce nessuna riga. **Non incollare mai la `service_role` key** in questo file.

---

## 3. Mettere online su GitHub Pages

Il repository può essere pubblico perché contiene **solo codice e dati demo finti**. Non contiene il registro, né password, né chiavi segrete.

```bash
cd registro-spedizioni
git init
git add .
git commit -m "Registro spedizioni 2026"
```

Crea su GitHub un repository vuoto (senza README), poi:

```bash
git remote add origin https://github.com/TUO-UTENTE/registro-spedizioni.git
git branch -M main
git push -u origin main
```

Su GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
Dopo circa un minuto il sito è su:

```
https://TUO-UTENTE.github.io/registro-spedizioni/
```

La demo è su `.../registro-spedizioni/?demo=1`.

### Repo privato?

GitHub Pages da repository privati richiede un piano a pagamento. In alternativa, collega lo stesso repository a **Cloudflare Pages** o **Netlify** (piano gratuito, repo privato) senza cambiare una riga di codice. Il resto della configurazione resta identico.

### Controllo di sicurezza prima del push

```bash
git status --ignored
```

Deve mostrare `private/` come ignorata. Se `private/seed.sql` o `private/registro-2026.json` compaiono tra i file da caricare, **fermati**: il `.gitignore` non sta funzionando.

> Se un giorno pubblichi con un caricamento manuale (drag & drop, `netlify deploy --dir .`, ZIP), **escludi la cartella `private/`**. GitHub Pages da repository git la esclude automaticamente perché non è versionata; un caricamento manuale no.

> Non incollare mai dati reali in `index.html`, `README.md` o `data/demo.json`: quei file sono pubblici. L'unico posto giusto per i dati veri è Supabase o `private/`.

---

## 4. Uso quotidiano

- **Cercare**: la barra cerca in cliente, indirizzo, offerta, modello, cauzione, note e date.
- **Filtrare**: mese, stato (Aperto/Chiuso/Annullato), modello. Il pulsante **Azzera** rimuove tutto.
- **Modificare**: clic su una riga → pannello laterale → **Salva**. Modifiche immediate per tutti.
- **Aggiungere**: **Nuova spedizione**. Almeno uno tra cliente e indirizzo è obbligatorio.
- **Eliminare**: dal pannello di modifica, pulsante **Elimina** (chiede conferma).
- **Esportare**: **CSV** esporta le righe attualmente filtrate, con separatore `;` e accenti corretti per Excel/Numbers.
- **Aggiornare**: il registro si ricarica da solo quando torni sulla finestra dopo 45 secondi. Il pulsante circolare forza l'aggiornamento.

### Stato "Chiuso" iniziale

Nel foglio Excel le righe chiuse sono **barrate** (`BARRATO = c'è il DDT di chiusura`). Il seed interpreta come chiusa una riga con almeno 5 celle barrate su 7, oppure con una nota che contiene "chiuso", "rientrato", "riconsegnato" o "annullato". Sono 192 righe su 875. Tutte le altre risultano **Aperte**: correggile man mano dal cruscotto.

---

## 5. Aggiornare i dati dall'Excel

Il file Excel resta la fonte iniziale. Per riestrarre:

```bash
python3 tools/build_data.py "/percorso/Registro SPEDIZIONI 2026.xlsx"
```

Genera:

| File | Contenuto | Git |
|---|---|---|
| `private/registro-2026.json` | dati reali completi | ignorato |
| `private/seed.sql` | INSERT SQL con dati reali | ignorato |
| `data/demo.json` | stessi volumi, ma nomi/indirizzi/note finti | versionato |
| `supabase/schema.sql` | struttura e sicurezza | versionato |

Per **sostituire** i dati su Supabase (dopo un backup CSV):

```sql
truncate public.spedizioni;
```

Poi esegui di nuovo `private/seed.sql`. Attenzione: il truncate cancella anche le modifiche fatte dal cruscotto.

Il parser legge il foglio `2026` a partire dalla riga 26, ricostruisce le celle unite, scarta le righe vuote e normalizza i modelli in maiuscolo. Se il layout del foglio cambia, aggiorna le costanti in cima a `tools/build_data.py`.

---

## 6. Struttura del progetto

```
registro-spedizioni/
├── index.html              interfaccia (login, tabella, pannello)
├── assets/
│   ├── styles.css
│   ├── app.js              auth, CRUD, filtri, export, demo
│   └── config.js           URL e anon key di Supabase
├── data/
│   └── demo.json           dati finti per la demo (versionati)
├── supabase/
│   └── schema.sql          tabella, indici, trigger, RLS
├── tools/
│   └── build_data.py       Excel -> seed + demo
├── private/                DATI REALI - ignorata da git
│   ├── registro-2026.json
│   └── seed.sql
├── .gitignore
├── .nojekyll
└── README.md
```

### Campi della tabella

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | generato dal database |
| `data_uscita` | date | può essere vuota |
| `indirizzo` | text | destinazione / fermo deposito |
| `cliente` | text | nome cliente reale |
| `numero_offerta` | text | numeri e sigle DDT |
| `data_ritiro` | date | può essere vuota |
| `colli` | integer | null se assente |
| `modello` | text | normalizzato in maiuscolo |
| `cauzione` | text | importo, `NO`, `ONLINE`… |
| `stato` | text | Aperto / Chiuso / Annullato |
| `note` | text | note operative |
| `created_at`, `updated_at`, `created_by` | | tracciati dal database |

---

## 7. Domande frequenti

**Perché non un semplice JSON su GitHub?**
Un JSON statico si può leggere ma non si può scrivere: per salvare le modifiche serve un server. Supabase fa da database, login e API, gratis, senza gestire niente. Il browser non contiene nessun dato.

**Quindi il sito è pubblico?**
Sì, la pagina di login è pubblica, come qualsiasi portale. I dati no: senza un account valido Supabase risponde con zero righe. La demo pubblica usa solo dati inventati.

**Chi può modificare?**
Ogni utente creato da te in Supabase. Non ci sono ruoli separati: chi entra può leggere e modificare tutto. Per ruoli diversi (sola lettura, ecc.) si aggiungono policy più fini.

**Cosa succede se dimentico la password?**
L'utente la reimposta dalla dashboard di Supabase, o via email se hai configurato SMTP. Non è salvata da nessuna parte nel sito.

**Backup?**
Il modo più semplice è **CSV** dal cruscotto. In alternativa, Supabase → Database → Backups (il piano gratuito ha backup limitati) oppure `pg_dump`.

**Il piano gratuito basta?**
Per 875 righe e un team piccolo sì. Attenzione: i progetti gratuiti possono andare **in pausa dopo circa una settimana di inattività**; si riattivano dalla dashboard di Supabase. Se diventa un problema, il piano a pagamento più basso evita la pausa.

**Posso cambiare l'anno?**
Il registro è impostato sul 2026 in `config.js` (`APP_YEAR`) e nel seed. Per il 2027 conviene una nuova tabella o una colonna `anno`; il codice attuale filtra per anno solo nelle etichette, non nei dati.

---

## 8. Personalizzazione rapida

- Nome azienda: `COMPANY_NAME` in `assets/config.js`.
- Titolo: `APP_TITLE`, `APP_YEAR`.
- Colori e tipografia: variabili CSS in cima a `assets/styles.css`.
- Campi della tabella: `readForm()` in `assets/app.js` + colonne in `supabase/schema.sql`.

---

## 9. Problemi comuni

| Sintomo | Causa | Soluzione |
|---|---|---|
| Schermata "Collega Supabase" | `config.js` vuoto o chiave troppo corta | incolla URL e anon key |
| Login: "Email o password non corretti" | utente assente o non confermato | crea l'utente con Auto Confirm |
| Tabella vuota dopo il login | seed non eseguito o RLS errata | esegui `private/seed.sql`, controlla `schema.sql` |
| "Permesso negato" | policy RLS mancanti | riesegui `supabase/schema.sql` |
| Modifiche non visibili agli altri | finestra non aggiornata | torna sulla finestra o premi il pulsante di aggiornamento |
| Demo non parte | aperto con `file://` | usa `python3 -m http.server` o GitHub Pages |
