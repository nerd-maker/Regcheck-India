# backend/routers/workspace.py
# CRUD endpoints for all 5 workspace entities:
# submissions, documents, applications, registrations, ha_correspondence

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
import json
import os
import uuid
from datetime import datetime
from db import get_conn

router = APIRouter(prefix="/api/v1", tags=["Workspace"])

# ── Helper: asyncpg row → dict with JSONB fields parsed ───────────


def row_to_dict(row) -> dict:
    """Convert an asyncpg Record to a plain dict, parsing JSONB strings."""
    if row is None:
        return {}
    d = dict(row)
    for k, v in d.items():
        # Parse stringified JSON (asyncpg may return JSONB as str)
        if isinstance(v, str):
            stripped = v.strip()
            if (stripped.startswith('[') or stripped.startswith('{')):
                try:
                    d[k] = json.loads(stripped)
                except Exception:
                    pass
        # Serialize datetime objects to ISO strings
        if hasattr(v, 'isoformat'):
            d[k] = v.isoformat()
    return d


def rows_to_list(rows) -> List[dict]:
    return [row_to_dict(r) for r in rows]


# ── SUBMISSIONS ───────────────────────────────────────────────────


# @router.get("/submissions")
# async def list_submissions(
#     state: Optional[str] = Query(None),
#     type: Optional[str] = Query(None),
#     phase: Optional[str] = Query(None),
#     search: Optional[str] = Query(None),
# ):
#     conn = await get_conn()
#     try:
#         rows = await conn.fetch(
#             "SELECT * FROM submissions ORDER BY created_at DESC"
#         )
#         results = rows_to_list(rows)
#         if state:
#             results = [r for r in results if r.get('state') == state]
#         if type:
#             results = [r for r in results if r.get('type') == type]
#         if phase:
#             results = [r for r in results if r.get('phase') == phase]
#         if search:
#             q = search.lower()
#             results = [r for r in results if
#                        q in r.get('name', '').lower() or
#                        q in r.get('number', '').lower() or
#                        q in r.get('product', '').lower()]
#         return results
#     finally:
#         await conn.close()



class SubmissionCreate(BaseModel):
    name: str
    type: str
    product: str
    indication: str
    phase: str
    ha_authority: str = "CDSCO"
    target_submit_date: Optional[str] = None
    risk_level: str = "medium"
    frameworks: List[str] = []
    application_id: Optional[str] = None


# @router.post("/submissions")
# async def create_submission(body: SubmissionCreate):
#     conn = await get_conn()
#     try:
#         sid = f"s-{uuid.uuid4().hex[:8]}"
#         count = await conn.fetchval("SELECT COUNT(*) FROM submissions")
#         number = f"RC-SUB-{datetime.now().year}-{str(int(count) + 1).zfill(4)}"
#         now_str = datetime.now().strftime("%-d %b %Y, %H:%M") if os.name != 'nt' \
#             else datetime.now().strftime("%d %b %Y, %H:%M")
# 
#         await conn.execute("""
#             INSERT INTO submissions (
#                 id, number, name, type, product, indication, state,
#                 ha_authority, phase, owner_id, owner_name, owner_initials,
#                 owner_role, target_submit_date, risk_level, documents,
#                 open_gaps, compliance_score, frameworks, application_id,
#                 updated_at
#             ) VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,
#                       'p1','Anika Sharma','AS','Regulatory Lead',
#                       $9,$10,0,0,0,$11,$12,$13)
#         """, sid, number, body.name, body.type, body.product,
#             body.indication, body.ha_authority, body.phase,
#             body.target_submit_date, body.risk_level,
#             json.dumps(body.frameworks), body.application_id, now_str)
# 
#         row = await conn.fetchrow(
#             "SELECT * FROM submissions WHERE id=$1", sid
#         )
#         return row_to_dict(row)
#     finally:
#         await conn.close()



# @router.get("/submissions/{submission_id}")
# async def get_submission(submission_id: str):
#     conn = await get_conn()
#     try:
#         row = await conn.fetchrow(
#             "SELECT * FROM submissions WHERE id=$1", submission_id
#         )
#         if not row:
#             raise HTTPException(status_code=404, detail="Submission not found")
#         return row_to_dict(row)
#     finally:
#         await conn.close()



# @router.patch("/submissions/{submission_id}")
# async def update_submission(submission_id: str, body: dict):
#     conn = await get_conn()
#     try:
#         allowed = ['state', 'state_label', 'compliance_score',
#                    'open_gaps', 'documents', 'risk_level', 'updated_at',
#                    'target_submit_date']
#         updates = {k: v for k, v in body.items() if k in allowed}
#         if not updates:
#             raise HTTPException(status_code=400, detail="No valid fields to update")
#         for k, v in updates.items():
#             await conn.execute(
#                 f"UPDATE submissions SET {k}=$1 WHERE id=$2", v, submission_id
#             )
#         row = await conn.fetchrow(
#             "SELECT * FROM submissions WHERE id=$1", submission_id
#         )
#         if not row:
#             raise HTTPException(status_code=404, detail="Submission not found")
#         return row_to_dict(row)
#     finally:
#         await conn.close()



# ── DOCUMENTS ─────────────────────────────────────────────────────


@router.get("/documents")
@router.get("/documents/")
async def list_documents(
    submission_id: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    conn = await get_conn()
    try:
        if submission_id:
            rows = await conn.fetch(
                "SELECT * FROM documents WHERE submission_id=$1 "
                "ORDER BY created_at DESC", submission_id
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM documents ORDER BY created_at DESC"
            )
        results = rows_to_list(rows)
        if state:
            results = [r for r in results if r.get('state') == state]
        if search:
            q = search.lower()
            results = [r for r in results if
                       q in r.get('name', '').lower() or
                       q in r.get('number', '').lower() or
                       q in r.get('classification', '').lower()]
        return results
    finally:
        await conn.close()


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    submission_id: Optional[str] = Query(None),
    document_type: str = Query("Protocol"),
    classification: str = Query("Clinical / Protocol"),
):
    """Upload a document file and create a document record."""
    conn = await get_conn()
    try:
        content = await file.read()
        file_size_kb = round(len(content) / 1024, 1)
        size_str = (f"{file_size_kb} KB" if file_size_kb < 1024
                    else f"{round(file_size_kb / 1024, 1)} MB")

        did = f"d-{uuid.uuid4().hex[:8]}"
        count = await conn.fetchval("SELECT COUNT(*) FROM documents")
        number = f"DOC-{str(int(count) + 1).zfill(4)}"
        now_str = "just now"

        # Save file locally
        upload_dir = os.path.join(
            os.path.dirname(__file__), '..', 'uploads'
        )
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, f"{did}_{file.filename}")
        with open(file_path, 'wb') as f:
            f.write(content)

        await conn.execute("""
            INSERT INTO documents (
                id, number, name, type, classification, state,
                version, owner_id, owner_name, owner_initials,
                owner_role, country, language, size, updated_at,
                updated_by, submission_id, compliance_score,
                flags, file_path
            ) VALUES ($1,$2,$3,$4,$5,'draft','0.1','p1',
                      'Anika Sharma','AS','Regulatory Lead',
                      'India','en',$6,$7,'Anika Sharma',$8,
                      NULL,'[]',$9)
        """, did, number, file.filename, document_type,
            classification, size_str, now_str,
            submission_id, file_path)

        # Increment document count on submission
        if submission_id:
            await conn.execute("""
                UPDATE submissions
                SET documents = documents + 1
                WHERE id = $1
            """, submission_id)

        row = await conn.fetchrow(
            "SELECT * FROM documents WHERE id=$1", did
        )
        return row_to_dict(row)
    finally:
        await conn.close()


# ── APPLICATIONS ──────────────────────────────────────────────────


class ApplicationCreate(BaseModel):
    product: str
    sponsor: str
    type: str
    owner_name: str
    owner_initials: str


@router.post("/applications")
async def create_application(body: ApplicationCreate):
    conn = await get_conn()
    try:
        aid = f"a-{uuid.uuid4().hex[:8]}"
        year = datetime.now().year
        count = await conn.fetchval("SELECT COUNT(*) FROM applications")
        number = f"APP-{year}-{str(int(count) + 1).zfill(3)}"
        opened_at = datetime.now().strftime("%d %b %Y")
        
        await conn.execute("""
            INSERT INTO applications (
                id, number, product, sponsor, type, status,
                submissions, registrations, owner_id, owner_name,
                owner_initials, owner_role, opened_at
            ) VALUES ($1, $2, $3, $4, $5, 'Active', 0, 0, $1, $6, $7, 'Regulatory Lead', $8)
        """, aid, number, body.product, body.sponsor, body.type, body.owner_name, body.owner_initials, opened_at)
        
        row = await conn.fetchrow("SELECT * FROM applications WHERE id=$1", aid)
        return row_to_dict(row)
    finally:
        await conn.close()


@router.get("/applications")
async def list_applications(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            "SELECT * FROM applications ORDER BY created_at DESC"
        )
        results = rows_to_list(rows)
        if status:
            results = [r for r in results if r.get('status') == status]
        if search:
            q = search.lower()
            results = [r for r in results if
                       q in r.get('product', '').lower() or
                       q in r.get('number', '').lower() or
                       q in r.get('sponsor', '').lower()]
        return results
    finally:
        await conn.close()


# ── REGISTRATIONS ─────────────────────────────────────────────────


class RegistrationCreate(BaseModel):
    product: str
    certificate: str
    market: str = "India"
    application_id: Optional[str] = None
    approved_date: str
    expiry_date: str


@router.post("/registrations")
async def create_registration(body: RegistrationCreate):
    conn = await get_conn()
    try:
        rid = f"r-{uuid.uuid4().hex[:8]}"
        year = datetime.now().year
        count = await conn.fetchval("SELECT COUNT(*) FROM registrations")
        number = f"REG-{year}-{str(int(count) + 1).zfill(3)}"
        
        def format_date(d_str: str) -> str:
            try:
                dt = datetime.strptime(d_str, "%Y-%m-%d")
                return dt.strftime("%d %b %Y")
            except Exception:
                return d_str

        app_date = format_date(body.approved_date)
        exp_date = format_date(body.expiry_date)
        
        app_id = body.application_id.strip() if body.application_id else None
        if app_id == "":
            app_id = None
        
        await conn.execute("""
            INSERT INTO registrations (
                id, number, product, certificate, market, state,
                approved_date, expiry_date, application_id
            ) VALUES ($1, $2, $3, $4, $5, 'Effective', $6, $7, $8)
        """, rid, number, body.product, body.certificate, body.market, app_date, exp_date, app_id)
        
        if app_id:
            await conn.execute("""
                UPDATE applications SET registrations = registrations + 1 WHERE id = $1
            """, app_id)
            
        row = await conn.fetchrow("SELECT * FROM registrations WHERE id=$1", rid)
        return row_to_dict(row)
    finally:
        await conn.close()


@router.get("/registrations")
async def list_registrations(
    state: Optional[str] = Query(None),
    application_id: Optional[str] = Query(None),
):
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            "SELECT * FROM registrations ORDER BY created_at DESC"
        )
        results = rows_to_list(rows)
        if state:
            results = [r for r in results if r.get('state') == state]
        if application_id:
            results = [r for r in results
                       if r.get('application_id') == application_id]
        return results
    finally:
        await conn.close()


# ── HA CORRESPONDENCE ─────────────────────────────────────────────


# @router.get("/correspondence")
# async def list_correspondence(
#     state: Optional[str] = Query(None),
#     submission_id: Optional[str] = Query(None),
#     priority: Optional[str] = Query(None),
# ):
#     conn = await get_conn()
#     try:
#         rows = await conn.fetch(
#             "SELECT * FROM ha_correspondence ORDER BY created_at DESC"
#         )
#         results = rows_to_list(rows)
#         if state:
#             results = [r for r in results if r.get('state') == state]
#         if submission_id:
#             results = [r for r in results
#                        if r.get('submission_id') == submission_id]
#         if priority:
#             results = [r for r in results if r.get('priority') == priority]
#         return results
#     finally:
#         await conn.close()



@router.patch("/correspondence/{corr_id}")
async def update_correspondence(corr_id: str, body: dict):
    conn = await get_conn()
    try:
        allowed = ['state', 'priority']
        updates = {k: v for k, v in body.items() if k in allowed}
        if not updates:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        for k, v in updates.items():
            await conn.execute(
                f"UPDATE ha_correspondence SET {k}=$1 WHERE id=$2",
                v, corr_id
            )
        row = await conn.fetchrow(
            "SELECT * FROM ha_correspondence WHERE id=$1", corr_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Correspondence not found")
        return row_to_dict(row)
    finally:
        await conn.close()


# ── HA CORRESPONDENCE STATE MACHINE ──────────────────────────────────────────

VALID_CORR_TRANSITIONS = {
    'open': ['response-drafted', 'closed'],
    'response-drafted': ['open', 'closed'],
    'closed': [],
}


# @router.post("/correspondence")
# async def create_correspondence(body: dict):
#     """Create a new HA correspondence item."""
#     conn = await get_conn()
#     try:
#         cid = f"h-{uuid.uuid4().hex[:8]}"
#         count = await conn.fetchval(
#             "SELECT COUNT(*) FROM ha_correspondence"
#         )
#         number = (
#             f"CDSCO-Q-{datetime.now().year}-"
#             f"{str(count + 1).zfill(4)}"
#         )
#         await conn.execute("""
#             INSERT INTO ha_correspondence (
#                 id, number, subject, direction, authority,
#                 category, submission_id, received_at, due_at,
#                 state, priority, preview
#             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10,$11)
#         """,
#             cid, number,
#             body.get('subject', 'New correspondence'),
#             body.get('direction', 'inbound'),
#             body.get('authority', 'CDSCO'),
#             body.get('category', 'Query'),
#             body.get('submission_id'),
#             body.get('received_at', datetime.now().strftime('%Y-%m-%d')),
#             body.get('due_at'),
#             body.get('priority', 'standard'),
#             body.get('preview', ''),
#         )
#         row = await conn.fetchrow(
#             "SELECT * FROM ha_correspondence WHERE id=$1", cid
#         )
#         return row_to_dict(row)
#     finally:
#         await conn.close()



# @router.patch("/correspondence/{corr_id}/state")
# async def transition_correspondence_state(corr_id: str, body: dict):
#     """
#     State machine transition for correspondence.
#     Valid transitions: open → response-drafted → closed
#     """
#     conn = await get_conn()
#     try:
#         row = await conn.fetchrow(
#             "SELECT * FROM ha_correspondence WHERE id=$1", corr_id
#         )
#         if not row:
#             raise HTTPException(status_code=404, detail="Not found")
# 
#         current = row['state']
#         new_state = body.get('state')
#         allowed = VALID_CORR_TRANSITIONS.get(current, [])
# 
#         if new_state not in allowed:
#             raise HTTPException(
#                 status_code=400,
#                 detail=(
#                     f"Cannot transition from '{current}' to '{new_state}'. "
#                     f"Allowed: {allowed}"
#                 )
#             )
# 
#         await conn.execute(
#             "UPDATE ha_correspondence SET state=$1 WHERE id=$2",
#             new_state, corr_id
#         )
#         updated = await conn.fetchrow(
#             "SELECT * FROM ha_correspondence WHERE id=$1", corr_id
#         )
#         return row_to_dict(updated)
#     finally:
#         await conn.close()



# ── GAP REMEDIATIONS ─────────────────────────────────────────────────────────


class RemediationCreate(BaseModel):
    submission_id: Optional[str] = None
    document_id: Optional[str] = None
    agent_id: str
    agent_name: str
    agent_run_id: Optional[str] = None
    gap_text: str
    severity: str = "major"
    framework: Optional[str] = None
    section_ref: Optional[str] = None
    owner_name: str = "Anika Sharma"
    owner_initials: str = "AS"
    due_date: Optional[str] = None


class RemediationUpdate(BaseModel):
    status: Optional[str] = None
    owner_name: Optional[str] = None
    owner_initials: Optional[str] = None
    due_date: Optional[str] = None
    resolution_note: Optional[str] = None


@router.get("/remediations/summary")
async def remediations_summary(
    submission_id: Optional[str] = Query(None)
):
    """Summary counts for dashboard KPI widget."""
    conn = await get_conn()
    try:
        base = "FROM gap_remediations"
        where = ""
        if submission_id:
            where = f" WHERE submission_id='{submission_id}'"
        rows = await conn.fetch(f"""
            SELECT severity, status, COUNT(*) as count
            {base}{where}
            GROUP BY severity, status
        """)
        result: dict = {
            'critical': {'open': 0, 'in_progress': 0, 'resolved': 0},
            'major':    {'open': 0, 'in_progress': 0, 'resolved': 0},
            'minor':    {'open': 0, 'in_progress': 0, 'resolved': 0},
        }
        for row in rows:
            sev = row['severity']
            st = row['status'].replace('-', '_')
            if sev in result and st in result[sev]:
                result[sev][st] = row['count']
        total_open = sum(v['open'] for v in result.values())
        return {
            **result,
            'total_open': total_open,
            'submission_id': submission_id,
        }
    finally:
        await conn.close()


@router.post("/remediations")
async def create_remediation(body: RemediationCreate):
    """Promote an AI-detected gap to a tracked remediation task."""
    conn = await get_conn()
    try:
        rid = f"r-{uuid.uuid4().hex[:8]}"
        await conn.execute("""
            INSERT INTO gap_remediations (
                id, submission_id, document_id, agent_id,
                agent_name, agent_run_id, gap_text, severity,
                framework, section_ref, status, owner_name,
                owner_initials, due_date
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',$11,$12,$13
            )
        """,
            rid, body.submission_id, body.document_id,
            body.agent_id, body.agent_name, body.agent_run_id,
            body.gap_text, body.severity, body.framework,
            body.section_ref, body.owner_name,
            body.owner_initials, body.due_date,
        )
        row = await conn.fetchrow(
            "SELECT * FROM gap_remediations WHERE id=$1", rid
        )
        return row_to_dict(row)
    finally:
        await conn.close()


@router.get("/remediations")
async def list_remediations(
    submission_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
):
    conn = await get_conn()
    try:
        rows = await conn.fetch("""
            SELECT * FROM gap_remediations
            ORDER BY
                CASE severity
                    WHEN 'critical' THEN 1
                    WHEN 'major' THEN 2
                    WHEN 'minor' THEN 3
                    ELSE 4
                END,
                created_at DESC
        """)
        results = rows_to_list(rows)
        if submission_id:
            results = [r for r in results
                       if r.get('submission_id') == submission_id]
        if status:
            results = [r for r in results if r['status'] == status]
        if severity:
            results = [r for r in results if r['severity'] == severity]
        return results
    finally:
        await conn.close()


@router.patch("/remediations/{rem_id}")
async def update_remediation(rem_id: str, body: RemediationUpdate):
    conn = await get_conn()
    try:
        updates = body.dict(exclude_none=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        updates['updated_at'] = datetime.now()
        for k, v in updates.items():
            await conn.execute(
                f"UPDATE gap_remediations SET {k}=$1 WHERE id=$2", v, rem_id
            )
        row = await conn.fetchrow(
            "SELECT * FROM gap_remediations WHERE id=$1", rem_id
        )
        return row_to_dict(row)
    finally:
        await conn.close()


@router.delete("/remediations/{rem_id}")
async def delete_remediation(rem_id: str):
    conn = await get_conn()
    try:
        await conn.execute(
            "DELETE FROM gap_remediations WHERE id=$1", rem_id
        )
        return {"deleted": rem_id}
    finally:
        await conn.close()

