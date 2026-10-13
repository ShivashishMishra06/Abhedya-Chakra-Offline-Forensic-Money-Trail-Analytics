export interface OfficerFormDetails {
  officerName: string;
  designation: string;
  policeStation: string;
  firNumber: string;
  firDate: string;
  complaintId1930: string;
}

export interface BankNoticePayload {
  bankName: string;
  ifscPrefix: string;
  accounts: {
    accountNumber: string;
    ifsc: string;
    layer: string;
    totalReceived: number;
    currentHolding: number;
    transactionIds: string[];
    timestamps: string[];
  }[];
  totalDisputedAmount: number;
  noticeReferenceNumber: string;
  statutoryAct: 'Section 91 CrPC / Section 94 BNSS';
}

export interface CaseDiaryPayload {
  firNumber: string;
  firDate: string;
  victimAccount: string;
  victimBank: string;
  victimIfsc: string;
  totalSiphoned: number;
  chronologicalEntries: {
    stepIndex: number;
    timestamp: string;
    senderAccount: string;
    senderBank: string;
    receiverAccount: string;
    receiverBank: string;
    receiverIfsc: string;
    amount: number;
    paymentMode: string;
    transactionId: string;
    layer: string;
  }[];
  holdingAccountsToFreeze: {
    accountNumber: string;
    bankName: string;
    ifsc: string;
    retainedAmount: number;
    layer: string;
  }[];
}

export interface ValidationCheckResult {
  isValid: boolean;
  totalEntitiesChecked: number;
  verifiedAccountsCount: number;
  verifiedAmountsCount: number;
  verifiedTxIdsCount: number;
  verifiedIfscsCount: number;
  discrepancies: {
    type: 'ACCOUNT' | 'AMOUNT' | 'TRANSACTION_ID' | 'IFSC';
    value: string | number;
    message: string;
  }[];
}
