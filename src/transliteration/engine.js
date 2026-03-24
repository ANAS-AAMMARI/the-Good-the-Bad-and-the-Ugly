(() => {
  const mappings = globalThis.ArabiziMappings || {};

  const multiEntries = Object.entries(mappings.multiCharMap || {}).sort((a, b) => b[0].length - a[0].length);
  const singleMap = mappings.singleCharMap || {};
  const multiOptionsMap = mappings.multiCharOptions || {};
  const singleOptionsMap = mappings.singleCharOptions || {};
  const wordMap = mappings.wholeWordMap || {};
  const tokenPattern = mappings.tokenPattern || /[A-Za-z0-9'`]+/;
  const sortedMultiOptionKeys = Object.keys(multiOptionsMap).sort((a, b) => b.length - a.length);

  function normalizeToken(token) {
    return (token || "").trim().toLowerCase();
  }

  function shouldTransliterate(token) {
    return tokenPattern.test(token) && /[A-Za-z0-9]/.test(token);
  }

  function transliterateWord(token) {
    const normalized = normalizeToken(token);
    if (!normalized) {
      return token;
    }

    if (wordMap[normalized]) {
      return Array.isArray(wordMap[normalized]) ? wordMap[normalized][0] : wordMap[normalized];
    }

    let result = "";
    let index = 0;

    while (index < normalized.length) {
      let matched = false;

      for (const [latin, arabic] of multiEntries) {
        if (normalized.startsWith(latin, index)) {
          result += arabic;
          index += latin.length;
          matched = true;
          break;
        }
      }

      if (matched) {
        continue;
      }

      const char = normalized[index];
      result += singleMap[char] || char;
      index += 1;
    }

    return result;
  }

  function pushUnique(list, value) {
    if (value && !list.includes(value)) {
      list.push(value);
    }
  }

  function generatePhoneticCandidates(normalized, limit) {
    const results = [];

    function walk(index, current) {
      if (results.length >= limit) {
        return;
      }

      if (index >= normalized.length) {
        pushUnique(results, current);
        return;
      }

      for (const key of sortedMultiOptionKeys) {
        if (!normalized.startsWith(key, index)) {
          continue;
        }

        const options = multiOptionsMap[key] || [];
        for (const option of options) {
          walk(index + key.length, current + option);
          if (results.length >= limit) {
            return;
          }
        }
      }

      const char = normalized[index];
      const options = singleOptionsMap[char] || [singleMap[char] || char];
      for (const option of options) {
        walk(index + 1, current + option);
        if (results.length >= limit) {
          return;
        }
      }
    }

    walk(0, "");
    return results;
  }

  function getWholeWordCandidates(normalized) {
    const found = wordMap[normalized];
    if (!found) {
      return [];
    }
    return Array.isArray(found) ? found : [found];
  }

  function generateCandidates(token, maxCandidates = 6) {
    if (!shouldTransliterate(token)) {
      return [];
    }

    const normalized = normalizeToken(token);
    const candidates = [];

    for (const candidate of getWholeWordCandidates(normalized)) {
      pushUnique(candidates, candidate);
    }

    pushUnique(candidates, transliterateWord(normalized));

    for (const candidate of generatePhoneticCandidates(normalized, maxCandidates * 3)) {
      pushUnique(candidates, candidate);
      if (candidates.length >= maxCandidates) {
        break;
      }
    }

    return candidates.slice(0, maxCandidates);
  }

  function transliterateToken(token) {
    if (!shouldTransliterate(token)) {
      return token;
    }
    return transliterateWord(token);
  }

  globalThis.ArabiziEngine = {
    transliterateToken,
    shouldTransliterate,
    generateCandidates
  };
})();
