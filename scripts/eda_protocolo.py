"""EDA aplicando o framework oficial do briefing (alto/medio/rotineiro).

Calcula gap protocolar:
  visitas reais vs frequencia prescrita por grupo.

Limitacoes conhecidas:
  - Nao temos "alto risco gestacional" (so gestante boolean)
  - Nao temos "descompensado" (so hipertenso/diabetico boolean)
  - Nao temos "frail elderly" (so faixa 66+)
  - TB ausente do dataset
  - Faltas a consultas nao mapeadas (so 'agendamento' como tipo)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "_inbox" / "data"
GRID = 0.001  # ~100m, alinhado com ruido da anonimizacao

# protocolo do briefing — visitas/ano minimas (proxy)
# alto risco: semanal a quinzenal = 26-52/ano (usamos 26 como minimo)
# medio risco: quinzenal a mensal = 12-26/ano (usamos 12 como minimo)
# rotineiro: mensal = 12/ano (mas usamos 4 como minimo bem permissivo aqui)
PROTOCOLO = {
    "gestante": 12,      # gestante padrao mensal (alto risco seria semanal mas nao distinguimos)
    "crianca_0_6": 12,   # 0-2 anos eh mensal; pegamos a faixa 0-6 do dataset
    "idoso_66": 12,      # se "fragil" seria quinzenal (24); rotineiro mensal (12)
    "hipertenso": 12,    # mensal
    "diabetico": 12,     # mensal
    "vulneravel": 12,    # familia sem renda eh alto risco
}


def header(s: str) -> None:
    print("\n" + "=" * 78)
    print(s)
    print("=" * 78)


def sub(s: str) -> None:
    print("\n" + "-" * 60)
    print(s)
    print("-" * 60)


def load() -> dict[str, pd.DataFrame]:
    out = {n: pd.read_parquet(DATA_DIR / f"{n}.parquet")
           for n in ["equipes", "pacientes", "eventos_clinicos", "visitas"]}
    out["visitas"]["registrados_em"] = pd.to_datetime(out["visitas"]["registrados_em"])
    out["eventos_clinicos"]["data_referencia"] = pd.to_datetime(
        out["eventos_clinicos"]["data_referencia"]
    )
    return out


def classificar_familias(pac: pd.DataFrame) -> pd.DataFrame:
    """Agrupa pacientes em familias (proxy 100m + equipe) e classifica em
    alto/medio/rotineiro pelo framework do briefing."""
    g = pac.assign(
        grid_lat=np.floor(pac["endereco_latitude"] / GRID) * GRID,
        grid_lng=np.floor(pac["endereco_longitude"] / GRID) * GRID,
    )
    fam = (
        g.groupby(["equipe_id", "grid_lat", "grid_lng"])
        .agg(
            tamanho=("paciente_id", "count"),
            tem_gestante=("gestacao", "any"),
            tem_crianca_0_6=("faixa_etaria", lambda s: (s == "0-6").any()),
            tem_idoso=("faixa_etaria", lambda s: (s == "66+").any()),
            tem_hipertenso=("hipertenso", "any"),
            tem_diabetico=("diabetico", "any"),
            tem_vulneravel=("situacao_vulnerabilidade", "any"),
        )
        .reset_index()
    )

    # classificacao: heuristica conservadora — alto risco se gestante OU vulneravel OU crianca 0-6;
    # medio se idoso OU (hipertenso E diabetico); rotineiro caso contrario
    cond_alto = (
        fam["tem_gestante"]
        | fam["tem_vulneravel"]
        | fam["tem_crianca_0_6"]
    )
    cond_medio = (
        fam["tem_idoso"]
        | (fam["tem_hipertenso"] & fam["tem_diabetico"])
        | fam["tem_hipertenso"]
        | fam["tem_diabetico"]
    )
    fam["categoria_risco"] = np.where(
        cond_alto, "alto", np.where(cond_medio, "medio", "rotineiro")
    )
    fam["frequencia_minima_anual"] = fam["categoria_risco"].map(
        {"alto": 26, "medio": 12, "rotineiro": 12}
    )
    return fam


def familias_visitas(fam: pd.DataFrame, pac: pd.DataFrame,
                     vis: pd.DataFrame) -> pd.DataFrame:
    """Conta visitas reais por familia (somando visitas dos membros)."""
    pac_fam = pac.assign(
        grid_lat=np.floor(pac["endereco_latitude"] / GRID) * GRID,
        grid_lng=np.floor(pac["endereco_longitude"] / GRID) * GRID,
    )[["paciente_id", "equipe_id", "grid_lat", "grid_lng"]]
    vis_count = vis.groupby("paciente_id").size().rename("n_visitas_paciente")
    pac_fam = pac_fam.merge(vis_count, left_on="paciente_id",
                            right_index=True, how="left").fillna({"n_visitas_paciente": 0})
    fam_visitas = pac_fam.groupby(["equipe_id", "grid_lat", "grid_lng"])[
        "n_visitas_paciente"].sum().rename("n_visitas_familia").reset_index()
    return fam.merge(fam_visitas,
                     on=["equipe_id", "grid_lat", "grid_lng"], how="left")


def main() -> int:
    d = load()
    fam = classificar_familias(d["pacientes"])
    fam = familias_visitas(fam, d["pacientes"], d["visitas"])

    header("1. CLASSIFICACAO DE FAMILIAS PELO FRAMEWORK DO BRIEFING")
    print(fam["categoria_risco"].value_counts().to_string())
    print(f"\ntotal: {len(fam):,} familias")

    sub("tamanho medio por categoria")
    print(fam.groupby("categoria_risco")["tamanho"].agg(
        ["count", "mean", "median", "max"]).round(2).to_string())

    header("2. GAP PROTOCOLAR — visitas reais vs frequencia minima prescrita")
    sub("por categoria de risco (visitas/familia/ano)")
    by_cat = fam.groupby("categoria_risco").apply(
        lambda g: pd.Series({
            "n_familias": len(g),
            "media_visitas": g["n_visitas_familia"].mean(),
            "mediana_visitas": g["n_visitas_familia"].median(),
            "min_protocolar": g["frequencia_minima_anual"].iloc[0],
            "pct_acima_protocolo": (g["n_visitas_familia"] >= g["frequencia_minima_anual"]).mean() * 100,
            "pct_sem_visita": (g["n_visitas_familia"] == 0).mean() * 100,
        }),
        include_groups=False,
    ).round(2)
    print(by_cat.to_string())

    header("3. GAP PROTOCOLAR — por GRUPO INDIVIDUAL (paciente, nao familia)")
    p = d["pacientes"]
    v_count = d["visitas"].groupby("paciente_id").size().rename("n_visitas")
    p = p.merge(v_count, left_on="paciente_id", right_index=True, how="left").fillna(
        {"n_visitas": 0}
    )
    p["n_visitas"] = p["n_visitas"].astype(int)

    def gap(mask, label, freq_min):
        s = p.loc[mask, "n_visitas"]
        n = mask.sum()
        below = (s < freq_min).sum()
        print(
            f"  {label:30s}  n={n:>6,}  min_protocolo={freq_min:>2}/ano  "
            f"abaixo={below:>6,} ({100*below/n:5.1f}%)  "
            f"media={s.mean():>5.1f}  mediana={s.median():>4.1f}"
        )

    print(f"{'GRUPO':30s}  n            protocolo       abaixo do protocolo     media    mediana")
    gap(p["gestacao"], "Gestantes (>=12/ano)", 12)
    gap(p["faixa_etaria"] == "0-6", "Criancas 0-6 (>=12/ano)", 12)
    gap(p["faixa_etaria"] == "66+", "Idosos 66+ (>=12/ano)", 12)
    gap(p["hipertenso"], "Hipertensos (>=12/ano)", 12)
    gap(p["diabetico"], "Diabeticos (>=12/ano)", 12)
    gap(p["situacao_vulnerabilidade"], "Vulneraveis (>=12/ano)", 12)
    gap(p["hipertenso"] & p["diabetico"], "Hipert+Diab (>=12/ano)", 12)

    header("4. SINAIS DE ALERTA — pacientes com URGENCIA RECENTE sem visita pos-urgencia")
    evt = d["eventos_clinicos"]
    urg = evt[evt["tipo"] == "urgencia-emergencia-ou-internacao"]
    urg_last = urg.sort_values("data_referencia").groupby("paciente_id").last()
    vis_last = d["visitas"].sort_values("registrados_em").groupby("paciente_id")["registrados_em"].max()
    joined = urg_last.join(vis_last.rename("ultima_visita")).reset_index()
    joined["sem_followup"] = (
        joined["ultima_visita"].isna()
        | (joined["ultima_visita"] < joined["data_referencia"])
    )

    sem_followup = joined[joined["sem_followup"]]
    print(f"pacientes com urgencia: {len(joined):,}")
    print(f"sem visita apos urgencia: {len(sem_followup):,} ({100*len(sem_followup)/len(joined):.1f}%)")

    # cruzar com perfis
    sub("perfil dos SEM FOLLOWUP (cruzando com cadastro de pacientes)")
    sf = sem_followup.merge(p[["paciente_id", "faixa_etaria", "hipertenso",
                               "diabetico", "gestacao", "situacao_vulnerabilidade",
                               "equipe_id"]], on="paciente_id", how="left")
    print(f"  gestantes sem followup pos-urgencia:  {sf['gestacao'].sum():,}")
    print(f"  idosos 66+ sem followup pos-urgencia: {(sf['faixa_etaria'] == '66+').sum():,}")
    print(f"  hipertensos sem followup pos-urgencia: {sf['hipertenso'].sum():,}")
    print(f"  diabeticos sem followup pos-urgencia:  {sf['diabetico'].sum():,}")
    print(f"  vulneraveis sem followup pos-urgencia: {sf['situacao_vulnerabilidade'].sum():,}")

    sub("equipes com mais 'pos-urgencia sem followup' — alvo de priorizacao")
    top = sf.groupby("equipe_id").size().sort_values(ascending=False).head(10)
    print(top.to_string())

    header("5. INTERSECAO: PERFIL DO ALVO IDEAL — alto risco + sem followup + sem visita recente")
    alvo = sf[
        (sf["gestacao"] | sf["situacao_vulnerabilidade"]
         | (sf["faixa_etaria"] == "66+")
         | (sf["hipertenso"] & sf["diabetico"]))
    ]
    print(f"alvos ideais (urgencia recente sem followup + perfil alto/medio risco): {len(alvo):,}")
    print("(esse eh o subset que um produto deveria empurrar pra topo da lista do ACS amanha)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
