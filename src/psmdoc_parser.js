// @ts-check
// Parser PSMDoc — alineado con psmdoc-web/src/utils/psmdocParser.js
// Versión pública con soporte local (localMode) y reescritura de assets (assetMap).

import logger from "./logger.js";

// ---------------------------------------------------------------------------
// Helpers de seguridad y sanitización
// ---------------------------------------------------------------------------

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const stripQuotes = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.substring(1, trimmed.length - 1);
  }
  return trimmed;
};

/**
 * @param {string} value
 * @param {boolean} [localMode=false] - Permitir rutas relativas sin prefijo (ej. images/logo.png)
 */
const sanitizeUrl = (value, localMode = false) => {
  if (!value) return "";
  let url = String(value).trim().replace(".psmdoc", ".html");
  if (!url) return "";
  if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) return url;
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  // Modo local: permitir rutas relativas simples como images/logo.png
  if (localMode && !/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) return url;
  return "";
};

const sanitizeDimension = (value) => {
  if (!value) return "";
  const normalized = stripQuotes(value);
  return /^(\d+)(px|%|vw|vh)?$/i.test(normalized) ? normalized : "";
};

const sanitizeToken = (value) => {
  if (!value) return "";
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "");
};

// ---------------------------------------------------------------------------
// idFromString
// ---------------------------------------------------------------------------

const idFromString = (str) => {
  // remove any special characters from the content to create the id
  var id = str.trim();
  if (!id || id === "") {
    return "";
  }
  id = id.replace(" ", "-");
  // replace any vowels with accents with the same vowel without accent
  id = id.replace(/[áäâà]/g, "a");
  id = id.replace(/[éëêè]/g, "e");
  id = id.replace(/[íïîì]/g, "i");
  id = id.replace(/[óöôò]/g, "o");
  id = id.replace(/[úüûù]/g, "u");
  id = id.replace(/[ñ]/g, "n");
  id = id.replace(/[ç]/g, "c");
  id = id.replace(/[ß]/g, "ss");
  id = id.replace(/[&]/g, "and");
  id = id.replace(/[^\w\s]/g, "");
  id = id.replace(/\s+/g, "-");
  id = id.replace(/^[^a-zA-Z0-9\-]+/, "");
  return id;
};

const inlineParser = (line) => {
  if (line === null || line === undefined) return "";
  if (typeof line !== "string") line = String(line);

  let html = "";
  let elementLevels = { "*": 0, _: 0, "~": 0, "`": 0 };

  for (let i = 0; i < line.length; i++) {
    if (line[i] === "#") {
      const link = line.substring(i, i + 3);
      if (["#EL", "#IL"].includes(link)) {
        let indexEnd = line.indexOf("\n", i);
        if (indexEnd === -1) indexEnd = line.length;
        const linkText = line.substring(i, indexEnd);
        const linkHTML = parseLink(linkText);
        html += `&nbsp;${linkHTML}&nbsp;`;
        i = indexEnd;
      } else {
        html += escapeHtml(line[i]);
      }
    } else if (line[i] === "*") {
      if (elementLevels["*"] === 0) {
        html += "<b>";
        elementLevels["*"]++;
      } else {
        html += "</b>";
        elementLevels["*"] = 0;
      }
    } else if (line[i] === "_") {
      if (elementLevels["_"] === 0) {
        html += "<i>";
        elementLevels["_"]++;
      } else {
        html += "</i>";
        elementLevels["_"] = 0;
      }
    } else if (line[i] === "~") {
      if (elementLevels["~"] === 0) {
        html += "<strike>";
        elementLevels["~"]++;
      } else {
        html += "</strike>";
        elementLevels["~"] = 0;
      }
    } else if (line[i] === "`") {
      if (elementLevels["`"] === 0) {
        html += "<code>";
        elementLevels["`"]++;
      } else {
        html += "</code>";
        elementLevels["`"] = 0;
      }
    } else {
      html += escapeHtml(line[i]);
    }
  }
  return html;
};

/**
 * @param {string} line
 * @param {string} [lang]
 * @param {boolean} [localMode]
 */
const parseLink = (line, lang, localMode = false) => {
  const parts = line.split(" ");
  if (!lang) lang = "en";
  if (parts.length < 2) {
    logger.error(`Link "${line}" is not valid`);
    return "";
  }
  const src = sanitizeUrl(parts[1], localMode);
  if (!src) return "";

  // Atributos de idioma lg-xx="..."
  const langAttrs = parts.filter((a) => a.startsWith("lg-"));
  let text = "";
  if (!langAttrs.length) {
    const firstQuote = line.indexOf('"');
    if (firstQuote !== -1) {
      const lastQuote = line.substring(firstQuote + 1).indexOf('"') + firstQuote + 1;
      text = line.substring(firstQuote + 1, lastQuote);
    }
  } else {
    for (const attr of langAttrs) {
      if (attr.startsWith(`lg-${lang}`)) {
        text = attr.split("=")[1] || "";
      }
    }
  }
  if (!text) text = src;
  text = stripQuotes(text);
  text = escapeHtml(text);

  const externalLink = line.toUpperCase().startsWith("#EL");
  let target = externalLink ? "_blank" : "";
  const targetIndex = line.indexOf("target=");
  if (targetIndex !== -1) {
    const endTarget = line.indexOf(" ", targetIndex);
    const raw = line.substring(targetIndex, endTarget === -1 ? line.length : endTarget);
    target = stripQuotes(raw.split("=")[1] || "");
  }
  if (target && !/^(_blank|_self|_parent|_top)$/i.test(target)) target = "_self";
  const rel = target === "_blank" ? ' rel="noopener noreferrer"' : "";

  return `<a href="${escapeHtml(src)}" target="${escapeHtml(target)}"${rel}>${text}</a>`;
};

/**
 * @param {string} data
 * @param {string} [lang]
 * @param {{ localMode?: boolean, assetMap?: Record<string,string> }} [options]
 */
const psmdocParser = (data, lang, options = {}) => {
  if (!lang) lang = "en";
  const localMode = options.localMode || false;
  const assetMap = options.assetMap || {};

  // Reemplaza refs locales de assets si hay un mapa
  const resolveAsset = (src) => assetMap[src] || src;

  var headersIds = [];
  var accordionIds = [];

  const lines = String(data || "").split(/\r?\n\r?\n/);
  if (lines.length === 0) return "";

  let htmlFile = "";

  for (var i = 0; i < lines.length; i++) {
    if (lines[i] === undefined || lines[i] === "") continue;
    var previousHtmlLength = htmlFile.length;
    if (htmlFile !== "") htmlFile += "<br>\n";
    var currentLine = lines[i].trim();

    if (currentLine.startsWith("#")) {
      // -----------------------------------------------------------------------
      // #HR
      // -----------------------------------------------------------------------
      if (currentLine.toUpperCase().startsWith("#HR")) {
        htmlFile += "<hr>\n";

      // -----------------------------------------------------------------------
      // #H1 … #H6
      // -----------------------------------------------------------------------
      } else if (/^#H[1-6](\s|$)/i.test(currentLine)) {
        var level = currentLine.charAt(2);
        var firstSpace = currentLine.indexOf(" ");
        var afterLevelId = currentLine.substring(3, firstSpace);
        var content = inlineParser(currentLine.substring(firstSpace + 1));
        var id = afterLevelId.trim() || content.trim();
        id = idFromString(id);
        if (headersIds.includes(id)) {
          var count = 1;
          while (headersIds.includes(`${id}${count}`)) count++;
          id = `${id}${count}`;
        }
        headersIds.push(id);
        htmlFile += `<h${level} id="${id}">
          <a href="#${id}">
            ${content}
            <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="display:inline-block;user-select:none;vertical-align:text-bottom;overflow:visible"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path></svg>
          </a>
        </h${level}>\n`;

      // -----------------------------------------------------------------------
      // #IMG
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#IMG")) {
        var img = currentLine.split(" ");
        var rawSrc = img[1] || "";
        var src = sanitizeUrl(resolveAsset(rawSrc), localMode);
        if (!src) { htmlFile = htmlFile.substring(0, previousHtmlLength); continue; }
        var alt = escapeHtml(img[2] || "");
        var width = "", height = "", fit = "";
        for (var j = 3; j < img.length; j++) {
          if (img[j].startsWith("width")) width = sanitizeDimension(img[j].split("=")[1]);
          else if (img[j].startsWith("height")) height = sanitizeDimension(img[j].split("=")[1]);
          else if (img[j].startsWith("fit")) fit = sanitizeToken(img[j].split("=")[1]);
        }
        htmlFile += `<img src="${escapeHtml(src)}" alt="${alt}" width="${width}" height="${height}" class="img object-fit-${fit}" loading="lazy" decoding="async">\n`;

      // -----------------------------------------------------------------------
      // #CODE
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#CODE")) {
        var codeContent = currentLine.split("\n").slice(1).join("\n");
        if (!codeContent.trim() && i + 1 < lines.length) {
          var nextCodeBlock = (lines[i + 1] || "").trim();
          if (nextCodeBlock && !nextCodeBlock.startsWith("#")) {
            codeContent = lines[i + 1];
            i++;
          }
        }
        htmlFile += `<pre><code>${escapeHtml(codeContent)}</code></pre>\n`;

      // -----------------------------------------------------------------------
      // #IL / #EL
      // -----------------------------------------------------------------------
      } else if (
        currentLine.toUpperCase().startsWith("#IL") ||
        currentLine.toUpperCase().startsWith("#EL")
      ) {
        var link = parseLink(currentLine, lang, localMode);
        if (link.length) htmlFile += `${link}\n`;
        continue;

      // -----------------------------------------------------------------------
      // #TABLE
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#TABLE")) {
        var title = currentLine.split("\n")[0].split(" ").slice(1).join(" ");
        htmlFile += `<div class="psm-table-wrapper">\n<table role="table">\n`;
        htmlFile += `<caption role="caption">${escapeHtml(title)}</caption>\n`;
        var rows = currentLine.split("\n");
        rows.shift();
        for (var j = 0; j < rows.length; j++) {
          if (rows[j].indexOf("|") === -1 || rows[j].lastIndexOf("|") === -1) continue;
          htmlFile += "<tr role=\"row\">\n";
          var firstPipe = rows[j].indexOf("|");
          var lastPipe = rows[j].lastIndexOf("|");
          var row = rows[j].substring(firstPipe + 1, lastPipe).split("|");
          for (var k = 0; k < row.length; k++) {
            if (j === 0) {
              htmlFile += `<th scope="col" role="columnheader">${inlineParser(row[k])}</th>\n`;
              continue;
            }
            htmlFile += `<td role="cell">${inlineParser(row[k])}</td>\n`;
          }
          htmlFile += "</tr>\n";
        }
        htmlFile += "</table>\n</div>\n";

      // -----------------------------------------------------------------------
      // #QUOTE
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#QUOTE")) {
        var quoteText = currentLine.split("\n").slice(1).join("\n").trim();
        if (!quoteText) { htmlFile = htmlFile.substring(0, previousHtmlLength); continue; }
        htmlFile += `<blockquote><p>${inlineParser(quoteText)}</p></blockquote>\n`;

      // -----------------------------------------------------------------------
      // #VIDEO (YouTube)
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#VIDEO")) {
        var video = currentLine.split(" ");
        var vsrc = video[1] || "";
        if (vsrc.toLowerCase().startsWith("youtube")) {
          vsrc = `https://www.youtube.com/embed/${vsrc.split("=")[1] || ""}`;
        } else if (vsrc.includes("youtube.com/watch?v=")) {
          vsrc = `https://www.youtube.com/embed/${vsrc.split("v=")[1].split("&")[0]}`;
        } else if (vsrc.includes("youtu.be/")) {
          vsrc = `https://www.youtube.com/embed/${vsrc.split("youtu.be/")[1].split("?")[0]}`;
        } else if (vsrc.includes("youtube.com/embed/")) {
          // ya es embed, usar directo
        } else {
          logger.error(`Video "${vsrc}" no soportado. Solo YouTube.`);
          htmlFile = htmlFile.substring(0, previousHtmlLength);
          continue;
        }
        vsrc = sanitizeUrl(vsrc);
        if (!vsrc) { htmlFile = htmlFile.substring(0, previousHtmlLength); continue; }
        var vtitle = "";
        var titleStart = currentLine.indexOf('"');
        if (titleStart !== -1) {
          var titleEnd = currentLine.indexOf('"', titleStart + 1);
          if (titleEnd > titleStart) vtitle = escapeHtml(currentLine.substring(titleStart + 1, titleEnd));
        }
        var vwidth = "560", vheight = "315";
        for (var j = 2; j < video.length; j++) {
          if (video[j].startsWith("width")) vwidth = sanitizeDimension(video[j].split("=")[1]) || vwidth;
          else if (video[j].startsWith("height")) vheight = sanitizeDimension(video[j].split("=")[1]) || vheight;
        }
        htmlFile += `<div class="psm-video-wrapper">
          ${vtitle ? `<h3>${vtitle}</h3>` : ""}
          <iframe width="${vwidth}" height="${vheight}" src="${escapeHtml(vsrc)}" title="${vtitle}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin" loading="lazy" style="border:0;" allowfullscreen></iframe>
        </div>\n`;

      // -----------------------------------------------------------------------
      // #AUDIO
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#AUDIO")) {
        var audio = currentLine.split(" ");
        var asrc = sanitizeUrl(resolveAsset(audio[1] || ""), localMode);
        if (!asrc) { htmlFile = htmlFile.substring(0, previousHtmlLength); continue; }
        var aw = "", ah = "";
        for (var j = 2; j < audio.length; j++) {
          if (audio[j].startsWith("width")) aw = sanitizeDimension(audio[j].split("=")[1]);
          else if (audio[j].startsWith("height")) ah = sanitizeDimension(audio[j].split("=")[1]);
        }
        htmlFile += `<audio src="${escapeHtml(asrc)}" width="${aw}" height="${ah}" controls preload="metadata"></audio>\n`;

      // -----------------------------------------------------------------------
      // #PDF
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#PDF")) {
        var pdf = currentLine.split(" ");
        var psrc = sanitizeUrl(resolveAsset(pdf[1] || ""), localMode);
        if (!psrc) { htmlFile = htmlFile.substring(0, previousHtmlLength); continue; }
        var pw = "", ph = "";
        for (var j = 2; j < pdf.length; j++) {
          if (pdf[j].startsWith("width")) pw = sanitizeDimension(pdf[j].split("=")[1]);
          else if (pdf[j].startsWith("height")) ph = sanitizeDimension(pdf[j].split("=")[1]);
        }
        htmlFile += `<embed src="${escapeHtml(psrc)}" width="${pw}" height="${ph}" type="application/pdf">\n`;

      // -----------------------------------------------------------------------
      // #SVG
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#SVG")) {
        var svg = currentLine.split(" ");
        var ssrc = sanitizeUrl(resolveAsset(svg[1] || ""), localMode);
        if (!ssrc) { htmlFile = htmlFile.substring(0, previousHtmlLength); continue; }
        var sw = "", sh = "";
        for (var j = 2; j < svg.length; j++) {
          if (svg[j].startsWith("width")) sw = sanitizeDimension(svg[j].split("=")[1]);
          else if (svg[j].startsWith("height")) sh = sanitizeDimension(svg[j].split("=")[1]);
        }
        htmlFile += `<img src="${escapeHtml(ssrc)}" width="${sw}" height="${sh}" class="img object-fit-cover" loading="lazy" decoding="async">\n`;

      // -----------------------------------------------------------------------
      // #MAP
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#MAP")) {
        var map = currentLine.split(" ");
        var msrc = sanitizeUrl(map[1] || "");
        if (!msrc) { htmlFile = htmlFile.substring(0, previousHtmlLength); continue; }
        var mw = "", mh = "";
        for (var j = 2; j < map.length; j++) {
          if (map[j].startsWith("width")) mw = sanitizeDimension(map[j].split("=")[1]);
          else if (map[j].startsWith("height")) mh = sanitizeDimension(map[j].split("=")[1]);
        }
        htmlFile += `<iframe src="${escapeHtml(msrc)}" width="${mw}" height="${mh}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="border:0;" allowfullscreen></iframe>\n`;

      // -----------------------------------------------------------------------
      // #ACCORDION … #ENDACCORDION
      // -----------------------------------------------------------------------
      } else if (currentLine.toUpperCase().startsWith("#ACCORDION")) {
        logger.info(`Parsing accordion: ${currentLine.substring(0, 60)}`);
        var accordionOptions = [];
        var accordionBlocks = [];
        var inlineContent = currentLine.split("\n").slice(1).join("\n");
        if (inlineContent && inlineContent.trim()) accordionBlocks.push(inlineContent);

        var scanIndex = i + 1;
        var accordionEndIndex = i;
        var foundAccordionEnd = false;
        while (scanIndex < lines.length) {
          var block = lines[scanIndex] || "";
          var endIndex = block.toUpperCase().indexOf("#ENDACCORDION");
          if (endIndex !== -1) {
            accordionBlocks.push(block.substring(0, endIndex));
            accordionEndIndex = scanIndex;
            foundAccordionEnd = true;
            break;
          }
          accordionBlocks.push(block);
          accordionEndIndex = scanIndex;
          scanIndex++;
        }

        var accordionContent = accordionBlocks.join("\n\n").trim();
        var optionRegex = /(^|\n)#O[ \t]+([^\n]*)([\s\S]*?)(?=(\n#O[ \t]+|\n#ENDACCORDION\b|$))/g;
        var optionMatch;
        while ((optionMatch = optionRegex.exec(accordionContent)) !== null) {
          var optionTitle = (optionMatch[2] || "").trim();
          if (!optionTitle) continue;
          var optionText = (optionMatch[3] || "").replace(/^\n/, "");
          var optionId = idFromString(optionTitle);
          if (accordionIds.includes(optionId)) {
            var count = 1;
            while (accordionIds.includes(`${optionId}${count}`)) count++;
            optionId = `${optionId}${count}`;
          }
          accordionIds.push(optionId);
          accordionOptions.push(
            `<div class="psm-accordion-option" id="psm-accordion-${optionId}">
              <div class="psm-accordion-option-title" id="psm-accordion-option-title-${optionId}"
                onclick="document.getElementById('psm-accordion-option-${optionId}-content').classList.toggle('active');document.getElementById('psm-accordion-option-title-${optionId}').classList.toggle('active');">
                ${inlineParser(optionTitle)}</div>
              <div class="psm-accordion-option-content" id="psm-accordion-option-${optionId}-content">
                ${psmdocParser(optionText, lang, options)}
              </div>
            </div>`
          );
        }

        if (!accordionOptions.length) {
          htmlFile = htmlFile.substring(0, previousHtmlLength);
          if (foundAccordionEnd && accordionEndIndex > i) i = accordionEndIndex;
          continue;
        }

        var accTitle = currentLine.split("\n")[0].split(" ").slice(1).join(" ");
        htmlFile += `<div class="psm-accordion-wrapper">
        <details open>
        <summary>${inlineParser(accTitle)}</summary>\n`;
        htmlFile += accordionOptions.join("\n");
        htmlFile += "</details>\n</div>\n";
        if (foundAccordionEnd && accordionEndIndex > i) i = accordionEndIndex;
      }

    // -------------------------------------------------------------------------
    // Listas
    // -------------------------------------------------------------------------
    } else if (currentLine.startsWith("-")) {
      var listItems = currentLine.split("-");
      htmlFile += "<ul>\n";
      for (var j = 0; j < listItems.length; j++) {
        var lineHTML = inlineParser(listItems[j]);
        if (lineHTML.length > 0) htmlFile += `<li>${lineHTML}</li>\n`;
      }
      htmlFile += "</ul>\n";

    // -------------------------------------------------------------------------
    // Párrafo
    // -------------------------------------------------------------------------
    } else {
      htmlFile += `<p>${inlineParser(currentLine)}</p>\n`;
    }
  }

  return htmlFile;
};

export default psmdocParser;
