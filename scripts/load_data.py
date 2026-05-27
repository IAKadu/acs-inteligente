"""
ETL: carrega os 4 parquets de _inbox/data/ para o Supabase Postgres.
Ordem: equipes -> pacientes -> visitas -> eventos_clinicos

Uso:
    python scripts/load_data.py

Requer DATABASE_URL no ambiente ou em src/backend/.env
"""

import os
import sys
import time
from pathlib import Path

env_file = Path(__file__).parent.parent / "src" / "backend" / ".env"
if env_file.exists() and not os.environ.get("DATABASE_URL"):
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()
            break

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERRO: DATABASE_URL nao encontrada.")
    sys.exit(1)

import psycopg2
from psycopg2.extras import execute_values
import pyarrow.parquet as pq

DATA_DIR = Path(__file__).parent.parent / "_inbox" / "data"


def get_conn():
    return psycopg2.connect(
        DATABASE_URL,
        keepalives=1,
        keepalives_idle=10,
        keepalives_interval=5,
        keepalives_count=5,
        connect_timeout=30,
    )


def load_table(parquet_path: Path, table: str, columns: list[str], batch_size: int = 2000):
    pf = pq.ParquetFile(parquet_path)
    total = 0
    cols_sql = ", ".join(columns)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"TRUNCATE {table} CASCADE")
    conn.commit()

    for batch in pf.iter_batches(batch_size=batch_size, columns=columns):
        df = batch.to_pydict()
        rows = list(zip(*[df[c] for c in columns]))
        rows = [
            tuple(
                None if (v is None or (isinstance(v, float) and v != v))
                else int(v) if isinstance(v, bool)
                else v
                for v in row
            )
            for row in rows
        ]

        for attempt in range(5):
            try:
                execute_values(
                    cur,
                    f"INSERT INTO {table} ({cols_sql}) VALUES %s ON CONFLICT DO NOTHING",
                    rows,
                    page_size=batch_size,
                )
                conn.commit()
                break
            except psycopg2.OperationalError as e:
                conn = get_conn()
                cur = conn.cursor()
                if attempt == 4:
                    raise
                wait = 2 ** attempt
                print(f"\n  reconectando (tentativa {attempt+1}): {e}", flush=True)
                time.sleep(wait)

        total += len(rows)
        print(f"  {table}: {total} linhas inseridas...", end="\r", flush=True)

    cur.close()
    conn.close()
    print(f"  {table}: {total} linhas OK                    ")
    return total


def main():
    print("Conectando ao banco...")
    conn = get_conn()
    conn.close()
    print("Conexao OK\n")

    print("Carregando equipes...")
    load_table(DATA_DIR / "equipes.parquet", "equipes", [
        "equipe_id", "endereco_latitude", "endereco_longitude"
    ])

    print("Carregando pacientes...")
    load_table(DATA_DIR / "pacientes.parquet", "pacientes", [
        "paciente_id", "equipe_id", "unidade_id", "faixa_etaria", "sexo", "raca_cor",
        "situacao_vulnerabilidade", "endereco_latitude", "endereco_longitude",
        "hipertenso", "diabetico", "gestacao"
    ])

    print("Carregando visitas...")
    load_table(DATA_DIR / "visitas.parquet", "visitas", [
        "profissional_id", "registrados_em", "ordem_visita_dia", "paciente_id"
    ])

    print("Carregando eventos_clinicos...")
    load_table(DATA_DIR / "eventos_clinicos.parquet", "eventos_clinicos", [
        "paciente_id", "tipo", "data_referencia"
    ])

    print("\nCarga completa! Proximo passo: rodar rescore_all.")
    print("  cd src/backend && npx tsx scripts/rescore_all.ts")


if __name__ == "__main__":
    main()
