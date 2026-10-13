// Legal wording must be reviewed by the investigating authority before use.

export const STATUTORY_SECTION_HEADING =
  'Section 91 of the Code of Criminal Procedure, 1973 (corresponding provision under the Bharatiya Nagarik Suraksha Sanhita, 2023)';

export const PLACEHOLDERS = {
  officerNameAndRank: '[OFFICER NAME AND RANK]',
  policeStation: '[POLICE STATION]',
  firCaseNo: '[FIR / CASE NO.]',
  dateOfFir: '[DATE OF FIR]',
  bankNodalOfficerName: '[BANK NODAL OFFICER NAME]',
} as const;

export const REQUISITION_NOTICE_TEXT = {
  subject:
    'Urgent requisition for debit freeze, lien marking, and production of electronic records under ' +
    STATUTORY_SECTION_HEADING,

  salutation: 'To,\nThe Nodal Officer,\n' + PLACEHOLDERS.bankNodalOfficerName,

  factualParagraph: (victimAccount: string, totalSiphonedFormatted: string) =>
    `During the forensic investigation of the financial fraud involving victim account ${victimAccount}, an illicit money trail of ${totalSiphonedFormatted} was identified traversing multi-tiered accounts. The beneficiary accounts and transaction details specified in the annexure below are directly linked to the proceeds of crime routed through your institution.`,

  requestClause:
    'You are hereby formally directed under ' +
    STATUTORY_SECTION_HEADING +
    ' to immediately execute the following statutory actions:\n' +
    '1. Place an immediate debit freeze and statutory lien on the accounts listed in the annexure up to the disputed sums.\n' +
    '2. Retain and preserve all underlying electronic records, logs, and system data.\n' +
    '3. Supply certified copies of account opening documents, KYC records, and certified statements of account for the relevant period.',

  signatureBlock:
    'Issued under official authority,\n\n' +
    '________________________________________\n' +
    'Signature & Seal\n' +
    PLACEHOLDERS.officerNameAndRank + '\n' +
    PLACEHOLDERS.policeStation,
};

export const CASE_DIARY_TEXT = {
  title: 'Police Case Diary Record',
  heading:
    'Record of Investigation under ' +
    STATUTORY_SECTION_HEADING,
  caseRef: PLACEHOLDERS.firCaseNo,
  dateRef: PLACEHOLDERS.dateOfFir,
  officerRef: PLACEHOLDERS.officerNameAndRank,
  stationRef: PLACEHOLDERS.policeStation,
};
