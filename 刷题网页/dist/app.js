(() => {
  "use strict";

  const db = window.PAPER_DATA || { names: {}, papers: [] };
  const storageKey = "kaoyan-math-321-progress-v1";
  const state = {
    series: "",
    year: "",
    subject: "",
    paperNo: "",
    questionIndex: 0,
    progress: loadProgress(),
  };

  const el = Object.fromEntries([
    "seriesSelect", "yearSelect", "subjectSelect", "paperSelect", "progressText", "progressBar",
    "questionGrid", "paperMeta", "paperTitle", "questionNumber", "questionSection", "questionPoints",
    "favoriteButton", "questionBody", "figureArea", "choices", "subparts", "prevButton", "nextButton",
    "masterButton", "randomButton", "noteInput", "openSidebar", "closeSidebar", "sidebar", "sidebarScrim", "toast"
  ].map(id => [id, document.getElementById(id)]));

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
    catch { return {}; }
  }

  function saveProgress() {
    localStorage.setItem(storageKey, JSON.stringify(state.progress));
  }

  const unique = (items) => [...new Set(items)];
  const subjectLabel = { math1: "数学一", math2: "数学二", math3: "数学三" };
  const sectionLabel = { choice: "选择题", blank: "填空题", solution: "解答题" };

  function naturalSort(a, b) {
    return String(a).localeCompare(String(b), "zh-CN", { numeric: true });
  }

  function setOptions(select, values, labeler = v => v, preferred = "") {
    select.innerHTML = "";
    values.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labeler(value);
      select.append(option);
    });
    select.value = values.includes(preferred) ? preferred : values[0] || "";
    return select.value;
  }

  function initializeFilters() {
    const series = unique(db.papers.map(p => p.series_key)).sort(naturalSort);
    state.series = setOptions(el.seriesSelect, series, value => db.names[value] || value, state.series);
    syncYears();
  }

  function syncYears() {
    const papers = db.papers.filter(p => p.series_key === state.series);
    const years = unique(papers.map(p => String(p.year))).sort((a, b) => Number(b) - Number(a));
    state.year = setOptions(el.yearSelect, years, value => `${value} 年`, state.year);
    syncSubjects();
  }

  function syncSubjects() {
    const papers = db.papers.filter(p => p.series_key === state.series && String(p.year) === state.year);
    const subjects = unique(papers.map(p => p.subject)).sort(naturalSort);
    state.subject = setOptions(el.subjectSelect, subjects, value => subjectLabel[value] || value, state.subject);
    syncPapers();
  }

  function syncPapers() {
    const papers = db.papers.filter(p => p.series_key === state.series && String(p.year) === state.year && p.subject === state.subject);
    const numbers = papers.map(p => String(p.paper_no)).sort(naturalSort);
    state.paperNo = setOptions(el.paperSelect, numbers, value => `第 ${value} 套`, state.paperNo);
    state.questionIndex = 0;
    renderAll();
  }

  function currentPaper() {
    return db.papers.find(p => p.series_key === state.series && String(p.year) === state.year && p.subject === state.subject && String(p.paper_no) === state.paperNo);
  }

  function paperKey() {
    return [state.year, state.subject, state.series, state.paperNo].join("/");
  }

  function questionKey(index = state.questionIndex) {
    const paper = currentPaper();
    return `${paperKey()}/${paper?.questions[index]?.number ?? index + 1}`;
  }

  function getQuestionState(index = state.questionIndex) {
    const key = questionKey(index);
    state.progress[key] ||= { answer: null, done: false, favorite: false, note: "" };
    return state.progress[key];
  }

  function cleanLatex(text) {
    return String(text || "")
      .replace(/\\ExamSelection\.?/g, "")
      .replace(/\\ExamBlank/g, "\u00a0______\u00a0")
      .trim();
  }

  function renderMath(container) {
    if (!window.katex) return;
    const source = container.textContent;
    container.textContent = "";
    const parts = source.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const block = document.createElement("div");
        try { katex.render(part.slice(2, -2), block, { displayMode: true, throwOnError: false, strict: false }); }
        catch { block.textContent = part; }
        container.append(block);
      } else if (part.startsWith("$") && part.endsWith("$")) {
        const span = document.createElement("span");
        try { katex.render(part.slice(1, -1), span, { displayMode: false, throwOnError: false, strict: false }); }
        catch { span.textContent = part; }
        container.append(span);
      } else {
        container.append(document.createTextNode(part));
      }
    }
  }

  function renderQuestion() {
    const paper = currentPaper();
    if (!paper?.questions?.length) {
      el.questionBody.textContent = "当前筛选条件下没有题目。";
      return;
    }
    state.questionIndex = Math.max(0, Math.min(state.questionIndex, paper.questions.length - 1));
    const question = paper.questions[state.questionIndex];
    const qState = getQuestionState();

    el.paperMeta.textContent = `${state.year} · ${subjectLabel[state.subject] || state.subject} · 第 ${state.paperNo} 套`;
    el.paperTitle.textContent = db.names[state.series] || state.series;
    el.questionNumber.textContent = String(question.number).padStart(2, "0");
    el.questionSection.textContent = sectionLabel[question.section] || question.section || "题目";
    el.questionPoints.textContent = `${question.points || "—"} 分`;
    el.questionBody.textContent = cleanLatex(question.latex);
    renderMath(el.questionBody);

    el.favoriteButton.classList.toggle("active", Boolean(qState.favorite));
    el.favoriteButton.textContent = qState.favorite ? "★" : "☆";
    el.favoriteButton.setAttribute("aria-pressed", String(Boolean(qState.favorite)));
    el.masterButton.classList.toggle("active", Boolean(qState.done));
    el.masterButton.textContent = qState.done ? "✓ 已掌握" : "标记已掌握";
    el.noteInput.value = qState.note || "";

    el.choices.innerHTML = "";
    (question.choices || []).forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "choice-button" + (qState.answer === index ? " selected" : "");
      button.type = "button";
      button.setAttribute("aria-pressed", String(qState.answer === index));
      const letter = document.createElement("span");
      letter.className = "choice-letter";
      letter.textContent = String.fromCharCode(65 + index);
      const text = document.createElement("span");
      text.className = "choice-text";
      text.textContent = cleanLatex(choice);
      renderMath(text);
      button.append(letter, text);
      button.addEventListener("click", () => chooseAnswer(index));
      el.choices.append(button);
    });

    el.subparts.innerHTML = "";
    (question.subparts || []).forEach((part, index) => {
      const block = document.createElement("div");
      block.className = "subpart";
      block.textContent = `（${index + 1}）${cleanLatex(typeof part === "string" ? part : part.latex || part.text || "")}`;
      renderMath(block);
      el.subparts.append(block);
    });

    el.figureArea.innerHTML = "";
    (question.figures || []).forEach(figure => {
      const note = document.createElement("div");
      note.className = "figure-note";
      const title = document.createElement("strong");
      title.textContent = `题图：${figure.description || "图形信息"}`;
      note.append(title);
      if (figure.latex) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "查看 TikZ 图形源码";
        const pre = document.createElement("pre");
        pre.textContent = figure.latex;
        details.append(summary, pre);
        note.append(details);
      }
      el.figureArea.append(note);
    });

    el.prevButton.disabled = state.questionIndex === 0;
    el.nextButton.disabled = state.questionIndex === paper.questions.length - 1;
    renderNavigation();
  }

  function renderNavigation() {
    const paper = currentPaper();
    if (!paper) return;
    el.questionGrid.innerHTML = "";
    let doneCount = 0;
    paper.questions.forEach((question, index) => {
      const qState = getQuestionState(index);
      if (qState.done) doneCount += 1;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = question.number;
      button.title = `第 ${question.number} 题`;
      if (qState.answer !== null) button.classList.add("answered");
      if (qState.done) button.classList.add("done");
      if (index === state.questionIndex) button.classList.add("current");
      button.addEventListener("click", () => goToQuestion(index));
      el.questionGrid.append(button);
    });
    el.progressText.textContent = `${doneCount} / ${paper.questions.length}`;
    el.progressBar.style.width = `${paper.questions.length ? (doneCount / paper.questions.length) * 100 : 0}%`;
  }

  function renderAll() { renderQuestion(); }

  function chooseAnswer(index) {
    const qState = getQuestionState();
    qState.answer = qState.answer === index ? null : index;
    saveProgress();
    renderQuestion();
  }

  function goToQuestion(index) {
    state.questionIndex = index;
    renderQuestion();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.toast.classList.remove("show"), 1500);
  }

  function openSidebar() {
    el.sidebar.classList.add("open");
    el.sidebarScrim.classList.add("open");
  }

  function closeSidebar() {
    el.sidebar.classList.remove("open");
    el.sidebarScrim.classList.remove("open");
  }

  el.seriesSelect.addEventListener("change", () => { state.series = el.seriesSelect.value; state.year = ""; state.subject = ""; state.paperNo = ""; syncYears(); });
  el.yearSelect.addEventListener("change", () => { state.year = el.yearSelect.value; state.subject = ""; state.paperNo = ""; syncSubjects(); });
  el.subjectSelect.addEventListener("change", () => { state.subject = el.subjectSelect.value; state.paperNo = ""; syncPapers(); });
  el.paperSelect.addEventListener("change", () => { state.paperNo = el.paperSelect.value; state.questionIndex = 0; renderAll(); });
  el.prevButton.addEventListener("click", () => goToQuestion(state.questionIndex - 1));
  el.nextButton.addEventListener("click", () => goToQuestion(state.questionIndex + 1));
  el.randomButton.addEventListener("click", () => {
    const count = currentPaper()?.questions.length || 0;
    if (count) goToQuestion(Math.floor(Math.random() * count));
  });
  el.favoriteButton.addEventListener("click", () => {
    const qState = getQuestionState();
    qState.favorite = !qState.favorite;
    saveProgress();
    renderQuestion();
    showToast(qState.favorite ? "已收藏" : "已取消收藏");
  });
  el.masterButton.addEventListener("click", () => {
    const qState = getQuestionState();
    qState.done = !qState.done;
    saveProgress();
    renderQuestion();
    showToast(qState.done ? "已标记为掌握" : "已取消掌握标记");
  });
  el.noteInput.addEventListener("input", () => {
    const key = questionKey();
    state.progress[key] ||= { answer: null, done: false, favorite: false, note: "" };
    state.progress[key].note = el.noteInput.value;
    clearTimeout(el.noteInput.saveTimer);
    el.noteInput.saveTimer = setTimeout(saveProgress, 250);
  });
  el.openSidebar.addEventListener("click", openSidebar);
  el.closeSidebar.addEventListener("click", closeSidebar);
  el.sidebarScrim.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", event => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
    if (event.key === "ArrowLeft" && state.questionIndex > 0) goToQuestion(state.questionIndex - 1);
    if (event.key === "ArrowRight" && state.questionIndex < (currentPaper()?.questions.length || 1) - 1) goToQuestion(state.questionIndex + 1);
    if (/^[1-4]$/.test(event.key)) chooseAnswer(Number(event.key) - 1);
    if (event.key.toLowerCase() === "f") el.favoriteButton.click();
  });

  function registerWebMcp() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const tool = {
      name: "open_exam_question",
      title: "打开试卷题目",
      description: "切换到当前所选试卷中的指定题号。",
      inputSchema: { type: "object", properties: { questionNumber: { type: "integer", minimum: 1 } }, required: ["questionNumber"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const index = currentPaper()?.questions.findIndex(q => Number(q.number) === Number(input?.questionNumber)) ?? -1;
        if (index < 0) throw new Error("题号不存在");
        goToQuestion(index);
        return { questionNumber: Number(input.questionNumber), paper: paperKey() };
      }
    };
    try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch {}
  }

  if (!db.papers.length) {
    el.questionBody.textContent = "题库数据未加载，请确认 papers-data.js 与网页位于同一目录。";
    return;
  }
  initializeFilters();
  registerWebMcp();
})();
