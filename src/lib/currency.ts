/**
 * Currency formatting utility for Indian Rupee (INR) forensic records.
 */

export function formatRupees(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Rs 0.00';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const fixed = absAmount.toFixed(2);
  const [integerPart, decimalPart] = fixed.split('.');

  // Indian numbering format: last 3 digits, then comma every 2 digits
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }

  const formattedInteger =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}Rs ${formattedInteger}.${decimalPart}`;
}

export function formatINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹ 0.00';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const fixed = absAmount.toFixed(2);
  const [integerPart, decimalPart] = fixed.split('.');

  // Indian numbering format: last 3 digits, then comma every 2 digits
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }

  const formattedInteger =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹ ${formattedInteger}.${decimalPart}`;
}

export function formatINRCompact(amount: number): string {
  if (isNaN(amount)) return '₹ 0';
  const abs = Math.abs(amount);
  if (abs >= 10000000) {
    return `₹ ${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `₹ ${(amount / 100000).toFixed(2)} Lakh`;
  }
  if (abs >= 1000) {
    return `₹ ${(amount / 1000).toFixed(1)} K`;
  }
  return formatINR(amount);
}
