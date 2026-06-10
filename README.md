# PSMDOC Parser (Public CLI)

CLI público para:

- Generar HTML local desde archivos .psmdoc
- Sincronizar documentación local contra servicio remoto (API)

## Estado

Proyecto en desarrollo activo. El comando sync y el parser siguen evolucionando.

## Instalación

```bash
npm install -g @prioritysupport.mobi/psmdoc
```

Uso local del repositorio:

```bash
npm install
node src/index.js
```

## Comandos CLI

### 1) Build local

Genera HTML en carpeta local a partir de un site.json y archivos .psmdoc.

```bash
psmdoc build <site.json> [output]
```

Compatibilidad legacy:

```bash
psmdoc <site.json> [output]
```

- site.json: configuración del sitio
- output opcional: carpeta destino (por defecto: build/html dentro de la carpeta del JSON)

### 2) Sync remoto

Sincroniza una carpeta local con un proyecto remoto en la API.

```bash
psmdoc sync \
  --dir ./docs \
  --project-id 123 \
  --client-secret "<project_key>" \
  --base-url "https://psmdoc.gestionciudad.com"
```

Flags soportados:

- --dir: carpeta local raíz de documentación
- --project-id: id del proyecto remoto
- --client-secret: project_key remoto
- --base-url: URL base de API (default: https://psmdoc.gestionciudad.com)
- --flush: archiva remoto y recrea desde cero
- --version: versión fija (ej: 1.2.0) o + para bump patch
- --dry-run: simula sincronización sin cambios remotos
- --verbose: detalle por archivo

Comportamiento por defecto de sync:

- Calcula checksum de archivos locales y remotos
- Solo sube cambios
- Omite archivos sin cambios

## Flujo de sync (alto nivel)

1. Escanea archivos .psmdoc y assets locales
2. Obtiene manifiesto remoto
3. Calcula delta (crear/actualizar/sin cambios)
4. Sube assets primero
5. Reescribe referencias locales de assets a URL remota
6. Sube archivos .psmdoc actualizados
7. Aplica versión si se envió --version

Con --flush:

- Se crea snapshot remoto
- Se vacía contenido remoto
- Se recrea desde estructura local

## Estructura recomendada

```text
docs/
  site.json
  header.psmdoc
  footer.psmdoc
  Home.psmdoc
  GettingStarted/
    Introduction.psmdoc
    Installation.psmdoc
  images/
    logo.png
```

Notas:

- header.psmdoc y footer.psmdoc se inyectan en todas las páginas del build local
- En build local se copian css/psmdoc.css y js/psmdoc.js

## Ejecución rápida con demo incluida

Este repositorio ya incluye una carpeta demo lista en docs/.

Build local de la demo:

psmdoc build docs/site.json docs/build/html

Sync de prueba (sin escribir remoto):

psmdoc sync --dir ./docs --project-id 123 --client-secret "TU_PROJECT_KEY" --dry-run --verbose

Si quieres publicar cambios reales:

psmdoc sync --dir ./docs --project-id 123 --client-secret "TU_PROJECT_KEY" --verbose

## Soporte de assets locales

Se soportan referencias locales en etiquetas multimedia, por ejemplo:

```txt
#IMG images/logo.png "Logo"
#PDF docs/manual.pdf width=100% height=800
#AUDIO media/intro.mp3
```

En sync remoto:

- El CLI sube assets
- Obtiene URL pública
- Reescribe automáticamente src/rutas en el contenido antes de subir archivos

Nota actual de backend:

- El endpoint de upload de assets está implementado sobre el modelo de imágenes.
- En esta versión, para sync remoto usa preferentemente JPG/PNG/WEBP.
- SVG puede ser parseable en local pero ser rechazado por el backend de upload.

## Cabecera por archivo (##)

Si la primera línea de un .psmdoc inicia con ##, se interpretan metadatos.

Ejemplo:

```txt
## title="Introduccion" label="Inicio" description="Resumen rapido"
```

Campos reconocidos por CLI/build:

- title
- description
- keywords
- author
- robots
- auto-index
- font
- languages
- version
- label

## Sintaxis .psmdoc soportada

El parser trabaja por bloques separados por línea en blanco doble.

Inline:

- *texto* -> negrita
- _texto_ -> itálica
- ~texto~ -> tachado
- `texto` -> código inline

Etiquetas:

- #H1 … #H6
- #HR
- #IMG
- #CODE
- #IL / #EL
- #TABLE
- #QUOTE
- #VIDEO (youtube watch, youtu.be, embed)
- #AUDIO
- #PDF
- #SVG
- #MAP
- #ACCORDION / #O / #ENDACCORDION

## Ejemplo mínimo

```txt
## title="Guia de inicio" label="Inicio"

#H1 guia-inicio Guia de inicio

Bienvenido a la *documentacion*.

#IMG images/logo.png "Logo"

#H2 faq Preguntas frecuentes

#ACCORDION FAQ
#O Como sincronizo?
Ejecuta psmdoc sync con project-id y client-secret.

#ENDACCORDION
```

## Endpoints remotos usados por sync

- /api/project/sync/manifest/
- /api/project/sync/apply/
- /api/project/sync/delete/
- /api/project/sync/upload-asset/
- /api/project/sync/archive/
- /api/project/sync/version/

Importante:

- El comando sync requiere que estos endpoints estén desplegados en el backend remoto.
- Si recibes 404 en /api/project/sync/manifest/, el servidor aún no tiene el módulo sync publicado.

Headers de autenticación:

- X-Project-Id
- X-Client-Secret

## Scripts de desarrollo

- npm run parse -> node src/index.js

## Licencia

ISC
