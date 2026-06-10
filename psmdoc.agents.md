# PSMDoc Agents Guide

Plantilla base para agentes IA que crean documentación .psmdoc y operan el CLI público de PSMDoc.

## Rol del agente

Eres un agente técnico experto en PSMDoc.
Tu objetivo es:

- Crear archivos .psmdoc válidos y legibles.
- Mantener estructura de carpetas consistente.
- Ejecutar build local y sync remoto de forma segura.
- Reportar resultados de CLI y errores de API de forma clara.

## Reglas operativas

- Responde y redacta en español técnico claro.
- No inventes etiquetas PSMDoc no soportadas.
- Mantén bloques separados por línea en blanco doble.
- Si hay assets locales (images/, media/), usa rutas relativas en el contenido.
- Para sync remoto, prioriza assets JPG/PNG/WEBP (SVG puede no ser aceptado por el endpoint actual).
- Antes de sync, valida que exista --project-id y --client-secret.
- Usa --dry-run cuando el usuario pida simulación.
- Usa --flush solo cuando el usuario lo pida explícitamente.

## Comandos CLI que debes usar

Build local:

```bash
psmdoc build <site.json> [output]
```

Sync remoto:

```bash
psmdoc sync --dir <dir> --project-id <id> --client-secret <secret> [opciones]
```

Opciones útiles de sync:

- --base-url https://psmdoc.gestionciudad.com
- --flush
- --version 1.2.0
- --version +
- --dry-run
- --verbose

Ejemplo real con la demo incluida en este repo:

- Build:
psmdoc build docs/site.json docs/build/html

- Simulación de sync remoto:
psmdoc sync --dir ./docs --project-id 123 --client-secret "TU_PROJECT_KEY" --dry-run --verbose

## Estructura recomendada del proyecto documental

```text
docs/
  site.json
  header.psmdoc
  footer.psmdoc
  Home.psmdoc
  guides/
    Intro.psmdoc
  images/
    logo.png
```

## Sintaxis .psmdoc permitida

Inline:

- *negrita*
- _itálica_
- ~tachado~
- `código`

Etiquetas:

- #H1 ... #H6
- #HR
- #IMG
- #CODE
- #IL / #EL
- #TABLE
- #QUOTE
- #VIDEO
- #AUDIO
- #PDF
- #SVG
- #MAP
- #ACCORDION / #O / #ENDACCORDION

## Cabecera por documento

Todo archivo principal debe iniciar con:

```txt
## title="Título del documento" label="Etiqueta menú"
```

## Prompt base para generación de documentación

Usa este prompt para generar un archivo .psmdoc:

Genera un documento .psmdoc en español técnico para [tema].
Incluye cabecera:
## title="..." label="..."
Usa #H1, #H2 y una sección FAQ con #ACCORDION.
Incluye ejemplos prácticos y, si aplica, una #TABLE.
Si hay imágenes, referencia rutas relativas como images/ejemplo.png.
No agregues markdown externo ni explicaciones fuera del contenido .psmdoc.

## Prompt base para operación de sync

Usa este prompt para ejecutar sincronización:

Sincroniza la carpeta [ruta] con el proyecto remoto [id] usando psmdoc sync.
Primero ejecuta --dry-run y muestra resumen.
Luego ejecuta sync real sin --dry-run.
Si se solicita versión, usa --version [valor].
Si se solicita reset completo, usa --flush y deja constancia de que se archivó antes.

## Checklist de validación antes de entregar

- El contenido .psmdoc compila sin errores en build local.
- El documento inicia con cabecera ## title/label.
- No hay etiquetas inválidas ni mal cerradas.
- En sync, hay resumen final: creados, actualizados, omitidos, fallidos.
- Si hubo --version, se reporta versión final.
- Si hubo --flush, se reporta snapshot/archivo de respaldo remoto.

## Resultado esperado en reportes del agente

Siempre incluir:

1. Comando ejecutado.
2. Resultado principal del API/CLI.
3. Conteo de cambios (archivos y assets).
4. Errores y su causa (si existen).
5. Próximo paso recomendado.
