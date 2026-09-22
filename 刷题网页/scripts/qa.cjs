const { chromium } = require("playwright");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

  const targetUrl = process.env.QA_FILE
    ? pathToFileURL(process.env.QA_FILE).href
    : process.env.QA_URL || "http://127.0.0.1:8765";
  await page.goto(targetUrl === "file" ? pathToFileURL(path.join(__dirname, "..", "dist", "index.html")).href : targetUrl, { waitUntil: "networkidle" });
  await page.waitForSelector(".question-body .katex");
  const seriesCount = await page.locator("#seriesSelect option").count();
  const paperTitle = await page.locator("#paperTitle").textContent();
  const questionCount = await page.locator("#questionGrid button").count();
  const katexCount = await page.locator(".katex").count();
  const katexErrors = await page.locator(".katex-error").count();
  const katexErrorTitles = await page.locator(".katex-error").evaluateAll(nodes => nodes.map(node => node.getAttribute("title")));
  const questionText = await page.locator("#questionBody").textContent();
  const sourceLatex = await page.evaluate(() => {
    const series = document.querySelector("#seriesSelect").value;
    const year = document.querySelector("#yearSelect").value;
    const subject = document.querySelector("#subjectSelect").value;
    const paperNo = document.querySelector("#paperSelect").value;
    return window.PAPER_DATA.papers.find(p => p.series_key === series && String(p.year) === year && p.subject === subject && String(p.paper_no) === paperNo).questions[0].latex;
  });
  const mathParts = await page.evaluate(source => source.replace(/\\ExamSelection\.?/g, "").trim().split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g).filter(Boolean), sourceLatex);
  const directKatex = await page.evaluate(part => {
    try { return { ok: true, html: window.katex.renderToString(part.slice(1, -1)).slice(0, 80), version: window.katex.version }; }
    catch (error) { return { ok: false, error: error.message, input: part.slice(1, -1), version: window.katex.version }; }
  }, mathParts[1]);

  await page.locator(".choice-button").first().click();
  await page.locator("#masterButton").click();
  await page.locator("#favoriteButton").click();
  await page.locator("#noteInput").fill("验收笔记");
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  const persistence = {
    answer: await page.locator(".choice-button.selected").count() === 1,
    mastered: await page.locator("#masterButton.active").count() === 1,
    favorite: await page.locator("#favoriteButton.active").count() === 1,
    note: await page.locator("#noteInput").inputValue() === "验收笔记",
  };

  await page.screenshot({ path: path.join(__dirname, "..", "qa-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#openSidebar").click();
  await page.waitForTimeout(300);
  const mobileMenuOpen = await page.locator("#sidebar.open").count() === 1;
  await page.screenshot({ path: path.join(__dirname, "..", "qa-mobile.png"), fullPage: false });

  const result = { seriesCount, paperTitle, questionCount, katexCount, katexErrors, katexErrorTitles, questionText, sourceLatex, mathParts, directKatex, persistence, mobileMenuOpen, errors };
  console.log(JSON.stringify(result, null, 2));
  if (seriesCount !== 7 || !questionCount || !katexCount || katexErrors || !Object.values(persistence).every(Boolean) || !mobileMenuOpen || errors.length) process.exitCode = 1;
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
