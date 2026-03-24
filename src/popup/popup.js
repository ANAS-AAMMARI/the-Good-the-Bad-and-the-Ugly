(() => {
  const api = globalThis.browser || globalThis.chrome;

  const searchInput = document.getElementById("searchInput");
  const globalToggle = document.getElementById("globalToggle");
  const siteToggle = document.getElementById("siteToggle");
  const siteLabel = document.getElementById("siteLabel");
  const status = document.getElementById("status");
  const saveBtn = document.getElementById("saveBtn");
  const cards = Array.from(document.querySelectorAll(".card"));

  let activeHostname = "";
  let loadedSettings = null;
  let isDirty = false;

  function setStatus(message, tone = "") {
    status.textContent = message;
    status.classList.remove("success", "error");
    if (tone) {
      status.classList.add(tone);
    }
  }

  function filterCards(query) {
    const normalized = String(query || "").trim().toLowerCase();
    let visibleCount = 0;

    for (const card of cards) {
      const keywords = `${card.dataset.search || ""} ${card.textContent || ""}`.toLowerCase();
      const visible = !normalized || keywords.includes(normalized);
      card.classList.toggle("hidden", !visible);
      if (visible) {
        visibleCount += 1;
      }
    }

    if (visibleCount === 0) {
      setStatus("No matching settings.", "error");
      return;
    }

    if (!isDirty) {
      setStatus("", "");
    }
  }

  function setDirty(nextDirty) {
    isDirty = nextDirty;
    saveBtn.disabled = !isDirty;
    saveBtn.textContent = isDirty ? "Apply Changes" : "Saved";
  }

  function bindControls() {
    searchInput.addEventListener("input", () => {
      filterCards(searchInput.value);
    });

    globalToggle.addEventListener("change", () => {
      setDirty(true);
      setStatus("Unsaved changes", "");
    });

    siteToggle.addEventListener("change", () => {
      setDirty(true);
      setStatus("Unsaved changes", "");
    });

    saveBtn.addEventListener("click", async () => {
      await applyChanges();
    });
  }

  async function getActiveTabHostname() {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      return "";
    }

    try {
      return new URL(tab.url).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  async function init() {
    bindControls();

    const [response, hostname] = await Promise.all([
      api.runtime.sendMessage({ type: "GET_SETTINGS" }),
      getActiveTabHostname()
    ]);

    if (!response || !response.ok || !response.settings) {
      setStatus("Unable to read settings on this page.", "error");
      saveBtn.disabled = true;
      return;
    }

    loadedSettings = response.settings;
    activeHostname = hostname;

    globalToggle.checked = Boolean(loadedSettings.enabled);

    if (!activeHostname) {
      siteToggle.disabled = true;
      siteLabel.textContent = "Site controls unavailable for this tab.";
    } else {
      siteToggle.disabled = false;
      siteLabel.textContent = activeHostname;
      siteToggle.checked = !loadedSettings.disabledSites.includes(activeHostname);
    }

    setDirty(false);
    filterCards("");
  }

  async function applyChanges() {
    if (!isDirty) {
      return;
    }

    saveBtn.disabled = true;
    setStatus("Applying changes...", "");

    try {
      const requests = [
        api.runtime.sendMessage({
          type: "SET_GLOBAL",
          enabled: globalToggle.checked
        })
      ];

      if (activeHostname && !siteToggle.disabled) {
        requests.push(
          api.runtime.sendMessage({
            type: "SET_SITE_DISABLED",
            hostname: activeHostname,
            disabled: !siteToggle.checked
          })
        );
      }

      await Promise.all(requests);

      setDirty(false);
      setStatus("Settings updated", "success");
    } catch {
      setDirty(true);
      setStatus("Failed to apply changes.", "error");
    }
  }

  init().catch(() => {
    setStatus("Popup failed to initialize.", "error");
  });
})();
