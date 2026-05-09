import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(projectRoot, "data", "processed");
const catalogUrl = "https://api.us.socrata.com/api/catalog/v1";
const domains = "www.datos.gov.co,datos.gov.co";
const queries = ["musica", "música", "eventos musicales", "cultura musica"];

const fallbackRows = [
  { nombre: "Festival Petronio Alvarez", departamento: "Valle del Cauca", municipio: "Cali", tipo: "Festival", fecha: "2025-08-15", fuente: "Muestra local" },
  { nombre: "Rock al Parque", departamento: "Bogota D.C.", municipio: "Bogota", tipo: "Festival", fecha: "2025-11-09", fuente: "Muestra local" },
  { nombre: "Festival Vallenato", departamento: "Cesar", municipio: "Valledupar", tipo: "Festival", fecha: "2025-04-30", fuente: "Muestra local" },
  { nombre: "Mercado Cultural del Caribe", departamento: "Atlantico", municipio: "Barranquilla", tipo: "Encuentro", fecha: "2025-09-20", fuente: "Muestra local" },
  { nombre: "Temporada Sinfonica Nacional", departamento: "Cundinamarca", municipio: "Bogota", tipo: "Concierto", fecha: "2025-06-11", fuente: "Muestra local" },
  { nombre: "Festival Mono Nunez", departamento: "Valle del Cauca", municipio: "Ginebra", tipo: "Festival", fecha: "2025-06-02", fuente: "Muestra local" },
  { nombre: "Circuito de Musicas Colombianas", departamento: "Antioquia", municipio: "Medellin", tipo: "Concierto", fecha: "2025-10-05", fuente: "Muestra local" },
  { nombre: "Escuela de Musica Tradicional", departamento: "Nariño", municipio: "Pasto", tipo: "Formacion", fecha: "2025-03-18", fuente: "Muestra local" }
];

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

function detectType(row) {
  const text = normalizeText(Object.values(row).join(" ")).toLowerCase();
  if (/festival|festividad|feria/.test(text)) return "Festival";
  if (/concierto|recital|presentacion/.test(text)) return "Concierto";
  if (/escuela|formacion|taller|clase/.test(text)) return "Formacion";
  if (/convocatoria|beca|estimulo/.test(text)) return "Convocatoria";
  if (/artista|agrupacion|banda|orquesta/.test(text)) return "Agente musical";
  return titleCase(pickField(row, [/tipo/, /categoria/, /clase/, /linea/])) || "Actividad musical";
}

function qualityScore(row) {
  const fields = ["nombre", "departamento", "municipio", "tipo", "anio"];
  const filled = fields.filter(field => row[field] && row[field] !== "Sin dato").length;
  return Math.round((filled / fields.length) * 100);
}

function cleanRows(rawRows, sourceName, datasetId = "sin-id") {
  const seen = new Set();
  return rawRows.map(original => {
    const row = {};
    Object.entries(original).forEach(([key, value]) => {
      row[normalizeKey(key)] = typeof value === "string" ? normalizeText(value) : value;
    });

    const dateValue = pickField(row, [/fecha/, /anio/, /a_o/, /year/, /vigencia/]);
    const parsedDate = new Date(dateValue);
    const fallbackYear = String(dateValue).match(/\b(20\d{2}|19\d{2})\b/)?.[0];
    const year = Number.isFinite(parsedDate.getFullYear()) ? parsedDate.getFullYear() : Number(fallbackYear || 0);
    const nombre = pickField(row, [/nombre/, /evento/, /actividad/, /titulo/, /razon_social/, /proyecto/]);
    const originalType = pickField(row, [/tipo/, /categoria/, /clase/, /linea/]);
    const departamento = pickField(row, [/departamento/, /depto/, /region/]);
    const municipio = pickField(row, [/municipio/, /ciudad/, /localidad/]);

    const clean = {
      nombre: titleCase(nombre || "Actividad musical"),
      departamento: titleCase(departamento),
      municipio: titleCase(municipio),
      tipo: detectType(row),
      anio: year || "Sin dato",
      fecha: dateValue || "",
      calidad: 0,
      fuente: row.fuente || sourceName,
      dataset_id: row.dataset_id_origen || datasetId,
      fecha_extraccion: new Date().toISOString().slice(0, 10),
      _texto_principal: `${nombre} ${originalType} ${row.fuente || sourceName}`,
      _texto_busqueda: JSON.stringify(row)
    };
    clean.calidad = qualityScore(clean);
    clean.id = [clean.nombre, clean.departamento, clean.municipio, clean.anio].join("|").toLowerCase();
    return clean;
  }).filter(row => {
    const keep = !seen.has(row.id);
    seen.add(row.id);
    const searchable = row._texto_principal.toLowerCase();
    return keep && /musica|musical|festival|concierto|artista|vallenato|sinfonica|banda|orquesta|cantante|cancion|sonoro|fonograf|discograf|instrumento|agrupacion/.test(searchable);
  }).map(({ id, _texto_principal, _texto_busqueda, ...row }) => row);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function discoverDatasets() {
  const responses = await Promise.allSettled(queries.map(query => {
    const url = `${catalogUrl}?only=dataset&domains=${domains}&q=${encodeURIComponent(query)}&limit=12`;
    return fetchJson(url);
  }));
  const resources = responses.flatMap(result => result.status === "fulfilled" ? result.value.results || [] : []);
  const unique = new Map();
  for (const item of resources) {
    const resource = item.resource || {};
    const haystack = normalizeText([resource.name, resource.description, ...(resource.tags || [])].join(" ")).toLowerCase();
    if (resource.id && /musica|musical|cultura|festival|concierto|artista|banda|orquesta/.test(haystack)) {
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
        collected.push(...rows.map(row => ({ ...row, fuente: dataset.name, dataset_id_origen: dataset.id })));
        sources.push(`${dataset.name} (${dataset.id})`);
      }
    } catch {
      // Sigue con el siguiente recurso descubierto.
    }
  }
  if (!collected.length) throw new Error("No se encontro un dataset descargable");
  return {
    rows: collected,
    sourceName: sources.join("; "),
    datasetId: "catalogo-combinado"
  };
}

function toCsv(rows) {
  const headers = ["nombre", "departamento", "municipio", "tipo", "anio", "fecha", "calidad", "fuente", "dataset_id", "fecha_extraccion"];
  const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map(row => headers.map(header => escape(row[header])).join(","))].join("\n");
}

function toMarkdown(rows) {
  const headers = ["nombre", "departamento", "municipio", "tipo", "anio", "calidad", "fuente"];
  const header = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.slice(0, 50).map(row => `| ${headers.map(key => String(row[key] ?? "").replace(/\|/g, "/")).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

await mkdir(outputDir, { recursive: true });

let scraped;
try {
  scraped = await scrapeRows();
} catch (error) {
  scraped = {
    rows: fallbackRows,
    sourceName: "Muestra local de respaldo",
    datasetId: "muestra-local"
  };
}

const cleanTable = cleanRows(scraped.rows, scraped.sourceName, scraped.datasetId);
const csvPath = resolve(outputDir, "musica_colombia_tabla_limpia.csv");
const jsonPath = resolve(outputDir, "musica_colombia_tabla_limpia.json");
const mdPath = resolve(outputDir, "musica_colombia_tabla_limpia.md");

await writeFile(csvPath, toCsv(cleanTable), "utf8");
await writeFile(jsonPath, JSON.stringify(cleanTable, null, 2), "utf8");
await writeFile(mdPath, toMarkdown(cleanTable), "utf8");

console.log(`Tabla limpia generada con ${cleanTable.length} filas`);
console.log(`CSV: ${csvPath}`);
console.log(`JSON: ${jsonPath}`);
console.log(`Markdown: ${mdPath}`);
