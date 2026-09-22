import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectDir = join(scriptsDir, "..");
const distDir = join(projectDir, "dist");
const outputFile = join(projectDir, "研数321套刷题.html");

const read = name => readFile(join(distDir, name), "utf8");
const escapeScriptEnd = source => source.replace(/<\/script/gi, "<\\/script");

let [html, katexCss, appCss, katexJs, dataJs, appJs] = await Promise.all([
  read("index.html"),
  read("vendor/katex.min.css"),
  read("styles.css"),
  read("vendor/katex.min.js"),
  read("papers-data.js"),
  read("app.js"),
]);

const fontMatches = [...katexCss.matchAll(/url\((?:["']?)(fonts\/[^)'"?]+\.woff2)(?:["']?)\)/g)];
for (const match of fontMatches) {
  const font = await readFile(join(distDir, "vendor", match[1]));
  katexCss = katexCss.replaceAll(match[0], `url(data:font/woff2;base64,${font.toString("base64")})`);
}

html = html
  .replace(/\s*<link rel="stylesheet" href="vendor\/katex\.min\.css" \/>/, "")
  .replace(/\s*<link rel="stylesheet" href="styles\.css" \/>/, "")
  .replace("</head>", () => `<style>${katexCss}\n${appCss}</style>\n  </head>`)
  .replace(/\s*<script src="vendor\/katex\.min\.js"><\/script>/, "")
  .replace(/\s*<script src="papers-data\.js"><\/script>/, "")
  .replace(/\s*<script src="app\.js"><\/script>/, "")
  .replace("</body>", () => `<script>${escapeScriptEnd(katexJs)}</script>\n<script>${escapeScriptEnd(dataJs)}</script>\n<script>${escapeScriptEnd(appJs)}</script>\n  </body>`);

await writeFile(outputFile, html, "utf8");
console.log(`Standalone file created: ${outputFile}`);
