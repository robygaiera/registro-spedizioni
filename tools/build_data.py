#!/usr/bin/env python3
"""Estrae il registro 2026 dal file Excel e genera:
   - data/demo.json      (dati finti per la modalita demo, versionabili)
   - private/seed.sql    (INSERT con i dati reali, NON versionare)
   - private/registro-2026.json (export completo, NON versionare)

Uso:
   python3 tools/build_data.py "/percorso/Registro SPEDIZIONI 2026.xlsx"
"""

import datetime as dt
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = Path.home() / "Downloads" / "Registro SPEDIZIONI 2026.xlsx"
SHEET = "2026"
FIRST_ROW = 26  # dove inizia il blocco 2026 nel foglio
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# colonne del foglio 2026 (1-based)
COL_NOTE = 2
COL_DATA_USCITA = 5
COL_INDIRIZZO = 6
COL_CLIENTE = 7
COL_OFFERTA = 8
COL_DATA_RITIRO = 9
COL_COLLI = 10
COL_MODELLO = 11


def clean(value):
    if value is None:
        return None
    if isinstance(value, (dt.datetime, dt.date)):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).replace("\u00a0", " ").strip()
    text = re.sub(r"\s+", " ", text)
    return text or None


def is_closed(note):
    n = (note or "").lower()
    if re.search(r"chius[oa]\b", n):
        return True
    return any(
        k in n
        for k in ("rientrat", "riconsegnat", "annull", "chiusura virtuale")
    )


def date_only(value):
    """Restituisce una data ISO solo se il valore e' davvero una data.

    Nel foglio alcune celle 'data ritiro' contengono frasi ("aspettare OK
    di Emanuele"): in quel caso la data resta vuota e il testo va nelle note.
    """
    if isinstance(value, (dt.datetime, dt.date)):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, str) and DATE_RE.match(value.strip()):
        return value.strip()
    return None


def sql_literal(value):
    if value is None:
        return "null"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main():
    xlsx = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx.exists():
        sys.exit(f"File non trovato: {xlsx}")

    wb = openpyxl.load_workbook(xlsx, data_only=True)
    if SHEET not in wb.sheetnames:
        sys.exit(f"Foglio '{SHEET}' non trovato. Fogli: {', '.join(wb.sheetnames)}")
    ws = wb[SHEET]

    # Le celle unite verticalmente vanno riportate su ogni riga.
    merged = {}
    for rng in ws.merged_cells.ranges:
        if rng.max_row < FIRST_ROW:
            continue
        top_left = ws.cell(rng.min_row, rng.min_col).value
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                merged[(r, c)] = top_left if c == rng.min_col else None

    def get(row, col):
        if (row, col) in merged:
            return merged[(row, col)]
        return ws.cell(row, col).value

    rows = []
    for r in range(FIRST_ROW, ws.max_row + 1):
        core = [get(r, c) for c in range(COL_DATA_USCITA, COL_MODELLO + 1)]
        if not any(v not in (None, "", "  ") for v in core):
            continue

        raw_uscita = get(r, COL_DATA_USCITA)
        raw_ritiro = get(r, COL_DATA_RITIRO)
        raw_uscita_text = clean(raw_uscita)

        # scarta una eventuale riga di intestazione ripetuta
        if raw_uscita_text and raw_uscita_text.upper().startswith("DATA"):
            continue

        data_uscita = date_only(raw_uscita)
        data_ritiro = date_only(raw_ritiro)
        note = clean(get(r, COL_NOTE))

        # Se una data conteneva testo libero, il testo non va perso: finisce
        # nelle note, mentre il campo date resta vuoto.
        for label, raw, parsed in (
            ("Uscita", raw_uscita, data_uscita),
            ("Ritiro", raw_ritiro, data_ritiro),
        ):
            if parsed:
                continue
            text = clean(raw)
            if not text:
                continue
            if note and text.lower() in note.lower():
                continue
            note = f"{note} | {label}: {text}" if note else f"{label}: {text}"
        # Nel foglio la riga chiusa e' barrata. Le righe parzialmente barrate
        # (1-3 celle) sono per lo piu' lavoro in corso: contano da 5 celle su 7.
        barrato = sum(
            1
            for c in range(COL_DATA_USCITA, COL_MODELLO + 1)
            if ws.cell(r, c).font.strike
        ) >= 5
        stato = "Chiuso" if barrato or is_closed(note) else "Aperto"

        colli = get(r, COL_COLLI)
        try:
            colli = int(colli) if colli not in (None, "") else None
        except (TypeError, ValueError):
            colli = None

        modello = clean(get(r, COL_MODELLO))
        if modello:
            modello = re.sub(r"\s+", " ", modello).strip().upper()

        rows.append(
            {
                "data_uscita": data_uscita,
                "indirizzo": clean(get(r, COL_INDIRIZZO)),
                "cliente": clean(get(r, COL_CLIENTE)),
                "numero_offerta": clean(get(r, COL_OFFERTA)),
                "data_ritiro": data_ritiro,
                "colli": colli,
                "modello": modello,
                "stato": stato,
                "note": note,
            }
        )

    # controllo finale: il database rifiuterebbe qualsiasi valore fuori formato
    for index, row in enumerate(rows, start=1):
        for key in ("data_uscita", "data_ritiro"):
            if row[key] is not None and not DATE_RE.match(row[key]):
                sys.exit(f"Data non valida alla riga {index}: {row[key]!r}")
        if row["colli"] is not None and (
            not isinstance(row["colli"], int) or row["colli"] < 0
        ):
            sys.exit(f"Numero colli non valido alla riga {index}: {row['colli']!r}")
        if row["stato"] not in ("Aperto", "Chiuso"):
            sys.exit(f"Stato non valido alla riga {index}: {row['stato']!r}")

    # ordina per data (le righe senza data in fondo) e assegna un id stabile
    rows.sort(key=lambda x: (x["data_uscita"] is None, x["data_uscita"] or ""), reverse=False)
    for i, row in enumerate(rows, start=1):
        row["id"] = f"real-{i:04d}"

    # ---- dati veri: solo in private/ (cartella ignorata da git) ----
    private_dir = ROOT / "private"
    private_dir.mkdir(parents=True, exist_ok=True)
    (private_dir / "registro-2026.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    seed = [
        "-- Registro Spedizioni 2026 - dati iniziali",
        "-- ATTENZIONE: contiene dati reali. NON caricare questo file su GitHub.",
        "-- Generato da tools/build_data.py. Eseguire DOPO supabase/schema.sql.",
        "",
        "do $$",
        "begin",
        "  if to_regclass('public.spedizioni') is null then",
        "    raise exception 'Tabella public.spedizioni assente: esegui prima schema.sql';",
        "  end if;",
        "  if exists (select 1 from public.spedizioni) then",
        "    raise exception 'La tabella public.spedizioni non e vuota: seed annullato';",
        "  end if;",
        "end $$;",
        "",
        "insert into public.spedizioni",
        "  (data_uscita, indirizzo, cliente, numero_offerta, data_ritiro, colli, modello, stato, note)",
        "values",
    ]
    values = []
    for row in rows:
        values.append(
            "  ("
            + ", ".join(
                [
                    sql_literal(row["data_uscita"]),
                    sql_literal(row["indirizzo"]),
                    sql_literal(row["cliente"]),
                    sql_literal(row["numero_offerta"]),
                    sql_literal(row["data_ritiro"]),
                    sql_literal(row["colli"]),
                    sql_literal(row["modello"]),
                    sql_literal(row["stato"]),
                    sql_literal(row["note"]),
                ]
            )
            + ")"
        )
    seed.append(",\n".join(values) + ";")
    seed.append("")
    seed.extend([
        "-- Allinea le due spunte e lo stato ai dati importati",
        "update public.spedizioni",
        "set ritiro_impostato = (stato = 'Chiuso' or (data_ritiro is not null and data_ritiro < current_date)),",
        "    rientrato = (stato = 'Chiuso');",
        "",
        "update public.spedizioni",
        "set stato = 'Ritiro impostato'",
        "where stato = 'Aperto' and ritiro_impostato = true;",
        "",
    ])

    (private_dir / "seed.sql").write_text("\n".join(seed), encoding="utf-8")

    # ---- demo pubblica: stessi volumi e date, ma nomi/indirizzi/note finti ----
    demo_rows = anonymize(rows)
    demo_dir = ROOT / "data"
    demo_dir.mkdir(parents=True, exist_ok=True)
    (demo_dir / "demo.json").write_text(
        json.dumps(demo_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    chiusi = sum(1 for r in rows if r["stato"] == "Chiuso")
    senza_data = sum(1 for r in rows if not r["data_uscita"])
    print(f"Righe esportate: {len(rows)}")
    print(f"  chiuse: {chiusi}  aperte: {len(rows) - chiusi}")
    print(f"  senza data uscita: {senza_data}")
    print(f"  con modello: {sum(1 for r in rows if r['modello'])}")
    print(f"Dati reali  -> {private_dir / 'registro-2026.json'}")
    print(f"Seed SQL    -> {private_dir / 'seed.sql'}  (ignorato da git)")
    print(f"Demo finta  -> {demo_dir / 'demo.json'}")


PREFIXES = [
    "Teatro", "Studio", "Fondazione", "Associazione", "Eventi", "Allestimenti",
    "Scuola", "Gruppo", "Compagnia", "Azienda", "Club", "Circolo",
    "Cooperativa", "Agenzia", "Progetto", "Spazio", "Centro", "Rete",
    "Consorzio", "Officina",
]
NOUNS = [
    "Aurora", "Vega", "Nord", "Sud", "Lumen", "Onda", "Ponte", "Vela",
    "Fiamma", "Bosco", "Prisma", "Civico", "Metro", "Corso", "Isola",
    "Faro", "Riva", "Campo", "Musica", "Scena",
]
CITIES = [
    "Milano", "Torino", "Bologna", "Firenze", "Roma", "Napoli", "Padova",
    "Verona", "Genova", "Bari", "Palermo", "Bergamo", "Modena", "Parma",
]
DEST_PREFIXES = [
    "Fiera", "Hotel", "Teatro", "Magazzino", "Centro congressi",
    "Palazzo", "Arena", "Villa", "Sede", "Studio",
]
NOTES_CLOSED = [
    "DDT di chiusura registrato", "Rientrato in magazzino", "Chiuso con il corriere",
    "DDT rientro ricevuto", "Riconsegnato", "",
]
NOTES_OPEN = [
    "Da sentire per il rientro", "In attesa del DDT", "Sollecitare il cliente",
    "Consegna confermata", "Ritiro da fissare", "",
]


def safe_date(value):
    """Nel registro alcune date sono in realtà testo libero: in demo restano solo date vere."""
    if isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return value
    return None


def safe_model(value):
    """Scarta le celle modello che contengono annotazioni interne."""
    if value is None:
        return None
    text = str(value).strip()
    if len(text) > 30 or "DDT" in text.upper() or "EXTRA" in text.upper():
        return "ALTRO"
    return text


def add_days(iso, days):
    return (dt.date.fromisoformat(iso) + dt.timedelta(days=days)).isoformat()


def anonymize(rows):
    """Sostituisce i dati identificativi mantenendo date, colli, modelli e stato."""
    name_by_client = {}
    used = set()

    def fake_name(real, index):
        key = real or f"__none_{index}"
        if key in name_by_client:
            return name_by_client[key]
        n = len(name_by_client)
        base = (
            f"{PREFIXES[n % len(PREFIXES)]} "
            f"{NOUNS[(n * 7 + n // len(PREFIXES)) % len(NOUNS)]}"
        )
        candidate = base
        suffix = 2
        while candidate in used:
            candidate = f"{base} {suffix}"
            suffix += 1
        used.add(candidate)
        name_by_client[key] = candidate
        return candidate

    modes = ["Etichetta nostra", "A carico cliente", "Ritiro nostro", "Di persona"]
    today = dt.date.today().isoformat()

    out = []
    for i, row in enumerate(rows, start=1):
        closed = row["stato"] == "Chiuso"
        pool = NOTES_CLOSED if closed else NOTES_OPEN
        note = pool[i % len(pool)] or None

        # Una parte delle righe chiuse diventa "Rientrato": serve a mostrare
        # la vista "Da chiudere" nella demo.
        ritiro_prev = safe_date(row["data_ritiro"])
        ritiro_impostato = closed or bool(ritiro_prev and ritiro_prev < today)
        rientrato = closed
        rientro_effettivo = None
        modalita_rientro = None
        ddt_rientro = None

        if closed:
            stato = "Rientrato" if i % 5 == 0 else "Chiuso"
            base = ritiro_prev or safe_date(row["data_uscita"])
            if base:
                rientro_effettivo = add_days(base, (i % 7) + 1)
            modalita_rientro = modes[i % len(modes)]
            if stato == "Chiuso":
                ddt_rientro = f"R-2026-{i:04d}"
        else:
            stato = "Ritiro impostato" if ritiro_impostato else "Aperto"

        out.append(
            {
                "id": f"demo-{i:04d}",
                "data_uscita": safe_date(row["data_uscita"]),
                "indirizzo": (
                    f"{DEST_PREFIXES[i % len(DEST_PREFIXES)]} Demo "
                    f"{CITIES[(i * 5) % len(CITIES)]}"
                ),
                "cliente": fake_name(row["cliente"], i) if row["cliente"] else None,
                "numero_offerta": str(200000 + i),
                "data_ritiro": ritiro_prev,
                "rientro_effettivo": rientro_effettivo,
                "modalita_rientro": modalita_rientro,
                "ddt_rientro": ddt_rientro,
                "ritiro_impostato": ritiro_impostato,
                "rientrato": rientrato,
                "colli": row["colli"],
                "modello": safe_model(row["modello"]),
                "stato": stato,
                "note": note,
            }
        )
    return out


if __name__ == "__main__":
    main()
