(() => {
  const multiCharMap = {
    sh: "ش",
    kh: "خ",
    gh: "غ",
    th: "ث",
    dh: "ذ",
    ch: "تش"
  };

  const multiCharOptions = {
    th: ["ث", "ذ", "ظ"],
    dh: ["ذ", "ض"],
    sh: ["ش"],
    kh: ["خ"],
    gh: ["غ"]
  };

  const singleCharMap = {
    "2": "ء",
    "3": "ع",
    "4": "غ",
    "5": "خ",
    "6": "ط",
    "7": "ح",
    "8": "ق",
    "9": "ق",
    a: "ا",
    b: "ب",
    c: "ك",
    d: "د",
    e: "e",
    f: "ف",
    g: "ج",
    h: "ه",
    i: "ي",
    j: "ج",
    k: "ك",
    l: "ل",
    m: "م",
    n: "ن",
    o: "o",
    p: "ب",
    q: "ق",
    r: "ر",
    s: "س",
    t: "ت",
    u: "و",
    v: "ف",
    w: "و",
    x: "كس",
    y: "ي",
    z: "ز",
    "'": "ع"
  };

  const singleCharOptions = {
    "2": ["ء", "أ", "إ"],
    "3": ["ع"],
    "4": ["غ"],
    "5": ["خ"],
    "6": ["ط", "ت"],
    "7": ["ح"],
    "8": ["ق", "غ"],
    "9": ["ق", "ص"],
    a: ["ا", ""],
    c: ["ك", "ق", "س"],
    d: ["د", "ض"],
    e: ["ي", ""],
    g: ["ج", "غ"],
    h: ["ه", "ح"],
    i: ["ي", ""],
    o: ["و", ""],
    q: ["ق", "ك"],
    s: ["س", "ص"],
    t: ["ت", "ط"],
    u: ["و", ""],
    z: ["ز", "ظ", "ذ"],
    "'": ["ع", "ء"]
  };

  const wholeWordMap = {
    salam: ["سلام", "سلم"],
    marhaba: ["مرحبا"],
    mar7aba: "مرحبا",
    ahlan: "اهلا",
    ana: "انا",
    enti: "انتي",
    enta: "انت",
    keef: "كيف",
    kif: "كيف",
    habibi: "حبيبي",
    habibti: "حبيبتي",
    inshallah: "ان شاء الله",
    wallah: "والله",
    yalla: ["يلا", "يا الله"]
  };

  const tokenPattern = /[A-Za-z0-9'`]+/;

  globalThis.ArabiziMappings = {
    multiCharMap,
    multiCharOptions,
    singleCharMap,
    singleCharOptions,
    wholeWordMap,
    tokenPattern
  };
})();
