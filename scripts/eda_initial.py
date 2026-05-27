"""EDA inicial dos 4 datasets do desafio Inteligencia no Territorio (ACS Rio).

Foco: entender shape, valores unicos de campos criticos, gaps, relacionamentos.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "_inbox" / "data"
TABLES = ["equipes", "pacientes", "eventos_clinicos", "visitas"]


def header(title: str) -> None:
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def describe_table(name: str, df: pd.DataFrame) -> None:
    header(f"[{name}]  shape={df.shape}  memoria={df.memory_usage(deep=True).sum() / 1e6:.2f} MB")
    print("\n-- dtypes --")
    print(df.dtypes.to_string())
    print("\n-- head(3) --")
    with pd.option_context("display.max_columns", None, "display.width", 200):
        print(df.head(3).to_string(index=False))
    print("\n-- nulls por coluna --")
    nulls = df.isna().sum()
    print(nulls[nulls > 0].to_string() if nulls.any() else "(nenhuma coluna com null)")


def show_categoricals(name: str, df: pd.DataFrame, cols: list[str]) -> None:
    header(f"[{name}] distribuicao de categoricos")
    for c in cols:
        if c not in df.columns:
            continue
        vc = df[c].value_counts(dropna=False)
        n_unique = df[c].nunique(dropna=False)
        print(f"\n>> {c}  ({n_unique} valores unicos)")
        if n_unique <= 30:
            print(vc.to_string())
        else:
            print(vc.head(20).to_string())
            print(f"... (+{n_unique - 20} valores)")


def main() -> int:
    if not DATA_DIR.exists():
        print(f"ERRO: diretorio nao existe: {DATA_DIR}", file=sys.stderr)
        return 1

    frames: dict[str, pd.DataFrame] = {}
    for name in TABLES:
        path = DATA_DIR / f"{name}.parquet"
        if not path.exists():
            print(f"AVISO: nao encontrado {path}", file=sys.stderr)
            continue
        frames[name] = pd.read_parquet(path)

    # 1. Visao geral de cada tabela
    for name, df in frames.items():
        describe_table(name, df)

    # 2. Categoricos prioritarios
    if "pacientes" in frames:
        show_categoricals(
            "pacientes",
            frames["pacientes"],
            ["faixa_etaria", "sexo", "raca_cor",
             "situacao_vulnerabilidade", "hipertenso", "diabetico", "gestacao"],
        )
    if "eventos_clinicos" in frames:
        show_categoricals("eventos_clinicos", frames["eventos_clinicos"], ["tipo"])

    # 3. Cobertura de equipes
    if "pacientes" in frames and "equipes" in frames:
        header("Relacionamento equipes <-> pacientes")
        eq = frames["equipes"]
        pac = frames["pacientes"]
        print(f"equipes: {len(eq)}")
        print(f"unique equipe_id em pacientes: {pac['equipe_id'].nunique()}")
        print(f"unique unidade_id em pacientes: {pac['unidade_id'].nunique()}")
        per_eq = pac.groupby("equipe_id").size().describe()
        print("\npacientes por equipe (estatistica):")
        print(per_eq.to_string())

    # 4. Datas (registros & eventos)
    if "visitas" in frames:
        v = frames["visitas"]
        header("Visitas: cobertura temporal e profissionais")
        if "registrados_em" in v.columns:
            d = pd.to_datetime(v["registrados_em"], errors="coerce")
            print(f"range: {d.min()}  ->  {d.max()}")
            print(f"dias distintos: {d.dt.date.nunique()}")
        print(f"profissionais distintos: {v['profissional_id'].nunique()}")
        print(f"pacientes visitados (distintos): {v['paciente_id'].nunique()}")
        print(f"total de registros de visita: {len(v):,}")
        if "ordem_visita_dia" in v.columns:
            print("\nordem_visita_dia (estatistica):")
            print(v["ordem_visita_dia"].describe().to_string())

        # visitas por paciente
        per_pac = v.groupby("paciente_id").size()
        print("\nvisitas por paciente (estatistica):")
        print(per_pac.describe().to_string())

    if "eventos_clinicos" in frames:
        e = frames["eventos_clinicos"]
        header("Eventos clinicos: cobertura temporal")
        if "data_referencia" in e.columns:
            d = pd.to_datetime(e["data_referencia"], errors="coerce")
            print(f"range: {d.min()}  ->  {d.max()}")
            print(f"dias distintos: {d.dt.date.nunique()}")
        print(f"pacientes com evento (distintos): {e['paciente_id'].nunique()}")
        print(f"total de eventos: {len(e):,}")

    # 5. Cross-check: pacientes orfaos / FKs
    if "pacientes" in frames and "visitas" in frames:
        header("Cross-check: pacientes com/sem visita")
        pac_ids = set(frames["pacientes"]["paciente_id"])
        vis_ids = set(frames["visitas"]["paciente_id"])
        print(f"pacientes com visita: {len(pac_ids & vis_ids):,} / {len(pac_ids):,}")
        print(f"pacientes sem visita: {len(pac_ids - vis_ids):,}")
        print(f"visitas com paciente desconhecido: {len(vis_ids - pac_ids):,}")

    if "pacientes" in frames and "eventos_clinicos" in frames:
        header("Cross-check: pacientes com/sem evento clinico")
        pac_ids = set(frames["pacientes"]["paciente_id"])
        evt_ids = set(frames["eventos_clinicos"]["paciente_id"])
        print(f"pacientes com evento: {len(pac_ids & evt_ids):,} / {len(pac_ids):,}")
        print(f"eventos com paciente desconhecido: {len(evt_ids - pac_ids):,}")

    # 6. Subgrupos prioritarios (transcricao da Carol)
    if "pacientes" in frames:
        p = frames["pacientes"]
        header("Subgrupos prioritarios mencionados na apresentacao")
        for flag in ["gestacao", "hipertenso", "diabetico", "situacao_vulnerabilidade"]:
            if flag in p.columns:
                n = int(p[flag].sum()) if p[flag].dtype != object else (p[flag] == True).sum()
                print(f"  {flag}: {n:,} pacientes ({100 * n / len(p):.1f}%)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
