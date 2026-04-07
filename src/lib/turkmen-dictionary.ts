/**
 * Turkmen Hunspell dictionary parser.
 * Loads tk_TM.dic and tk_TM.aff, expands suffixes,
 * and provides O(1) word lookup.
 */

interface AffixRule {
  strip: string;
  add: string;
  condition: string;
}

let wordSet: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;

function parseAffFile(content: string): Map<string, AffixRule[]> {
  const rules = new Map<string, AffixRule[]>();
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("SFX ") && !trimmed.startsWith("PFX ")) continue;

    const parts = trimmed.split(/\s+/);
    // Format: SFX <flag> <strip> <add> <condition>
    if (parts.length < 5) continue;
    // Skip header lines (SFX <flag> Y/N <count>)
    if (parts[2] === "Y" || parts[2] === "N") continue;

    const flag = parts[1];
    const strip = parts[2]; // "0" means no stripping
    const add = parts[3];
    const condition = parts[4] || ".";

    if (!rules.has(flag)) rules.set(flag, []);
    rules.get(flag)!.push({ strip, add, condition });
  }

  return rules;
}

function expandWord(baseWord: string, flags: string[], affixRules: Map<string, AffixRule[]>): string[] {
  const forms = [baseWord];

  for (const flag of flags) {
    const rules = affixRules.get(flag);
    if (!rules) continue;

    for (const rule of rules) {
      let newWord: string;
      if (rule.strip === "0") {
        newWord = baseWord + rule.add;
      } else {
        // Strip ending and add suffix
        if (baseWord.endsWith(rule.strip)) {
          newWord = baseWord.slice(0, -rule.strip.length) + rule.add;
        } else {
          continue;
        }
      }
      forms.push(newWord);
    }
  }

  return forms;
}

function parseDicFile(content: string, affixRules: Map<string, AffixRule[]>): Set<string> {
  const words = new Set<string>();
  const lines = content.split("\n");

  // First line is word count, skip it
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Format: word/flags or just word
    const slashIdx = line.indexOf("/");
    let baseWord: string;
    let flags: string[] = [];

    if (slashIdx > 0) {
      baseWord = line.slice(0, slashIdx);
      const flagStr = line.slice(slashIdx + 1);
      flags = flagStr.split(",");
    } else {
      baseWord = line;
    }

    // Add base word and all expanded forms (lowercase)
    const forms = expandWord(baseWord, flags, affixRules);
    for (const form of forms) {
      words.add(form.toLowerCase());
    }
  }

  return words;
}

async function loadDictionary(): Promise<Set<string>> {
  const [affResponse, dicResponse] = await Promise.all([
    fetch("/dictionaries/tk_TM.aff"),
    fetch("/dictionaries/tk_TM.dic"),
  ]);

  if (!affResponse.ok || !dicResponse.ok) {
    throw new Error("Sözlük faýllary ýüklenip bilinmedi");
  }

  const [affContent, dicContent] = await Promise.all([
    affResponse.text(),
    dicResponse.text(),
  ]);

  const affixRules = parseAffFile(affContent);
  const words = parseDicFile(dicContent, affixRules);

  return words;
}

export async function getDictionary(): Promise<Set<string>> {
  if (wordSet) return wordSet;
  if (loading) return loading;

  loading = loadDictionary().then((set) => {
    wordSet = set;
    loading = null;
    return set;
  });

  return loading;
}

/**
 * Check text against dictionary. Returns words not found.
 */
export async function checkSpelling(text: string): Promise<{
  misspelled: string[];
  allWords: string[];
}> {
  const dict = await getDictionary();

  // Split text into words, keeping only Turkmen alphabet chars
  const wordRegex = /[a-zA-ZçÇäÄöÖüÜşŞňŇžŽýÝ]+/g;
  const matches = text.match(wordRegex) || [];

  const allWords = [...new Set(matches)];
  const misspelled: string[] = [];

  for (const word of allWords) {
    const lower = word.toLowerCase();
    // Skip very short words (1-2 chars) — usually correct
    if (lower.length <= 2) continue;
    if (!dict.has(lower)) {
      misspelled.push(word);
    }
  }

  return { misspelled, allWords };
}
