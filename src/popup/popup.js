(() => {
  const api = globalThis.browser || globalThis.chrome;

  const globalToggle = document.getElementById("globalToggle");
  const siteToggle = document.getElementById("siteToggle");
  const siteLabel = document.getElementById("siteLabel");
  const status = document.getElementById("status");

  function setStatus(message) {
    status.textContent = message;
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
    const response = await api.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (!response || !response.ok || !response.settings) {
      setStatus("Unable to read settings on this page.");
      return;
    }

    const settings = response.settings;
    const hostname = await getActiveTabHostname();

    globalToggle.checked = Boolean(settings.enabled);

    if (!hostname) {
      siteToggle.disabled = true;
      siteLabel.textContent = "Site controls unavailable on this tab.";
    } else {
      siteLabel.textContent = `Current site: ${hostname}`;
      siteToggle.checked = !settings.disabledSites.includes(hostname);
    }

    globalToggle.addEventListener("change", async () => {
      await api.runtime.sendMessage({
        type: "SET_GLOBAL",
        enabled: globalToggle.checked
      });
      setStatus(`Global transliteration ${globalToggle.checked ? "enabled" : "disabled"}.`);
    });

    siteToggle.addEventListener("change", async () => {
      if (!hostname) {
        return;
      }

      await api.runtime.sendMessage({
        type: "SET_SITE_DISABLED",
        hostname,
        disabled: !siteToggle.checked
      });
      setStatus(
        siteToggle.checked
          ? `Enabled on ${hostname}.`
          : `Disabled on ${hostname}.`
      );
    });
  }

  init().catch(() => {
    setStatus("Popup failed to initialize.");
  });
})();
