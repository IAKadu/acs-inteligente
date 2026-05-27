"""EDA profunda — guiada pelos pontos estrategicos do Peter.

Foco em descobertas nao-obvias que sustentem um produto diferenciado:
1. Familia como entidade canonica (cluster por endereco)
2. Os 48k pacientes nunca visitados — quem sao?
3. Cobertura por populacao prioritaria (gestantes, hipertensos, idosos)
4. ACS workload & dinamica de visita
5. Eventos como triggers (urgencia recente, agendamento futuro)
6. Pacientes com visita extrema (118x) — proxy de TB/cronico avancado?
7. Cobertura geo: distancia da sede ate pacientes
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "_inbox" / "data"
GRID = 0.001  # ~100m em lat/lng no Rio — combina com ruido da anonimizacao

# ----------------------------- helpers -----------------------------------------

def header(s: str) -> None:
    print("\n" + "=" * 78)
    print(s)
    print("=" * 78)


def sub(s: str) -> None:
    print("\n" + "-" * 60)
    print(s)
    print("-" * 60)


def load() -> dict[str, pd.DataFrame]:
    out: dict[str, pd.DataFrame] = {}
    for name in ["equipes", "pacientes", "eventos_clinicos", "visitas"]:
        out[name] = pd.read_parquet(DATA_DIR / f"{name}.parquet")
    # garante tipos de data
    out["visitas"]["registrados_em"] = pd.to_datetime(out["visitas"]["registrados_em"])
    out["eventos_clinicos"]["data_referencia"] = pd.to_datetime(
        out["eventos_clinicos"]["data_referencia"]
    )
    return out


# ----------------------------- analises ----------------------------------------

def familias(pac: pd.DataFrame) -> pd.DataFrame:
    """Infere familia por bin geografico (~100m) dentro da mesma equipe."""
    header("1. FAMILIA COMO ENTIDADE CANONICA — clustering por endereco")
    g = pac.assign(
        grid_lat=np.floor(pac["endereco_latitude"] / GRID) * GRID,
        grid_lng=np.floor(pac["endereco_longitude"] / GRID) * GRID,
    )
    # familia = (equipe, celula_geografica) com mais de 1 paciente
    fam = (
        g.groupby(["equipe_id", "grid_lat", "grid_lng"])
        .agg(
            tamanho=("paciente_id", "count"),
            tem_gestante=("gestacao", "any"),
            tem_crianca_0_6=("faixa_etaria", lambda s: (s == "0-6").any()),
            tem_crianca_6_18=("faixa_etaria", lambda s: (s == "6-18").any()),
            tem_idoso=("faixa_etaria", lambda s: (s == "66+").any()),
            tem_hipertenso=("hipertenso", "any"),
            tem_diabetico=("diabetico", "any"),
            tem_vulnerabilidade=("situacao_vulnerabilidade", "any"),
        )
        .reset_index()
    )

    sub("Distribuicao de tamanho de 'familia' (proxy por celula 100m + equipe)")
    print(fam["tamanho"].describe().to_string())
    print(f"\ncelulas com 1 paciente (solitario):     {(fam['tamanho'] == 1).sum():,}")
    print(f"celulas com 2-4 pacientes (familia tipica): {((fam['tamanho'] >= 2) & (fam['tamanho'] <= 4)).sum():,}")
    print(f"celulas com 5-9 pacientes (familia grande): {((fam['tamanho'] >= 5) & (fam['tamanho'] <= 9)).sum():,}")
    print(f"celulas com 10+ pacientes (predio?):    {(fam['tamanho'] >= 10).sum():,}")
    print(f"total de 'familias' inferidas:          {len(fam):,}")

    sub("'Familias' com perfil de alto risco combinado")
    multi = (
        fam.assign(
            n_sinais_risco=(
                fam["tem_gestante"].astype(int)
                + fam["tem_crianca_0_6"].astype(int)
                + fam["tem_idoso"].astype(int)
                + fam["tem_hipertenso"].astype(int)
                + fam["tem_diabetico"].astype(int)
                + fam["tem_vulnerabilidade"].astype(int)
            )
        )
    )
    print("distribuicao do numero de sinais de risco simultaneos por familia:")
    print(multi["n_sinais_risco"].value_counts().sort_index().to_string())

    print("\nfamilias com 4+ sinais (alto risco multi-dimensional):")
    print(f"  total: {(multi['n_sinais_risco'] >= 4).sum():,}")

    print("\ncombos especificos (familias com >= 2 pacientes):")
    f2 = fam[fam["tamanho"] >= 2]
    print(f"  gestante + crianca 0-6: {((f2['tem_gestante']) & (f2['tem_crianca_0_6'])).sum():,}")
    print(f"  idoso + hipertenso:     {((f2['tem_idoso']) & (f2['tem_hipertenso'])).sum():,}")
    print(f"  gestante + vulnerabilidade: {((f2['tem_gestante']) & (f2['tem_vulnerabilidade'])).sum():,}")
    print(f"  idoso + diabetico + hipertenso: {((f2['tem_idoso']) & (f2['tem_diabetico']) & (f2['tem_hipertenso'])).sum():,}")

    return fam


def nao_visitados(pac: pd.DataFrame, vis: pd.DataFrame) -> None:
    header("2. OS 48k QUE NUNCA FORAM VISITADOS — quem sao?")
    visitados = set(vis["paciente_id"])
    p = pac.assign(visitado=pac["paciente_id"].isin(visitados))
    nv = p[~p["visitado"]]
    print(f"nao visitados: {len(nv):,} de {len(p):,} ({100*len(nv)/len(p):.1f}%)")

    sub("perfil dos NAO visitados vs base inteira")
    for col in ["faixa_etaria", "sexo", "raca_cor", "hipertenso", "diabetico",
                "gestacao", "situacao_vulnerabilidade"]:
        full = p[col].value_counts(normalize=True).round(3)
        nv_dist = nv[col].value_counts(normalize=True).round(3)
        # mostra so a diferenca pra economizar leitura
        diff = (nv_dist - full).abs()
        # imprime quando ha desvio maior que 2pp
        if (diff > 0.02).any():
            print(f"\n>> {col}  (sobre/sub-representado nos nao-visitados)")
            joined = pd.DataFrame({"base": full, "nao_visitados": nv_dist, "diff_pp": (nv_dist - full).round(3)})
            print(joined.to_string())

    sub("contagem absoluta de POPULACOES PRIORITARIAS nao visitadas")
    print(f"  gestantes nao visitadas:        {nv['gestacao'].sum():,} de {p['gestacao'].sum():,}")
    print(f"  criancas 0-6 nao visitadas:     {(nv['faixa_etaria'] == '0-6').sum():,} de {(p['faixa_etaria'] == '0-6').sum():,}")
    print(f"  hipertensos nao visitados:      {nv['hipertenso'].sum():,} de {p['hipertenso'].sum():,}")
    print(f"  diabeticos nao visitados:       {nv['diabetico'].sum():,} de {p['diabetico'].sum():,}")
    print(f"  vulneraveis nao visitados:      {nv['situacao_vulnerabilidade'].sum():,} de {p['situacao_vulnerabilidade'].sum():,}")
    print(f"  idosos 66+ nao visitados:       {(nv['faixa_etaria'] == '66+').sum():,} de {(p['faixa_etaria'] == '66+').sum():,}")


def cobertura_por_grupo(pac: pd.DataFrame, vis: pd.DataFrame) -> None:
    header("3. COBERTURA POR POPULACAO PRIORITARIA — frequencia de visita")
    visit_count = vis.groupby("paciente_id").size().rename("n_visitas")
    p = pac.merge(visit_count, left_on="paciente_id", right_index=True, how="left")
    p["n_visitas"] = p["n_visitas"].fillna(0).astype(int)

    def stats(mask: pd.Series, label: str) -> None:
        s = p.loc[mask, "n_visitas"]
        print(
            f"  {label:32s} n={mask.sum():>6,}  "
            f"sem_visita={(s == 0).sum():>5,} ({100*(s == 0).mean():5.1f}%)  "
            f"media={s.mean():>5.2f}  mediana={s.median():>4.1f}  max={s.max():>4}"
        )

    print(f"{'GRUPO':32s} contagem      sem visita        media    mediana   max")
    stats(p["gestacao"], "Gestantes")
    stats(p["faixa_etaria"] == "0-6", "Criancas 0-6")
    stats(p["faixa_etaria"] == "6-18", "Adolescentes 6-18")
    stats(p["faixa_etaria"] == "19-45", "Adultos 19-45")
    stats(p["faixa_etaria"] == "45-65", "Adultos 45-65")
    stats(p["faixa_etaria"] == "66+", "Idosos 66+")
    stats(p["hipertenso"], "Hipertensos")
    stats(p["diabetico"], "Diabeticos")
    stats(p["situacao_vulnerabilidade"], "Vulnerabilidade social")
    stats(p["hipertenso"] & p["diabetico"], "Hipertenso + Diabetico")
    stats(p["gestacao"] & p["situacao_vulnerabilidade"], "Gestante + Vulneravel")


def workload_acs(vis: pd.DataFrame) -> None:
    header("4. CARGA DE TRABALHO POR PROFISSIONAL")
    per_prof = vis.groupby("profissional_id").agg(
        n_visitas=("paciente_id", "count"),
        n_pacientes_unicos=("paciente_id", "nunique"),
        n_dias_atuando=("registrados_em", "nunique"),
    )
    sub("distribuicao geral")
    print(per_prof.describe().round(2).to_string())

    sub("classificacao de profissionais por nivel de atividade")
    print(f"  >= 200 visitas no ano (alta atividade): {(per_prof['n_visitas'] >= 200).sum():,}")
    print(f"   50-199 visitas: {((per_prof['n_visitas'] >= 50) & (per_prof['n_visitas'] < 200)).sum():,}")
    print(f"   10-49 visitas:  {((per_prof['n_visitas'] >= 10) & (per_prof['n_visitas'] < 50)).sum():,}")
    print(f"   <10 visitas (esporadico/teste): {(per_prof['n_visitas'] < 10).sum():,}")
    print("(3.531 profissionais bem mais que os ~300 ACS esperados — confirma que "
          "'profissional' inclui outros membros da equipe)")


def visita_extrema(pac: pd.DataFrame, vis: pd.DataFrame, evt: pd.DataFrame) -> None:
    header("5. PACIENTES COM VISITA EXTREMA (cauda longa) — proxy de TB?")
    per_pac = vis.groupby("paciente_id").size().rename("n_visitas")
    p = pac.merge(per_pac, left_on="paciente_id", right_index=True, how="left")
    p["n_visitas"] = p["n_visitas"].fillna(0).astype(int)

    extremos = p[p["n_visitas"] >= 30].copy()
    sub(f"pacientes com 30+ visitas no ano: {len(extremos):,}")
    if len(extremos):
        print("\nperfil:")
        for col in ["faixa_etaria", "hipertenso", "diabetico", "gestacao",
                    "situacao_vulnerabilidade"]:
            if col in extremos.columns:
                vc = extremos[col].value_counts(normalize=True).round(3)
                print(f"  {col}: {vc.to_dict()}")

        sub("eventos clinicos para esses extremos")
        evt_extremos = evt[evt["paciente_id"].isin(extremos["paciente_id"])]
        print(f"  eventos totais: {len(evt_extremos):,}")
        if len(evt_extremos):
            print(f"  tipos: {evt_extremos['tipo'].value_counts().to_dict()}")
            print(f"  pacientes com >= 1 evento: {evt_extremos['paciente_id'].nunique():,} de {len(extremos):,}")

    sub("pacientes com 60+ visitas (super-extremos)")
    super_ex = p[p["n_visitas"] >= 60]
    print(f"  total: {len(super_ex):,}")
    if len(super_ex):
        for col in ["faixa_etaria", "hipertenso", "diabetico", "gestacao"]:
            print(f"  {col}: {super_ex[col].value_counts(normalize=True).round(3).to_dict()}")


def eventos_como_trigger(vis: pd.DataFrame, evt: pd.DataFrame) -> None:
    header("6. EVENTOS COMO TRIGGER — urgencia gera visita subsequente?")
    urg = evt[evt["tipo"] == "urgencia-emergencia-ou-internacao"].copy()
    print(f"total de eventos de urgencia: {len(urg):,}")
    print(f"pacientes com >= 1 urgencia: {urg['paciente_id'].nunique():,}")

    sub("desses pacientes, quantos receberam visita do ACS depois do evento?")
    # como datas estao deslocadas POR paciente mas sequencia eh confiavel,
    # comparacao dentro do mesmo paciente eh valida
    urg_first = urg.sort_values("data_referencia").groupby("paciente_id").first()
    vis_last = vis.sort_values("registrados_em").groupby("paciente_id")["registrados_em"].max()
    joined = urg_first.join(vis_last.rename("ultima_visita"))
    joined["visitado_apos_urgencia"] = joined["ultima_visita"] > joined["data_referencia"]
    n = len(joined)
    n_sim = int(joined["visitado_apos_urgencia"].fillna(False).sum())
    n_sem_visita = int(joined["ultima_visita"].isna().sum())
    print(f"  pacientes com urgencia: {n:,}")
    print(f"  receberam visita ACS APOS a urgencia: {n_sim:,} ({100*n_sim/n:.1f}%)")
    print(f"  visitados antes da urgencia mas nao depois: {n - n_sim - n_sem_visita:,}")
    print(f"  nunca receberam visita ACS: {n_sem_visita:,}")
    print("(GAP claro: paciente com urgencia que nao recebe followup do ACS = falha de fluxo)")

    sub("agendamentos como trigger de comunicacao")
    agend = evt[evt["tipo"] == "agendamento"]
    print(f"total de agendamentos: {len(agend):,}")
    print(f"pacientes com >= 1 agendamento: {agend['paciente_id'].nunique():,}")
    print("(ACS pode usar pra lembrar/transportar paciente — touchpoint claro de WhatsApp)")


def geo_cobertura(pac: pd.DataFrame, eq: pd.DataFrame) -> None:
    header("7. DISTANCIA DA SEDE AO PACIENTE (cobertura territorial)")
    # haversine simples
    def haversine(lat1, lon1, lat2, lon2):
        r = 6371000  # metros
        phi1, phi2 = np.radians(lat1), np.radians(lat2)
        dphi = np.radians(lat2 - lat1)
        dlmb = np.radians(lon2 - lon1)
        a = np.sin(dphi/2)**2 + np.cos(phi1)*np.cos(phi2)*np.sin(dlmb/2)**2
        return 2 * r * np.arcsin(np.sqrt(a))

    eq_loc = eq.set_index("equipe_id")[["endereco_latitude", "endereco_longitude"]]
    p = pac.merge(eq_loc, left_on="equipe_id", right_index=True, suffixes=("_pac", "_eq"))
    p["distancia_m"] = haversine(
        p["endereco_latitude_pac"], p["endereco_longitude_pac"],
        p["endereco_latitude_eq"], p["endereco_longitude_eq"],
    )
    print(p["distancia_m"].describe().round(0).to_string())
    print(f"\npacientes a mais de 1km da sede:  {(p['distancia_m'] > 1000).sum():,}")
    print(f"pacientes a mais de 2km da sede:  {(p['distancia_m'] > 2000).sum():,}")
    print(f"pacientes a mais de 5km da sede:  {(p['distancia_m'] > 5000).sum():,}")
    print("(distancia importa pro roteirizador: ACS comeca na sede)")


def main() -> int:
    d = load()
    familias(d["pacientes"])
    nao_visitados(d["pacientes"], d["visitas"])
    cobertura_por_grupo(d["pacientes"], d["visitas"])
    workload_acs(d["visitas"])
    visita_extrema(d["pacientes"], d["visitas"], d["eventos_clinicos"])
    eventos_como_trigger(d["visitas"], d["eventos_clinicos"])
    geo_cobertura(d["pacientes"], d["equipes"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
