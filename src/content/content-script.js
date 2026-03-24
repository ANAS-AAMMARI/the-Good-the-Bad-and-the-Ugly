(() => {
  const api = globalThis.browser || globalThis.chrome;
  const engine = globalThis.ArabiziEngine;

  if (!api || !engine) {
    return;
  }

  const SKIP_HOSTS = new Set(["docs.google.com", "notion.so", "www.notion.so"]);
  const SKIP_EDITORS_SELECTOR = [
    ".kix-appview-editor",
    ".CodeMirror",
    ".cm-content"
  ].join(",");

  let settings = {
    enabled: true,
    disabledSites: [],
    skipKnownEditors: true,
    customDictionary: {}
  };

  let isComposing = false;
  let activeTarget = null;

  const suggestionState = {
    visible: false,
    root: null,
    tokenInfo: null,
    candidates: [],
    selectedIndex: 0,
    showAddForm: false,
    draftArabic: "",
    infoMessage: ""
  };

  injectSuggestionStyles();
  const suggestionEl = createSuggestionElement();

  function injectSuggestionStyles() {
    if (document.getElementById("yallatype-suggestion-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "yallatype-suggestion-styles";
    style.textContent = `
      .yallatype-suggestion-box {
        position: fixed;
        z-index: 2147483647;
        min-width: 220px;
        max-width: min(360px, calc(100vw - 16px));
        max-height: min(260px, calc(100vh - 24px));
        overflow-y: auto;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95));
        border: 1px solid rgba(148, 163, 184, 0.45);
        border-radius: 14px;
        box-shadow: 0 18px 42px rgba(15, 23, 42, 0.24);
        backdrop-filter: blur(8px);
        padding: 8px;
        font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif;
        font-size: 28px;
        line-height: 1.5;
        direction: rtl;
        display: none;
      }

      .yallatype-suggestion-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 2px 4px 8px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        margin-bottom: 6px;
      }

      .yallatype-token-chip {
        direction: ltr;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 11px;
        color: #334155;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        padding: 2px 8px;
      }

      .yallatype-add-btn {
        direction: ltr;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 11px;
        border: 1px solid #bfdbfe;
        background: #eff6ff;
        color: #1d4ed8;
        border-radius: 999px;
        padding: 3px 9px;
        cursor: pointer;
      }

      .yallatype-suggestion-hint {
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 11px;
        color: #64748b;
        direction: ltr;
        text-align: left;
        padding: 0 4px 6px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        margin-bottom: 6px;
      }

      .yallatype-suggestion-item {
        padding: 6px 10px;
        cursor: pointer;
        border-radius: 10px;
        user-select: none;
        color: #0f172a;
        transition: background-color 120ms ease;
      }

      .yallatype-suggestion-item[data-active='true'] {
        background: linear-gradient(90deg, #eff6ff, #dbeafe);
      }

      .yallatype-suggestion-item:hover {
        background: #f1f5f9;
      }

      .yallatype-add-form {
        direction: rtl;
        display: grid;
        gap: 6px;
        margin: 8px 2px 2px;
        padding: 8px;
        border: 1px dashed #cbd5e1;
        border-radius: 10px;
        background: #ffffff;
      }

      .yallatype-add-form input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 7px 9px;
        font-size: 22px;
        font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif;
        direction: rtl;
      }

      .yallatype-add-actions {
        display: flex;
        gap: 6px;
        justify-content: flex-start;
      }

      .yallatype-action {
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 11px;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        cursor: pointer;
      }

      .yallatype-action[data-primary='true'] {
        border-color: #1d4ed8;
        background: #1d4ed8;
        color: #ffffff;
      }

      .yallatype-info {
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 11px;
        color: #065f46;
        direction: ltr;
      }
    `;

    document.documentElement.appendChild(style);
  }

  function currentHostname() {
    return (location.hostname || "").toLowerCase();
  }

  function isEnabledForPage() {
    const host = currentHostname();
    if (!settings.enabled) {
      return false;
    }
    if (SKIP_HOSTS.has(host)) {
      return false;
    }
    return !settings.disabledSites.includes(host);
  }

  function isSupportedInput(el) {
    const root = getEditableRoot(el);
    if (!root) {
      return false;
    }

    if (root instanceof HTMLInputElement) {
      const type = (root.type || "text").toLowerCase();
      if (["password", "email", "number", "date", "datetime-local", "time", "week", "month", "url", "file"].includes(type)) {
        return false;
      }
      return !root.readOnly && !root.disabled;
    }

    if (root instanceof HTMLTextAreaElement) {
      return !root.readOnly && !root.disabled;
    }

    if (root instanceof HTMLElement && root.isContentEditable) {
      return true;
    }

    return false;
  }

  function isKnownUnsafeEditor(el) {
    if (!settings.skipKnownEditors) {
      return false;
    }

    const root = getEditableRoot(el);
    if (!(root instanceof Element)) {
      return false;
    }

    return Boolean(root.closest(SKIP_EDITORS_SELECTOR));
  }

  function getEditableRoot(el) {
    if (!el || !(el instanceof Element)) {
      return null;
    }

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el;
    }

    if (el instanceof HTMLElement && el.isContentEditable) {
      return el;
    }

    const editableAncestor = el.closest("[contenteditable='true'], [contenteditable='plaintext-only']");
    if (editableAncestor instanceof HTMLElement) {
      return editableAncestor;
    }

    return null;
  }

  function isTokenChar(char) {
    return /[A-Za-z0-9'`]/.test(char || "");
  }

  function isDelimiterInput(text) {
    return /\s|[.,!?;:()[\]{}"\\/\\-]/.test(text || "");
  }

  function findTokenBounds(text, anchorIndex) {
    if (!text || anchorIndex <= 0) {
      return null;
    }

    let index = anchorIndex - 1;

    while (index >= 0 && !isTokenChar(text[index])) {
      index -= 1;
    }

    if (index < 0) {
      return null;
    }

    const end = index + 1;
    let start = index;

    while (start > 0 && isTokenChar(text[start - 1])) {
      start -= 1;
    }

    if (start === end) {
      return null;
    }

    return { start, end, token: text.slice(start, end) };
  }

  function maybeSetAutoDir(el, replacement) {
    if (!/[\u0600-\u06FF]/.test(replacement)) {
      return;
    }

    if (el instanceof HTMLElement && !el.getAttribute("dir")) {
      el.setAttribute("dir", "auto");
    }
  }

  function replaceInTextControl(el, start, end, replacement) {
    el.setRangeText(replacement, start, end, "end");
    maybeSetAutoDir(el, replacement);
  }

  function createSuggestionElement() {
    const el = document.createElement("div");
    el.className = "yallatype-suggestion-box";
    el.dataset.yallatype = "suggestions";
    document.documentElement.appendChild(el);
    return el;
  }

  function hideSuggestions() {
    suggestionState.visible = false;
    suggestionState.root = null;
    suggestionState.tokenInfo = null;
    suggestionState.candidates = [];
    suggestionState.selectedIndex = 0;
    suggestionState.showAddForm = false;
    suggestionState.draftArabic = "";
    suggestionState.infoMessage = "";
    suggestionEl.style.display = "none";
    suggestionEl.innerHTML = "";
  }

  function normalizeToken(token) {
    return String(token || "").trim().toLowerCase();
  }

  function getCustomWord(token) {
    const key = normalizeToken(token);
    return settings.customDictionary && typeof settings.customDictionary === "object"
      ? settings.customDictionary[key]
      : undefined;
  }

  async function saveCustomWord(latinToken, arabicWord) {
    const normalizedLatin = normalizeToken(latinToken);
    const trimmedArabic = String(arabicWord || "").trim();
    if (!normalizedLatin || !trimmedArabic) {
      return false;
    }

    try {
      const response = await api.runtime.sendMessage({
        type: "SET_CUSTOM_WORD",
        latinToken: normalizedLatin,
        arabicWord: trimmedArabic
      });

      if (!response || !response.ok || !response.settings) {
        return false;
      }

      settings = {
        ...settings,
        ...response.settings,
        disabledSites: Array.isArray(response.settings.disabledSites)
          ? response.settings.disabledSites
          : settings.disabledSites,
        customDictionary: response.settings.customDictionary && typeof response.settings.customDictionary === "object"
          ? response.settings.customDictionary
          : settings.customDictionary
      };

      return true;
    } catch {
      return false;
    }
  }

  function getAnchorRect(root) {
    if (root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) {
      const rect = root.getBoundingClientRect();
      return {
        left: rect.left,
        bottom: rect.bottom
      };
    }

    if (root instanceof HTMLElement && root.isContentEditable) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        range.collapse(true);
        const rect = range.getBoundingClientRect();
        if (rect && (rect.left || rect.bottom)) {
          return {
            left: rect.left,
            bottom: rect.bottom
          };
        }
      }

      const rect = root.getBoundingClientRect();
      return {
        left: rect.left,
        bottom: rect.bottom
      };
    }

    return {
      left: 10,
      bottom: 10
    };
  }

  function positionSuggestionBox(anchor) {
    const margin = 8;
    const preferredLeft = Math.max(margin, anchor.left);
    const preferredTop = anchor.bottom + 8;

    suggestionEl.style.left = `${preferredLeft}px`;
    suggestionEl.style.top = `${Math.max(margin, preferredTop)}px`;
    suggestionEl.style.display = "block";

    const rect = suggestionEl.getBoundingClientRect();
    let finalLeft = preferredLeft;
    let finalTop = preferredTop;

    if (rect.right > window.innerWidth - margin) {
      finalLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    }

    if (rect.bottom > window.innerHeight - margin) {
      const aboveTop = anchor.bottom - rect.height - 12;
      finalTop = aboveTop > margin ? aboveTop : Math.max(margin, window.innerHeight - rect.height - margin);
    }

    suggestionEl.style.left = `${Math.round(finalLeft)}px`;
    suggestionEl.style.top = `${Math.round(finalTop)}px`;
  }

  function renderSuggestions() {
    if (!suggestionState.visible || !suggestionState.candidates.length || !suggestionState.root) {
      hideSuggestions();
      return;
    }

    const anchor = getAnchorRect(suggestionState.root);
    suggestionEl.innerHTML = "";

    const header = document.createElement("div");
    header.className = "yallatype-suggestion-header";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "yallatype-add-btn";
    addBtn.textContent = suggestionState.showAddForm ? "Close" : "Add Word";
    addBtn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      suggestionState.showAddForm = !suggestionState.showAddForm;
      suggestionState.infoMessage = "";
      renderSuggestions();
    });

    const tokenChip = document.createElement("div");
    tokenChip.className = "yallatype-token-chip";
    tokenChip.textContent = suggestionState.tokenInfo ? suggestionState.tokenInfo.token : "";

    header.appendChild(addBtn);
    header.appendChild(tokenChip);
    suggestionEl.appendChild(header);

    const hint = document.createElement("div");
    hint.className = "yallatype-suggestion-hint";
    hint.textContent = "Arrows: navigate  |  Enter/Tab: apply  |  Space: apply first";
    suggestionEl.appendChild(hint);

    suggestionState.candidates.forEach((candidate, idx) => {
      const item = document.createElement("div");
      item.textContent = candidate;
      item.className = "yallatype-suggestion-item";
      item.dataset.active = idx === suggestionState.selectedIndex ? "true" : "false";
      item.dataset.index = String(idx);

      item.addEventListener("mouseenter", () => {
        suggestionState.selectedIndex = idx;
        renderSuggestions();
      });

      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyCurrentSuggestion(suggestionState.root, candidate);
      });

      suggestionEl.appendChild(item);
    });

    if (suggestionState.showAddForm && suggestionState.tokenInfo) {
      const addForm = document.createElement("div");
      addForm.className = "yallatype-add-form";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "اكتب الكلمة العربية";
      input.value = suggestionState.draftArabic || "";
      input.addEventListener("input", () => {
        suggestionState.draftArabic = input.value;
      });
      input.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        const ok = await saveCustomWord(suggestionState.tokenInfo.token, suggestionState.draftArabic);
        suggestionState.infoMessage = ok ? "Saved" : "Save failed";
        if (ok) {
          suggestionState.showAddForm = false;
          showSuggestions(suggestionState.root, suggestionState.tokenInfo);
          return;
        }
        renderSuggestions();
      });

      const actions = document.createElement("div");
      actions.className = "yallatype-add-actions";

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "yallatype-action";
      saveBtn.dataset.primary = "true";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("mousedown", async (event) => {
        event.preventDefault();
        const ok = await saveCustomWord(suggestionState.tokenInfo.token, suggestionState.draftArabic);
        suggestionState.infoMessage = ok ? "Saved" : "Save failed";
        if (ok) {
          suggestionState.showAddForm = false;
          showSuggestions(suggestionState.root, suggestionState.tokenInfo);
          return;
        }
        renderSuggestions();
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "yallatype-action";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("mousedown", (event) => {
        event.preventDefault();
        suggestionState.showAddForm = false;
        suggestionState.infoMessage = "";
        renderSuggestions();
      });

      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);

      addForm.appendChild(input);
      addForm.appendChild(actions);

      if (suggestionState.infoMessage) {
        const info = document.createElement("div");
        info.className = "yallatype-info";
        info.textContent = suggestionState.infoMessage;
        addForm.appendChild(info);
      }

      suggestionEl.appendChild(addForm);
      setTimeout(() => input.focus(), 0);
    }

    positionSuggestionBox(anchor);
  }

  function getCaretContextInContentEditable(root) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
      return null;
    }

    if (!root.contains(range.endContainer)) {
      return null;
    }

    const preRange = document.createRange();
    preRange.selectNodeContents(root);
    preRange.setEnd(range.endContainer, range.endOffset);
    const text = preRange.toString();

    return {
      index: text.length,
      text
    };
  }

  function findTextPosition(root, absoluteIndex) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    let consumed = 0;

    while ((node = walker.nextNode())) {
      const len = node.textContent ? node.textContent.length : 0;
      if (absoluteIndex <= consumed + len) {
        return { node, offset: absoluteIndex - consumed };
      }
      consumed += len;
    }

    return null;
  }

  function replaceInContentEditable(root, start, end, replacement) {
    const startPos = findTextPosition(root, start);
    const endPos = findTextPosition(root, end);
    if (!startPos || !endPos) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    selection.removeAllRanges();
    selection.addRange(range);

    let replaced = false;
    if (typeof document.execCommand === "function") {
      replaced = document.execCommand("insertText", false, replacement);
    }

    if (!replaced) {
      range.deleteContents();
      range.insertNode(document.createTextNode(replacement));

      const collapseRange = document.createRange();
      collapseRange.selectNodeContents(root);
      collapseRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(collapseRange);
    }

    maybeSetAutoDir(root, replacement);
    return true;
  }

  function getTokenContext(root) {
    if (!root) {
      return null;
    }

    if (root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) {
      const cursor = root.selectionStart;
      if (typeof cursor !== "number") {
        return null;
      }

      const text = root.value.slice(0, cursor);
      const tokenInfo = findTokenBounds(text, cursor);
      if (!tokenInfo) {
        return null;
      }

      return { root, tokenInfo };
    }

    if (root instanceof HTMLElement && root.isContentEditable) {
      const caretContext = getCaretContextInContentEditable(root);
      if (!caretContext) {
        return null;
      }

      const tokenInfo = findTokenBounds(caretContext.text, caretContext.index);
      if (!tokenInfo) {
        return null;
      }

      return { root, tokenInfo };
    }

    return null;
  }

  function showSuggestions(root, tokenInfo) {
    if (!engine.shouldTransliterate(tokenInfo.token)) {
      hideSuggestions();
      return;
    }

    const candidates = engine.generateCandidates(tokenInfo.token, 6);
    const customWord = getCustomWord(tokenInfo.token);
    if (customWord) {
      candidates.unshift(customWord);
    }

    const uniqueCandidates = [];
    for (const candidate of candidates) {
      if (candidate && !uniqueCandidates.includes(candidate)) {
        uniqueCandidates.push(candidate);
      }
    }

    if (!uniqueCandidates.length) {
      hideSuggestions();
      return;
    }

    suggestionState.visible = true;
    suggestionState.root = root;
    suggestionState.tokenInfo = tokenInfo;
    suggestionState.candidates = uniqueCandidates;
    suggestionState.selectedIndex = 0;
    renderSuggestions();
  }

  function applyCurrentSuggestion(root, forcedSuggestion) {
    if (!isEnabledForPage() || !isSupportedInput(root) || isKnownUnsafeEditor(root)) {
      hideSuggestions();
      return false;
    }

    const context = getTokenContext(root);
    if (!context) {
      hideSuggestions();
      return false;
    }

    const fallbackCandidates = engine.generateCandidates(context.tokenInfo.token, 6);
    const replacement = forcedSuggestion
      || (suggestionState.visible && suggestionState.root === root
        ? suggestionState.candidates[suggestionState.selectedIndex]
        : fallbackCandidates[0]);

    if (!replacement || replacement === context.tokenInfo.token) {
      hideSuggestions();
      return false;
    }

    if (root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) {
      replaceInTextControl(root, context.tokenInfo.start, context.tokenInfo.end, replacement);
      hideSuggestions();
      return true;
    }

    if (root instanceof HTMLElement && root.isContentEditable) {
      const replaced = replaceInContentEditable(root, context.tokenInfo.start, context.tokenInfo.end, replacement);
      hideSuggestions();
      return replaced;
    }

    hideSuggestions();
    return false;
  }

  function updateSuggestionsFromTarget(el) {
    if (!isEnabledForPage()) {
      hideSuggestions();
      return;
    }

    if (!isSupportedInput(el) || isKnownUnsafeEditor(el)) {
      hideSuggestions();
      return;
    }

    const root = getEditableRoot(el);
    if (!root) {
      hideSuggestions();
      return;
    }

    const context = getTokenContext(root);
    if (!context) {
      hideSuggestions();
      return;
    }

    showSuggestions(context.root, context.tokenInfo);
  }

  async function loadSettings() {
    try {
      const response = await api.runtime.sendMessage({ type: "GET_SETTINGS" });
      if (response && response.ok && response.settings) {
        settings = {
          ...settings,
          ...response.settings,
          disabledSites: Array.isArray(response.settings.disabledSites)
            ? response.settings.disabledSites
            : [],
          customDictionary: response.settings.customDictionary && typeof response.settings.customDictionary === "object"
            ? response.settings.customDictionary
            : {}
        };
      }
    } catch {
      // Keep defaults if background is unavailable on this page.
    }
  }

  function onInput(event) {
    if (isComposing || event.isComposing) {
      return;
    }

    if (event.inputType && event.inputType.startsWith("delete")) {
      updateSuggestionsFromTarget(event.target);
      return;
    }

    const insertedText = typeof event.data === "string" ? event.data : "";
    const isBoundaryInput =
      isDelimiterInput(insertedText) ||
      event.inputType === "insertParagraph" ||
      event.inputType === "insertLineBreak";

    if (isBoundaryInput) {
      applyCurrentSuggestion(event.target instanceof Element ? event.target : activeTarget);
      return;
    }

    updateSuggestionsFromTarget(event.target);
  }

  function onKeyup(event) {
    if (isComposing || event.isComposing) {
      return;
    }

    if (["Shift", "Control", "Alt", "Meta", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) {
      return;
    }

    updateSuggestionsFromTarget(event.target instanceof Element ? event.target : activeTarget);
  }

  function onCompositionStart(event) {
    isComposing = true;
    activeTarget = event.target instanceof Element ? event.target : activeTarget;
  }

  function onCompositionEnd(event) {
    isComposing = false;
    updateSuggestionsFromTarget(event.target);
  }

  function onBlur(event) {
    applyCurrentSuggestion(event.target instanceof Element ? event.target : activeTarget);
    hideSuggestions();
  }

  function onKeydown(event) {
    if (isComposing || event.isComposing) {
      return;
    }

    activeTarget = event.target instanceof Element ? event.target : activeTarget;

    if (suggestionState.visible && suggestionState.root === activeTarget) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        suggestionState.selectedIndex = (suggestionState.selectedIndex + 1) % suggestionState.candidates.length;
        renderSuggestions();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        suggestionState.selectedIndex =
          (suggestionState.selectedIndex - 1 + suggestionState.candidates.length) % suggestionState.candidates.length;
        renderSuggestions();
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyCurrentSuggestion(activeTarget);
        return;
      }

      if (event.key === "Escape") {
        suggestionState.showAddForm = false;
        hideSuggestions();
        return;
      }
    }

    if (![" ", "Spacebar", "Enter", "Tab"].includes(event.key)) {
      return;
    }

    const target = event.target instanceof Element ? event.target : document.activeElement;
    if (!(target instanceof Element)) {
      return;
    }

    setTimeout(() => {
      applyCurrentSuggestion(target);
    }, 0);
  }

  function onFocusIn(event) {
    activeTarget = event.target instanceof Element ? event.target : activeTarget;
    updateSuggestionsFromTarget(activeTarget);
  }

  function onPointerDown(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest("[data-yallatype='suggestions']")) {
      return;
    }

    hideSuggestions();
  }

  api.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) {
      return;
    }

    if (message.type === "SETTINGS_UPDATED" && message.payload) {
      settings = {
        ...settings,
        ...message.payload,
        disabledSites: Array.isArray(message.payload.disabledSites)
          ? message.payload.disabledSites
          : settings.disabledSites,
        customDictionary: message.payload.customDictionary && typeof message.payload.customDictionary === "object"
          ? message.payload.customDictionary
          : settings.customDictionary
      };

      if (!isEnabledForPage()) {
        hideSuggestions();
      }
    }
  });

  loadSettings();

  document.addEventListener("input", onInput, true);
  document.addEventListener("compositionstart", onCompositionStart, true);
  document.addEventListener("compositionend", onCompositionEnd, true);
  document.addEventListener("blur", onBlur, true);
  document.addEventListener("keydown", onKeydown, true);
  document.addEventListener("keyup", onKeyup, true);
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("mousedown", onPointerDown, true);
  window.addEventListener("resize", renderSuggestions);
  document.addEventListener("scroll", renderSuggestions, true);
})();
