const api = globalThis.browser || globalThis.chrome;

const DEFAULT_SETTINGS = {
  enabled: true,
  disabledSites: [],
  skipKnownEditors: true,
  customDictionary: {}
};

async function getSettings() {
  const stored = await api.storage.sync.get(DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    disabledSites: Array.isArray(stored.disabledSites) ? stored.disabledSites : [],
    customDictionary: stored.customDictionary && typeof stored.customDictionary === "object"
      ? stored.customDictionary
      : {}
  };
}

async function setSettings(next) {
  await api.storage.sync.set(next);
  await notifySettingsUpdated(next);
  return next;
}

async function notifySettingsUpdated(settings) {
  const tabs = await api.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) {
      continue;
    }
    try {
      await api.tabs.sendMessage(tab.id, {
        type: "SETTINGS_UPDATED",
        payload: settings
      });
    } catch {
      // Ignore tabs without a content script.
    }
  }
}

function isSiteEnabled(settings, hostname) {
  if (!hostname) {
    return settings.enabled;
  }
  return settings.enabled && !settings.disabledSites.includes(hostname);
}

function normalizeToken(token) {
  return String(token || "").trim().toLowerCase();
}

api.runtime.onInstalled.addListener(async () => {
  const existing = await api.storage.sync.get(["enabled", "disabledSites", "skipKnownEditors", "customDictionary"]);
  const current = await getSettings();

  // First-time bootstrap: ensure transliteration starts enabled by default.
  if (typeof existing.enabled !== "boolean") {
    current.enabled = true;
  }

  await api.storage.sync.set(current);
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const settings = await getSettings();

    if (!message || !message.type) {
      sendResponse({ ok: false });
      return;
    }

    if (message.type === "GET_SETTINGS") {
      sendResponse({ ok: true, settings });
      return;
    }

    if (message.type === "IS_SITE_ENABLED") {
      const hostname = message.hostname || "";
      sendResponse({ ok: true, enabled: isSiteEnabled(settings, hostname) });
      return;
    }

    if (message.type === "SET_GLOBAL") {
      const next = await setSettings({
        ...settings,
        enabled: Boolean(message.enabled)
      });
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "TOGGLE_GLOBAL") {
      const next = await setSettings({
        ...settings,
        enabled: !settings.enabled
      });
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "SET_SITE_DISABLED") {
      const hostname = (message.hostname || "").trim().toLowerCase();
      if (!hostname) {
        sendResponse({ ok: false, error: "hostname-required" });
        return;
      }

      const disabled = Boolean(message.disabled);
      const nextDisabled = new Set(settings.disabledSites);
      if (disabled) {
        nextDisabled.add(hostname);
      } else {
        nextDisabled.delete(hostname);
      }

      const next = await setSettings({
        ...settings,
        disabledSites: Array.from(nextDisabled)
      });
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "SET_CUSTOM_WORD") {
      const latinToken = normalizeToken(message.latinToken);
      const arabicWord = String(message.arabicWord || "").trim();

      if (!latinToken || !arabicWord) {
        sendResponse({ ok: false, error: "latin-and-arabic-required" });
        return;
      }

      const next = await setSettings({
        ...settings,
        customDictionary: {
          ...settings.customDictionary,
          [latinToken]: arabicWord
        }
      });

      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "REMOVE_CUSTOM_WORD") {
      const latinToken = normalizeToken(message.latinToken);
      if (!latinToken) {
        sendResponse({ ok: false, error: "latin-required" });
        return;
      }

      const nextDictionary = { ...settings.customDictionary };
      delete nextDictionary[latinToken];

      const next = await setSettings({
        ...settings,
        customDictionary: nextDictionary
      });

      sendResponse({ ok: true, settings: next });
      return;
    }

    sendResponse({ ok: false, error: "unknown-message" });
  })();

  return true;
});

api.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-transliteration") {
    return;
  }

  const settings = await getSettings();
  const next = await setSettings({
    ...settings,
    enabled: !settings.enabled
  });

  const [activeTab] = await api.tabs.query({ active: true, currentWindow: true });
  if (activeTab && activeTab.id) {
    try {
      await api.tabs.sendMessage(activeTab.id, {
        type: "SETTINGS_UPDATED",
        payload: next
      });
    } catch {
      // Ignore messaging errors for unsupported pages.
    }
  }
});
