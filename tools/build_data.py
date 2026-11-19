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

# colonne del foglio 2026 (1-based)
COL_CAUZIONE = 1
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

        data_uscita = clean(get(r, COL_DATA_USCITA))
        data_ritiro = clean(get(r, COL_DATA_RITIRO))
        # scarta una eventuale riga di intestazione ripetuta
        if data_uscita and data_uscita.upper().startswith("DATA"):
            continue

        note = clean(get(r, COL_NOTE))
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
                "cauzione": clean(get(r, COL_CAUZIONE)),
                "stato": stato,
                "note": note,
            }
        )

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
        "  (data_uscita, indirizzo, cliente, numero_offerta, data_ritiro, colli, modello, cauzione, stato, note)",
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
                    sql_literal(row["cauzione"]),
                    sql_literal(row["stato"]),
                    sql_literal(row["note"]),
                ]
            )
            + ")"
        )
    seed.append(",\n".join(values) + ";")
    seed.append("")

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
STREETS = [
    "Via Roma", "Via Garibaldi", "Corso Italia", "Via Dante", "Piazza Duomo",
    "Viale Europa", "Via Verdi", "Via Manzoni", "Corso Buenos Aires",
    "Via XX Settembre", "Piazza della Repubblica", "Via Mazzini",
    "Viale Regina Margherita", "Via Leopardi", "Piazza Cavour",
]
CITIES = [
    "Milano", "Torino", "Bologna", "Firenze", "Roma", "Napoli", "Padova",
    "Verona", "Genova", "Bari", "Palermo", "Bergamo", "Modena", "Parma",
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


SAFE_DEPOSITS = {"NO", "ONLINE", "SÌ CASH", "SI CASH", "M", "E", "S", "R"}


def safe_deposit(value):
    """Tiene importi e stati brevi, scarta le note finite per errore nella colonna cauzione."""
    if value is None:
        return None
    text = str(value).strip()
    if re.fullmatch(r"\d{1,4}", text):
        return text
    if text.upper() in SAFE_DEPOSITS:
        return text
    return None


def safe_model(value):
    """Scarta le celle modello che contengono annotazioni interne."""
    if value is None:
        return None
    text = str(value).strip()
    if len(text) > 30 or "DDT" in text.upper() or "EXTRA" in text.upper():
        return "ALTRO"
    return text


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

    out = []
    for i, row in enumerate(rows, start=1):
        closed = row["stato"] == "Chiuso"
        pool = NOTES_CLOSED if closed else NOTES_OPEN
        note = pool[i % len(pool)] or None
        out.append(
            {
                "id": f"demo-{i:04d}",
                "data_uscita": safe_date(row["data_uscita"]),
                "indirizzo": (
                    f"{STREETS[i % len(STREETS)]} {8 + (i * 7) % 120}, "
                    f"{CITIES[(i * 3) % len(CITIES)]}"
                ),
                "cliente": fake_name(row["cliente"], i) if row["cliente"] else None,
                "numero_offerta": str(200000 + i),
                "data_ritiro": safe_date(row["data_ritiro"]),
                "colli": row["colli"],
                "modello": safe_model(row["modello"]),
                "cauzione": safe_deposit(row["cauzione"]),
                "stato": row["stato"],
                "note": note,
            }
        )
    return out


if __name__ == "__main__":
    main()
