export interface LayerEntry {
  account: string;
  bank: string;
  ifsc: string;
  amount: number;
  timestamp: string;
  transactionId: string;
  hop: number;
}

export interface ChronologicalEntry {
  step: number;
  timestamp: string;
  senderAccount: string;
  senderBank: string;
  receiverAccount: string;
  receiverBank: string;
  receiverIfsc: string;
  amount: number;
  paymentMode: string;
  transactionId: string;
  hop: number;
}

export interface FreezeAccount {
  account: string;
  bank: string;
  ifsc: string;
  layer: string;
  freezeAmount: number;
}

export interface BankNoticeFactItem {
  accountNumber: string;
  ifsc: string;
  transactionId: string;
  amount: number;
  timestamp: string;
}

export interface BankNoticeFact {
  bankName: string;
  ifscPrefix: string;
  accounts: BankNoticeFactItem[];
  totalAmount: number;
}

export interface CaseFileFacts {
  victimAccount: string;
  victimBank: string;
  victimIfsc: string;
  totalSiphoned: number;
  chronologicalEntries: ChronologicalEntry[];
  layer1Entries: LayerEntry[];
  layer2Entries: LayerEntry[];
  layer3Entries: LayerEntry[];
  layer1Total: number;
  layer2Total: number;
  layer3Total: number;
  freezeAccounts: FreezeAccount[];
  bankNotices: BankNoticeFact[];
}
