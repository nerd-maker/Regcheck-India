from fastapi import APIRouter, HTTPException
from db import get_conn
import logging
from datetime import datetime, timezone
import json
from typing import Any

router = APIRouter(prefix="/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)

# Empty-state defaults returned when DB is unavailable
_EMPTY_KPIS = {
    "active_submissions": 0,
    "open_critical_gaps": 0,
    "ha_queries_pending": 0,
    "avg_compliance_score": None,
    "total_vault_documents": 0,
    "documents_by_state": {},
    "computed_at": None,
}


def row_to_dict(row: Any) -> dict[str, Any]:
    """Convert an asyncpg Record to a plain dict, parsing JSONB strings."""
    if row is None:
        return {}
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, str):
            stripped = v.strip()
            if (stripped.startswith('[') or stripped.startswith('{')):
                try:
                    d[k] = json.loads(stripped)
                except Exception:
                    pass
        elif hasattr(v, 'isoformat'):
            d[k] = v.isoformat()
    return d


@router.get("/dashboard-kpis")
async def get_dashboard_kpis() -> dict:
    """
    Returns all KPI values for the Home dashboard strip.
    Computes from real tables — no mockup values.
    Returns zeros gracefully when database is unavailable.
    """
    conn = await get_conn()
    if conn is None:
        return {**_EMPTY_KPIS, "computed_at": datetime.now(timezone.utc).isoformat()}
    try:
        # Active submissions (not archived, not approved)
        active_submissions = await conn.fetchval(
            "SELECT COUNT(*) FROM submissions WHERE state NOT IN ('archived', 'approved')"
        )

        # Open critical gaps = sum of open_gaps across active submissions
        open_gaps = await conn.fetchval(
            "SELECT COALESCE(SUM(open_gaps), 0) FROM submissions WHERE state NOT IN ('archived')"
        )

        # HA queries pending = open + response-drafted correspondence items
        ha_pending = await conn.fetchval(
            "SELECT COUNT(*) FROM ha_correspondence WHERE state IN ('open', 'response-drafted')"
        )

        # Avg compliance score from completed vault scans (last 30 days)
        avg_score = await conn.fetchval("""
            SELECT ROUND(AVG(score))
            FROM vault_compliance_scans
            WHERE status = 'completed'
              AND created_at >= NOW() - INTERVAL '30 days'
        """)

        # Total vault documents
        total_docs = await conn.fetchval(
            "SELECT COUNT(*) FROM vault_documents WHERE lifecycle_state != 'superseded'"
        )

        # Documents by lifecycle state
        state_counts = await conn.fetch(
            "SELECT lifecycle_state, COUNT(*) as count FROM vault_documents GROUP BY lifecycle_state"
        )

        return {
            "active_submissions": active_submissions or 0,
            "open_critical_gaps": open_gaps or 0,
            "ha_queries_pending": ha_pending or 0,
            "avg_compliance_score": int(avg_score) if avg_score is not None else None,
            "total_vault_documents": total_docs or 0,
            "documents_by_state": {r["lifecycle_state"]: r["count"] for r in state_counts},
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("Failed to fetch dashboard KPIs", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard KPIs: {e}")
    finally:
        await conn.close()


@router.get("/compliance-by-agent")
async def get_compliance_by_agent() -> dict:
    """
    Returns average compliance score per agent type.
    Used by the 'Compliance across frameworks' card in Reports.
    Only includes completed scans. Groups by scan_type.
    """
    conn = await get_conn()
    if conn is None:
        return {"frameworks": [], "computed_at": datetime.now(timezone.utc).isoformat()}
    try:
        rows = await conn.fetch("""
            SELECT
                scan_type,
                ROUND(AVG(score)) as avg_score,
                COUNT(*) as scan_count,
                COUNT(CASE WHEN score >= 80 THEN 1 END) as compliant_count,
                COUNT(CASE WHEN score >= 60 AND score < 80 THEN 1 END) as needs_revision_count,
                COUNT(CASE WHEN score < 60 THEN 1 END) as non_compliant_count
            FROM vault_compliance_scans
            WHERE status = 'completed'
              AND score IS NOT NULL
            GROUP BY scan_type
            ORDER BY avg_score DESC
        """)

        AGENT_DISPLAY_NAMES = {
            "schedule_y":     "Schedule Y Check",
            "ich_e6r3":       "ICH E6(R3) GCP Compliance",
            "completeness":   "Document Completeness Check",
            "pii_anonymiser": "PII / PHI Anonymisation",
            "sae_classifier": "SAE Case Classification",
            "cross_doc":      "Cross-Document Consistency Check",
        }

        return {
            "frameworks": [
                {
                    "agent_type": r["scan_type"],
                    "display_name": AGENT_DISPLAY_NAMES.get(r["scan_type"], r["scan_type"].replace('_', ' ').title()),
                    "avg_score": int(r["avg_score"]) if r["avg_score"] is not None else None,
                    "scan_count": r["scan_count"],
                    "compliant_count": r["compliant_count"],
                    "needs_revision_count": r["needs_revision_count"],
                    "non_compliant_count": r["non_compliant_count"],
                }
                for r in rows
            ],
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("Failed to fetch compliance by agent", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch compliance by agent: {e}")
    finally:
        await conn.close()


@router.get("/submission-throughput")
async def get_submission_throughput() -> dict:
    """
    Returns submission counts grouped by month for the last 6 months.
    Used by the 'Submission throughput' card in Reports.
    """
    conn = await get_conn()
    if conn is None:
        return {"monthly_data": [], "computed_at": datetime.now(timezone.utc).isoformat()}
    try:
        rows = await conn.fetch("""
            SELECT
                TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month_label,
                DATE_TRUNC('month', created_at) as month_date,
                COUNT(*) as total,
                COUNT(CASE WHEN state = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN state IN ('draft', 'under_review', 'submitted') THEN 1 END) as in_progress
            FROM submissions
            WHERE created_at >= NOW() - INTERVAL '6 months'
              AND state != 'archived'
            GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY')
            ORDER BY month_date ASC
        """)

        return {
            "monthly_data": [
                {
                    "month": r["month_label"],
                    "total": r["total"],
                    "approved": r["approved"],
                    "in_progress": r["in_progress"],
                }
                for r in rows
            ],
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("Failed to fetch submission throughput", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch submission throughput: {e}")
    finally:
        await conn.close()


@router.get("/recent-activity")
async def get_recent_activity(limit: int = 20) -> dict:
    """
    Returns a unified activity feed from three sources:
    1. vault_document_audit — document uploads, state changes
    2. agent_runs — AI compliance scans completed
    3. ha_correspondence — new correspondence items created
    All merged and sorted by timestamp descending.
    """
    if limit > 100:
        limit = 100

    conn = await get_conn()
    if conn is None:
        return {
            "activities": [],
            "total": 0,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
    try:
        # Source 1: vault document audit entries
        doc_audit = await conn.fetch("""
            SELECT
                a.id::text as id,
                a.action,
                a.user_name,
                a.user_initials,
                a.from_state,
                a.to_state,
                a.note,
                a.created_at,
                d.title as document_title,
                d.doc_number
            FROM vault_document_audit a
            LEFT JOIN vault_documents d ON a.document_id = d.id
            ORDER BY a.created_at DESC
            LIMIT $1
        """, limit)

        # Source 2: agent runs (AI scans)
        agent_runs = await conn.fetch("""
            SELECT
                id::text as id,
                agent_id,
                agent_name,
                status,
                created_at,
                input_snippet,
                compliance_score
            FROM agent_runs
            ORDER BY created_at DESC
            LIMIT $1
        """, limit)

        # Source 3: recent correspondence
        correspondence = await conn.fetch("""
            SELECT
                id::text as id,
                number,
                subject,
                direction,
                authority,
                state,
                priority,
                created_at
            FROM ha_correspondence
            ORDER BY created_at DESC
            LIMIT $1
        """, limit)

        # Merge and normalise into unified activity items
        activities = []

        for r in doc_audit:
            action = r["action"]
            if action == "uploaded":
                label = f"Document uploaded: {r['document_title'] or 'Unknown'}"
                icon = "upload"
            elif action == "state_changed":
                label = f"{r['document_title'] or 'Document'} moved to {r['to_state'] or 'new state'}"
                icon = "transition"
            else:
                label = f"{action.replace('_', ' ').title()}: {r['document_title'] or 'Document'}"
                icon = "document"

            # Derive initials defensively if empty
            initials = r["user_initials"]
            if not initials and r["user_name"]:
                words = r["user_name"].split()
                initials = "".join([w[0].upper() for w in words if w])[:2]

            activities.append({
                "id": f"doc-{r['id']}",
                "type": "document",
                "icon": icon,
                "label": label,
                "sublabel": r["doc_number"] or "",
                "user_name": r["user_name"] or "System",
                "user_initials": initials or "SYS",
                "timestamp": r["created_at"].isoformat() if r["created_at"] else None,
            })

        for r in agent_runs:
            score_str = f" · Score: {int(r['compliance_score'])}%" if r['compliance_score'] is not None else ""
            activities.append({
                "id": f"agent-{r['id']}",
                "type": "agent_run",
                "icon": "scan",
                "label": f"AI Compliance Scan: {r['agent_name']}",
                "sublabel": f"{r['status'].capitalize()}{score_str}",
                "user_name": "System",
                "user_initials": "AI",
                "timestamp": r["created_at"].isoformat() if r["created_at"] else None,
            })

        for r in correspondence:
            activities.append({
                "id": f"corr-{r['id']}",
                "type": "correspondence",
                "icon": "mail",
                "label": f"HA Correspondence: {r['subject']}",
                "sublabel": f"{r['authority']} — {r['number']}",
                "user_name": "System",
                "user_initials": "HA",
                "timestamp": r["created_at"].isoformat() if r["created_at"] else None,
            })

        # Sort all by timestamp descending
        activities.sort(
            key=lambda x: x["timestamp"] or "1970-01-01T00:00:00",
            reverse=True
        )

        return {
            "activities": activities[:limit],
            "total": len(activities),
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("Failed to fetch recent activity", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch recent activity: {e}")
    finally:
        await conn.close()
