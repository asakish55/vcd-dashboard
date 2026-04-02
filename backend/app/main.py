"""
VCD Dashboard - FastAPI Backend
Provides REST API for managing VMware Cloud Director resources.
"""

import uuid
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .vcd_client import VCDClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="VCD Dashboard API",
    description="VMware Cloud Director Resource Management Dashboard",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store  {session_id: VCDClient}
# For production use Redis or a proper session backend
sessions: dict[str, VCDClient] = {}


# ──────────────────────────────────────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    host: str           # e.g. https://vcd.example.com
    username: str       # e.g. administrator
    password: str
    org: str = "System" # Provider org is "System"


class UpdateVDCRequest(BaseModel):
    cpu_vcpu: Optional[int] = None    # Number of vCPUs (1 vCPU = 2 GHz)
    memory_gb: Optional[int] = None  # Memory in GB


class UpdateStorageRequest(BaseModel):
    limit_gb: int  # New storage limit in GB


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_session(session_id: str) -> VCDClient:
    client = sessions.get(session_id)
    if not client:
        raise HTTPException(
            status_code=401,
            detail="Session expired or not found. Please login again.",
        )
    return client


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "sessions": len(sessions)}


@app.post("/api/login")
async def login(req: LoginRequest):
    """Authenticate with VCD and create a dashboard session."""
    client = VCDClient(
        host=req.host,
        username=req.username,
        password=req.password,
        org=req.org,
    )
    try:
        await client.login()
    except Exception as e:
        logger.error(f"Login failed for {req.username}@{req.host}: {e}")
        raise HTTPException(status_code=401, detail=str(e))

    session_id = str(uuid.uuid4())
    sessions[session_id] = client
    logger.info(f"Session created: {session_id[:8]}... for {req.username}@{req.host}")
    return {
        "success": True,
        "session_id": session_id,
        "host": req.host,
        "username": req.username,
        "org": req.org,
    }


@app.post("/api/logout")
async def logout(session_id: str = Query(...)):
    """Invalidate session and close VCD connection."""
    client = sessions.pop(session_id, None)
    if client:
        await client.close()
    return {"success": True}


@app.get("/api/orgs")
async def get_orgs(session_id: str = Query(...)):
    """Return all organizations visible to the logged-in user."""
    client = _get_session(session_id)
    try:
        return await client.get_orgs()
    except Exception as e:
        logger.error(f"get_orgs failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/orgs/{org_id}/vdcs")
async def get_vdcs(org_id: str, session_id: str = Query(...)):
    """Return all VDCs for an organization with full resource details."""
    client = _get_session(session_id)
    try:
        return await client.get_vdcs_for_org(org_id)
    except Exception as e:
        logger.error(f"get_vdcs_for_org failed for {org_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/vdcs/{vdc_id}")
async def update_vdc(
    vdc_id: str,
    req: UpdateVDCRequest,
    session_id: str = Query(...),
):
    """Update VDC CPU (vCPUs) and/or Memory (GB) limits."""
    if req.cpu_vcpu is None and req.memory_gb is None:
        raise HTTPException(status_code=400, detail="Provide cpu_vcpu and/or memory_gb")
    client = _get_session(session_id)
    try:
        return await client.update_vdc_resources(
            vdc_id=vdc_id,
            cpu_vcpu=req.cpu_vcpu,
            memory_gb=req.memory_gb,
        )
    except Exception as e:
        logger.error(f"update_vdc failed for {vdc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/storage-profiles/{profile_id}")
async def update_storage(
    profile_id: str,
    req: UpdateStorageRequest,
    session_id: str = Query(...),
):
    """Update storage policy quota limit in GB."""
    if req.limit_gb < 1:
        raise HTTPException(status_code=400, detail="limit_gb must be >= 1")
    client = _get_session(session_id)
    try:
        return await client.update_storage_profile(profile_id, req.limit_gb)
    except Exception as e:
        logger.error(f"update_storage_profile failed for {profile_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
