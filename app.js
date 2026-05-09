const CATALOG = "https://api.us.socrata.com/api/catalog/v1";
const DOMAINS = "www.datos.gov.co,datos.gov.co";
const COLORS = ["#295bdb", "#07847c", "#e65d45", "#c58a12", "#21894c", "#7c3aed", "#0f766e", "#be123c"];

const genreRules = [
  { genero: "Vallenato", pattern: /vallenato|acordeon|parranda vallenata/ },
  { genero: "Salsa", pattern: /salsa|salsero|salsera/ },
  { genero: "Reggaeton", pattern: /reggaeton|urbano|urbana|trap/ },
  { genero: "Musica popular", pattern: /popular|ranchera|norteña|despecho|carrilera/ },
  { genero: "Rock", pattern: /rock|metal|punk|alternativo/ },
  { genero: "Cumbia", pattern: /cumbia|gaita|porro|fandango|tambora/ },
  { genero: "Champeta", pattern: /champeta|picotera|picotero/ },
  { genero: "Llanera", pattern: /llanera|joropo|arpa|cuatro/ },
  { genero: "Pacifico", pattern: /currulao|marimba|pacifico|chirimia|petronio/ },
  { genero: "Clasica", pattern: /clasica|sinfonica|filarmonica|orquesta|coro|opera/ },
  { genero: "Hip hop", pattern: /hip hop|rap|freestyle/ },
  { genero: "Electronica", pattern: /electronica|dj|techno|house/ },
  { genero: "Folclor", pattern: /folclor|folklor|tradicional|andina|bambuco|pasillo|musica campesina/ }
];

const fallbackRows = [
  { nombre: "Festival Vallenato", departamento: "Cesar", municipio: "Valledupar", descripcion: "vallenato acordeon parranda", fuente: "Muestra local" },
  { nombre: "Feria de Cali", departamento: "Valle del Cauca", municipio: "Cali", descripcion: "salsa orquestas salseras", fuente: "Muestra local" },
  { nombre: "Rock al Parque", departamento: "Bogota D.C.", municipio: "Bogota", descripcion: "rock metal alternativo", fuente: "Muestra local" },
  { nombre: "Festival Petronio Alvarez", departamento: "Valle del Cauca", municipio: "Cali", descripcion: "currulao marimba pacifico", fuente: "Muestra local" },
  { nombre: "Festival de la Leyenda Llanera", departamento: "Meta", municipio: "Villavicencio", descripcion: "joropo arpa musica llanera", fuente: "Muestra local" },
  { nombre: "Champeta en el Caribe", departamento: "Bolivar", municipio: "Cartagena de Indias", descripcion: "champeta picotera", fuente: "Muestra local" },
  { nombre: "Concierto urbano Medellin", departamento: "Antioquia", municipio: "Medellin", descripcion: "reggaeton urbano trap", fuente: "Muestra local" },
  { nombre: "Festival Nacional de la Cumbia", departamento: "Magdalena", municipio: "El Banco", descripcion: "cumbia tambora gaita", fuente: "Muestra local" },
  { nombre: "Musica popular cafetera", departamento: "Risaralda", municipio: "Pereira", descripcion: "musica popular despecho carrilera", fuente: "Muestra local" },
  { nombre: "Temporada Sinfonica Nacional", departamento: "Cundinamarca", municipio: "Bogota", descripcion: "orquesta sinfonica clasica", fuente: "Muestra local" }
];

const state = {
  source: "Muestra local",
  raw: [],
  evidence: [],
  clean: [],
  mart: {},
  filtered: []
};

const els = {
  sourceName: document.querySelector("#sourceName"),
  runTime: document.querySelector("#runTime"),
  pipelineState: document.querySelector("#pipelineState"),
  kpiRows: document.querySelector("#kpiRows"),
  kpiDepartments: document.querySelector("#kpiDepartments"),
  kpiCities: document.querySelector("#kpiCities"),
  kpiQuality: document.querySelector("#kpiQuality"),
  departmentFilter: document.querySelector("#departmentFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  searchInput: document.querySelector("#searchInput"),
  departmentChart: document.querySelector("#departmentChart"),
  deptTotal: document.querySelector("#deptTotal"),
  donutChart: document.querySelector("#donutChart"),
  typeLegend: document.querySelector("#typeLegend"),
  typeTotal: document.querySelector("#typeTotal"),
  qualityChart: document.querySelector("#qualityChart"),
  insights: document.querySelector("#insights"),
  dataTable: document.querySelector("#dataTable"),
  tableCount: document.querySelector("#tableCount"),
  refreshBtn: document.querySelector("#refreshBtn"),
  csvBtn: document.querySelector("#csvBtn"),
  jsonBtn: document.querySelector("#jsonBtn")
};

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function titleCase(value) {
  const text = normalizeText(value).toLowerCase();
  return text ? text.replace(/\b\w/g, letter => letter.toUpperCase()) : "Sin dato";
}

function normalizeKey(key) {
  return normalizeText(key).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pickField(row, patterns) {
  const key = Object.keys(row).find(candidate => patterns.some(pattern => pattern.test(candidate)));
  return key ? row[key] : "";
}

function detectGenres(text) {
  const normalized = normalizeText(text).toLowerCase();
  const found = genreRules.filter(rule => rule.pattern.test(normalized)).map(rule => rule.genero);
  return found.length ? [...new Set(found)] : ["Otros generos"];
}

function evidenceQuality(row) {
  const fields = ["departamento", "municipio", "genero"];
  const filled = fields.filter(field => row[field] && row[field] !== "Sin dato").length;
  return Math.round((filled / fields.length) * 100);
}

function toEvidenceRows(rawRows) {
  const evidence = [];
  rawRows.forEach(original => {
    const row = {};
    Object.entries(original).forEach(([key, value]) => {
      row[normalizeKey(key)] = typeof value === "string" ? normalizeText(value) : value;
    });

    const nombre = pickField(row, [/nombre/, /evento/, /actividad/, /titulo/, /razon_social/, /proyecto/, /lugar/]) || "Registro musical";
    const departamento = titleCase(pickField(row, [/departamento/, /depto/, /region/]));
    const municipio = titleCase(pickField(row, [/municipio/, /ciudad/, /localidad/]));
    const text = Object.values(row).join(" ");
    const genres = detectGenres(text);

    genres.forEach(genero => {
      const item = {
        nombre: titleCase(nombre),
        departamento,
        municipio,
        genero,
        fuente: row.fuente || state.source
      };
      item.calidad = evidenceQuality(item);
      evidence.push(item);
    });
  });
  return evidence.filter(row => row.departamento !== "Sin dato" || row.municipio !== "Sin dato");
}

function preferenceTable(evidenceRows) {
  const cityTotals = new Map();
  const grouped = new Map();

  evidenceRows.forEach(row => {
    const cityKey = `${row.departamento}|${row.municipio}`;
    const genreKey = `${cityKey}|${row.genero}`;
    cityTotals.set(cityKey, (cityTotals.get(cityKey) || 0) + 1);
    if (!grouped.has(genreKey)) {
      grouped.set(genreKey, {
        departamento: row.departamento,
        municipio: row.municipio,
        genero: row.genero,
        menciones: 0,
        calidad_sum: 0,
        fuentes: new Set()
      });
    }
    const current = grouped.get(genreKey);
    current.menciones += 1;
    current.calidad_sum += row.calidad;
    current.fuentes.add(row.fuente);
  });

  return [...grouped.values()].map(row => {
    const total = cityTotals.get(`${row.departamento}|${row.municipio}`) || row.menciones;
    return {
      departamento: row.departamento,
      municipio: row.municipio,
      genero: row.genero,
      menciones: row.menciones,
      preferencia: Math.round((row.menciones / total) * 100),
      confianza: Math.round(row.calidad_sum / row.menciones),
      fuentes: [...row.fuentes].slice(0, 3).join("; ")
    };
  }).sort((a, b) => b.menciones - a.menciones || b.preferencia - a.preferencia);
}

function groupCount(rows, key, valueKey = "menciones") {
  return rows.reduce((acc, row) => {
    const value = row[key] || "Sin dato";
    acc[value] = (acc[value] || 0) + Number(row[valueKey] || 1);
    return acc;
  }, {});
}

function departmentLeaders(rows) {
  const byDepartmentGenre = new Map();
  rows.forEach(row => {
    const key = `${row.departamento}|${row.genero}`;
    byDepartmentGenre.set(key, (byDepartmentGenre.get(key) || 0) + row.menciones);
  });
  const leaders = {};
  byDepartmentGenre.forEach((value, key) => {
    const [department, genre] = key.split("|");
    if (!leaders[department] || value > leaders[department].menciones) {
      leaders[department] = { genero: genre, menciones: value };
    }
  });
  return leaders;
}

function buildMart(rows) {
  return {
    byGenre: groupCount(rows, "genero"),
    byDepartment: groupCount(rows, "departamento"),
    leaders: departmentLeaders(rows),
    quality: {
      departamento: completeness(rows, "departamento"),
      municipio: completeness(rows, "municipio"),
      genero: completeness(rows, "genero"),
      menciones: completeness(rows, "menciones"),
      preferencia: completeness(rows, "preferencia")
    }
  };
}

function completeness(rows, key) {
  if (!rows.length) return 0;
  const filled = rows.filter(row => row[key] !== undefined && row[key] !== "" && row[key] !== "Sin dato").length;
  return Math.round((filled / rows.length) * 100);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function discoverDatasets() {
  const queries = ["musica genero Colombia", "musica", "música", "artistas musica", "espacios musica"];
  const responses = await Promise.allSettled(queries.map(q =>
    fetchJson(`${CATALOG}?only=dataset&domains=${DOMAINS}&q=${encodeURIComponent(q)}&limit=12`)
  ));
  const results = responses.flatMap(result => result.status === "fulfilled" ? result.value.results || [] : []);
  const unique = new Map();
  results.forEach(item => {
    const resource = item.resource || {};
    const id = resource.id;
    const haystack = normalizeText([resource.name, resource.description, ...(resource.tags || [])].join(" ")).toLowerCase();
    if (id && /musica|musical|cultura|festival|concierto|artista|banda|orquesta|genero/.test(haystack)) {
      unique.set(id, resource);
    }
  });
  return [...unique.values()].sort((a, b) => (b.page_views?.page_views_total || 0) - (a.page_views?.page_views_total || 0));
}

async function loadFromSocrata() {
  setStatus("Buscando conjuntos de datos");
  const datasets = await discoverDatasets();
  const collected = [];
  const sources = [];
  for (const dataset of datasets.slice(0, 8)) {
    setStatus(`Ingestando ${dataset.name}`);
    try {
      const rows = await fetchJson(`https://www.datos.gov.co/resource/${dataset.id}.json?$limit=5000`);
      if (Array.isArray(rows) && rows.length) {
        collected.push(...rows.map(row => ({ ...row, fuente: dataset.name })));
        sources.push(`${dataset.name} (${dataset.id})`);
      }
    } catch (error) {
      console.warn("No se pudo leer dataset", dataset.id, error);
    }
  }
  if (!collected.length) throw new Error("No se encontraron registros descargables desde la API");
  state.source = sources.slice(0, 3).join("; ");
  return collected;
}

async function runPipeline() {
  setStatus("Ejecutando");
  els.refreshBtn.disabled = true;
  try {
    state.raw = await loadFromSocrata();
  } catch (error) {
    console.warn(error);
    state.source = "Muestra local de respaldo";
    state.raw = fallbackRows;
  }

  localStorage.setItem("musica_colombia_raw", JSON.stringify(state.raw));
  setStatus("Infiriendo generos musicales");
  state.evidence = toEvidenceRows(state.raw);
  if (!state.evidence.length) state.evidence = toEvidenceRows(fallbackRows);

  setStatus("Calculando preferencias por ciudad");
  state.clean = preferenceTable(state.evidence);
  localStorage.setItem("musica_colombia_preferencias_limpias", JSON.stringify(state.clean));

  state.mart = buildMart(state.clean);
  localStorage.setItem("musica_colombia_mart", JSON.stringify(state.mart));
  state.filtered = [...state.clean];

  hydrateFilters();
  render();
  setStatus("Completado");
  els.sourceName.textContent = state.source;
  els.runTime.textContent = new Date().toLocaleString("es-CO");
  els.refreshBtn.disabled = false;
}

function setStatus(text) {
  els.pipelineState.textContent = text;
}

function hydrateFilters() {
  const departments = [...new Set(state.clean.map(row => row.departamento))].sort();
  const genres = [...new Set(state.clean.map(row => row.genero))].sort();
  els.departmentFilter.innerHTML = `<option value="">Todos</option>${departments.map(value => `<option>${value}</option>`).join("")}`;
  els.typeFilter.innerHTML = `<option value="">Todos</option>${genres.map(value => `<option>${value}</option>`).join("")}`;
}

function applyFilters() {
  const department = els.departmentFilter.value;
  const genre = els.typeFilter.value;
  const search = normalizeText(els.searchInput.value).toLowerCase();
  state.filtered = state.clean.filter(row => {
    const matchesDepartment = !department || row.departamento === department;
    const matchesGenre = !genre || row.genero === genre;
    const matchesSearch = !search || normalizeText(`${row.municipio} ${row.departamento} ${row.genero}`).toLowerCase().includes(search);
    return matchesDepartment && matchesGenre && matchesSearch;
  });
  render();
}

function render() {
  const rows = state.filtered;
  const mart = buildMart(rows);
  const departments = Object.keys(groupCount(rows, "departamento")).filter(value => value !== "Sin dato");
  const cities = [...new Set(rows.map(row => `${row.departamento}|${row.municipio}`))].filter(value => !value.includes("Sin dato"));
  const topGenre = sortedEntries(mart.byGenre)[0]?.[0] || "Sin dato";

  els.kpiRows.textContent = rows.length.toLocaleString("es-CO");
  els.kpiDepartments.textContent = departments.length.toLocaleString("es-CO");
  els.kpiCities.textContent = cities.length.toLocaleString("es-CO");
  els.kpiQuality.textContent = topGenre;

  renderDepartmentLeaders(mart.leaders);
  renderDonut(mart.byGenre);
  renderQuality(mart.quality);
  renderInsights(rows, mart);
  renderTable(rows.slice(0, 140));
}

function sortedEntries(object) {
  return Object.entries(object).sort((a, b) => b[1] - a[1]);
}

function renderDepartmentLeaders(leaders) {
  const entries = Object.entries(leaders)
    .sort((a, b) => b[1].menciones - a[1].menciones)
    .slice(0, 10);
  const max = Math.max(...entries.map(([, value]) => value.menciones), 1);
  els.deptTotal.textContent = `${entries.length} departamentos`;
  els.departmentChart.innerHTML = entries.map(([department, value]) => `
    <div class="bar-row">
      <strong title="${department}">${department}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max((value.menciones / max) * 100, 4)}%"></div></div>
      <span title="${value.genero}">${value.genero}</span>
    </div>
  `).join("");
}

function renderDonut(data) {
  const entries = sortedEntries(data).slice(0, 8);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  let cursor = 0;
  const stops = entries.map(([, value], index) => {
    const start = cursor;
    const end = cursor + (value / total) * 100;
    cursor = end;
    return `${COLORS[index % COLORS.length]} ${start}% ${end}%`;
  }).join(", ");
  els.donutChart.style.background = `conic-gradient(${stops || "#d1d5db 0 100%"})`;
  els.typeTotal.textContent = `${entries.length} generos`;
  els.typeLegend.innerHTML = entries.map(([name, value], index) => `
    <li><span><i class="swatch" style="background:${COLORS[index % COLORS.length]}"></i>${name}</span><strong>${value}</strong></li>
  `).join("");
}

function renderQuality(data) {
  els.qualityChart.innerHTML = Object.entries(data).map(([name, value]) => `
    <div class="quality-item">
      <div><strong>${titleCase(name)}</strong><span>${value}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${value}%"></div></div>
    </div>
  `).join("");
}

function renderInsights(rows, mart) {
  const topGenre = sortedEntries(mart.byGenre)[0] || ["Sin dato", 0];
  const topDepartment = sortedEntries(mart.byDepartment)[0] || ["Sin dato", 0];
  const strongest = [...rows].sort((a, b) => b.preferencia - a.preferencia || b.menciones - a.menciones)[0];
  const lowConfidence = rows.filter(row => row.confianza < 80).length;
  els.insights.innerHTML = [
    `El genero con mas menciones en el conjunto visible es ${topGenre[0]} con ${topGenre[1]} registros agregados.`,
    `El departamento con mayor volumen de señales musicales es ${topDepartment[0]}.`,
    strongest ? `${strongest.municipio}, ${strongest.departamento} muestra preferencia alta por ${strongest.genero} (${strongest.preferencia}%).` : "No hay suficientes filas para calcular una preferencia dominante.",
    `${lowConfidence} preferencias tienen confianza menor a 80 por campos territoriales incompletos.`
  ].map(text => `<li>${text}</li>`).join("");
}

function renderTable(rows) {
  els.tableCount.textContent = `${state.filtered.length} filas visibles`;
  els.dataTable.innerHTML = rows.map(row => `
    <tr>
      <td>${row.departamento}</td>
      <td>${row.municipio}</td>
      <td>${row.genero}</td>
      <td>${row.menciones}</td>
      <td>${row.preferencia}%</td>
      <td>${row.confianza}%</td>
    </tr>
  `).join("");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const headers = ["departamento", "municipio", "genero", "menciones", "preferencia", "confianza", "fuentes"];
  const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map(row => headers.map(key => escape(row[key])).join(","))].join("\n");
}

els.refreshBtn.addEventListener("click", runPipeline);
els.csvBtn.addEventListener("click", () => download("preferencias_genero_musical_colombia.csv", toCsv(state.filtered), "text/csv;charset=utf-8"));
els.jsonBtn.addEventListener("click", () => download("preferencias_genero_musical_mart.json", JSON.stringify(state.mart, null, 2), "application/json"));
els.departmentFilter.addEventListener("change", applyFilters);
els.typeFilter.addEventListener("change", applyFilters);
els.searchInput.addEventListener("input", applyFilters);

runPipeline();
