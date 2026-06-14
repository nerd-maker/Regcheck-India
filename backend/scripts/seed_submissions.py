import os
import sys
import asyncio
import json
import uuid
from datetime import datetime

# Add parent directory to sys.path to resolve backend imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db import get_conn, init_all_tables

DEMO_SUBMISSIONS = [
    {
        "name": "ZP-101 Phase II CT Permission Application",
        "type": "CT-04",
        "phase": "Phase II",
        "product": "Zalpifylline 400mg Tablets",
        "indication": "Type 2 Diabetes Mellitus",
        "ha_authority": "CDSCO",
        "state": "under_review",
        "state_label": "Under Review",
        "owner_name": "Anika Sharma",
        "owner_initials": "AS",
        "owner_role": "Regulatory Lead",
        "risk_level": "high",
        "compliance_score": 65,
        "open_gaps": 5,
        "frameworks": ["Schedule Y", "ICH E6(R3)", "NDCTR 2019"],
    },
    {
        "name": "ZP-101 Investigator Brochure v3.0 Submission",
        "type": "IND",
        "phase": "Phase II",
        "product": "Zalpifylline 400mg Tablets",
        "indication": "Type 2 Diabetes Mellitus",
        "ha_authority": "CDSCO",
        "state": "draft",
        "state_label": "Draft",
        "owner_name": "Rajat Mehta",
        "owner_initials": "RM",
        "owner_role": "RA Specialist",
        "risk_level": "medium",
        "compliance_score": 0,
        "open_gaps": 0,
        "frameworks": ["Schedule Y", "ICH E6(R3)"],
    },
    {
        "name": "CTRI Registration — ZP-101 Phase II",
        "type": "CT-04",
        "phase": "Phase II",
        "product": "Zalpifylline 400mg Tablets",
        "indication": "Type 2 Diabetes Mellitus",
        "ha_authority": "CTRI",
        "state": "approved",
        "state_label": "Approved",
        "owner_name": "Anika Sharma",
        "owner_initials": "AS",
        "owner_role": "Regulatory Lead",
        "risk_level": "low",
        "compliance_score": 92,
        "open_gaps": 0,
        "frameworks": ["CTRI Guidelines", "NDCTR 2019"],
    },
]


async def seed_demo_submissions(conn) -> None:
    # Clean up legacy submissions
    deleted_status = await conn.execute("DELETE FROM submissions WHERE number LIKE 'RC-SUB-%'")
    print(f"Cleaned up legacy submissions status: {deleted_status}")

    count = await conn.fetchval("SELECT COUNT(*) FROM submissions WHERE number LIKE 'SUB-%'")
    if count > 0:
        print(f"Skipping seed: submissions table already contains {count} real SUB-format records.")
        return

    print(f"Seeding {len(DEMO_SUBMISSIONS)} demo submissions...")
    for i, sub in enumerate(DEMO_SUBMISSIONS):
        sub_id = f"s-seed-{uuid.uuid4().hex[:6]}"
        number = f"SUB-{datetime.now().year}-{str(i + 1).zfill(3)}"
        now_str = datetime.now().strftime("%d %b %Y, %H:%M")

        await conn.execute("""
            INSERT INTO submissions (
                id, number, name, type, product, indication,
                state, state_label, ha_authority, phase,
                owner_id, owner_name, owner_initials, owner_role,
                target_submit_date, risk_level, documents, open_gaps,
                compliance_score, frameworks, application_id, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10,
                $11, $12, $13, $14,
                $15, $16, 0, $17,
                $18, $19::jsonb, NULL, $20
            )
        """,
            sub_id, number, sub["name"], sub["type"],
            sub["product"], sub["indication"], sub["state"],
            sub["state_label"], sub["ha_authority"], sub["phase"],
            f"p{i+1}",  # owner_id = p1, p2, p3
            sub["owner_name"], sub["owner_initials"], sub["owner_role"],
            datetime.now().strftime("%Y-%m-%d"),  # target_submit_date
            sub["risk_level"], sub["open_gaps"], sub["compliance_score"],
            json.dumps(sub["frameworks"]), now_str
        )
    print("Demo submissions seeded successfully.")


async def seed() -> None:
    if not os.getenv("DATABASE_URL"):
        print("DATABASE_URL not set — skipping seeding.")
        return

    print("Initializing database tables...")
    await init_all_tables()

    conn = await get_conn()
    try:
        await seed_demo_submissions(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
