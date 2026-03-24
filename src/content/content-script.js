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
        min-width: 240px;
        max-width: min(380px, calc(100vw - 16px));
        max-height: min(320px, calc(100vh - 20px));
        overflow-y: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
        background: linear-gradient(180deg, #1a1d24, #171b22);
        border: 1px solid #2a2f3a;
        border-radius: 16px;
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(10px);
        padding: 10px;
        font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif;
        font-size: 16px;
        line-height: 1.4;
        direction: rtl;
        color: #ffffff;
        display: none;
      }

      .yallatype-suggestion-box::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }

      .yallatype-suggestion-box::-webkit-scrollbar-thumb {
        display: none;
      }

      .yallatype-suggestion-box::-webkit-scrollbar-button {
        width: 0;
        height: 0;
        display: none;
      }

      .yallatype-suggestion-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 2px 2px 10px;
        border-bottom: 1px solid rgba(79, 89, 107, 0.5);
        margin-bottom: 8px;
      }

      .yallatype-token-chip {
        direction: ltr;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 11px;
        color: #d6dbe6;
        background: #232733;
        border: 1px solid #32394a;
        border-radius: 999px;
        padding: 3px 10px;
      }

      .yallatype-add-btn {
        direction: ltr;
        font-family: Inter, 'Segoe UI', Tahoma, sans-serif;
        font-size: 11px;
        border: 1px solid rgba(79, 140, 255, 0.7);
        background: rgba(79, 140, 255, 0.16);
        color: #cfe0ff;
        border-radius: 999px;
        padding: 4px 10px;
        cursor: pointer;
        transition: background-color 140ms ease, transform 140ms ease;
      }

      .yallatype-add-btn:hover {
        background: rgba(79, 140, 255, 0.26);
        transform: translateY(-1px);
      }

      .yallatype-suggestion-hint {
        font-family: Inter, 'Segoe UI', Tahoma, sans-serif;
        font-size: 11px;
        color: #8f98a8;
        direction: ltr;
        text-align: left;
        padding: 0 2px 8px;
        border-bottom: 1px solid rgba(79, 89, 107, 0.45);
        margin-bottom: 8px;
      }

      .yallatype-suggestion-item {
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 12px;
        user-select: none;
        color: #f8fafc;
        font-size: 22px;
        line-height: 1.35;
        border: 1px solid transparent;
        transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
      }

      .yallatype-suggestion-item[data-active='true'] {
        background: linear-gradient(180deg, rgba(79, 140, 255, 0.22), rgba(79, 140, 255, 0.14));
        border-color: rgba(79, 140, 255, 0.55);
        box-shadow: 0 4px 16px rgba(79, 140, 255, 0.22);
      }

      .yallatype-suggestion-item:hover {
        background: rgba(35, 41, 54, 0.95);
        border-color: #384154;
        transform: translateY(-1px);
      }

      .yallatype-add-form {
        direction: rtl;
        display: grid;
        gap: 8px;
        margin: 10px 2px 2px;
        padding: 10px;
        border: 1px dashed #3a4354;
        border-radius: 12px;
        background: rgba(19, 22, 29, 0.85);
      }

      .yallatype-add-form input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #32384a;
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 20px;
        font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif;
        direction: rtl;
        color: #ffffff;
        background: #10141b;
      }

      .yallatype-add-form input:focus {
        outline: none;
        border-color: rgba(79, 140, 255, 0.75);
        box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.2);
      }

      .yallatype-add-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-start;
      }

      .yallatype-action {
        border: 1px solid #3a4354;
        background: #232733;
        color: #e2e8f0;
        border-radius: 10px;
        padding: 5px 12px;
        font-size: 11px;
        font-family: Inter, 'Segoe UI', Tahoma, sans-serif;
        cursor: pointer;
        transition: background-color 140ms ease, transform 140ms ease;
      }

      .yallatype-action:hover {
        background: #2b3140;
        transform: translateY(-1px);
      }

      .yallatype-action[data-primary='true'] {
        border-color: #4f8cff;
        background: #4f8cff;
        color: #ffffff;
      }

      .yallatype-action[data-primary='true']:hover {
        background: #6a9dff;
        border-color: #6a9dff;
      }

      .yallatype-info {
        font-family: Inter, 'Segoe UI', Tahoma, sans-serif;
        font-size: 11px;
        color: #7cc5ff;
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

  function resolveTargetElement(target) {
    if (target instanceof Element) {
      return target;
    }

    if (target instanceof Node && target.parentElement) {
      return target.parentElement;
    }

    if (activeTarget instanceof Element) {
      return activeTarget;
    }

    if (document.activeElement instanceof Element) {
      return document.activeElement;
    }

    const selection = window.getSelection();
    if (selection && selection.anchorNode && selection.anchorNode.parentElement) {
      return selection.anchorNode.parentElement;
    }

    return null;
  }

  function getEditableRoot(el) {
    const source = resolveTargetElement(el);
    if (!source) {
      return null;
    }

    if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement) {
      return source;
    }

    if (source instanceof HTMLElement && source.isContentEditable) {
      return source;
    }

    const editableAncestor = source.closest("[contenteditable='true'], [contenteditable='plaintext-only']");
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
      const rawText = (root.innerText || root.textContent || "").replace(/\u200b/g, "");
      return {
        index: rawText.length,
        text: rawText
      };
    }

    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
      const preRange = document.createRange();
      preRange.selectNodeContents(root);
      preRange.setEnd(range.endContainer, range.endOffset);
      const text = preRange.toString().replace(/\u200b/g, "");
      return {
        index: text.length,
        text
      };
    }

    if (!root.contains(range.endContainer)) {
      const rawText = (root.innerText || root.textContent || "").replace(/\u200b/g, "");
      return {
        index: rawText.length,
        text: rawText
      };
    }

    const preRange = document.createRange();
    preRange.selectNodeContents(root);
    preRange.setEnd(range.endContainer, range.endOffset);
    const text = preRange.toString().replace(/\u200b/g, "");

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

  function scheduleSuggestionRefresh(target) {
    const resolved = resolveTargetElement(target);
    if (!resolved) {
      return;
    }

    setTimeout(() => {
      updateSuggestionsFromTarget(resolved);
    }, 0);

    setTimeout(() => {
      updateSuggestionsFromTarget(resolved);
    }, 48);
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
      scheduleSuggestionRefresh(event.target);
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

    scheduleSuggestionRefresh(event.target);
  }

  function onKeyup(event) {
    if (isComposing || event.isComposing) {
      return;
    }

    if (["Shift", "Control", "Alt", "Meta", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) {
      return;
    }

    scheduleSuggestionRefresh(event.target instanceof Element ? event.target : activeTarget);
  }

  function onCompositionStart(event) {
    isComposing = true;
    activeTarget = event.target instanceof Element ? event.target : activeTarget;
  }

  function onCompositionEnd(event) {
    isComposing = false;
    scheduleSuggestionRefresh(event.target);
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
    scheduleSuggestionRefresh(activeTarget);
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
