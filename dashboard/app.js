(function () {
  "use strict";
  var D = JSON.parse(document.getElementById("dados").textContent);
  var ROTULO = { grau: "grau", intermediacao: "intermediação", proximidade: "proximidade", autovetor: "autovetor", pagerank: "PageRank" };
  var TEMAS = {
    claro:  { aresta: "#cfd6e0", forte: "#18212f", borda: "#ffffff", texto: "#18212f", traco: "#ffffff" },
    escuro: { aresta: "#34425a", forte: "#e8edf5", borda: "#0f1621", texto: "#e8edf5", traco: "#0f1621" }
  };
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, props, texto) {            // cria elementos só com textContent (nunca innerHTML)
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { e.setAttribute(k, props[k]); });
    if (texto !== undefined) e.textContent = texto;
    return e;
  }
  function fmt(x, d) { return Number(x).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d }); }
  function f3(x) { return Number(x).toFixed(3).replace(".", ","); }
  var cor = {}; D.comunidades.forEach(function (c) { cor[c.id] = c.cor; });
  var porId = {}; D.nos.forEach(function (n) { porId[n.id] = n; });
  var vizinhos = {}; D.nos.forEach(function (n) { vizinhos[n.id] = []; });
  D.arestas.forEach(function (a) { vizinhos[a.de].push({ id: a.para, peso: a.peso }); vizinhos[a.para].push({ id: a.de, peso: a.peso }); });
  Object.keys(vizinhos).forEach(function (k) { vizinhos[k].sort(function (a, b) { return b.peso - a.peso || (a.id < b.id ? -1 : 1); }); });

  var estado = { metrica: "grau", escondidas: {}, removidos: 0, selecionado: null, tema: "claro" };
  $("remover").max = String(D.robustez.ordem_hubs.length);   // limite vem dos dados, não fixo no HTML
  var botoes = {};

  // ---- KPIs
  var R = D.resumo;
  [["Personagens", R.nos], ["Conexões", R.arestas], ["Comunidades", D.comunidades.length], ["Modularidade", R.modularidade],
   ["Densidade", R.densidade], ["Agrupamento médio", R.clustering], ["Caminho médio", R.caminho_medio]].forEach(function (k) {
    var d = el("div", { "class": "kpi" }); d.appendChild(el("b", null, fmt(k[1], 4))); d.appendChild(el("span", null, k[0])); $("kpis").appendChild(d);
  });

  // ---- comunidades (chips)
  D.comunidades.forEach(function (c) {
    var b = el("button", { type: "button", "class": "chip", "aria-pressed": "true" });
    b.appendChild(el("span", { "class": "dot", style: "background:" + c.cor }));
    b.appendChild(el("span", null, c.lider));
    b.appendChild(el("small", null, c.tamanho + " nós"));
    b.setAttribute("title", "Comunidade " + c.id + " · líder: " + c.lider);
    b.addEventListener("click", function () {
      estado.escondidas[c.id] = !estado.escondidas[c.id];
      b.setAttribute("aria-pressed", estado.escondidas[c.id] ? "false" : "true"); aplicar();
    });
    botoes[c.id] = b; $("comunidades").appendChild(b);
  });
  D.nos.map(function (n) { return n.id; }).sort().forEach(function (id) { $("nomes").appendChild(el("option", { value: id })); });

  // ---- rede
  function tooltip(n) {
    var d = el("div"); d.appendChild(el("b", null, n.id));
    [["Conexões", n.grau], ["Intermediação", f3(n.intermediacao)], ["Proximidade", f3(n.proximidade)], ["Comunidade", n.comunidade]]
      .forEach(function (p) { d.appendChild(el("div", null, p[0] + ": " + p[1])); });
    return d;
  }
  var nodes = new vis.DataSet(D.nos.map(function (n) { return { id: n.id, x: n.x, y: n.y, title: tooltip(n) }; }));
  var edges = new vis.DataSet(D.arestas.map(function (a, i) {
    return { id: i, from: a.de, to: a.para, value: a.peso, title: el("div", null, a.de + " – " + a.para + ": " + a.peso + " capítulo(s) em comum") };
  }));
  var rede = new vis.Network($("rede"), { nodes: nodes, edges: edges }, {
    physics: false,
    interaction: { hover: true, tooltipDelay: 80 },
    nodes: { shape: "dot", borderWidth: 2, font: { size: 22, face: "system-ui, Segoe UI, Arial", strokeWidth: 5 } },
    edges: { smooth: false, scaling: { min: 0.7, max: 4.5 } }
  });

  function valorMax() { return Math.max.apply(null, D.nos.map(function (n) { return n[estado.metrica]; })); }
  function topPorMetrica(k) {
    return D.nos.slice().sort(function (a, b) { return b[estado.metrica] - a[estado.metrica]; }).slice(0, k);
  }
  function removidosSet() {
    var s = {}; D.robustez.ordem_hubs.slice(0, estado.removidos).forEach(function (id) { s[id] = true; }); return s;
  }

  function aplicar() {
    var T = TEMAS[estado.tema], max = valorMax(), rem = removidosSet(), sel = estado.selecionado;
    var viz = {}, rotulados = {};
    if (sel) { viz[sel] = true; rotulados[sel] = true; vizinhos[sel].forEach(function (v, i) { viz[v.id] = true; if (i < 10) rotulados[v.id] = true; }); }
    else topPorMetrica(10).forEach(function (n) { rotulados[n.id] = true; });
    nodes.update(D.nos.map(function (n) {
      var apagado = sel && !viz[n.id], c = cor[n.comunidade];
      return {
        id: n.id, size: 6 + 28 * Math.sqrt(n[estado.metrica] / max), hidden: !!estado.escondidas[n.comunidade] || !!rem[n.id],
        label: rotulados[n.id] ? n.id : "", opacity: apagado ? 0.14 : 1,
        color: { background: c, border: n.id === sel ? T.forte : T.borda, highlight: { background: c, border: T.forte }, hover: { background: c, border: T.forte } },
        font: { size: rotulados[n.id] ? 22 : 0, color: T.texto, strokeColor: T.traco }
      };
    }));
    edges.update(D.arestas.map(function (a, i) {
      var liga = sel && (a.de === sel || a.para === sel), fraca = sel && !liga;
      return { id: i, color: { color: liga ? T.forte : T.aresta, highlight: T.forte, hover: T.forte, opacity: fraca ? 0.06 : (liga ? 0.95 : 0.75) } };
    }));
    atualizarRanking(); atualizarRemocao();
  }

  function atualizarRanking() {
    $("tituloRank").textContent = "Top 10 · " + ROTULO[estado.metrica];
    var lista = $("rank"); lista.textContent = "";
    var top = topPorMetrica(10), max = top[0][estado.metrica] || 1;
    top.forEach(function (n, i) {
      var li = el("li", { tabindex: "0", role: "button", "aria-label": "Localizar " + n.id });
      li.appendChild(el("span", { "class": "pos" }, String(i + 1)));
      li.appendChild(el("span", null, n.id));
      li.appendChild(el("span", { "class": "valor" }, estado.metrica === "grau" ? String(n.grau) : f3(n[estado.metrica])));
      var tr = el("div", { "class": "trilho" }), b = el("div", { style: "width:" + (100 * n[estado.metrica] / max) + "%;background:" + cor[n.comunidade] });
      tr.appendChild(b); li.appendChild(tr);
      li.addEventListener("click", function () { focar(n.id); });
      li.addEventListener("keydown", function (e) { if (e.key === "Enter") focar(n.id); });
      lista.appendChild(li);
    });
  }

  function atualizarRemocao() {
    var k = estado.removidos, a = D.robustez.alvo[k], r = D.robustez.aleatorio[k];
    $("rotuloRemover").textContent = String(k);
    $("barraAlvo").style.width = (a * 100) + "%"; $("barraAleat").style.width = (r * 100) + "%";
    $("pctAlvo").textContent = (a * 100).toFixed(0) + "%"; $("pctAleat").textContent = (r * 100).toFixed(0) + "%";
    $("saidaRemover").textContent = k === 0 ? "Rede completa: todos os nós conectados entre si."
      : "Fração dos nós que continua na maior componente conectada ao remover " + k + " hubs ou " + k + " nós aleatórios.";
  }

  function detalhar(id) {
    var box = $("detalhe"); box.textContent = ""; box.appendChild(el("h2", null, "Detalhes"));
    if (!id) { box.appendChild(el("p", { "class": "vazio" }, "Clique num nó do grafo para ver as métricas e os vizinhos.")); return; }
    var n = porId[id];
    box.appendChild(el("b", { style: "font-size:1.1rem" }, id));
    var selo = el("div", { "class": "selo" });
    selo.appendChild(el("span", { "class": "dot", style: "background:" + cor[n.comunidade] }));
    selo.appendChild(el("span", null, "Comunidade " + n.comunidade)); box.appendChild(selo);
    var g = el("div", { "class": "metricas" });
    [["Conexões", n.grau], ["Intermediação", f3(n.intermediacao)], ["Proximidade", f3(n.proximidade)], ["PageRank", f3(n.pagerank)]]
      .forEach(function (p) { var d = el("div", null, p[0]); d.appendChild(el("b", null, String(p[1]))); g.appendChild(d); });
    box.appendChild(g);
    box.appendChild(el("div", { "class": "nota", style: "margin:0" }, "Mais capítulos em comum com:"));
    var ul = el("ul", { "class": "vizinhos" });
    vizinhos[id].slice(0, 8).forEach(function (v) {
      var li = el("li"); li.appendChild(el("span", null, v.id)); li.appendChild(el("span", { "class": "valor" }, v.peso + " cap."));
      li.addEventListener("click", function () { focar(v.id); }); ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function focar(id) {
    if (!porId[id]) return;
    estado.selecionado = id; aplicar(); detalhar(id);
    rede.selectNodes([id]); rede.focus(id, { scale: 1.2, animation: { duration: 500 } });
  }

  function definirTema(t) {
    estado.tema = t; document.documentElement.setAttribute("data-tema", t);
    $("tema").textContent = t === "claro" ? "🌙 Tema escuro" : "☀️ Tema claro"; aplicar();
  }

  rede.on("click", function (p) {
    if (p.nodes.length) { estado.selecionado = p.nodes[0]; detalhar(p.nodes[0]); }
    else { estado.selecionado = null; detalhar(null); rede.unselectAll(); }
    aplicar();
  });
  $("metrica").addEventListener("change", function (e) { estado.metrica = e.target.value; aplicar(); });
  $("remover").addEventListener("input", function (e) { estado.removidos = parseInt(e.target.value, 10) || 0; aplicar(); });
  $("busca").addEventListener("change", function (e) {
    var q = e.target.value.trim().toLowerCase(); if (!q) return;
    var achado = D.nos.filter(function (n) { return n.id.toLowerCase() === q; })[0]
              || D.nos.filter(function (n) { return n.id.toLowerCase().indexOf(q) === 0; })[0];
    if (achado) focar(achado.id);
  });
  $("tema").addEventListener("click", function () { definirTema(estado.tema === "claro" ? "escuro" : "claro"); });
  $("zmais").addEventListener("click", function () { rede.moveTo({ scale: rede.getScale() * 1.3, animation: true }); });
  $("zmenos").addEventListener("click", function () { rede.moveTo({ scale: rede.getScale() / 1.3, animation: true }); });
  $("zfit").addEventListener("click", function () { rede.fit({ animation: true }); });
  $("reset").addEventListener("click", function () {
    var t = estado.tema;
    estado = { metrica: "grau", escondidas: {}, removidos: 0, selecionado: null, tema: t };
    $("metrica").value = "grau"; $("remover").value = "0"; $("busca").value = "";
    Object.keys(botoes).forEach(function (k) { botoes[k].setAttribute("aria-pressed", "true"); });
    rede.unselectAll(); detalhar(null); aplicar(); rede.fit({ animation: true });
  });

  definirTema(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro");
  rede.fit();
})();
