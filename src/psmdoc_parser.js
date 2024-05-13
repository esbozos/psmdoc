// @ts-check

import logger from "./logger.js";

const inlineParser = (line) => {
  // inline elements as bold, italic, strike and code
  // example: Today is a *good* day for a _walk_ and a ~swim~ with `friends.sh ride`
  // output: Today is a <b>good</b> day for a <i>walk</i> and a <strike>swim</strike> with <code>friends.sh ride</code>
  // can be combined as well as *~good~* or _*good*_ or ~*good*~ or *~`good`~* or *~`good~`* or ~*`good`*~
  // output: <b><strike>good</strike></b> or <i><b>good</b></i> or <strike><b>good</b></strike> or <b><strike><code>good</code></strike></b> or <b><strike><code>good</code></strike></b> or <strike><b><code>good</code></b></strike>
  // or any combination of the above

  let html = "";
  let elementLevels = {
    "*": 0,
    _: 0,
    "~": 0,
    "`": 0,
  };
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "#") {
      // check if it is a link
      var link = line.substring(i, i + 3);
      if ([`#EL`, `#IL`].includes(link)) {
        var indexEnd = line.indexOf("\n", i);
        var linkText = line.substring(i, indexEnd);
        var linkHTML = parseLink(linkText);
        html += `&nbsp;${linkHTML}&nbsp;`;
        i = indexEnd;
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
      html += line[i];
    }
  }
  return html;
};

const parseLink = (line, lang) => {
  // #EL https://gestionciudad.com lg-es="Gestión Ciudad" lg-en="City Management" lg-fr="Gestion de la ville" target=_blank
  var link = line.split(" ");
  if(!lang) {
    lang = "en";
  }
  if (link.length < 2) {
    logger.error(`Link ${link} is not valid`);
    return "";
  }
  var src = link[1];
  src = src.trim().replace(".psmdoc", ".html");
  // get all lg-xx attributes
  var langAttrs = link.filter((attr) => attr.startsWith("lg-"));
  var text = "";
  if (!langAttrs.length) {
    text = link[2];
  } else {
    for (var j = 0; j < langAttrs.length; j++) {
      if (langAttrs[j].startsWith(`lg-${lang}`)) {
        text = langAttrs[j].split("=")[1];
      }
    }
  }
  if (!text) {
    text = src;
  }
  // remove quotes at the beginning and end of the text
  logger.info(`Link ${src} text ${text}`);
  text = text.trim();
  if ([`"`, `'`].includes(text.charAt(0))) {
    text = text.substring(1, text.length);
  }
  if ([`"`, `'`].includes(text.charAt(text.length - 1))) {
    text = text.substring(0, text.length - 1);
  }

  logger.info(`Link ${src} ${text}`);
  // get target attribute
  var target = "_self";
  for (var j = 0; j < link.length; j++) {
    if (link[j].startsWith("target")) {
      target = link[j].split("=")[1];
    }
  }
  return `<a href="${src}" target="${target}">${text}</a>`;
};

const psmdocParser = (data, lang) => {
  if (!lang) {
    lang = "en";
  }
  var headersIds = [];
  // using regex to split into end of lines
  const lines = data.split(/\r?\n\r?\n/);

  if (lines.length === 0) {
    return "";
  }
  let htmlFile = "";

  for (var i = 0; i < lines.length; i++) {
    if (lines[i] === undefined || lines[i] === "") {
      // i is higher than the length of lines array
      continue;
    }
    if (htmlFile !== "") {
      htmlFile += "<br>\n";
    }
    var currentLine = lines[i];
    // remove any leading or trailing spaces
    currentLine = currentLine.trim();

    if (currentLine.startsWith("#")) {
      if (currentLine.toUpperCase().startsWith("#H")) {
        var level = currentLine.charAt(2);
        var firstSpace = currentLine.indexOf(" ");
        var afterLevelId = currentLine.substring(3, firstSpace);        
        var content = inlineParser(currentLine.substring(firstSpace + 1));
        // remove any special characters from the content to create the id
         var id = afterLevelId.trim();
        if(!id || id === "") {
          id = content.trim();
        }
        id = content.replace(" ", "-");
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
        // check if the id already exists
        if (headersIds.includes(id)) {
          // add a number at the end of the id
          var count = 1;
          while (headersIds.includes(`${id}${count}`)) {
            count++;
          }
          id = `${id}${count}`;
        }

        htmlFile += `<h${level} id="${id}">
          <a href="#${id}">
            ${content}
            <svg aria-hidden="true" focusable="false" class="Octicon-sc-9kayk9-0 ituJXZ octicon-link" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="display:inline-block;user-select:none;vertical-align:text-bottom;overflow:visible"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path></svg>
          </a>
        </h${level}>\n`;
      } else if (currentLine.toUpperCase().startsWith("#IMG")) {
        var img = currentLine.split(" ");
        var src = img[1];
        var alt = img[2];
        var width = "";
        var height = "";
        var fit = "";
        for (var j = 3; j < img.length; j++) {
          if (img[j].startsWith("width")) {
            width = img[j].split("=")[1];
          } else if (img[j].startsWith("height")) {
            height = img[j].split("=")[1];
          } else if (img[j].startsWith("fit")) {
            fit = img[j].split("=")[1];
          }
        }
        htmlFile += `<img src="${src}" alt="${alt}" width="${width}" height="${height}" class="img object-fit-${fit}">\n`;
      } else if (currentLine.toUpperCase().startsWith("#CODE")) {
        htmlFile += "<pre><code>\n";
        i++;
        while (i < lines.length && lines[i] !== "") {
          htmlFile += `${lines[i]}\n`;
          i++;
        }
        htmlFile += "</code></pre>\n";
      } else if (
        currentLine.toUpperCase().startsWith("#IL") ||
        currentLine.toUpperCase().startsWith("#EL")
      ) {
        var link = parseLink(currentLine, lang);
        if (link.length) {
          htmlFile += `${link}\n`;
        }
        continue;
        // #EL https://gestionciudad.com lg-es="Gestión Ciudad" lg-en="City Management" lg-fr="Gestion de la ville" target=_blank
        // var link = currentLine.split(" ");
        // if (link.length < 2) {
        //   logger.error(`Link ${link} is not valid`);
        //   continue;
        // }
        // var src = link[1];
        // // get all lg-xx attributes
        // var langAttrs = link.filter((attr) => attr.startsWith("lg-"));
        // var text = "";
        // if (!langAttrs.length) {
        //   text = link[2];
        // } else {
        //   for (var j = 0; j < langAttrs.length; j++) {
        //     if (langAttrs[j].startsWith(`lg-${lang}`)) {
        //       text = langAttrs[j].split("=")[1];
        //     }
        //   }
        // }
        // if (!text) {
        //   text = src;
        // }

        // // remove quotes at the beginning and end of the text
        // logger.info(`Link ${src} text ${text}`);
        // text = text.trim();
        // if ([`"`, `'`].includes(text.charAt(0))) {
        //   text = text.substring(1, text.length);
        // }
        // if ([`"`, `'`].includes(text.charAt(text.length - 1))) {
        //   text = text.substring(0, text.length - 1);
        // }

        // logger.info(`Link ${src} ${text}`);
        // // get target attribute
        // var target = "_self";
        // for (var j = 0; j < link.length; j++) {
        //   if (link[j].startsWith("target")) {
        //     target = link[j].split("=")[1];
        //   }
        // }
        // htmlFile += `<a href="${src}" target="${target}">${text}</a>\n`;
      } else if (currentLine.toUpperCase().startsWith("#TABLE")) {
        // #Table Medios de pago
        // | Medio de pago | Descripción |
        // | --- | --- |
        // | Tarjeta de crédito | Puedes pagar con tarjeta de crédito Visa, Mastercard o American Express. |
        // | Tarjeta de débito | Puedes pagar con tarjeta de débito Visa o Mastercard. |
        // | Transferencia bancaria | Puedes realizar una transferencia bancaria a la cuenta de Gestión Ciudad. |
        // | PayPal | Puedes pagar con tu cuenta de PayPal. |
        // | Apple Pay | Puedes pagar con Apple Pay desde tu dispositivo Apple. |
        // | Google Pay | Puedes pagar con Google Pay desde tu dispositivo Android. |
        // | Banca en línea | Puedes pagar a través de la banca en línea de tu banco. |
        // | Efectivo | Puedes pagar en efectivo en nuestras oficinas. |
        // | Cheque | Puedes pagar con cheque a nombre de Gestión Ciudad. |
        // | Pago en tiendas | Puedes pagar en tiendas autorizadas. |

        logger.info(`Parsing table ${currentLine}`);
        // Text after #Table is the title of the table
        var title = currentLine.split("\n")[0].split(" ").slice(1).join(" ");

        htmlFile += `<div class="psm-table-wrapper">\n
        <table role='table'>\n`;
        htmlFile += `<caption role='caption'>${title}</caption>\n`;

        // each row is separated by a new line
        var rows = currentLine.split("\n");
        // remove the first row as it is the title
        rows.shift();

        for (var j = 0; j < rows.length; j++) {
          htmlFile += "<tr role='row'>\n";
          // remove the first | and the last | and split by |
          var firstPipe = rows[j].indexOf("|");
          var lastPipe = rows[j].lastIndexOf("|");
          rows[j] = rows[j].substring(firstPipe + 1, lastPipe);
          var row = rows[j].split("|");
          for (var k = 0; k < row.length; k++) {
            if (j === 0) {
              htmlFile += `<th scope="col" role="columnheader">${inlineParser(
                row[k]
              )}</th>\n`;
              continue;
            }
            htmlFile += `<td role="cell">${inlineParser(row[k])}</td>\n`;
          }
          htmlFile += "</tr>\n";
        }
        htmlFile += "</table>\n</div>\n";

        // while (i < lines.length && lines[i] !== "") {
        //   htmlFile += "<tr>\n";
        //   var row = lines[i].split("|");
        //   for (var j = 0; j < row.length; j++) {
        //     var lineHTML = inlineParser(row[j]);
        //     htmlFile += `<td>${lineHTML}</td>\n`;
        //   }
        //   htmlFile += "</tr>\n";
        //   i++;
        // }
        // htmlFile += "</table>\n";
      } else if (currentLine.toUpperCase().startsWith("#QUOTE")) {
        htmlFile += "<blockquote>\n";
        i++;
        var quoteText = "";
        while (i < lines.length && lines[i] !== "") {
          quoteText += lines[i];
          i++;
        }
        var lineHTML = inlineParser(quoteText);
        htmlFile += `${lineHTML}`;
        htmlFile += "</blockquote>\n";
      }
    } else if (currentLine.startsWith("-")) {
      var listItems = currentLine.split(`-`);
      htmlFile += "<ul>\n";
      for (var j = 0; j < listItems.length; j++) {
        var lineHTML = inlineParser(listItems[j]);
        if (lineHTML.length > 0) {
          htmlFile += `<li>${lineHTML}</li>\n`;
        }
      }
      htmlFile += "</ul>\n";
    } else {
      htmlFile += `<p>${inlineParser(currentLine)}</p>\n`;
    }
  } // end for loop
  return htmlFile;
};

export default psmdocParser;
