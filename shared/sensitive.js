// @ts-check
// GENERATED from apps-script/domain/sensitive.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * Keeps obviously sensitive numbers out of the app (it stores reference numbers and notes only):
 * payment card numbers, UK sort code + account number pairs, and IBANs. Deliberately narrow, so
 * ordinary policy and reference numbers are not refused.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Sensitive = (() => {
  /** @param {string} digits */
  function luhn(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i += 1) {
      let d = Number(digits[digits.length - 1 - i]);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    return sum % 10 === 0;
  }

  /**
   * Why a piece of text must not be stored, or null if it is fine.
   * @param {string|null|undefined} text
   * @returns {string|null}
   */
  function problem(text) {
    if (!text) return null;
    // Card numbers: 15 or 16 digits (spaces or dashes allowed) starting 2-6, passing the Luhn check.
    for (const match of text.matchAll(/(?<![\d])(?:\d[ -]?){14,15}\d(?![\d])/g)) {
      const digits = match[0].replace(/[ -]/g, '');
      if ((digits.length === 15 || digits.length === 16) && /^[2-6]/.test(digits) && luhn(digits)) {
        return 'looks like a payment card number; do not store card details here';
      }
    }
    if (/(?<![\d])\d{2}[- ]\d{2}[- ]\d{2}(?![\d])[\s\S]{0,30}(?<![\d])\d{8}(?![\d])/.test(text)
      || /(?<![\d])\d{8}(?![\d])[\s\S]{0,30}(?<![\d])\d{2}[- ]\d{2}[- ]\d{2}(?![\d])/.test(text)) {
      return 'looks like a sort code and account number; do not store bank details here';
    }
    if (/\bGB\d{2}\s?[A-Z]{4}(\s?\d){14}\b/i.test(text)) return 'looks like an IBAN; do not store bank details here';
    return null;
  }

  return { problem, luhn };
})();

export { Sensitive };
