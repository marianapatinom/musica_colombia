# Tutorial: pipeline y dashboard de preferencias de genero musical en Colombia

Este tutorial explica como usar y presentar los entregables de la actividad.

## 1. Tema y objetivo

El tema seleccionado es la preferencia de genero musical en Colombia por ciudad y departamento. El pipeline busca automaticamente conjuntos de datos publicos relacionados con musica, cultura, festivales, conciertos, artistas, bandas y orquestas dentro del portal Datos Abiertos Colombia.

El objetivo es demostrar un ciclo completo de ingenieria de datos: descubrimiento de fuente, ingesta, limpieza, organizacion, movimiento entre capas, transformacion y visualizacion final.

## 2. Fuente de datos

La fuente principal es el catalogo Socrata:

```text
https://api.us.socrata.com/api/catalog/v1
```

El dashboard consulta el catalogo con estas palabras clave:

```text
musica, música, eventos musicales, cultura musica
```

Cuando encuentra un dataset relevante, descarga registros desde:

```text
https://www.datos.gov.co/resource/{id}.json
```

Si la API no responde o no encuentra registros descargables, el dashboard usa una muestra local de respaldo. Esto evita que la presentacion falle por conectividad.

## 3. Como ejecutar el dashboard

Opcion simple:

1. Abre `dashboard/index.html` en el navegador.
2. Espera a que el estado cambie a `Completado`.
3. Usa los filtros de departamento, tipo de actividad y busqueda.
4. Descarga los resultados con los botones `CSV` o `JSON`.

Opcion con servidor local:

```powershell
cd C:\Users\Catherine\Desktop\Codex\musica-colombia-pipeline\dashboard
node server.mjs
```

Luego abre:

```text
http://localhost:8000
```

## 4. Que hace el dashboard

El dashboard ejecuta estas etapas:

1. **Recoleccion:** busca datasets en el catalogo de datos.gov.co.
2. **Ingesta:** descarga registros en JSON desde la API SODA.
3. **Almacenamiento raw:** guarda la respuesta original en `localStorage`.
4. **Limpieza:** normaliza nombres, ubicaciones, fuentes y textos.
5. **Inferencia:** detecta generos como vallenato, salsa, reggaeton, rock, cumbia, champeta, llanera, Pacifico, clasica, hip hop, electronica, popular y folclor.
6. **Transformacion:** calcula menciones y porcentaje de preferencia por ciudad y departamento.
7. **Consumo:** muestra KPIs, graficos, hallazgos y tabla limpia.

## 4.1. Como generar solo la tabla limpia

Si quieres que el scraping entregue directamente la tabla limpia de preferencias por genero sin abrir el dashboard, ejecuta:

```powershell
cd C:\Users\Catherine\Desktop\Codex\musica-colombia-pipeline
node scripts\scrape_genre_preferences.mjs
```

El resultado queda en:

```text
data/processed/preferencias_genero_musical_colombia.csv
data/processed/preferencias_genero_musical_colombia.json
data/processed/preferencias_genero_musical_colombia.md
```

La estructura final de la tabla es:

| Columna | Descripcion |
|---|---|
| departamento | Departamento normalizado |
| municipio | Municipio o ciudad normalizada |
| genero | Genero musical inferido |
| menciones | Cantidad de registros asociados al genero en la ciudad |
| preferencia | Porcentaje del genero dentro de la ciudad |
| confianza | Completitud de campos clave |
| fuentes | Datasets que soportan el calculo |

## 5. Como ejecutar el cuaderno

Abre el archivo:

```text
notebooks/pipeline_musica_colombia.ipynb
```

Ejecuta las celdas en orden. El notebook creara estas carpetas si no existen:

```text
data/raw
data/processed
data/warehouse
```

Y generara:

```text
data/raw/musica_colombia_raw.json
data/processed/musica_colombia_limpio.csv
data/warehouse/staging_musica.db
data/warehouse/warehouse_musica.db
```

## 6. Movimiento de datos entre sistemas

La simulacion mueve datos asi:

| Capa | Tecnologia usada | Proposito |
|---|---|---|
| Raw | JSON | Guardar la extraccion original |
| Staging | SQLite | Simular base intermedia |
| Warehouse | SQLite | Publicar datos limpios y marts |
| Dashboard | HTML/JS | Consumir indicadores finales |

## 7. Transformaciones realizadas

Las principales transformaciones son:

- Normalizar nombres de columnas.
- Estandarizar textos y valores vacios.
- Detectar columnas equivalentes aunque tengan nombres distintos.
- Inferir tipo de actividad: festival, concierto, formacion, convocatoria o agente musical.
- Extraer anio desde campos de fecha o vigencia.
- Eliminar duplicados.
- Calcular puntaje de calidad por completitud.
- Crear agregados por departamento y tipo.

## 8. Como presentar los resultados

Puedes explicar el resultado final con esta guia:

1. El dashboard muestra cuantas preferencias ciudad-genero se calcularon.
2. Los KPIs resumen departamentos, municipios y genero lider.
3. El grafico de barras identifica el genero lider por departamento.
4. El grafico circular muestra la distribucion nacional por genero.
5. La tabla permite auditar la preferencia por ciudad y departamento.
6. Los botones de descarga demuestran la capa de consumo y reutilizacion.

## 9. Reflexion final

El aprendizaje principal es que el valor del pipeline aparece cuando los datos se vuelven trazables, limpios y consumibles. La fuente abierta entrega datos con estructuras variables, por lo que el trabajo de ingenieria consiste en automatizar la busqueda, controlar la calidad, transformar a un formato comun y publicar resultados comprensibles para usuarios finales.
