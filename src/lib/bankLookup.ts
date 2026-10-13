// IFSC Prefix Lookup Table for major Indian public and private banks
// Known 4-character IFSC prefixes map directly to banking institutions.
// Per specification: If a prefix is unknown, return the raw prefix; never guess.

export const IFSC_PREFIX_MAP: Record<string, string> = {
  SBIN: 'State Bank of India',
  HDFC: 'HDFC Bank',
  ICIC: 'ICICI Bank',
  PUNB: 'Punjab National Bank',
  BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank',
  UBIN: 'Union Bank of India',
  UTIB: 'Axis Bank',
  AXIS: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank',
  IDIB: 'Indian Bank',
  CBIN: 'Central Bank of India',
  IOBA: 'Indian Overseas Bank',
  YESB: 'Yes Bank',
  INDB: 'IndusInd Bank',
  BKID: 'Bank of India',
  MAHB: 'Bank of Maharashtra',
  PSIB: 'Punjab and Sind Bank',
  UCOB: 'UCO Bank',
  FDRL: 'Federal Bank',
  IDFB: 'IDFC FIRST Bank',
  RATN: 'RBL Bank',
  KVBL: 'Karur Vysya Bank',
  SIBL: 'South Indian Bank',
  CSBK: 'CSB Bank',
  BDBL: 'Bandhan Bank',
};

/**
 * Resolves the bank name from an IFSC code.
 * If prefix is recognized, returns the institutional bank name.
 * If unknown, strictly returns the raw 4-letter prefix without guessing.
 */
export function getBankNameFromIfsc(ifsc: string): string {
  if (!ifsc || typeof ifsc !== 'string') {
    return 'UNKNOWN';
  }
  const cleanIfsc = ifsc.trim().toUpperCase();
  const prefix = cleanIfsc.slice(0, 4);
  return IFSC_PREFIX_MAP[prefix] || prefix;
}

/**
 * Extracts 4-letter IFSC prefix.
 */
export function getIfscPrefix(ifsc: string): string {
  if (!ifsc) return '';
  return ifsc.trim().toUpperCase().slice(0, 4);
}
