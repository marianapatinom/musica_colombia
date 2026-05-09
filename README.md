# Pipeline de datos: preferencias de genero musical en Colombia

Entregables de la actividad:

- Cuaderno detallado en español: `notebooks/pipeline_musica_colombia.ipynb`
- Dashboard automatico: `dashboard/index.html`
- Tutorial: `docs/tutorial.md`
- Scraper que genera tabla limpia: `scripts/scrape_clean_table.mjs`
- Scraper de preferencias por genero: `scripts/scrape_genre_preferences.mjs`

## Ejecucion rapida

Abre `dashboard/index.html` en un navegador moderno. El tablero buscara automaticamente datasets relacionados con musica en el portal Datos Abiertos Colombia y ejecutara el flujo de ingesta, limpieza, inferencia de genero musical, transformacion y visualizacion.

Para usar servidor local:

```powershell
cd C:\Users\Catherine\Desktop\Codex\musica-colombia-pipeline\dashboard
node server.mjs
```

Luego entra a `http://localhost:8000`.

## Generar tabla limpia desde el scraping

Ejecuta:

```powershell
cd C:\Users\Catherine\Desktop\Codex\musica-colombia-pipeline
node scripts\scrape_clean_table.mjs
```

El script entrega tres archivos:

```text
data/processed/musica_colombia_tabla_limpia.csv
data/processed/musica_colombia_tabla_limpia.json
data/processed/musica_colombia_tabla_limpia.md
```

La tabla limpia queda con estas columnas: `nombre`, `departamento`, `municipio`, `tipo`, `anio`, `fecha`, `calidad`, `fuente`, `dataset_id` y `fecha_extraccion`.

## Componentes del pipeline

1. Definicion del tema: musica en Colombia.
2. Recoleccion: catalogo Socrata de datos.gov.co.
3. Ingesta: API SODA en JSON.
4. Limpieza: normalizacion, deduplicacion y estandarizacion.
5. Movimiento: raw JSON, staging SQLite, warehouse SQLite y dashboard.
6. Transformacion: agregados por departamento, tipo, anio y calidad.
7. Consumo: KPIs, graficos, tabla limpia de preferencias y descargas CSV/JSON.

## Nuevo enfoque del dashboard

El dashboard responde a la pregunta: **cuales son las preferencias de genero musical en Colombia segun ciudad y departamento?**

La preferencia se estima con menciones de generos musicales detectadas en los registros publicos disponibles. La tabla final del tablero queda agregada por:

```text
departamento, municipio, genero, menciones, preferencia, confianza, fuentes
```

`preferencia` representa el porcentaje de menciones de un genero dentro de la ciudad/municipio. `confianza` mide completitud de los campos territoriales y de genero.

Para exportar la misma tabla limpia del dashboard:

```powershell
cd C:\Users\Catherine\Desktop\Codex\musica-colombia-pipeline
node scripts\scrape_genre_preferences.mjs
```

Salida:

```text
data/processed/preferencias_genero_musical_colombia.csv
data/processed/preferencias_genero_musical_colombia.json
data/processed/preferencias_genero_musical_colombia.md
```

## Nota

El dashboard incluye una muestra local de respaldo para que el entregable funcione aunque la API publica no este disponible durante la exposicion.
