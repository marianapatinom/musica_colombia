import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(projectRoot, "data", "processed");
const catalogUrl = "https://api.us.socrata.com/api/catalog/v1";
const domains = "www.datos.gov.co,datos.gov.co";
const queries = ["musica genero Colombia", "musica", "música", "artistas musica", "espacios musica"];

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
  { nombre: "Festival Nacional de la Cumbia", departamento: "Magdalena", municipio: "El Banco", descripcion: "cumbia tambora gaita", fuente: "Muestra local" }
];

function normalizeText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ");
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
  return found.length ? [...new Set(found)] : [];
}

function toEvidenceRows(rawRows, sourceName) {
  const evidence = [];
  for (const original of rawRows) {
    const row = {};
    Object.entries(original).forEach(([key, value]) => {
      row[normalizeKey(key)] = typeof value === "string" ? normalizeText(value) : value;
    });
    const departamento = titleCase(pickField(row, [/departamento/, /depto/, /region/]));
    const municipio = titleCase(pickField(row, [/municipio/, /ciudad/, /localidad/]));
    const genres = detectGenres(Object.values(row).join(" "));
    for (const genero of genres) {
      const calidad = Math.round((["departamento", "municipio"].filter(field => ({ departamento, municipio })[field] !== "Sin dato").length + 1) / 3 * 100);
      evidence.push({ departamento, municipio, genero, calidad, fuente: row.fuente || sourceName });
    }
  }
  return evidence.filter(row => row.departamento !== "Sin dato" || row.municipio !== "Sin dato");
}

function preferenceTable(evidenceRows) {
  const cityTotals = new Map();
  const grouped = new Map();
  for (const row of evidenceRows) {
    const cityKey = `${row.departamento}|${row.municipio}`;
    const genreKey = `${cityKey}|${row.genero}`;
    cityTotals.set(cityKey, (cityTotals.get(cityKey) || 0) + 1);
    if (!grouped.has(genreKey)) {
      grouped.set(genreKey, { departamento: row.departamento, municipio: row.municipio, genero: row.genero, menciones: 0, calidad_sum: 0, fuentes: new Set() });
    }
    const current = grouped.get(genreKey);
    current.menciones += 1;
    current.calidad_sum += row.calidad;
    current.fuentes.add(row.fuente);
  }
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

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function discoverDatasets() {
  const responses = await Promise.allSettled(queries.map(query =>
    fetchJson(`${catalogUrl}?only=dataset&domains=${domains}&q=${encodeURIComponent(query)}&limit=12`)
  ));
  const resources = responses.flatMap(result => result.status === "fulfilled" ? result.value.results || [] : []);
  const unique = new Map();
  for (const item of resources) {
    const resource = item.resource || {};
    const haystack = normalizeText([resource.name, resource.description, ...(resource.tags || [])].join(" ")).toLowerCase();
    if (resource.id && /musica|musical|cultura|festival|concierto|artista|banda|orquesta|genero/.test(haystack)) {
      unique.set(resource.id, resource);
    }
  }
  return [...unique.values()].sort((a, b) => (b.page_views?.page_views_total || 0) - (a.page_views?.page_views_total || 0));
}

async function scrapeRows() {
  const datasets = await discoverDatasets();
  const collected = [];
  const sources = [];
  for (const dataset of datasets.slice(0, 8)) {
    try {
      const rows = await fetchJson(`https://www.datos.gov.co/resource/${dataset.id}.json?$limit=5000`);
      if (Array.isArray(rows) && rows.length) {
        collected.push(...rows.map(row => ({ ...row, fuente: dataset.name })));
        sources.push(`${dataset.name} (${dataset.id})`);
      }
    } catch {
      // Continua con el siguiente dataset.
    }
  }
  if (!collected.length) return { rows: fallbackRows, sourceName: "Muestra local de respaldo" };
  return { rows: collected, sourceName: sources.slice(0, 3).join("; ") };
}

function toCsv(rows) {
  const headers = ["departamento", "municipio", "genero", "menciones", "preferencia", "confianza", "fuentes"];
  const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map(row => headers.map(header => escape(row[header])).join(","))].join("\n");
}

function toMarkdown(rows) {
  const headers = ["departamento", "municipio", "genero", "menciones", "preferencia", "confianza"];
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.slice(0, 80).map(row => `| ${headers.map(key => row[key]).join(" | ")} |`)
  ].join("\n");
}

await mkdir(outputDir, { recursive: true });
const scraped = await scrapeRows();
const preferences = preferenceTable(toEvidenceRows(scraped.rows, scraped.sourceName));

await writeFile(resolve(outputDir, "preferencias_genero_musical_colombia.csv"), toCsv(preferences), "utf8");
await writeFile(resolve(outputDir, "preferencias_genero_musical_colombia.json"), JSON.stringify(preferences, null, 2), "utf8");
await writeFile(resolve(outputDir, "preferencias_genero_musical_colombia.md"), toMarkdown(preferences), "utf8");

console.log(`Tabla de preferencias generada con ${preferences.length} filas`);
console.log(resolve(outputDir, "preferencias_genero_musical_colombia.csv"));
