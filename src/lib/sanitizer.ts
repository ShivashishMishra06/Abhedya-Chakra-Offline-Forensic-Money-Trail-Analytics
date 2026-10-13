/**
 * Security and sanitization utility for untrusted transaction fields.
 * Narration, IP, and Device fields can carry malicious prompts, XSS, or formula injection.
 */

/**
 * Escapes characters that might be interpreted in HTML context.
 */
export function escapeUntrustedText(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strips or neutralizes formula injection characters (=, +, -, @, TAB, CR)
 * when generating CSV exports for forensic records.
 */
export function sanitizeForCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  // If the cell begins with dangerous formula triggers, prefix with an apostrophe
  const firstChar = str.trimStart().charAt(0);
  if (['=', '+', '-', '@', '\t', '\r'].includes(firstChar)) {
    return `'${str.replace(/"/g, '""')}`;
  }

  // If value contains commas, quotes, or newlines, enclose in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Validates that an account number consists strictly of numeric digits.
 */
export function isValidAccountNumber(account: string): boolean {
  if (!account) return false;
  const trimmed = account.trim();
  return /^\d{6,24}$/.test(trimmed);
}
