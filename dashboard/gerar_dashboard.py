"""Gera outputs/dashboard.html: dashboard interativo e autossuficiente da rede (sem servidor, sem internet).

Uso (na raiz do projeto):  python dashboard/gerar_dashboard.py
Arquivos: modelo_dashboard.html (estrutura), estilo.css, app.js e vendor/vis-network.min.js, todos embutidos no HTML gerado.
Dependências: apenas as de requirements.txt. A biblioteca de grafos do navegador (vis-network, licença
MIT/Apache-2.0) está em dashboard/vendor/ e é embutida no HTML.
"""
import json
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd

SEED = 42
ROOT = Path(__file__).resolve().parent.parent
ARESTAS = ROOT / "data" / "edges_clean.csv"
VIS_JS = ROOT / "dashboard" / "vendor" / "vis-network.min.js"
SAIDA = ROOT / "outputs" / "dashboard.html"
MAX_REMOVER = 20

# Paleta categórica distinguível para daltonismo (Okabe-Ito)
CORES = ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7", "#56B4E9", "#7F7F7F", "#999933"]


def montar_grafo(caminho: Path) -> nx.Graph:
    edges = pd.read_csv(caminho)
    if not {"source", "target", "weight"}.issubset(edges.columns):
        raise ValueError("CSV precisa das colunas source, target e weight")
    return nx.from_pandas_edgelist(edges, "source", "target", edge_attr="weight")


def _fracao_lcc(H: nx.Graph, n0: int) -> float:
    return len(max(nx.connected_components(H), key=len)) / n0 if len(H) else 0.0


def curva_remocao(G: nx.Graph, ordem: list, k: int) -> list:
    H, n0 = G.copy(), G.number_of_nodes()
    out = [_fracao_lcc(H, n0)]
    for n in ordem[:k]:
        H.remove_node(n)
        out.append(_fracao_lcc(H, n0))
    return out


def montar_dados(G: nx.Graph) -> dict:
    comunidades = sorted(nx.community.louvain_communities(G, weight="weight", seed=SEED), key=len, reverse=True)
    comunidade_de = {n: i for i, c in enumerate(comunidades) for n in c}
    modularidade = nx.community.modularity(G, comunidades, weight="weight")

    metricas = {
        "grau": dict(G.degree()),
        "intermediacao": nx.betweenness_centrality(G),
        "proximidade": nx.closeness_centrality(G),
        "autovetor": nx.eigenvector_centrality(G, max_iter=1000),
        "pagerank": nx.pagerank(G, weight="weight"),
    }
    pos = nx.spring_layout(G, k=0.9, iterations=300, seed=SEED)
    esc = 800
    nos = [
        {
            "id": str(n), "comunidade": comunidade_de[n],
            "x": round(float(pos[n][0]) * esc, 1), "y": round(float(pos[n][1]) * esc, 1),
            **{m: round(float(v[n]), 6) for m, v in metricas.items()},
        }
        for n in G.nodes
    ]
    ordem_hubs = [n for n, _ in sorted(G.degree, key=lambda x: -x[1])]  # estável: empates na ordem do grafo
    rng = np.random.default_rng(SEED)
    aleatorio = np.mean(
        [curva_remocao(G, list(rng.permutation(list(G.nodes))), MAX_REMOVER) for _ in range(200)], axis=0
    )
    return {
        "nos": nos,
        "arestas": [{"de": str(u), "para": str(v), "peso": int(d["weight"])} for u, v, d in G.edges(data=True)],
        "comunidades": [
            {
                "id": i, "cor": CORES[i % len(CORES)], "tamanho": len(c),
                "lider": max(c, key=lambda n: (G.degree[n], str(n))),
            }
            for i, c in enumerate(comunidades)
        ],
        "resumo": {
            "nos": G.number_of_nodes(), "arestas": G.number_of_edges(),
            "densidade": round(nx.density(G), 4), "clustering": round(nx.average_clustering(G), 3),
            "modularidade": round(modularidade, 3),
            "caminho_medio": round(nx.average_shortest_path_length(G), 2),
        },
        "robustez": {
            "ordem_hubs": [str(n) for n in ordem_hubs[:MAX_REMOVER]],
            "alvo": [round(x, 4) for x in curva_remocao(G, ordem_hubs, MAX_REMOVER)],
            "aleatorio": [round(float(x), 4) for x in aleatorio],
        },
    }


def _ler(nome: str) -> str:
    return (Path(__file__).parent / nome).read_text(encoding="utf-8")


def renderizar(dados: dict) -> str:
    """Monta um único HTML autossuficiente a partir de modelo, CSS, JS da aplicação e vis-network."""
    # '<' escapado: nenhum dado pode fechar a tag <script> nem injetar HTML
    dados_json = json.dumps(dados, ensure_ascii=False).replace("<", "\\u003c")
    return (_ler("modelo_dashboard.html")
            .replace("/*__CSS__*/", _ler("estilo.css").replace("</style", "<\\/style"))
            .replace("/*__VIS_JS__*/", VIS_JS.read_text(encoding="utf-8").replace("</script", "<\\/script"))
            .replace("/*__APP_JS__*/", _ler("app.js").replace("</script", "<\\/script"))
            .replace("/*__DADOS__*/", dados_json))


if __name__ == "__main__":
    dados = montar_dados(montar_grafo(ARESTAS))
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(renderizar(dados), encoding="utf-8")
    print(f"Gerado: {SAIDA.relative_to(ROOT)}")
