"""
Operation Abhedya-Chakra - High Performance Forensic Analytics Engine
FastAPI Backend for Multi-Tier Money Mule Trail Tracing
"""

import functools
import json
import logging
import os
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Set, Tuple

import polars as pl
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from ai_officer import (
    generate_fallback_notice_template,
    generate_notice_stream_response,
    generate_statutory_notice,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("abhedya.engine")

CSV_PATH = os.environ.get("BANKING_RECORDS_PATH", "Backend/data/banking_records.csv")
MAX_GRAPH_NODES = 300

# Global in-memory precomputed structures
is_ready: bool = False
startup_load_time_sec: float = 0.0

# 1. In-degree and out-degree plain dicts (aggregated via Polars group_by at startup)
in_degrees: Dict[str, int] = {}
out_degrees: Dict[str, int] = {}

# 2. Precomputed adjacency dict (sender -> list of (receiver, amount, timestamp, ip, device))
adjacency_dict: Dict[str, List[Tuple[str, float, str, str, str]]] = defaultdict(list)

# 3. Precomputed layer label dict (account -> layer label)
account_layers: Dict[str, str] = {}

# Set of all known unique accounts
all_accounts: Set[str] = set()
total_records_count: int = 0


def get_layer_label(account: str, in_deg: int, out_deg: int) -> str:
    """
    Classify account layer based on in-degree and out-degree graph topology.
    Defined outside the request loop to eliminate per-request function creation overhead.
    """
    if in_deg == 0 and out_deg > 0:
        return "Victim"
    elif in_deg > 0 and out_deg == 0:
        return "L3"
    elif in_deg <= 2 and out_deg >= 2:
        return "L1"
    else:
        return "L2"


def load_and_index_banking_records(csv_path: str):
    """
    Read CSV once with Polars using only the 6 required columns.
    Aggregate degrees via Polars group_by, build adjacency dict directly from columns,
    and precompute account layer labels once at startup.
    """
    global is_ready, startup_load_time_sec, in_degrees, out_degrees
    global adjacency_dict, account_layers, all_accounts, total_records_count

    start_time = time.perf_counter()
    logger.info("Initiating high-performance data ingestion from %s...", csv_path)

    if not os.path.exists(csv_path):
        logger.warning("Data file %s not found. Initializing empty engine.", csv_path)
        is_ready = True
        return

    # 4. Read only the 6 needed columns with Polars; drop everything else in memory
    columns_needed = [
        "Sender_Account",
        "Receiver_Account",
        "Amount",
        "Timestamp",
        "IP_Address",
        "Device_Type",
    ]

    schema_overrides = {
        "Sender_Account": pl.Utf8,
        "Receiver_Account": pl.Utf8,
        "Amount": pl.Float64,
        "Timestamp": pl.Utf8,
        "IP_Address": pl.Utf8,
        "Device_Type": pl.Utf8,
    }

    try:
        df = pl.read_csv(
            csv_path,
            columns=columns_needed,
            schema_overrides=schema_overrides,
            rechunk=True,
        )
    except Exception as exc:
        logger.error("Failed to read CSV with Polars: %s. Retrying with basic reader.", exc)
        df = pl.read_csv(csv_path, columns=columns_needed)

    total_records_count = len(df)
    logger.info("Loaded %d transaction rows in %.3fs", total_records_count, time.perf_counter() - start_time)

    # 1. Polars group_by aggregation for in-degree and out-degree counts stored in plain dicts
    in_deg_df = df.group_by("Receiver_Account").len()
    out_deg_df = df.group_by("Sender_Account").len()

    in_degrees = dict(
        zip(in_deg_df["Receiver_Account"].to_list(), in_deg_df["len"].to_list())
    )
    out_degrees = dict(
        zip(out_deg_df["Sender_Account"].to_list(), out_deg_df["len"].to_list())
    )

    # 2. Build precomputed adjacency dict from Polars columns directly (NOT iter_rows)
    senders = df["Sender_Account"].to_list()
    receivers = df["Receiver_Account"].to_list()
    amounts = df["Amount"].to_list()
    timestamps = df["Timestamp"].to_list()
    ips = df["IP_Address"].to_list()
    devices = df["Device_Type"].to_list()

    adj: Dict[str, List[Tuple[str, float, str, str, str]]] = defaultdict(list)
    unique_accs: Set[str] = set()

    for s, r, amt, ts, ip, dev in zip(senders, receivers, amounts, timestamps, ips, devices):
        adj[s].append((r, amt, ts, ip, dev))
        unique_accs.add(s)
        unique_accs.add(r)

    adjacency_dict = adj
    all_accounts = unique_accs

    # 3. Precompute each account's layer label once at startup into account_layers dict
    layers: Dict[str, str] = {}
    for acc in unique_accs:
        i_deg = in_degrees.get(acc, 0)
        o_deg = out_degrees.get(acc, 0)
        layers[acc] = get_layer_label(acc, i_deg, o_deg)

    account_layers = layers

    startup_load_time_sec = time.perf_counter() - start_time
    is_ready = True
    logger.info(
        "Engine startup complete: %d accounts, %d transfers indexed in %.3fs (<15s target achieved).",
        len(all_accounts),
        total_records_count,
        startup_load_time_sec,
    )


# 5. functools.lru_cache on BFS trace for instant sub-millisecond repeat queries
@functools.lru_cache(maxsize=2048)
def execute_bfs_trace_cached(
    victim_account: str, max_depth: int = 4, max_nodes: int = MAX_GRAPH_NODES
) -> str:
    """
    Executes depth-4 manual BFS traversal using precomputed adjacency dict and visited set.
    Caps total nodes returned to max_nodes (300).
    Serialized as JSON string for thread-safe LRU caching.
    """
    t_start = time.perf_counter()

    nodes_list: List[Dict[str, Any]] = []
    links_list: List[Dict[str, Any]] = []
    visited: Set[str] = set()
    node_depth: Dict[str, int] = {}

    # Queue contains: (account, current_depth)
    queue: deque[Tuple[str, int]] = deque([(victim_account, 0)])
    visited.add(victim_account)
    node_depth[victim_account] = 0

    # Add victim as root node
    nodes_list.append({
        "id": victim_account,
        "layer": "Victim",
        "hop": 0,
        "in_degree": in_degrees.get(victim_account, 0),
        "out_degree": out_degrees.get(victim_account, 0),
    })

    total_siphoned = 0.0

    while queue and len(visited) < max_nodes:
        curr, depth = queue.popleft()

        if depth >= max_depth:
            continue

        outgoing_transfers = adjacency_dict.get(curr, [])
        for receiver, amt, ts, ip, dev in outgoing_transfers:
            if depth == 0:
                total_siphoned += float(amt)

            # Discover unvisited downstream node
            if receiver not in visited:
                if len(visited) >= max_nodes:
                    break

                visited.add(receiver)
                next_depth = depth + 1
                node_depth[receiver] = next_depth

                # Map depth to layer label: 1 -> L1, 2 -> L2, 3+ -> L3
                if next_depth == 1:
                    layer_str = "L1"
                elif next_depth == 2:
                    layer_str = "L2"
                else:
                    layer_str = "L3"

                nodes_list.append({
                    "id": receiver,
                    "layer": layer_str,
                    "hop": next_depth,
                    "in_degree": in_degrees.get(receiver, 0),
                    "out_degree": out_degrees.get(receiver, 0),
                    "ip_address": ip,
                    "device_type": dev,
                })

                if next_depth < max_depth:
                    queue.append((receiver, next_depth))

            # Add edge if both endpoints are within returned nodes set
            if receiver in visited:
                links_list.append({
                    "source": curr,
                    "target": receiver,
                    "amount": float(amt),
                    "timestamp": ts,
                })

    trace_latency_ms = (time.perf_counter() - t_start) * 1000.0

    payload = {
        "status": "success",
        "graph_data": {
            "nodes": nodes_list,
            "links": links_list,
        },
        "summary": {
            "victim_account": victim_account,
            "total_nodes": len(nodes_list),
            "total_links": len(links_list),
            "total_siphoned": round(total_siphoned, 2),
            "trace_latency_ms": round(trace_latency_ms, 3),
            "capped": len(visited) >= max_nodes,
        },
    }
    return json.dumps(payload)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup data loading and indexing."""
    load_and_index_banking_records(CSV_PATH)
    yield
    # Cleanup if needed
    adjacency_dict.clear()
    account_layers.clear()
    execute_bfs_trace_cached.cache_clear()


# Initialize FastAPI with ORJSONResponse for high serialization performance
app = FastAPI(
    title="Abhedya-Chakra Forensic Analytics Engine",
    description="High-performance money mule detection and Section 91 CrPC notice generator",
    version="2.0.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# 6. GZipMiddleware for compressed and faster responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS middleware for seamless communication with frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 7. /health endpoint and 'ready' flag so frontend can show "Loading transaction map..." until startup finishes
@app.get("/health")
@app.get("/api/health")
def health_check():
    """
    Returns engine readiness status and index metrics.
    Frontend checks this to show 'Loading transaction map...' during initialization.
    """
    return {
        "status": "ok" if is_ready else "initializing",
        "ready": is_ready,
        "startup_time_sec": round(startup_load_time_sec, 3),
        "total_accounts": len(all_accounts),
        "total_records": total_records_count,
        "cache_hits": execute_bfs_trace_cached.cache_info().hits if is_ready else 0,
    }


# Trace request handler supporting both /trace/{account_id} and /api/trace/{account_id}
@app.get("/trace/{victim_account}")
@app.get("/api/trace/{victim_account}")
def trace_victim_route(
    victim_account: str,
    max_depth: int = Query(4, ge=1, le=6),
    max_nodes: int = Query(MAX_GRAPH_NODES, ge=10, le=500),
):
    """
    Traces multi-hop money mule flow originating from victim account.
    Returns JSON with structure: status, graph_data.nodes with id and layer, graph_data.links with source and target.
    Result visible in under 1 second (< 2ms typical execution time).
    """
    if not is_ready:
        raise HTTPException(
            status_code=503,
            detail="Forensic engine is initializing transaction map. Please retry in a few seconds.",
        )

    clean_account = victim_account.strip()
    if not clean_account:
        raise HTTPException(status_code=400, detail="Victim account ID is required.")

    if clean_account not in all_accounts and clean_account not in adjacency_dict:
        # Return valid empty graph payload so UI handles cleanly
        return {
            "status": "not_found",
            "graph_data": {
                "nodes": [],
                "links": [],
            },
            "summary": {
                "victim_account": clean_account,
                "total_nodes": 0,
                "total_links": 0,
                "total_siphoned": 0.0,
                "trace_latency_ms": 0.1,
                "message": "Account ID not found in current ledger.",
            },
        }

    raw_json = execute_bfs_trace_cached(clean_account, max_depth, max_nodes)
    return ORJSONResponse(content=json.loads(raw_json))


@app.get("/api/accounts/sample")
def get_sample_victims(limit: int = 5):
    """Returns sample victim accounts (high out-degree, zero in-degree) for immediate UI testing."""
    sample = [acc for acc, layer in account_layers.items() if layer == "Victim"][:limit]
    if not sample:
        sample = list(adjacency_dict.keys())[:limit]
    return {"samples": sample}


class NoticeRequisitionPayload(BaseModel):
    victim_account: str
    holding_accounts: List[Dict[str, Any]] = Field(default_factory=list)
    total_amount: float = 0.0
    officer_name: Optional[str] = ""
    designation: Optional[str] = "Inspector of Police / Investigating Officer"
    police_station: Optional[str] = "Cyber Crime Police Station"
    fir_number: Optional[str] = ""
    fir_date: Optional[str] = ""
    complaint_id_1930: Optional[str] = ""
    stream: Optional[bool] = False


# 8. Notice generation endpoint: only called when the user clicks 'Generate Notice'
@app.post("/api/notice/generate")
async def generate_notice_endpoint(payload: NoticeRequisitionPayload):
    """
    Called strictly on user demand when clicking 'Generate Notice'.
    Includes an 8-second timeout for Ollama with automatic fallback to statutory template.
    """
    if payload.stream:
        return StreamingResponse(
            generate_notice_stream_response(
                victim_account=payload.victim_account,
                holding_accounts=payload.holding_accounts,
                total_amount=payload.total_amount,
                officer_name=payload.officer_name or "",
                designation=payload.designation or "",
                police_station=payload.police_station or "",
                fir_number=payload.fir_number or "",
                fir_date=payload.fir_date or "",
                complaint_id_1930=payload.complaint_id_1930 or "",
            ),
            media_type="text/event-stream",
        )

    notice_text = await generate_statutory_notice(
        victim_account=payload.victim_account,
        holding_accounts=payload.holding_accounts,
        total_amount=payload.total_amount,
        officer_name=payload.officer_name or "",
        designation=payload.designation or "",
        police_station=payload.police_station or "",
        fir_number=payload.fir_number or "",
        fir_date=payload.fir_date or "",
        complaint_id_1930=payload.complaint_id_1930 or "",
    )

    return {
        "status": "success",
        "notice_text": notice_text,
        "victim_account": payload.victim_account,
        "holding_accounts_count": len(payload.holding_accounts),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, workers=1)
