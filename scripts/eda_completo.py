"""EDA completa — análises que faltavam para fechar a visão do dataset.

Complementa eda_initial.py, eda_deeper.py e eda_protocolo.py com:
1. Familia inferida com calibracao multipla (grids 30m/50m/100m/200m)
2. Sinais de endemia/concentracao geografica
3. Padroes temporais DENTRO de cada paciente (cadencia, lag pos-urgencia)
4. Analise por EQUIPE (perfil, cobertura, gap)
5. Analise por ACS REAL (filtro 265 ativos)
6. Multi-comorbidades
7. Qualidade de dados — outliers, ressalvas

Decisao de design: date shifting eh por paciente. Comparacoes temporais
ACROSS patients sao invalidas. Comparacoes DENTRO de paciente sao validas.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "_inbox" / "data"


def header(s: str) -> None:
    print("\n" + "█" * 78)
    print(" " + s)
    print("█" * 78)


def sub(s: str) -> None:
    print("\n" + "-" * 60)
    print(" " + s)
    print("-" * 60)


def load() -> dict[str, pd.DataFrame]:
    out = {n: pd.read_parquet(DATA_DIR / f"{n}.parquet")
           for n in ["equipes", "pacientes", "eventos_clinicos", "visitas"]}
    out["visitas"]["registrados_em"] = pd.to_datetime(out["visitas"]["registrados_em"])
    out["eventos_clinicos"]["data_referencia"] = pd.to_datetime(
        out["eventos_clinicos"]["data_referencia"]
    )
    return out


# ============================================================================
# 1. FAMILIA — calibracao multipla de grid
# ============================================================================

def familias_calibracao(pac: pd.DataFrame) -> None:
    header("1. FAMILIA — calibracao de grid (vs benchmark 3.2 pessoas/familia)")
    print("Briefing diz: media 3.2 pessoas/familia, ~350 familias por microarea de 750 pessoas.")
    print("49 equipes x ~625 familias (em 2000 pacientes/equipe amostrados) = ~30.6k familias esperadas.")

    for grid_m, grid_deg in [(30, 0.00027), (50, 0.00045), (100, 0.001), (200, 0.002)]:
        sub(f"Grid ~{grid_m}m")
        g = pac.assign(
            grid_lat=np.floor(pac["endereco_latitude"] / grid_deg) * grid_deg,
            grid_lng=np.floor(pac["endereco_longitude"] / grid_deg) * grid_deg,
        )
        fam = g.groupby(["equipe_id", "grid_lat", "grid_lng"]).size().rename("n")
        print(f"  clusters totais:                     {len(fam):>7,}")
        print(f"  clusters de 1 paciente (isolados):   {(fam == 1).sum():>7,}")
        print(f"  clusters de 2-4 (familia tipica):    {((fam >= 2) & (fam <= 4)).sum():>7,}")
        print(f"  clusters de 5-8 (familia grande):    {((fam >= 5) & (fam <= 8)).sum():>7,}")
        print(f"  clusters de 9-20 (provavel predio):  {((fam >= 9) & (fam <= 20)).sum():>7,}")
        print(f"  clusters de 20+ (predio grande):     {(fam > 20).sum():>7,}")
        print(f"  tamanho medio:                       {fam.mean():>7.2f}")
        print(f"  tamanho mediano:                     {fam.median():>7.1f}")
        print(f"  tamanho max:                         {fam.max():>7,}")

    sub("Recomendacao: grid 50m + filtro [2-8] como proxy de FAMILIA real")
    grid_deg = 0.00045
    g = pac.assign(
        grid_lat=np.floor(pac["endereco_latitude"] / grid_deg) * grid_deg,
        grid_lng=np.floor(pac["endereco_longitude"] / grid_deg) * grid_deg,
    )
    fam_full = (
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
    fam = fam_full[(fam_full["tamanho"] >= 2) & (fam_full["tamanho"] <= 8)].copy()
    print(f"  familias candidatas (2-8 membros): {len(fam):,}")
    print(f"  pacientes em familias candidatas:  {fam['tamanho'].sum():,} ({100*fam['tamanho'].sum()/len(pac):.1f}%)")
    print(f"  pacientes 'isolados' (cluster=1):  {(fam_full['tamanho'] == 1).sum():,}")
    print(f"  pacientes em predios (>8):         {fam_full[fam_full['tamanho'] > 8]['tamanho'].sum():,}")

    sub("Multi-condicao por familia candidata (proxy de risco familiar)")
    fam["n_sinais"] = (
        fam["tem_gestante"].astype(int)
        + fam["tem_crianca_0_6"].astype(int)
        + fam["tem_idoso"].astype(int)
        + fam["tem_hipertenso"].astype(int)
        + fam["tem_diabetico"].astype(int)
        + fam["tem_vulneravel"].astype(int)
    )
    print("distribuicao do numero de sinais de risco simultaneos:")
    print(fam["n_sinais"].value_counts().sort_index().to_string())
    print(f"\nfamilias 2-8 com >=3 sinais (alvo prioritario): {(fam['n_sinais'] >= 3).sum():,}")
    print(f"familias 2-8 com >=4 sinais (alto risco):        {(fam['n_sinais'] >= 4).sum():,}")


# ============================================================================
# 2. SINAIS DE ENDEMIA — concentracao geografica
# ============================================================================

def endemia(pac: pd.DataFrame, evt: pd.DataFrame) -> None:
    header("2. SINAIS DE ENDEMIA — concentracao geografica de risco")
    print("RESSALVA: date shifting torna invalida deteccao temporal cross-paciente.")
    print("Focamos em concentracao ESPACIAL (valida com ruido de 100m).")

    # urgencia rate por equipe
    sub("Top equipes por taxa de urgencia (urgencia/paciente cadastrado)")
    urg = evt[evt["tipo"] == "urgencia-emergencia-ou-internacao"]
    urg_pac = urg.groupby("paciente_id").size().rename("n_urg")
    p = pac.merge(urg_pac, left_on="paciente_id", right_index=True, how="left").fillna(
        {"n_urg": 0}
    )
    by_eq = p.groupby("equipe_id").agg(
        n_pacientes=("paciente_id", "count"),
        n_urg_total=("n_urg", "sum"),
        n_pacientes_com_urg=("n_urg", lambda s: (s > 0).sum()),
    )
    by_eq["taxa_urg_pop"] = (by_eq["n_pacientes_com_urg"] / by_eq["n_pacientes"]).round(3)
    by_eq["urg_per_pac"] = (by_eq["n_urg_total"] / by_eq["n_pacientes"]).round(3)
    print(by_eq.sort_values("taxa_urg_pop", ascending=False).head(10).to_string())
    print(f"\nmedia geral: {by_eq['taxa_urg_pop'].mean():.3f}")
    print(f"desvio padrao: {by_eq['taxa_urg_pop'].std():.3f}")
    print(f"equipes acima de 1.5σ (hotspots): {(by_eq['taxa_urg_pop'] > by_eq['taxa_urg_pop'].mean() + 1.5*by_eq['taxa_urg_pop'].std()).sum()}")

    # comorbidade rate por equipe
    sub("Concentracao de comorbidades por equipe (top hotspots)")
    by_eq_co = pac.groupby("equipe_id").agg(
        n=("paciente_id", "count"),
        pct_hipertenso=("hipertenso", "mean"),
        pct_diabetico=("diabetico", "mean"),
        pct_gestante=("gestacao", "mean"),
        pct_vulneravel=("situacao_vulnerabilidade", "mean"),
        pct_idoso=("faixa_etaria", lambda s: (s == "66+").mean()),
    ).round(3)

    print("\nTop 5 equipes por % hipertensos:")
    print(by_eq_co.sort_values("pct_hipertenso", ascending=False).head(5)[["n", "pct_hipertenso", "pct_diabetico", "pct_idoso"]].to_string())

    print("\nTop 5 equipes por % vulneraveis (sinal social):")
    print(by_eq_co.sort_values("pct_vulneravel", ascending=False).head(5)[["n", "pct_vulneravel", "pct_hipertenso", "pct_idoso"]].to_string())

    print("\nTop 5 equipes por % idosos (envelhecimento territorial):")
    print(by_eq_co.sort_values("pct_idoso", ascending=False).head(5)[["n", "pct_idoso", "pct_hipertenso", "pct_diabetico"]].to_string())

    # clusters geograficos quentes — celulas com varios eventos de urgencia
    sub("Hotspots geograficos de urgencia (celula 100m + equipe, >=3 urgencias)")
    grid_deg = 0.001
    urg_geo = urg.merge(pac[["paciente_id", "equipe_id", "endereco_latitude",
                              "endereco_longitude"]], on="paciente_id")
    urg_geo["grid_lat"] = np.floor(urg_geo["endereco_latitude"] / grid_deg) * grid_deg
    urg_geo["grid_lng"] = np.floor(urg_geo["endereco_longitude"] / grid_deg) * grid_deg
    hot = urg_geo.groupby(["equipe_id", "grid_lat", "grid_lng"]).size().rename("n_urg")
    print(f"celulas com >=3 urgencias: {(hot >= 3).sum():,}")
    print(f"celulas com >=5 urgencias: {(hot >= 5).sum():,}")
    print(f"celulas com >=10 urgencias: {(hot >= 10).sum():,}")
    print(f"\ntop 10 celulas (alvos de investigacao endemica):")
    print(hot.sort_values(ascending=False).head(10).to_string())


# ============================================================================
# 3. PADROES TEMPORAIS DENTRO DE PACIENTE
# ============================================================================

def temporal_intra_paciente(vis: pd.DataFrame, evt: pd.DataFrame) -> None:
    header("3. PADROES TEMPORAIS DENTRO DE PACIENTE (validos apesar do date shifting)")

    sub("Cadencia de visita: gap entre visitas consecutivas do mesmo paciente")
    v = vis.sort_values(["paciente_id", "registrados_em"]).copy()
    v["gap_dias"] = v.groupby("paciente_id")["registrados_em"].diff().dt.days
    gaps = v["gap_dias"].dropna()
    print(f"total de gaps observados (pacientes com 2+ visitas): {len(gaps):,}")
    print("\ndistribuicao do gap entre visitas (dias):")
    print(gaps.describe([0.10, 0.25, 0.50, 0.75, 0.90, 0.95]).round(1).to_string())
    print(f"\ngaps <= 7 dias (cadencia semanal):       {(gaps <= 7).sum():,} ({100*(gaps <= 7).mean():.1f}%)")
    print(f"gaps 8-30 dias (cadencia mensal):        {((gaps > 7) & (gaps <= 30)).sum():,} ({100*((gaps > 7) & (gaps <= 30)).mean():.1f}%)")
    print(f"gaps 31-90 dias:                         {((gaps > 30) & (gaps <= 90)).sum():,} ({100*((gaps > 30) & (gaps <= 90)).mean():.1f}%)")
    print(f"gaps > 90 dias (lacunas grandes):        {(gaps > 90).sum():,} ({100*(gaps > 90).mean():.1f}%)")

    sub("Lag entre urgencia e proxima visita do ACS (validacao do gap operacional)")
    urg = evt[evt["tipo"] == "urgencia-emergencia-ou-internacao"][["paciente_id", "data_referencia"]]
    urg_sorted = urg.sort_values(["paciente_id", "data_referencia"])
    # para cada urgencia, achar a proxima visita do mesmo paciente
    v_by_pac = vis.groupby("paciente_id")["registrados_em"].apply(list).to_dict()
    lags = []
    for paciente_id, urg_data in zip(urg_sorted["paciente_id"], urg_sorted["data_referencia"]):
        visitas_pac = v_by_pac.get(paciente_id, [])
        proximas = [v for v in visitas_pac if v > urg_data]
        if proximas:
            lags.append((min(proximas) - urg_data).days)
    if lags:
        s = pd.Series(lags)
        print(f"urgencias com visita posterior do ACS: {len(s):,}")
        print(f"distribuicao do lag (dias urgencia -> proxima visita):")
        print(s.describe([0.10, 0.25, 0.50, 0.75, 0.90, 0.95]).round(1).to_string())
        print(f"\nlag <= 7 dias (rapida resposta):   {(s <= 7).sum():,} ({100*(s <= 7).mean():.1f}%)")
        print(f"lag 8-30 dias:                     {((s > 7) & (s <= 30)).sum():,} ({100*((s > 7) & (s <= 30)).mean():.1f}%)")
        print(f"lag > 30 dias (resposta tardia):   {(s > 30).sum():,} ({100*(s > 30).mean():.1f}%)")


# ============================================================================
# 4. ANALISE POR EQUIPE
# ============================================================================

def por_equipe(pac: pd.DataFrame, vis: pd.DataFrame, evt: pd.DataFrame) -> None:
    header("4. ANALISE POR EQUIPE (49 equipes, ~2000 pacientes cada)")

    vis_count = vis.groupby("paciente_id").size().rename("n_visitas")
    p = pac.merge(vis_count, left_on="paciente_id", right_index=True, how="left").fillna(
        {"n_visitas": 0}
    )

    eq = p.groupby("equipe_id").agg(
        n_pacientes=("paciente_id", "count"),
        pct_gestante=("gestacao", "mean"),
        pct_crianca_0_6=("faixa_etaria", lambda s: (s == "0-6").mean()),
        pct_idoso=("faixa_etaria", lambda s: (s == "66+").mean()),
        pct_hipertenso=("hipertenso", "mean"),
        pct_diabetico=("diabetico", "mean"),
        pct_vulneravel=("situacao_vulnerabilidade", "mean"),
        pct_sem_visita=("n_visitas", lambda s: (s == 0).mean()),
        media_visitas=("n_visitas", "mean"),
    ).round(3)

    sub("Visao geral das equipes (estatistica)")
    print(eq.describe().round(3).to_string())

    sub("Top 5 equipes em PERFIL DESAFIADOR (composito vulneravel + idoso + multi-condicao)")
    eq["score_desafio"] = (
        eq["pct_vulneravel"] * 2
        + eq["pct_idoso"]
        + eq["pct_hipertenso"] * 0.5
        + eq["pct_diabetico"] * 0.5
    ).round(3)
    print(eq.sort_values("score_desafio", ascending=False).head(5)[
        ["n_pacientes", "pct_vulneravel", "pct_idoso", "pct_hipertenso", "pct_sem_visita", "score_desafio"]
    ].to_string())

    sub("Top 5 equipes com MAIS pacientes sem visita")
    print(eq.sort_values("pct_sem_visita", ascending=False).head(5)[
        ["n_pacientes", "pct_sem_visita", "media_visitas", "pct_vulneravel", "pct_idoso"]
    ].to_string())

    sub("Top 5 equipes com MENOS pacientes sem visita (referencia de boas praticas)")
    print(eq.sort_values("pct_sem_visita", ascending=True).head(5)[
        ["n_pacientes", "pct_sem_visita", "media_visitas", "pct_vulneravel", "pct_idoso"]
    ].to_string())


# ============================================================================
# 5. ANALISE POR ACS REAL
# ============================================================================

def por_acs(vis: pd.DataFrame, pac: pd.DataFrame) -> None:
    header("5. ANALISE POR ACS REAL (filtro: profissional com >=200 visitas/ano)")

    per_prof = vis.groupby("profissional_id").agg(
        n_visitas=("paciente_id", "count"),
        n_pacientes=("paciente_id", "nunique"),
        n_dias=("registrados_em", "nunique"),
    )

    acs_real = per_prof[per_prof["n_visitas"] >= 200].copy()
    sub(f"Total de ACS reais (>=200 visitas/ano): {len(acs_real)}")
    print("(briefing diz 5-6 ACS/equipe x 49 equipes = ~245-294 esperados — bate)")
    print()
    print("distribuicao do ACS real:")
    print(acs_real.describe().round(1).to_string())

    sub("Pacientes unicos por ACS — quanto da microarea cobre?")
    print(f"briefing: microarea = ~750 pessoas / 300-350 familias por ACS.")
    print(f"Amostra eh ~2000/equipe / 6 ACS = ~333 pacientes/ACS na amostra.")
    print(f"observado: media {acs_real['n_pacientes'].mean():.1f} pacientes unicos por ACS")
    print(f"           mediana {acs_real['n_pacientes'].median():.1f}")
    print(f"           max     {acs_real['n_pacientes'].max():.1f}")

    sub("ACS muito ativos com poucos pacientes (visita os mesmos varias vezes)")
    acs_real["visitas_por_paciente"] = acs_real["n_visitas"] / acs_real["n_pacientes"]
    intensos = acs_real.sort_values("visitas_por_paciente", ascending=False).head(10)
    print(intensos[["n_visitas", "n_pacientes", "n_dias", "visitas_por_paciente"]].round(2).to_string())
    print("\n(provavel TB ou seguimento intenso — embora TB nao apareca como tipo)")


# ============================================================================
# 6. MULTI-COMORBIDADES
# ============================================================================

def multi_comorbidades(pac: pd.DataFrame) -> None:
    header("6. MULTI-COMORBIDADES (perfis combinados)")

    p = pac
    n = len(p)

    sub("Combinacoes (booleanas)")
    print(f"{'COMBO':50s}  count   pct")
    combos = [
        ("Hipertenso", p["hipertenso"]),
        ("Diabetico", p["diabetico"]),
        ("Vulneravel", p["situacao_vulnerabilidade"]),
        ("Gestante", p["gestacao"]),
        ("Hipertenso + Diabetico", p["hipertenso"] & p["diabetico"]),
        ("Hipertenso + Vulneravel", p["hipertenso"] & p["situacao_vulnerabilidade"]),
        ("Diabetico + Vulneravel", p["diabetico"] & p["situacao_vulnerabilidade"]),
        ("Hip + Dia + Vuln (triplet)", p["hipertenso"] & p["diabetico"] & p["situacao_vulnerabilidade"]),
        ("Idoso (66+) + Hipertenso", (p["faixa_etaria"] == "66+") & p["hipertenso"]),
        ("Idoso + Diabetico", (p["faixa_etaria"] == "66+") & p["diabetico"]),
        ("Idoso + Hip + Dia", (p["faixa_etaria"] == "66+") & p["hipertenso"] & p["diabetico"]),
        ("Gestante + Vulneravel", p["gestacao"] & p["situacao_vulnerabilidade"]),
        ("Crianca 0-6 + Vulneravel", (p["faixa_etaria"] == "0-6") & p["situacao_vulnerabilidade"]),
    ]
    for label, mask in combos:
        cnt = int(mask.sum())
        print(f"  {label:50s}  {cnt:>6,}  {100*cnt/n:>5.2f}%")


# ============================================================================
# 7. QUALIDADE DE DADOS
# ============================================================================

def qualidade(d: dict[str, pd.DataFrame]) -> None:
    header("7. QUALIDADE DE DADOS — outliers e ressalvas")

    sub("Outliers geograficos extremos (pacientes longe demais)")
    pac = d["pacientes"]
    eq = d["equipes"].set_index("equipe_id")[["endereco_latitude", "endereco_longitude"]]
    p = pac.merge(eq, left_on="equipe_id", right_index=True, suffixes=("_pac", "_eq"))

    def haversine(lat1, lon1, lat2, lon2):
        r = 6371000
        phi1, phi2 = np.radians(lat1), np.radians(lat2)
        dphi = np.radians(lat2 - lat1)
        dlmb = np.radians(lon2 - lon1)
        a = np.sin(dphi/2)**2 + np.cos(phi1)*np.cos(phi2)*np.sin(dlmb/2)**2
        return 2 * r * np.arcsin(np.sqrt(a))

    p["dist_m"] = haversine(p["endereco_latitude_pac"], p["endereco_longitude_pac"],
                            p["endereco_latitude_eq"], p["endereco_longitude_eq"])
    print(f"pacientes a mais de 10km da sede:   {(p['dist_m'] > 10000).sum():,}")
    print(f"pacientes a mais de 100km da sede:  {(p['dist_m'] > 100000).sum():,}")
    print(f"pacientes a mais de 1000km da sede: {(p['dist_m'] > 1000000).sum():,}")
    print("(>10km ja eh suspeito de anonimizacao agressiva ou caso atipico)")

    sub("Coerencia de IDs entre tabelas")
    pac_ids = set(d["pacientes"]["paciente_id"])
    vis_pacs = set(d["visitas"]["paciente_id"])
    evt_pacs = set(d["eventos_clinicos"]["paciente_id"])
    eq_ids = set(d["equipes"]["equipe_id"])
    pac_eq = set(d["pacientes"]["equipe_id"])
    print(f"  pacientes (cadastro):               {len(pac_ids):,}")
    print(f"  pacientes nas visitas:              {len(vis_pacs):,}")
    print(f"  pacientes nos eventos:              {len(evt_pacs):,}")
    print(f"  visitas com paciente desconhecido:  {len(vis_pacs - pac_ids):,}")
    print(f"  eventos com paciente desconhecido:  {len(evt_pacs - pac_ids):,}")
    print(f"  equipes (tabela):                   {len(eq_ids):,}")
    print(f"  equipes referenciadas em pacientes: {len(pac_eq):,}")
    print(f"  pacientes com equipe desconhecida:  {len(pac_eq - eq_ids):,}")

    sub("Datas de eventos vs visitas — pacientes com eventos mas zero visita")
    pac_sem_visita_com_evento = (evt_pacs - vis_pacs)
    print(f"pacientes com >=1 evento clinico mas ZERO visita: {len(pac_sem_visita_com_evento):,}")
    print("(esses sao 'visiveis ao sistema mas invisiveis ao ACS' — alvo claro)")

    sub("Pacientes que so existem no cadastro (sem evento, sem visita)")
    sem_nada = pac_ids - vis_pacs - evt_pacs
    print(f"pacientes 'fantasma' (so cadastro): {len(sem_nada):,}")
    print(f"  desses, vulneraveis: {pac[pac['paciente_id'].isin(sem_nada)]['situacao_vulnerabilidade'].sum():,}")
    print(f"  desses, hipertensos: {pac[pac['paciente_id'].isin(sem_nada)]['hipertenso'].sum():,}")
    print(f"  desses, idosos 66+: {(pac[pac['paciente_id'].isin(sem_nada)]['faixa_etaria'] == '66+').sum():,}")


def main() -> int:
    d = load()
    familias_calibracao(d["pacientes"])
    endemia(d["pacientes"], d["eventos_clinicos"])
    temporal_intra_paciente(d["visitas"], d["eventos_clinicos"])
    por_equipe(d["pacientes"], d["visitas"], d["eventos_clinicos"])
    por_acs(d["visitas"], d["pacientes"])
    multi_comorbidades(d["pacientes"])
    qualidade(d)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
