import { BankNoticePayload, CaseDiaryPayload, ValidationCheckResult } from '../types/legal';
import { TraceResult } from '../types/dataset';

/**
 * Anti-Hallucination Forensic Verification Guardrail
 * Cross-validates every entity in generated notices and diaries against
 * the in-memory trace dataset before allowing rendering or export.
 */
export function validateLegalDocumentAgainstTrace(
  document: {
    notices?: BankNoticePayload[];
    caseDiary?: CaseDiaryPayload;
  },
  trace: TraceResult,
  datasetLookup: {
    hasAccount: (acc: string) => boolean;
    hasTransaction: (txId: string) => boolean;
  }
): ValidationCheckResult {
  const discrepancies: ValidationCheckResult['discrepancies'] = [];
  let totalEntitiesChecked = 0;
  let verifiedAccountsCount = 0;
  let verifiedAmountsCount = 0;
  let verifiedTxIdsCount = 0;
  let verifiedIfscsCount = 0;

  // Build sets from the ground truth trace
  const traceAccounts = new Set(trace.nodes.map((n) => n.accountNumber));
  const traceTransactions = new Map(trace.edges.map((e) => [e.transactionId, e]));

  // 1. Verify Case Diary
  if (document.caseDiary) {
    const diary = document.caseDiary;

    // Check victim account
    totalEntitiesChecked++;
    if (!traceAccounts.has(diary.victimAccount) || !datasetLookup.hasAccount(diary.victimAccount)) {
      discrepancies.push({
        type: 'ACCOUNT',
        value: diary.victimAccount,
        message: `Victim account ${diary.victimAccount} does not exist in trace or loaded dataset.`,
      });
    } else {
      verifiedAccountsCount++;
    }

    // Check total siphoned amount
    totalEntitiesChecked++;
    if (Math.abs(diary.totalSiphoned - trace.totalSiphoned) > 0.01) {
      discrepancies.push({
        type: 'AMOUNT',
        value: diary.totalSiphoned,
        message: `Case diary total siphoned ${diary.totalSiphoned} does not match trace total ${trace.totalSiphoned}.`,
      });
    } else {
      verifiedAmountsCount++;
    }

    // Check chronological entries
    for (const entry of diary.chronologicalEntries) {
      // Sender account
      totalEntitiesChecked++;
      if (!traceAccounts.has(entry.senderAccount) || !datasetLookup.hasAccount(entry.senderAccount)) {
        discrepancies.push({
          type: 'ACCOUNT',
          value: entry.senderAccount,
          message: `Sender account ${entry.senderAccount} not found in trace.`,
        });
      } else {
        verifiedAccountsCount++;
      }

      // Receiver account
      totalEntitiesChecked++;
      if (!traceAccounts.has(entry.receiverAccount) || !datasetLookup.hasAccount(entry.receiverAccount)) {
        discrepancies.push({
          type: 'ACCOUNT',
          value: entry.receiverAccount,
          message: `Beneficiary account ${entry.receiverAccount} not found in trace.`,
        });
      } else {
        verifiedAccountsCount++;
      }

      // Transaction ID and amount
      totalEntitiesChecked++;
      const edge = traceTransactions.get(entry.transactionId);
      if (!edge || !datasetLookup.hasTransaction(entry.transactionId)) {
        discrepancies.push({
          type: 'TRANSACTION_ID',
          value: entry.transactionId,
          message: `Transaction ID ${entry.transactionId} not present in trace records.`,
        });
      } else {
        verifiedTxIdsCount++;
        totalEntitiesChecked++;
        if (Math.abs(entry.amount - edge.amount) > 0.01) {
          discrepancies.push({
            type: 'AMOUNT',
            value: entry.amount,
            message: `Amount ${entry.amount} on tx ${entry.transactionId} does not match ledger amount ${edge.amount}.`,
          });
        } else {
          verifiedAmountsCount++;
        }
      }
    }

    // Check holding accounts
    for (const holding of diary.holdingAccountsToFreeze) {
      totalEntitiesChecked++;
      if (!traceAccounts.has(holding.accountNumber)) {
        discrepancies.push({
          type: 'ACCOUNT',
          value: holding.accountNumber,
          message: `Holding account ${holding.accountNumber} not recognized in trace graph.`,
        });
      } else {
        verifiedAccountsCount++;
      }
    }
  }

  // 2. Verify Bank Freezing Notices
  if (document.notices) {
    for (const notice of document.notices) {
      for (const acc of notice.accounts) {
        totalEntitiesChecked++;
        if (!traceAccounts.has(acc.accountNumber) || !datasetLookup.hasAccount(acc.accountNumber)) {
          discrepancies.push({
            type: 'ACCOUNT',
            value: acc.accountNumber,
            message: `Bank notice target account ${acc.accountNumber} not found in trace graph.`,
          });
        } else {
          verifiedAccountsCount++;
        }

        totalEntitiesChecked++;
        if (!acc.ifsc || acc.ifsc.length < 4) {
          discrepancies.push({
            type: 'IFSC',
            value: acc.ifsc,
            message: `Invalid or missing IFSC code for account ${acc.accountNumber}.`,
          });
        } else {
          verifiedIfscsCount++;
        }

        // Verify linked transaction IDs
        for (const txId of acc.transactionIds) {
          totalEntitiesChecked++;
          if (!traceTransactions.has(txId) || !datasetLookup.hasTransaction(txId)) {
            discrepancies.push({
              type: 'TRANSACTION_ID',
              value: txId,
              message: `Notice references unverified transaction ID ${txId}.`,
            });
          } else {
            verifiedTxIdsCount++;
          }
        }
      }
    }
  }

  return {
    isValid: discrepancies.length === 0,
    totalEntitiesChecked,
    verifiedAccountsCount,
    verifiedAmountsCount,
    verifiedTxIdsCount,
    verifiedIfscsCount,
    discrepancies,
  };
}
