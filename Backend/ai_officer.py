"""
Operation Abhedya-Chakra - AI Legal Officer Module
Statutory Section 91 CrPC / Section 94 BNSS Freeze Notice Generator
"""

import json
import logging
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional

try:
    import httpx
except ImportError:
    httpx = None

logger = logging.getLogger("abhedya.ai_officer")

OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3"
OLLAMA_TIMEOUT_SECONDS = 8.0


def format_inr_text(amount: float) -> str:
    """Format floating point amount into standard Indian Rupee notation."""
    try:
        s = f"{amount:,.2f}"
        return f"INR {s}"
    except Exception:
        return f"INR {amount}"


def generate_fallback_notice_template(
    victim_account: str,
    holding_accounts: List[Dict[str, Any]],
    total_amount: float,
    officer_name: str = "",
    designation: str = "Inspector of Police / Investigating Officer",
    police_station: str = "Cyber Crime Police Station",
    fir_number: str = "",
    fir_date: str = "",
    complaint_id_1930: str = "",
) -> str:
    """
    Deterministic statutory notice under Section 91 CrPC / Section 94 BNSS.
    Instant fallback when Ollama is offline or takes longer than 8 seconds.
    Strictly free of em dashes, purple branding, emojis, and hallucinations.
    """
    date_str = datetime.now().strftime("%d-%m-%Y")
    ref_num = f"NOTICE/CYBER/{datetime.now().strftime('%Y%m%d%H%M')}/{victim_account[-4:] if victim_account else 'REF'}"

    officer_display = officer_name.strip() if officer_name else "Investigating Officer"
    fir_display = fir_number.strip() if fir_number else "Under Regular Inquiry (NCRB / 1930 Cyber Cell)"
    fir_date_display = fir_date.strip() if fir_date else date_str
    complaint_display = complaint_id_1930.strip() if complaint_id_1930 else "1930-PORTAL-DISPUTE"

    rows = []
    for idx, acc in enumerate(holding_accounts, start=1):
        acc_num = acc.get("account_number") or acc.get("id") or "UNKNOWN"
        bank = acc.get("bank_name") or acc.get("bank") or "Designated Scheduled Commercial Bank"
        ifsc = acc.get("ifsc") or acc.get("primaryIfsc") or "NOT SPECIFIED"
        layer = acc.get("layer") or "Mule Holding Account"
        held = acc.get("retained_amount") or acc.get("amount") or acc.get("inflow") or 0.0

        rows.append(
            f"| {idx:02d} | {acc_num} | {bank} | {ifsc} | {layer} | {format_inr_text(float(held))} |"
        )

    accounts_table = "\n".join(rows) if rows else "| 01 | Downstream Beneficiary | Target Bank | Branch IFSC | Mule Intermediary | Subject to Audit |"

    notice_text = f"""FORMAL NOTICE UNDER SECTION 91 OF THE CODE OF CRIMINAL PROCEDURE, 1973
(READ WITH SECTION 94 OF BHARATIYA NAGARIK SURAKSHA SANHITA, 2023)
AND SECTION 102 CrPC / SECTION 106 BNSS (DIRECTION FOR PRESERVATION OF EVIDENCE)

OFFICE OF THE INVESTIGATING OFFICER
{police_station.upper()}
CRIMINAL INVESTIGATION WING

Notice Reference: {ref_num}
Date of Issuance: {date_str}

TO:
The Branch Manager / Nodal Cyber Security Officer,
Designated Commercial Bank / Financial Intermediary.

SUBJECT:
Urgent requisition to freeze debit operations, lien mark disputed funds, and furnish certified electronic transaction logs in connection with financial cyber fraud investigation.

REFERENCE:
1. FIR / Crime Enquiry Number: {fir_display} dated {fir_date_display}
2. National Cyber Crime Reporting Portal (1930) Complaint ID: {complaint_display}
3. Victim Source Account: {victim_account}
4. Total Defrauded Sum Identified: {format_inr_text(total_amount)}

Sir / Madam,

Whereas an investigation into the above-referenced financial cyber fraud has established an illicit money dispersion trail originating from victim account {victim_account}. Forensic fund flow tracing indicates that proceeds of crime were routed rapidly across multi-tiered intermediary and mule collector accounts to prevent recovery.

Under the statutory powers vested in me under Section 91 of the Code of Criminal Procedure, 1973 (Section 94 BNSS, 2023) and Section 102 CrPC (Section 106 BNSS, 2023), you are hereby directed to execute the following immediate actions upon receipt of this statutory notice:

1. IMMEDIATE DEBIT FREEZE:
Immediately freeze all debit operations, UPI handles, ATM/POS authorizations, and net-banking outgoing facilities on the below-tabulated account(s) maintaining custody of the proceeds of crime, while keeping credit operations enabled:

| S.No | Account Number | Bank / Entity | Branch IFSC | Layer Classification | Disputed Amount / Lien |
|------|----------------|---------------|-------------|----------------------|------------------------|
{accounts_table}

2. STATUTORY PRODUCTION OF ELECTRONIC RECORDS:
Furnish within 24 hours of receipt the following certified records as admissible electronic evidence under Section 65B of the Indian Evidence Act, 1872 / Section 63 of Bharatiya Sakshya Adhiniyam, 2023:
   (a) Complete certified Account Statement from the date of inception of suspicious inflow to current date.
   (b) Certified copy of Account Opening Form (AOF), Customer Due Diligence (CDD), and e-KYC documents (Aadhaar, PAN, Passport, Voter ID).
   (c) Comprehensive IP access logs, Device MAC/IMEI fingerprints, and Geolocation metadata associated with all incoming and onward digital fund transfers.
   (d) Mobile number and email address linked to the beneficiary accounts along with registered SIM binding history.
   (e) CCTV footage logs in the event of ATM or branch cash withdrawals.

3. LEGAL NOTICE REGARDING NON-COMPLIANCE:
Take notice that intentional failure to comply with this statutory direction or willful delay in freezing the disputed proceeds of crime constitutes an offence punishable under Section 175 and Section 204 of the Indian Penal Code, 1860 (corresponding Sections 210 and 238 of the Bharatiya Nyaya Sanhita, 2023).

Issued under my hand and official seal.

Signature & Departmental Seal:

________________________________________
Name: {officer_display}
Designation: {designation}
Police Station: {police_station}
"""
    return notice_text.strip()


async def generate_statutory_notice(
    victim_account: str,
    holding_accounts: List[Dict[str, Any]],
    total_amount: float,
    officer_name: str = "",
    designation: str = "Inspector of Police / Investigating Officer",
    police_station: str = "Cyber Crime Police Station",
    fir_number: str = "",
    fir_date: str = "",
    complaint_id_1930: str = "",
    ollama_url: str = OLLAMA_BASE_URL,
    model: str = DEFAULT_MODEL,
) -> str:
    """
    Generate notice via local Ollama LLM if available within 8 seconds.
    If Ollama is slow, offline, or unavailable, instantly return the statutory template notice.
    """
    if not httpx:
        logger.info("httpx not installed. Using statutory fallback template.")
        return generate_fallback_notice_template(
            victim_account=victim_account,
            holding_accounts=holding_accounts,
            total_amount=total_amount,
            officer_name=officer_name,
            designation=designation,
            police_station=police_station,
            fir_number=fir_number,
            fir_date=fir_date,
            complaint_id_1930=complaint_id_1930,
        )

    # Prompt crafted for Indian financial cybercrime investigation standards
    accounts_summary_lines = []
    for acc in holding_accounts:
        acc_id = acc.get("account_number") or acc.get("id") or "UNKNOWN"
        amt = acc.get("retained_amount") or acc.get("amount") or 0.0
        bank = acc.get("bank_name") or acc.get("bank") or "Target Bank"
        ifsc = acc.get("ifsc") or acc.get("primaryIfsc") or "N/A"
        layer = acc.get("layer") or "Mule Account"
        accounts_summary_lines.append(f"Account: {acc_id}, Bank: {bank}, IFSC: {ifsc}, Layer: {layer}, Amount: INR {amt}")

    accounts_str = "\n".join(accounts_summary_lines) if accounts_summary_lines else "None specified"

    system_prompt = (
        "You are an expert Indian Cyber Police Legal Officer drafting a court-ready, formal statutory notice "
        "under Section 91 CrPC (Section 94 BNSS) and Section 102 CrPC (Section 106 BNSS) to bank branch managers. "
        "Demand an immediate debit freeze and preservation of electronic evidence under Section 65B Indian Evidence Act. "
        "Maintain strict legal precision. Do not use em dashes, emojis, or purple prose."
    )

    user_prompt = f"""Draft a statutory bank freeze requisition with these verified parameters:
- Investigating Officer: {officer_name or 'Investigating Officer'} ({designation})
- Police Station: {police_station}
- FIR Number: {fir_number or 'Under Verification'} (Date: {fir_date or datetime.now().strftime('%d-%m-%Y')})
- 1930 Portal Complaint Reference: {complaint_id_1930 or '1930-DISPUTE'}
- Victim Account: {victim_account}
- Total Fraudulent Outflow: INR {total_amount:,.2f}
- Flagged Downstream Holding Mule Accounts:
{accounts_str}

Ensure the notice orders an immediate freeze on debit facilities, preservation of IP logs, KYC records, and CCTV footage within 24 hours."""

    payload = {
        "model": model,
        "prompt": user_prompt,
        "system": system_prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "top_p": 0.9,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT_SECONDS) as client:
            response = await client.post(f"{ollama_url.rstrip('/')}/api/generate", json=payload)
            if response.status_code == 200:
                data = response.json()
                generated_text = data.get("response", "").strip()
                if generated_text:
                    # Clean any accidental em dashes
                    return generated_text.replace("—", " - ")
    except Exception as exc:
        logger.warning(
            "Ollama notice generation timed out or unreachable (%s). Using fallback template notice.",
            str(exc),
        )

    # Instant fallback template
    return generate_fallback_notice_template(
        victim_account=victim_account,
        holding_accounts=holding_accounts,
        total_amount=total_amount,
        officer_name=officer_name,
        designation=designation,
        police_station=police_station,
        fir_number=fir_number,
        fir_date=fir_date,
        complaint_id_1930=complaint_id_1930,
    )


async def generate_notice_stream_response(
    victim_account: str,
    holding_accounts: List[Dict[str, Any]],
    total_amount: float,
    officer_name: str = "",
    designation: str = "Inspector of Police / Investigating Officer",
    police_station: str = "Cyber Crime Police Station",
    fir_number: str = "",
    fir_date: str = "",
    complaint_id_1930: str = "",
    ollama_url: str = OLLAMA_BASE_URL,
    model: str = DEFAULT_MODEL,
) -> AsyncGenerator[str, None]:
    """
    Streams the generated notice chunk by chunk. If Ollama fails or times out (8 seconds),
    yields the fallback template notice smoothly.
    """
    if not httpx:
        fallback = generate_fallback_notice_template(
            victim_account, holding_accounts, total_amount, officer_name, designation, police_station, fir_number, fir_date, complaint_id_1930
        )
        yield f"data: {json.dumps({'chunk': fallback, 'done': True})}\n\n"
        return

    accounts_str = ", ".join(
        [f"{acc.get('account_number', acc.get('id', 'N/A'))} (INR {acc.get('retained_amount', 0)})" for acc in holding_accounts]
    )

    payload = {
        "model": model,
        "prompt": f"Draft Section 91 CrPC freeze notice for victim {victim_account}, fraud INR {total_amount:,.2f}, holding accounts: {accounts_str}",
        "system": "You are a Cyber Police Legal Officer drafting a Section 91 CrPC notice. No emojis or em dashes.",
        "stream": True,
        "options": {"temperature": 0.2},
    }

    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT_SECONDS) as client:
            async with client.stream("POST", f"{ollama_url.rstrip('/')}/api/generate", json=payload) as response:
                if response.status_code == 200:
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk_data = json.loads(line)
                            content = chunk_data.get("response", "").replace("—", " - ")
                            is_done = chunk_data.get("done", False)
                            yield f"data: {json.dumps({'chunk': content, 'done': is_done})}\n\n"
                            if is_done:
                                return
                        except Exception:
                            continue
                    return
    except Exception as exc:
        logger.warning("Ollama stream error or timeout (%s). Yielding fallback notice.", str(exc))

    # Fallback template output
    fallback = generate_fallback_notice_template(
        victim_account, holding_accounts, total_amount, officer_name, designation, police_station, fir_number, fir_date, complaint_id_1930
    )
    yield f"data: {json.dumps({'chunk': fallback, 'done': True, 'fallback': True})}\n\n"
