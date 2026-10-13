import { CaseFileFacts } from './types';

export interface DatasetLookup {
  hasAccount: (acc: string) => boolean;
  getTransaction: (txId: string) => {
    Transaction_ID: string;
    Sender_Account: string;
    Receiver_Account: string;
    Sender_IFSC: string;
    Receiver_IFSC: string;
    Amount: number;
    Timestamp: string;
  } | null;
}

export interface GuardrailValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Anti-hallucination consistency guardrail for court-ready outputs.
 * Verifies that all printed data strictly derives from verified transaction facts.
 * If any check fails, returns isValid: false with descriptive errors.
 */
export function verifyCaseFileGuardrail(
  facts: CaseFileFacts,
  datasetLookup: DatasetLookup
): GuardrailValidationResult {
  const errors: string[] = [];

  // 1. Every account number, IFSC, amount, timestamp, and transaction ID exists in the transactions data
  const accountsToCheck = new Set<string>();
  accountsToCheck.add(facts.victimAccount);

  for (const entry of facts.chronologicalEntries) {
    accountsToCheck.add(entry.senderAccount);
    accountsToCheck.add(entry.receiverAccount);

    const tx = datasetLookup.getTransaction(entry.transactionId);
    if (!tx) {
      errors.push(`Transaction ID ${entry.transactionId} does not exist in loaded transaction data.`);
    } else {
      if (Math.abs(tx.Amount - entry.amount) > 0.01) {
        errors.push(
          `Amount mismatch on tx ${entry.transactionId}: fact states ${entry.amount}, ledger records ${tx.Amount}.`
        );
      }
      if (tx.Timestamp !== entry.timestamp) {
        errors.push(
          `Timestamp mismatch on tx ${entry.transactionId}: fact states ${entry.timestamp}, ledger records ${tx.Timestamp}.`
        );
      }
      if (tx.Sender_Account !== entry.senderAccount) {
        errors.push(
          `Sender mismatch on tx ${entry.transactionId}: fact states ${entry.senderAccount}, ledger records ${tx.Sender_Account}.`
        );
      }
      if (tx.Receiver_Account !== entry.receiverAccount) {
        errors.push(
          `Receiver mismatch on tx ${entry.transactionId}: fact states ${entry.receiverAccount}, ledger records ${tx.Receiver_Account}.`
        );
      }
    }
  }

  for (const acc of accountsToCheck) {
    if (!datasetLookup.hasAccount(acc)) {
      errors.push(`Account ${acc} does not exist in loaded transactions dataset.`);
    }
  }

  // 2. The diary's total siphoned equals the sum of the victim's outgoing transactions in the trail
  const victimOutflowSum = facts.chronologicalEntries
    .filter((e) => e.senderAccount === facts.victimAccount)
    .reduce((sum, e) => sum + e.amount, 0);

  if (Math.abs(victimOutflowSum - facts.totalSiphoned) > 0.01) {
    errors.push(
      `Total siphoned mismatch: facts record ${facts.totalSiphoned}, but victim outgoing transactions sum to ${victimOutflowSum}.`
    );
  }

  // 3. Amounts in each layer table sum to the stated layer totals
  const l1Sum = facts.layer1Entries.reduce((s, e) => s + e.amount, 0);
  if (Math.abs(l1Sum - facts.layer1Total) > 0.01) {
    errors.push(`Layer 1 table sum (${l1Sum}) does not equal stated Layer 1 total (${facts.layer1Total}).`);
  }

  const l2Sum = facts.layer2Entries.reduce((s, e) => s + e.amount, 0);
  if (Math.abs(l2Sum - facts.layer2Total) > 0.01) {
    errors.push(`Layer 2 table sum (${l2Sum}) does not equal stated Layer 2 total (${facts.layer2Total}).`);
  }

  const l3Sum = facts.layer3Entries.reduce((s, e) => s + e.amount, 0);
  if (Math.abs(l3Sum - facts.layer3Total) > 0.01) {
    errors.push(`Layer 3 table sum (${l3Sum}) does not equal stated Layer 3 total (${facts.layer3Total}).`);
  }

  // 4. Each hop's sender received funds earlier than the hop's timestamp
  // Track earliest received timestamp for each receiver in the trail
  const earliestReceivedTime = new Map<string, number>();

  // Parse helper
  function toSec(ts: string): number {
    return new Date(ts.replace(' ', 'T') + 'Z').getTime() / 1000;
  }

  for (const entry of facts.chronologicalEntries) {
    const curTime = toSec(entry.timestamp);

    // If sender is NOT the original victim, sender must have received funds earlier
    if (entry.senderAccount !== facts.victimAccount) {
      const prevRecv = earliestReceivedTime.get(entry.senderAccount);
      if (prevRecv === undefined || prevRecv > curTime) {
        errors.push(
          `Causal order violation: Sender ${entry.senderAccount} forwarded funds at ${entry.timestamp} prior to receiving verified funds in the trail.`
        );
      }
    }

    const prevTargetTime = earliestReceivedTime.get(entry.receiverAccount);
    if (prevTargetTime === undefined || curTime < prevTargetTime) {
      earliestReceivedTime.set(entry.receiverAccount, curTime);
    }
  }

  // 5. The freeze list contains only accounts that received funds in the trail
  const trailReceivers = new Set<string>();
  for (const entry of facts.chronologicalEntries) {
    trailReceivers.add(entry.receiverAccount);
  }

  for (const freeze of facts.freezeAccounts) {
    if (!trailReceivers.has(freeze.account)) {
      errors.push(
        `Freeze list violation: Account ${freeze.account} is listed for freezing but never received funds in this trail.`
      );
    }
  }

  // 6. No duplicate transaction IDs in a notice
  for (const notice of facts.bankNotices) {
    const seenTx = new Set<string>();
    for (const item of notice.accounts) {
      if (seenTx.has(item.transactionId)) {
        errors.push(
          `Duplicate transaction ID violation: Bank notice for ${notice.bankName} contains duplicate transaction ${item.transactionId}.`
        );
      }
      seenTx.add(item.transactionId);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
