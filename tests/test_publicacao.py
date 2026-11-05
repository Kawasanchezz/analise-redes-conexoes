"""Testes de higiene para publicação e de reprodutibilidade (apenas biblioteca padrão + pandas/networkx).

Executar na raiz do projeto:  python -m unittest discover -s tests -v
"""
import json
import re
import unittest
from pathlib import Path

import networkx as nx
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
NOTEBOOK = ROOT / "notebooks" / "analise_redes.ipynb"

# Caminhos absolutos do Windows/Unix de usuário e e-mails
PADRAO_PRIVADO = re.compile(
    r"[A-Za-z]:\\\\?Users|/home/[a-z]|/Users/[A-Za-z]|AppData|[\w.+-]{1,64}@[\w-]{1,63}\.[\w.]{1,63}",
    re.IGNORECASE,
)


def _texto_notebook() -> str:
    """Notebook inteiro (células, saídas e metadados) como texto, sem imagens base64."""
    nb = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    for cell in nb["cells"]:
        for out in cell.get("outputs", []):
            for mime in [m for m in out.get("data", {}) if m.startswith("image/")]:
                del out["data"][mime]
    return json.dumps(nb, ensure_ascii=False)


class HigienePublicacao(unittest.TestCase):
    def test_notebook_sem_caminho_local_ou_email(self):
        achado = PADRAO_PRIVADO.search(_texto_notebook())
        self.assertIsNone(achado, f"Dado privado no notebook: {achado and achado.group()!r}")

    def test_arquivos_de_texto_sem_caminho_local_ou_email(self):
        for pasta in ("data", "outputs"):
            for f in (ROOT / pasta).glob("*.csv"):
                self.assertIsNone(PADRAO_PRIVADO.search(f.read_text(encoding="utf-8")), f.name)
        for nome in ("README.md", "SECURITY.md", "requirements.txt"):
            self.assertIsNone(PADRAO_PRIVADO.search((ROOT / nome).read_text(encoding="utf-8")), nome)

    @unittest.skipUnless((ROOT / "outputs" / "dashboard.html").exists(), "dashboard.html não gerado (python dashboard/gerar_dashboard.py)")
    def test_dashboard_offline_e_sem_dado_privado(self):
        """O HTML do dashboard não pode depender de CDN externa nem conter caminhos/e-mails."""
        html = (ROOT / "outputs" / "dashboard.html").read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"""(src|href)\s*=\s*["']https?://""", html), "carrega recurso externo")
        self.assertIsNone(PADRAO_PRIVADO.search(html), "dado privado no HTML")

    def test_dependencias_fixadas(self):
        for bruta in (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines():
            linha = bruta.strip()
            if not linha or linha.startswith("#"):
                continue
            self.assertRegex(linha, r"^[A-Za-z0-9_.-]+==\d", f"requirements.txt: não fixada -> {linha}")

    def test_gitignore_cobre_segredos_e_ambientes(self):
        regras = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
        for esperado in (".env", ".venv/", "__pycache__/", ".ipynb_checkpoints/", "*.key"):
            self.assertIn(esperado, regras)


class Reprodutibilidade(unittest.TestCase):
    """Os resultados-chave publicados no README devem sair dos dados com a SEED fixa."""

    @classmethod
    def setUpClass(cls):
        e = pd.read_csv(ROOT / "data" / "edges_clean.csv")
        cls.G = nx.from_pandas_edgelist(e, "source", "target", edge_attr="weight")

    def test_tamanho_da_rede(self):
        self.assertEqual((self.G.number_of_nodes(), self.G.number_of_edges()), (77, 254))

    def test_top5_por_grau(self):
        top = [n for n, _ in sorted(self.G.degree, key=lambda x: (-x[1], x[0]))[:5]]
        self.assertEqual(top, ["Valjean", "Gavroche", "Marius", "Javert", "Thenardier"])

    def test_modularidade_louvain(self):
        comms = nx.community.louvain_communities(self.G, weight="weight", seed=42)
        q = nx.community.modularity(self.G, comms, weight="weight")
        self.assertEqual(len(comms), 6)
        self.assertAlmostEqual(q, 0.5654, places=3)


if __name__ == "__main__":
    unittest.main()
