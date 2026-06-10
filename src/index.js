#!/usr/bin/env node
// @ts-check
/**
 * index.js — CLI de PSMDoc
 *
 * Uso:
 *   psmdoc build <site.json> [output]   Genera HTML desde archivos locales
 *   psmdoc sync  --dir <dir> --project-id <id> --client-secret <secret> [opts]
 *
 * Retrocompatibilidad: `psmdoc <site.json>` equivale a `psmdoc build <site.json>`.
 *
 * Opciones de sync:
 *   --dir            Directorio raíz de los archivos .psmdoc (obligatorio)
 *   --project-id     ID numérico del proyecto remoto (obligatorio)
 *   --client-secret  project_key del proyecto (obligatorio)
 *   --base-url       URL base de la API  [https://psmdoc.gestionciudad.com]
 *   --flush          Archivar remoto y recrear desde local (borra y recrea)
 *   --version        "1.2.0" para versión exacta, "+" para bump patch
 *   --dry-run        Simula sin escribir nada en remoto
 *   --verbose        Muestra detalle de cada archivo
 */

import fs from "fs";
import path from "path";
import logger from "./logger.js";
import psmdocParser from "./psmdoc_parser.js";
import { syncProject } from "./sync.js";



// ---------------------------------------------------------------------------
// Parseo de argumentos
// ---------------------------------------------------------------------------

const rawArgs = process.argv.slice(2);

/**
 * Parsea flags estilo --key value y --flag (boolean).
 * @param {string[]} args
 * @returns {{ _: string[], [key: string]: string|boolean|string[] }}
 */
const parseArgs = (args) => {
  const result = { _: [] };
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        result[key] = next;
        i += 2;
      } else {
        result[key] = true;
        i += 1;
      }
    } else {
      result._.push(arg);
      i += 1;
    }
  }
  return result;
};

const argv = parseArgs(rawArgs);

// Determinar subcomando
let subcommand = argv._[0] || "";
if (!subcommand) {
  console.error("Uso: psmdoc build <site.json> [output]");
  console.error("     psmdoc sync --dir <dir> --project-id <id> --client-secret <secret>");
  process.exit(1);
}

// Retrocompatibilidad: si el primer argumento parece un archivo JSON, es build
if (subcommand.endsWith(".json") || (subcommand !== "build" && subcommand !== "sync")) {
  // Inyectar "build" implícito
  argv._.unshift("build");
  subcommand = "build";
}

// ---------------------------------------------------------------------------
// Subcomando: sync
// ---------------------------------------------------------------------------

if (subcommand === "sync") {
  const dir = String(argv["dir"] || ".");
  const projectId = argv["project-id"];
  const clientSecret = argv["client-secret"];

  if (!projectId) {
    console.error("Error: --project-id es obligatorio para sync.");
    process.exit(1);
  }
  if (!clientSecret) {
    console.error("Error: --client-secret es obligatorio para sync.");
    process.exit(1);
  }

  await syncProject({
    dir,
    projectId: Number(projectId) || String(projectId),
    clientSecret: String(clientSecret),
    baseUrl: String(argv["base-url"] || "https://psmdoc.gestionciudad.com"),
    flush: argv["flush"] === true,
    version: argv["version"] ? String(argv["version"]) : undefined,
    dryRun: argv["dry-run"] === true,
    verbose: argv["verbose"] === true,
  });
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Subcomando: build (comportamiento original)
// ---------------------------------------------------------------------------

const file = argv._[1];

if (!file) {
  logger.error("No file given. Provide the JSON config file: psmdoc build <site.json> [output]");
  process.exit(1);
}

let output = argv._[2];

if (!output) {
  // output is the folder where the html files will be created
  // will be created in the same folder as the file given in the arguments
  output = path.dirname(file);
  output = path.join(output, "build/html");
}

if (!file) {
  console.error("No file given");
  process.exit(1);
}

// load json file
let site ={};
let rootSite = {};
try {
  site = JSON.parse(fs.readFileSync(file, "utf8"));
  rootSite = JSON.parse(fs.readFileSync(file, "utf8"));
  if(rootSite.logo && !rootSite.logo.startsWith("http")) {
    // path to root of site
    rootSite.logo = path.join("/", rootSite.logo);
  }
} catch (e) {
  console.error("Error parsing json file");
  process.exit(1);
}

const root = path.dirname(file);

// load all .psmdoc file recursively
let files = [];
let header = "";
let footer = "";

/**
 * Recursively loads files from the specified directory and populates the files array.
 * If a file named "header.psmdoc" is found, it is stored in the header variable.
 * If a file named "footer.psmdoc" is found, it is stored in the footer variable.
 *
 * @param {string} dir - The directory to load files from.
 */
const loadFiles = (dir) => {
  logger.info(`Loading files from ${dir}`);
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      loadFiles(filePath);
    } else {
      logger.info(`Loading file ${file}`);
      if (file.endsWith(".psmdoc")) {
        if (file === "header.psmdoc") {
          // log the file name with success style alert user that header will be used in each file
          logger.info(`Header file ${file} will be used in each file`);
          header = fs.readFileSync(filePath, "utf8");
        } else if (file === "footer.psmdoc") {
          footer = fs.readFileSync(filePath, "utf8");
        }
        files.push(filePath);
      }
    }
  });
};

logger.info(`Loading files from ${root}`);
loadFiles(root);

// copy css/psmdoc.css to output folder
var __dirname = path.resolve();
const cssFile = path.join(__dirname, "css/psmdoc.css");
const cssOutput = path.join(output, "css");
fs.mkdirSync(cssOutput, { recursive: true });
fs.copyFileSync(cssFile, path.join(cssOutput, "psmdoc.css"));
// copy js/psmdoc.js to output folder
const jsFile = path.join(__dirname, "js/psmdoc.js");
const jsOutput = path.join(output, "js");
fs.mkdirSync(jsOutput, { recursive: true });
fs.copyFileSync(jsFile, path.join(jsOutput, "psmdoc.js"));

var menuItemsHtml = "";

files.forEach((file) => {
  const data = fs.readFileSync(file, "utf8");

  const html = [];

  // file is a json with the following structure
  // {
  //     "title": "Gestión Ciudad | Software de Gestión de Municipial",
  //     "description": "Gestión Ciudad es un software de gestión de municipios que permite a los ciudadanos realizar trámites y consultas de forma online.",
  //     "keywords": "gestión ciudad, software de gestión de municipios, trámites online, consultas online",
  //     "author": "Gestión Ciudad | Norman Torres",
  //     "robots": "index, follow",
  //     "auto-index": "true",
  //     "font": "https://fonts.googleapis.com/css?family=Roboto:400,700&display=swap",
  //     "style": {
  //         "background": "#f5f5f5",
  //         "color": "#333",
  //         "font-family": "Roboto, sans-serif",
  //         "font-size": "16px",
  //         "line-height": "1.5",
  //         "text-align": "left"
  //     },
  //     "languages": ["es", "en"],
  //     "version": "3.2.0"
  // }

  // the file is located in the root of the project where .psmdoc files are located
  // .psmdoc files are special structured files that are used to create html files
  // each special structure is defined by starting with #
  // #H1, #H2, #H3, #H4, #H5, #H6 are used to create headers, headers are levels of titles
  // #img is used to insert images, if http or https is used, the image is inserted from the url, if not,
  // the image is inserted from the root of the project
  // example: #img https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png "Google Logo" width=100 height=100 fit=cover
  // example: #img logo.png "Logo" height=100 fit=cover width=100
  // Any line starting with - is a list item #- is a numbered list item
  // #code is used to insert code, the code is inserted in a code block
  // #IL is used to insert a internal link relative to the root of the project
  // #EL is used to insert a external link to a url
  // #table is used to insert a table, the table is inserted in a table  block
  // #quote is used to insert a quote, the quote is inserted in a blockquote block
  // any string starting and ending with * whitout spaces is a bold text
  // any string starting and ending with _ whitout spaces is a italic text
  // any string starting and ending with ~ whitout spaces is a strike text
  // any string starting and ending with ` whitout spaces is a code text

  
  var label = path.basename(file, ".psmdoc");
  // if data first line start with ##, then contains page information
  // example: ## title="Gestión Ciudad | Software de Gestión de Municipial" label="Inicio" description="Gestión Ciudad es un software de gestión de municipios que permite a los ciudadanos realizar trámites y consultas de forma online." keywords="gestión ciudad, software de gestión de municipios, trámites online, consultas online" author="Gestión Ciudad | Norman Torres" robots="index, follow" auto-index="true" font="https://fonts.googleapis.com/css?family=Roboto:400,700&display=swap" style="background:#f5f5f5;color:#333;font-family:Roboto, sans-serif;font-size:16px;line-height:1.5;text-align:left" languages="es,en" version="3.2.0"
  if (data.startsWith("##")) {
    const lines = data.split("\n");
    const page = lines[0].substring(2).split(" ");
    page.forEach((element) => {
      var [key, value] = element.split("=");
      if(!value) return;
      value = value.replace(/"/g, "");
      if (key === "title") {
        site.title = value;
      } else if (key === "description") {
        site.description = value;
      } else if (key === "keywords") {
        site.keywords = value;
      } else if (key === "author") {
        site.author = value;
      } else if (key === "robots") {
        site.robots = value;
      } else if (key === "auto-index") {
        site.autoIndex = value;
      } else if (key === "font") {
        site.font = value;
      } else if (key === "languages") {
        site.languages = value.split(",");
      } else if (key === "version") {
        site.version = value;
      } else if (key === "label") {
        label = value;
      }
    });
  }
  // href should be absolute to the root of the project
  // example: /index.psmdoc, intro/about.psmdoc etc
  // href should be /index.html, /intro/about.html etc
  var href = file.replace(root, "");
  href = href.replace(/\\/g, "/"); 
  
  // remove the .psmdoc extension
  href = href.replace(".psmdoc", ".html");


  // parse the file
  menuItemsHtml += `<li><a href="${href}">${label}</a></li>\n`;

  var htmlFile = psmdocParser(data, site.languages?.[0] || "en", { localMode: true });
  // add header and footer
  html.push(`
  <!-- This file was generated by psmdoc-parser, a tool to create html files from .psmdoc files -->
  <!-- Do not edit this file, it will be overwritten -->
  <!-- Generated at ${new Date().toISOString()} -->
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${rootSite.title} | ${site.title}</title>
    <meta name="description" content="${site.description ?? rootSite.description}">
    <meta name="keywords" content="${site.keywords ?? rootSite.keywords}">
    <meta name="author" content="${site.author ?? rootSite.author}">
    <meta name="robots" content="${site.robots ?? rootSite.robots}">
    <link rel="stylesheet" href="${site.font ?? rootSite.font}">
    <link rel="stylesheet" href="../css/psmdoc.css">
    </style>
  </head>
    <body>
      <main>       
        <div class="psm-mobile-menu" id="psm-mobile-menu">
          <div class="psm-mobile-menu-button">
            ☰ ${rootSite.title} 
              ${rootSite.logo ? `<img src="${rootSite.logo}" alt="${rootSite.title}" width="50" height="50" />` : ""}
          </div>
          <div class="psm-mobile-menu-content">
            <ul>
              ${menuItemsHtml}
            </ul>
          </div>
        </div>
        <header>
          <div class="psm-row">
            ${psmdocParser(header, site.languages?.[0] || "en", { localMode: true })}
          </div>
        </header>
        <div class="psm-row">          
          <div class="psm-content">           
            ${htmlFile}
          </div>
          <div class="psm-sidebar">
            <h2>Menu</h2>
            <ul>
              ${menuItemsHtml}
            </ul>
          </div>
        </div>
        <div class="psm-row">
          ${psmdocParser(footer, site.languages?.[0] || "en", { localMode: true })}        
        </div>
      </main>
      <footer>
        <p>&copy; ${rootSite.title} ${new Date().getFullYear()}</p>
      </footer>
    </body>
    <script src="../js/psmdoc.js"></script>
  </html>`);

  // create the html file in the output folder with the same name as the .psmdoc file
  const outputDir = path.join(output, path.dirname(file).replace(root, ""));
  const outputFile = path.join(
    outputDir,
    path.basename(file, ".psmdoc") + ".html"
  );
  logger.info(`Creating file ${outputFile}`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, html.join("\n"));
});
