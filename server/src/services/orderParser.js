import { products } from "../data/catalogue.js";

const devanagariDigits = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9"
};

function normalizeDigits(str) {
  return str.replace(/[०-९]/g, d => devanagariDigits[d] || d);
}

const numberWords = {
  "aadha": 0.5, "adha": 0.5, "आधा": 0.5, "half": 0.5,
  "dedh": 1.5, "डेढ़": 1.5,
  "dhai": 2.5, "ढाई": 2.5,
  "ek": 1, "एक": 1, "one": 1,
  "do": 2, "दो": 2, "two": 2,
  "teen": 3, "तीन": 3, "three": 3,
  "char": 4, "चार": 4, "four": 4,
  "paanch": 5, "पांच": 5, "पाँच": 5, "five": 5,
  "che": 6, "chhah": 6, "छह": 6, "छः": 6, "six": 6,
  "saat": 7, "सात": 7, "seven": 7,
  "aath": 8, "आठ": 8, "eight": 8,
  "nau": 9, "नौ": 9, "nine": 9,
  "das": 10, "दस": 10, "ten": 10
};

const beforeRegex = /(\d+(?:\.\d+)?|aadha|adha|आधा|half|dedh|डेढ़|dhai|ढाई|ek|एक|one|do|दो|two|teen|तीन|three|char|चार|four|paanch|पांच|पाँच|five|che|chhah|छह|छः|six|saat|सात|seven|aath|आठ|eight|nau|नौ|nine|das|दस|ten)\s*(?:किलो(?:ग्राम)?|किग्रा|kilo|kg|kilos|ग्राम|gram|grams|gm|g|लीटर|ली|litre|liter|litres|liters|l|ltr|पैकेट(?:्स)?|packet|packets|pkt|pack|packs|बोतल|bottle|bottles|डिब्बा|डिब्बे|box|boxes|dabba|पीस|piece|pieces|pc|pcs)?\s*$/i;

const afterRegex = /^\s*(?:ke|ka|ki|of|के|का|की)?\s*(\d+(?:\.\d+)?|aadha|adha|आधा|half|dedh|डेढ़|dhai|ढाई|ek|एक|one|do|दो|two|teen|तीन|three|char|चार|four|paanch|पांच|पाँच|five|che|chhah|छह|छः|six|saat|सात|seven|aath|आठ|eight|nau|नौ|nine|das|दस|ten)(?:\s*(?:किलो(?:ग्राम)?|किग्रा|kilo|kg|kilos|ग्राम|gram|grams|gm|g|लीटर|ली|litre|liter|litres|liters|l|ltr|पैकेट(?:्स)?|packet|packets|pkt|pack|packs|बोतल|bottle|bottles|डिब्बा|डिब्बे|box|boxes|dabba|पीस|piece|pieces|pc|pcs))?/i;

export function parseOrder(transcript) {
  const normalized = normalizeDigits(String(transcript || "")).toLowerCase();
  const found = [];

  for (const product of products) {
    const sortedAliases = [...product.aliases].sort((a, b) => b.length - a.length);
    let bestAlias = null;
    let bestIndex = -1;

    for (const alias of sortedAliases) {
      const idx = normalized.indexOf(alias.toLowerCase());
      if (idx !== -1) {
        bestAlias = alias;
        bestIndex = idx;
        break;
      }
    }

    if (!bestAlias) continue;

    // Read quantity before product (e.g. "2 किलो चावल", "दो पैकेट मैगी")
    const before = normalized.slice(Math.max(0, bestIndex - 35), bestIndex).trim();
    // Read quantity after product (e.g. "चावल 2 किलो", "मैगी के दो पैकेट")
    const after = normalized.slice(bestIndex + bestAlias.length, bestIndex + bestAlias.length + 35);

    let quantity = 1;
    const beforeMatch = before.match(beforeRegex);
    if (beforeMatch) {
      const token = beforeMatch[1].toLowerCase();
      quantity = Number(token) || numberWords[token] || 1;
    } else {
      const afterMatch = after.match(afterRegex);
      if (afterMatch) {
        const token = afterMatch[1].toLowerCase();
        quantity = Number(token) || numberWords[token] || 1;
      }
    }

    found.push({
      index: bestIndex,
      productId: product.id,
      name: product.name,
      quantity,
      unit: product.unit,
      price: product.price,
      subtotal: quantity * product.price
    });
  }

  // Sort by appearance in the transcript
  found.sort((a, b) => a.index - b.index);
  const items = found.map(({ index, ...rest }) => rest);
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  return { items, totalAmount, needsClarification: items.length === 0 };
}
