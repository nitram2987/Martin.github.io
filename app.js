const DATA = window.AMNISTIA_DATA;

const state = {
  minCuotas: DATA.assumptions.minCuotasDefault,
  tasaFracc: DATA.assumptions.tasaFraccionamientoDefault,
  anclaRate: DATA.assumptions.anclaPredialDefault,
  acogMult: DATA.assumptions.acogimientoMultiplierDefault,
  pulsoMult: DATA.assumptions.pulsoNaturalMultiplierDefault,
  activeTab: "ejecutivo",
  conceptMetric: "saldoBruto",
  filters: {
    tramo: "Todos los tramos",
    concepto: "Todos los conceptos",
    estado: "Todos los estados",
    search: "",
  },
};

const colors = {
  blue: "#1F3864",
  mid: "#2E75B6",
  gold: "#D6AA00",
  green: "#3F8D4A",
  lightGreen: "#C6EFCE",
  orange: "#ED7D31",
  red: "#C00000",
  gray: "#9AA6B6",
  line: "#D9E0EA",
  ink: "#17202F",
};

const els = {};

function qs(id) {
  return document.getElementById(id);
}

function money(value) {
  const abs = Math.abs(Number(value) || 0);
  if (abs >= 1_000_000) return `S/ ${(value / 1_000_000).toFixed(2)} M`;
  if (abs >= 1_000) return `S/ ${(value / 1_000).toFixed(1)} mil`;
  return `S/ ${Number(value || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 })}`;
}

function moneyFull(value) {
  return `S/ ${Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function numberFull(value) {
  return Number(value || 0).toLocaleString("es-PE");
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function pctInt(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function getFraccSensitivity() {
  return DATA.fraccionamiento.sensibilidad.find((row) => row.minCuotas === state.minCuotas) || DATA.fraccionamiento.sensibilidad[0];
}

function computeModel() {
  const fr = getFraccSensitivity();
  const natural = DATA.totals.recaudacionNaturalJulAgo * state.pulsoMult;
  const incrementalBase = DATA.totals.incrementalBeneficio;
  const incremental = incrementalBase * state.acogMult;
  const anchor = DATA.totals.ipInsoluto2026 * state.anclaRate;
  const fracc = fr.interes * state.tasaFracc;
  const total = natural + incremental + anchor + fracc;
  const remanente = DATA.totals.saldoBruto - DATA.totals.descuento - natural - incremental - anchor - fracc;
  const cobertura = DATA.totals.metaJulDic ? total / DATA.totals.metaJulDic : 0;
  return {
    natural,
    incremental,
    anchor,
    fracc,
    total,
    remanente,
    cobertura,
    fraccInfo: fr,
  };
}

function svg(tag, attrs = {}, children = []) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) el.setAttribute(key, value);
  });
  children.forEach((child) => el.appendChild(child));
  return el;
}

function textNode(x, y, text, attrs = {}) {
  const el = svg("text", { x, y, ...attrs });
  el.textContent = text;
  return el;
}

function clear(el) {
  el.innerHTML = "";
}

function tooltipHtml(title, rows) {
  return `<strong>${title}</strong>${rows.map(([label, value]) => `<div><span class="muted">${label}:</span> ${value}</div>`).join("")}`;
}

function showTooltip(event, html) {
  els.tooltip.innerHTML = html;
  moveTooltip(event);
}

function moveTooltip(event) {
  const pad = 16;
  const rect = els.tooltip.getBoundingClientRect();
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  if (x + rect.width > window.innerWidth) x = event.clientX - rect.width - pad;
  if (y + rect.height > window.innerHeight) y = event.clientY - rect.height - pad;
  els.tooltip.style.transform = `translate(${x}px, ${y}px)`;
}

function hideTooltip() {
  els.tooltip.style.transform = "translate(-9999px, -9999px)";
}

function withTooltip(node, html) {
  node.addEventListener("mouseenter", (event) => showTooltip(event, html));
  node.addEventListener("mousemove", moveTooltip);
  node.addEventListener("mouseleave", hideTooltip);
  return node;
}

function makeKpi(label, value, note, tone = "") {
  const div = document.createElement("article");
  div.className = `kpi ${tone}`;
  div.innerHTML = `
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-note">${note}</div>
  `;
  return div;
}

function renderKpis(model) {
  clear(els.kpiGrid);
  const kpis = [
    makeKpi("Cartera del programa", money(DATA.totals.saldoBruto), "Saldo bruto reconciliado con fuente", ""),
    makeKpi("Descuento fiscal", money(DATA.totals.descuento), `${percent(DATA.totals.descuento / DATA.totals.saldoBruto)} del stock`, "warn"),
    makeKpi("Ancla predial", money(model.anchor), `${pctInt(state.anclaRate)} sobre IP insoluto 2026`, "anchor"),
    makeKpi("Ingreso Jul-Ago", money(model.total), `${percent(model.cobertura)} de la meta Jul-Dic`, "good"),
    makeKpi("Saldo remanente", money(model.remanente), "Posterior a campaña y descuento", ""),
    makeKpi("Natural sin beneficio", money(model.natural), `${pctInt(state.pulsoMult)} del pulso histórico`, ""),
    makeKpi("Incremental beneficio", money(model.incremental), `${pctInt(state.acogMult)} de acogimiento vencido`, "good"),
    makeKpi("Fraccionamiento", money(model.fracc), `${model.fraccInfo.contratos} contratos elegibles`, "warn"),
    makeKpi("Universo elegible", money(DATA.totals.universoElegible), "Cartera total menos excluidos", ""),
    makeKpi("Monto no afecto", money(DATA.totals.montoNoAfecto), "FRA insoluto, IEPND, M.A. y otros", ""),
  ];
  kpis.forEach((item) => els.kpiGrid.appendChild(item));
}

function renderExecutiveNarrative(model) {
  els.executiveNarrative.innerHTML = `
    ${DATA.narrative.intro}
    Con los supuestos vigentes, el tablero estima un ingreso Jul-Ago de <strong>${moneyFull(model.total)}</strong>,
    compuesto por ingreso natural, ancla predial 2026, recuperación vencida y fraccionamiento.
  `;
}

function renderExecutiveObservations() {
  els.executiveObservations.innerHTML = DATA.narrative.observacionesGerenciales.map((item) => `
    <div class="observation-card">
      <div class="observation-top">
        <span>${item.titulo}</span>
        <strong>${moneyFull(DATA.totals[item.monto] || 0)}</strong>
      </div>
      <p>${item.texto}</p>
    </div>
  `).join("");
}

function renderPortfolioComposition() {
  const rows = [
    ["Cartera total del programa", DATA.totals.saldoBruto, "Universo acumulado de análisis"],
    ["Universo elegible", DATA.totals.universoElegible, "Base afecta al beneficio"],
    ["Predial insoluto acumulado", DATA.totals.ipInsolutoAcumulado, "Predial insoluto de todos los años"],
    ["Predial insoluto vencido 2005-2025", DATA.totals.ipInsolutoVencido, "Predial no corriente"],
    ["Ancla estricta: IP insoluto 2026", DATA.totals.ipInsoluto2026, "Base de acceso al beneficio"],
    ["2026 corriente total", DATA.totals.corriente2026Total, "IP, arbitrios y otros componentes 2026"],
    ["Arbitrios insoluto acumulado", DATA.totals.arbInsolutoAcumulado, "Arbitrios insoluto de todos los años"],
  ];
  els.portfolioComposition.innerHTML = `
    <table>
      <thead><tr><th>Componente</th><th class="num">Monto</th><th>Lectura</th></tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${row[0]}</td>
            <td class="num">${moneyFull(row[1])}</td>
            <td>${row[2]}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderProgramPitch() {
  els.programPitch.innerHTML = DATA.narrative.pitch.map((text, index) => `
    <div class="pitch-item">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <p>${text}</p>
    </div>
  `).join("");
}

function renderWaterfall(model) {
  clear(els.waterfallChart);
  const rows = [
    { label: "Natural", value: model.natural, color: colors.mid },
    { label: "Ancla 2026", value: model.anchor, color: colors.gold },
    { label: "Beneficio", value: model.incremental, color: colors.green },
    { label: "Fracc.", value: model.fracc, color: colors.orange },
    { label: "Total ingreso", value: model.total, color: colors.blue },
  ];
  const width = 780;
  const height = 360;
  const margin = { top: 26, right: 20, bottom: 54, left: 70 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const max = Math.max(...rows.map((row) => row.value)) * 1.15 || 1;
  const barW = chartWidth / rows.length * 0.58;
  const gap = chartWidth / rows.length;
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  root.appendChild(textNode(12, 18, "Soles estimados", { class: "chart-label" }));
  for (let i = 0; i <= 4; i += 1) {
    const y = margin.top + chartHeight - (chartHeight * i) / 4;
    root.appendChild(svg("line", { x1: margin.left, x2: width - margin.right, y1: y, y2: y, stroke: colors.line }));
    root.appendChild(textNode(8, y + 4, money((max * i) / 4), { class: "chart-label" }));
  }
  rows.forEach((row, index) => {
    const x = margin.left + index * gap + (gap - barW) / 2;
    const h = (row.value / max) * chartHeight;
    const y = margin.top + chartHeight - h;
    const rect = svg("rect", { x, y, width: barW, height: Math.max(2, h), rx: 4, fill: row.color, class: "bar" });
    withTooltip(rect, tooltipHtml(row.label, [["Monto", moneyFull(row.value)], ["Participación", percent(row.value / model.total)]]));
    root.appendChild(rect);
    root.appendChild(textNode(x + barW / 2, y - 7, money(row.value), { class: "chart-label", "text-anchor": "middle" }));
    root.appendChild(textNode(x + barW / 2, height - 18, row.label, { class: "chart-label", "text-anchor": "middle" }));
  });
  els.waterfallChart.appendChild(root);
}

function renderProjectionTable(model) {
  const adjusted = DATA.projection.map((row) => {
    let incremental = row.incrementalBeneficio;
    let natural = row.sinBeneficio;
    let anchor = row.incrementalAncla;
    if (row.concepto !== "Fraccionamiento") {
      incremental *= state.acogMult;
      natural *= state.pulsoMult;
    }
    if (row.concepto === "IP corriente") anchor = model.anchor;
    if (row.concepto === "Fraccionamiento") incremental = model.fracc;
    const total = natural + incremental + anchor;
    return { ...row, sinBeneficio: natural, incrementalBeneficio: incremental, incrementalAncla: anchor, totalConBeneficio: total };
  });
  els.projectionTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Frente</th><th class="num">Sin beneficio</th><th class="num">Incremental</th><th class="num">Ancla</th><th class="num">Total ingreso</th><th>Lectura</th>
        </tr>
      </thead>
      <tbody>
        ${adjusted.map((row) => `
          <tr>
            <td>${row.concepto}</td>
            <td class="num">${moneyFull(row.sinBeneficio)}</td>
            <td class="num">${moneyFull(row.incrementalBeneficio)}</td>
            <td class="num">${moneyFull(row.incrementalAncla)}</td>
            <td class="num"><strong>${moneyFull(row.totalConBeneficio)}</strong></td>
            <td>${row.lectura}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderValidationTable() {
  const fmt = (row, value) => {
    if (typeof value !== "number") return value;
    if (row.control.includes("Escenario") || row.control.includes("Padrón")) return numberFull(value);
    return moneyFull(value);
  };
  els.validationTable.innerHTML = `
    <table>
      <thead><tr><th>Control</th><th class="num">Fuente</th><th class="num">Modelo</th><th>Estado</th></tr></thead>
      <tbody>
        ${DATA.validations.map((row) => `
          <tr>
            <td>${row.control}</td>
            <td class="num">${fmt(row, row.fuente)}</td>
            <td class="num">${fmt(row, row.modelo)}</td>
            <td><span class="status ${row.estado === "OK" ? "ok" : row.estado.includes("VACÍO") ? "empty" : "warn"}">${row.estado}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderCoverageGauge(model) {
  const pct = Math.max(0, Math.min(model.cobertura, 1.25));
  els.coverageGauge.innerHTML = `
    <div class="gauge-ring" style="--gauge: ${Math.min(pct, 1) * 100}%">
      <div class="gauge-content">
        <div class="gauge-value">${percent(model.cobertura)}</div>
        <div class="gauge-label">Cobertura meta Jul-Dic</div>
        <div class="kpi-note">${moneyFull(model.total)} / ${moneyFull(DATA.totals.metaJulDic)}</div>
      </div>
    </div>
  `;
}

function renderStackedHorizontal(container, rows, options) {
  clear(container);
  const width = 840;
  const rowH = 48;
  const margin = { top: 22, right: 120, bottom: 28, left: 122 };
  const height = margin.top + margin.bottom + rows.length * rowH;
  const max = Math.max(...rows.map((row) => options.series.reduce((sum, serie) => sum + Math.max(row[serie.key] || 0, 0), 0))) || 1;
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  const scale = (value) => (value / max) * (width - margin.left - margin.right);
  rows.forEach((row, idx) => {
    const y = margin.top + idx * rowH;
    const label = row.displayName || row.key;
    root.appendChild(textNode(10, y + 24, label, { class: "chart-label" }));
    let x = margin.left;
    options.series.forEach((serie) => {
      const w = scale(row[serie.key] || 0);
      const rect = svg("rect", { x, y: y + 5, width: Math.max(1, w), height: 24, rx: 4, fill: serie.color, class: "bar" });
      withTooltip(rect, tooltipHtml(label, [[serie.label, moneyFull(row[serie.key] || 0)], ["Saldo bruto", moneyFull(row.saldoBruto)], ["Lectura", row.note || "Tramo de antigüedad de deuda"]]));
      root.appendChild(rect);
      x += w;
    });
    root.appendChild(textNode(x + 8, y + 23, money(row.saldoBruto), { class: "chart-label" }));
  });
  const legendX = margin.left;
  options.series.forEach((serie, i) => {
    const x = legendX + i * 150;
    root.appendChild(svg("rect", { x, y: height - 16, width: 10, height: 10, fill: serie.color }));
    root.appendChild(textNode(x + 15, height - 7, serie.label, { class: "chart-label" }));
  });
  container.appendChild(root);
}

function adjustedGroupRows(rows) {
  return rows.map((row) => ({
    ...row,
    recuperacion: row.recuperacion * state.acogMult,
    noRecuperado: Math.max(row.noRecuperado - row.recuperacion * (state.acogMult - 1), 0),
  }));
}

function renderTramos() {
  const rows = adjustedGroupRows(DATA.byTramo);
  renderStackedHorizontal(els.tramoChart, rows, {
    series: [
      { key: "descuento", label: "Descuento", color: colors.orange },
      { key: "recuperacion", label: "Recuperación", color: colors.green },
      { key: "noRecuperado", label: "No recuperado", color: colors.gray },
    ],
  });

  const ranked = [...rows].sort((a, b) => b.saldoBruto - a.saldoBruto);
  els.tramoCards.innerHTML = ranked.map((row, idx) => {
    const label = row.displayName || row.key;
    return `
      <div class="priority">
        <span class="marker"></span>
        <div>
          <strong>${label}</strong>
          <span>${row.note || `Descuento/saldo ${percent(row.descuento / row.saldoBruto)} | Recuperación/saldo post ${percent(row.recuperacion / row.saldoPost)}`}</span>
        </div>
        <b>${money(row.saldoBruto)}</b>
      </div>
    `;
  }).join("");
}

function renderConcepts() {
  const metric = state.conceptMetric;
  const rows = adjustedGroupRows(DATA.byConcept)
    .filter((row) => row[metric] > 0)
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 10);
  const labels = {
    saldoBruto: "Saldo bruto",
    descuento: "Descuento",
    recuperacion: "Recuperación",
    noRecuperado: "No recuperado",
  };
  renderSingleBar(els.conceptChart, rows, metric, labels[metric], metric === "descuento" ? colors.orange : metric === "recuperacion" ? colors.green : colors.mid);
}

function renderSingleBar(container, rows, key, label, color) {
  clear(container);
  const width = 900;
  const rowH = 36;
  const margin = { top: 18, right: 110, bottom: 18, left: 205 };
  const height = margin.top + margin.bottom + rows.length * rowH;
  const max = Math.max(...rows.map((row) => row[key] || 0)) || 1;
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  const chartW = width - margin.left - margin.right;
  rows.forEach((row, idx) => {
    const y = margin.top + idx * rowH;
    const w = ((row[key] || 0) / max) * chartW;
    root.appendChild(textNode(10, y + 21, row.key, { class: "chart-label" }));
    const rect = svg("rect", { x: margin.left, y: y + 5, width: Math.max(2, w), height: 20, rx: 4, fill: color, class: "bar" });
    withTooltip(rect, tooltipHtml(row.key, [[label, moneyFull(row[key])], ["Saldo bruto", moneyFull(row.saldoBruto)], ["Descuento", moneyFull(row.descuento)], ["Recuperación", moneyFull(row.recuperacion)]]));
    root.appendChild(rect);
    root.appendChild(textNode(margin.left + w + 8, y + 21, money(row[key]), { class: "chart-label" }));
  });
  container.appendChild(root);
}

function renderFracc() {
  clear(els.fraccChart);
  const rows = DATA.fraccionamiento.sensibilidad.map((row) => ({
    ...row,
    recovery: row.interes * state.tasaFracc,
  }));
  const width = 760;
  const height = 360;
  const margin = { top: 28, right: 30, bottom: 46, left: 70 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const max = Math.max(...rows.map((row) => row.recovery)) || 1;
  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  for (let i = 0; i <= 4; i += 1) {
    const y = margin.top + chartH - (chartH * i) / 4;
    root.appendChild(svg("line", { x1: margin.left, x2: width - margin.right, y1: y, y2: y, stroke: colors.line }));
    root.appendChild(textNode(8, y + 4, money((max * i) / 4), { class: "chart-label" }));
  }
  const gap = chartW / rows.length;
  const barW = Math.max(16, gap * 0.62);
  rows.forEach((row, idx) => {
    const x = margin.left + idx * gap + (gap - barW) / 2;
    const h = (row.recovery / max) * chartH;
    const y = margin.top + chartH - h;
    const selected = row.minCuotas === state.minCuotas;
    const rect = svg("rect", { x, y, width: barW, height: Math.max(2, h), rx: 4, fill: selected ? colors.orange : colors.mid, class: "bar" });
    withTooltip(rect, tooltipHtml(`Regla ${row.minCuotas}+ cuotas`, [["Contratos", numberFull(row.contratos)], ["Interés elegible", moneyFull(row.interes)], ["Recuperación", moneyFull(row.recovery)]]));
    root.appendChild(rect);
    root.appendChild(textNode(x + barW / 2, height - 20, String(row.minCuotas), { class: "chart-label", "text-anchor": "middle" }));
  });
  root.appendChild(textNode(width / 2, height - 3, "Cuotas vencidas mínimas", { class: "chart-label", "text-anchor": "middle" }));
  els.fraccChart.appendChild(root);

  const rowsTable = DATA.fraccionamiento.topContratos.filter((row) => row.cuotas >= state.minCuotas).slice(0, 35);
  els.fraccTable.innerHTML = `
    <table>
      <thead><tr><th>Contribuyente</th><th class="num">Saldo</th><th class="num">Interés</th><th class="num">Cuotas</th><th>Vía</th></tr></thead>
      <tbody>
        ${rowsTable.map((row) => `
          <tr>
            <td>${row.contribuyente}</td>
            <td class="num">${moneyFull(row.total)}</td>
            <td class="num">${moneyFull(row.interes)}</td>
            <td class="num">${numberFull(row.cuotas)}</td>
            <td>${row.via}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderMotorTable() {
  const { tramo, concepto, estado, search } = state.filters;
  const text = search.trim().toLowerCase();
  let rows = DATA.calcRows;
  if (tramo !== "Todos los tramos") rows = rows.filter((row) => row.tramo === tramo);
  if (concepto !== "Todos los conceptos") rows = rows.filter((row) => row.concepto === concepto);
  if (estado !== "Todos los estados") rows = rows.filter((row) => row.estado === estado);
  if (text) {
    rows = rows.filter((row) => `${row.anio} ${row.tramo} ${row.estado} ${row.concepto}`.toLowerCase().includes(text));
  }
  rows = [...rows].sort((a, b) => b.saldoBruto - a.saldoBruto).slice(0, 120);
  els.motorTable.innerHTML = `
    <table>
      <thead>
        <tr><th>Año</th><th>Tramo</th><th>Estado</th><th>Concepto</th><th class="num">Saldo</th><th class="num">Beneficio</th><th class="num">Descuento</th><th class="num">Recuperación</th></tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${row.anio}</td>
            <td>${row.tramo}</td>
            <td>${row.estado}</td>
            <td>${row.concepto}</td>
            <td class="num">${moneyFull(row.saldoBruto)}</td>
            <td class="num">${percent(row.beneficio)}</td>
            <td class="num">${moneyFull(row.descuento)}</td>
            <td class="num">${moneyFull(row.recuperacion * state.acogMult)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function fillSelect(select, values, selected) {
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
  select.value = selected;
}

function setupControls() {
  fillSelect(els.minCuotas, Array.from({ length: 12 }, (_, i) => String(i + 1)), String(state.minCuotas));
  els.minCuotas.addEventListener("change", () => {
    state.minCuotas = Number(els.minCuotas.value);
    render();
  });
  [
    ["tasaFracc", "tasaFraccValue", (value) => { state.tasaFracc = Number(value) / 100; }],
    ["anclaRate", "anclaRateValue", (value) => { state.anclaRate = Number(value) / 100; }],
    ["pulsoMult", "pulsoMultValue", (value) => { state.pulsoMult = Number(value) / 100; }],
    ["acogMult", "acogMultValue", (value) => { state.acogMult = Number(value) / 100; }],
  ].forEach(([inputId, valueId, update]) => {
    els[inputId].addEventListener("input", () => {
      update(els[inputId].value);
      els[valueId].textContent = `${els[inputId].value}%`;
      render();
    });
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === state.activeTab));
      render();
    });
  });

  els.conceptMetric.addEventListener("change", () => {
    state.conceptMetric = els.conceptMetric.value;
    renderConcepts();
  });

  const tramos = ["Todos los tramos", ...new Set(DATA.calcRows.map((row) => row.tramo))];
  const conceptos = ["Todos los conceptos", ...new Set(DATA.calcRows.map((row) => row.concepto))];
  const estados = ["Todos los estados", ...new Set(DATA.calcRows.map((row) => row.estado))];
  fillSelect(els.tramoFilter, tramos, state.filters.tramo);
  fillSelect(els.conceptFilter, conceptos, state.filters.concepto);
  fillSelect(els.estadoFilter, estados, state.filters.estado);
  els.tramoFilter.addEventListener("change", () => { state.filters.tramo = els.tramoFilter.value; renderMotorTable(); });
  els.conceptFilter.addEventListener("change", () => { state.filters.concepto = els.conceptFilter.value; renderMotorTable(); });
  els.estadoFilter.addEventListener("change", () => { state.filters.estado = els.estadoFilter.value; renderMotorTable(); });
  els.searchMotor.addEventListener("input", () => { state.filters.search = els.searchMotor.value; renderMotorTable(); });

  els.printBtn.addEventListener("click", () => window.print());
  els.downloadBtn.addEventListener("click", downloadCsv);
}

function downloadCsv() {
  const rows = [
    ["anio", "contrato", "via", "contribuyente", "insoluto", "interes", "costas", "total", "cuotas", "dni_ruc"],
    ...DATA.fraccionamiento.topContratos.map((row) => [
      row.anio,
      row.contrato,
      row.via,
      row.contribuyente,
      row.insoluto,
      row.interes,
      row.costas,
      row.total,
      row.cuotas,
      row.dniRuc,
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "base_fraccionamiento_prioritaria.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cacheElements() {
  [
    "kpiGrid",
    "waterfallChart",
    "projectionTable",
    "validationTable",
    "coverageGauge",
    "executiveNarrative",
    "executiveObservations",
    "portfolioComposition",
    "programPitch",
    "tramoChart",
    "tramoCards",
    "conceptChart",
    "fraccChart",
    "fraccTable",
    "motorTable",
    "tooltip",
    "minCuotas",
    "tasaFracc",
    "tasaFraccValue",
    "anclaRate",
    "anclaRateValue",
    "pulsoMult",
    "pulsoMultValue",
    "acogMult",
    "acogMultValue",
    "conceptMetric",
    "tramoFilter",
    "conceptFilter",
    "estadoFilter",
    "searchMotor",
    "printBtn",
    "downloadBtn",
  ].forEach((id) => { els[id] = qs(id); });
}

function render() {
  const model = computeModel();
  renderKpis(model);
  renderExecutiveNarrative(model);
  renderExecutiveObservations();
  renderWaterfall(model);
  renderProjectionTable(model);
  renderValidationTable();
  renderCoverageGauge(model);
  renderPortfolioComposition();
  renderProgramPitch();
  renderTramos();
  renderConcepts();
  renderFracc();
  renderMotorTable();
}

function init() {
  cacheElements();
  setupControls();
  render();
}

document.addEventListener("DOMContentLoaded", init);
