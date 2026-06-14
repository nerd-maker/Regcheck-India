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

DEMO_APPLICATIONS = [
    {
        "product": "Zalpifylline 400mg Tablets",
        "sponsor": "ZP Pharma Pvt Ltd",
        "type": "IND",
        "status": "Active",
        "owner_name": "Anika Sharma",
        "owner_initials": "AS",
        "owner_role": "Regulatory Lead",
        "submissions": 1,
        "registrations": 0,
    },
    {
        "product": "BX-400 Injection",
        "sponsor": "BioXcel India Ltd",
        "type": "NDA",
        "status": "Pending CDSCO",
        "owner_name": "Karan Bhatt",
        "owner_initials": "KB",
        "owner_role": "RA Manager",
        "submissions": 2,
        "registrations": 1,
    },
]

DEMO_REGISTRATIONS = [
    {
        "product": "BX-400 Injection",
        "certificate": "Marketing Authorization",
        "market": "India",
        "state": "Effective",
        "approved_date": "2024-03-15",
        "expiry_date": "2029-03-14",
    },
]

DEMO_CORRESPONDENCE = [
    {
        "subject": "Deficiency Letter – BX-400 CT-04 SAE Narrative",
        "direction": "inbound",
        "authority": "CDSCO",
        "category": "Deficiency Letter",
        "product": "BX-400 Injection",
        "received_at": "2026-06-01",
        "due_at": "2026-06-15",
        "state": "open",
        "priority": "critical",
        "preview": "CDSCO has issued a deficiency notice regarding inadequate causality assessment."
    },
    {
        "subject": "Query – ZP-101 Protocol v2 Dose Justification",
        "direction": "inbound",
        "authority": "CDSCO",
        "category": "Query",
        "product": "Zalpifylline 400mg Tablets",
        "received_at": "2026-06-05",
        "due_at": "2026-06-20",
        "state": "response-drafted",
        "priority": "high",
        "preview": "Justify the choice of 400 mg starting dose for ZP-101."
    },
    {
        "subject": "Acknowledgement – BX-400 NDA Submission",
        "direction": "inbound",
        "authority": "CDSCO",
        "category": "Acknowledgement",
        "product": "BX-400 Injection",
        "received_at": "2026-05-10",
        "due_at": None,
        "state": "closed",
        "priority": "standard",
        "preview": "CDSCO acknowledges receipt of NDA submission for BX-400."
    }
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

        # Lookup application_id if exists
        app_id = await conn.fetchval("SELECT id FROM applications WHERE product = $1 LIMIT 1", sub["product"])

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
                $18, $19::jsonb, $20, $21
            )
        """,
            sub_id, number, sub["name"], sub["type"],
            sub["product"], sub["indication"], sub["state"],
            sub["state_label"], sub["ha_authority"], sub["phase"],
            f"p{i+1}",
            sub["owner_name"], sub["owner_initials"], sub["owner_role"],
            datetime.now().strftime("%Y-%m-%d"),
            sub["risk_level"], sub["open_gaps"], sub["compliance_score"],
            json.dumps(sub["frameworks"]), app_id, now_str
        )
    print("Demo submissions seeded successfully.")


async def seed_demo_applications(conn) -> None:
    # Clean up legacy applications
    deleted_status = await conn.execute("DELETE FROM applications WHERE number LIKE 'RC-APP-%'")
    print(f"Cleaned up legacy applications status: {deleted_status}")

    count = await conn.fetchval("SELECT COUNT(*) FROM applications WHERE number LIKE 'APP-%'")
    if count > 0:
        print(f"Skipping seed: applications table already contains {count} real APP-format records.")
        return

    print(f"Seeding {len(DEMO_APPLICATIONS)} demo applications...")
    for i, app in enumerate(DEMO_APPLICATIONS):
        app_id = f"a-seed-{uuid.uuid4().hex[:6]}"
        number = f"APP-{datetime.now().year}-{str(i + 1).zfill(3)}"
        opened_at = datetime.now().strftime("%d %b %Y")
        
        await conn.execute("""
            INSERT INTO applications (
                id, number, product, sponsor, type, status,
                submissions, registrations, owner_id, owner_name,
                owner_initials, owner_role, opened_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $1, $9, $10, $11, $12)
        """,
            app_id, number, app["product"], app["sponsor"], app["type"], app["status"],
            app["submissions"], app["registrations"], app["owner_name"],
            app["owner_initials"], app["owner_role"], opened_at
        )
    print("Demo applications seeded successfully.")


async def seed_demo_registrations(conn) -> None:
    # Clean up legacy registrations (not starting with REG-)
    deleted_status = await conn.execute("DELETE FROM registrations WHERE number NOT LIKE 'REG-%'")
    print(f"Cleaned up legacy registrations status: {deleted_status}")

    count = await conn.fetchval("SELECT COUNT(*) FROM registrations WHERE number LIKE 'REG-%'")
    if count > 0:
        print(f"Skipping seed: registrations table already contains {count} real REG-format records.")
        return

    print(f"Seeding {len(DEMO_REGISTRATIONS)} demo registrations...")
    for i, reg in enumerate(DEMO_REGISTRATIONS):
        reg_id = f"r-seed-{uuid.uuid4().hex[:6]}"
        number = f"REG-{datetime.now().year}-{str(i + 1).zfill(3)}"
        
        app_id = await conn.fetchval("SELECT id FROM applications WHERE product = $1 LIMIT 1", reg["product"])
        
        def format_seed_date(d_str: str) -> str:
            try:
                dt = datetime.strptime(d_str, "%Y-%m-%d")
                return dt.strftime("%d %b %Y")
            except Exception:
                return d_str

        app_date = format_seed_date(reg["approved_date"])
        exp_date = format_seed_date(reg["expiry_date"])
        
        await conn.execute("""
            INSERT INTO registrations (
                id, number, product, certificate, market, state,
                approved_date, expiry_date, application_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
            reg_id, number, reg["product"], reg["certificate"],
            reg["market"], reg["state"], app_date, exp_date, app_id
        )
    print("Demo registrations seeded successfully.")


async def seed_demo_correspondence(conn) -> None:
    # Clean up legacy correspondence (starting with CDSCO-)
    deleted_status = await conn.execute("DELETE FROM ha_correspondence WHERE number LIKE 'CDSCO-%'")
    print(f"Cleaned up legacy correspondence status: {deleted_status}")

    count = await conn.fetchval("SELECT COUNT(*) FROM ha_correspondence WHERE number LIKE 'HA-%'")
    if count > 0:
        print(f"Skipping seed: ha_correspondence table already contains {count} real HA-format records.")
        return

    print(f"Seeding {len(DEMO_CORRESPONDENCE)} demo correspondence...")
    for i, corr in enumerate(DEMO_CORRESPONDENCE):
        corr_id = f"h-seed-{uuid.uuid4().hex[:6]}"
        number = f"HA-{datetime.now().year}-{str(i + 1).zfill(3)}"
        
        # Try to find a submission for this product
        sub_id = await conn.fetchval("SELECT id FROM submissions WHERE product = $1 LIMIT 1", corr["product"])

        await conn.execute("""
            INSERT INTO ha_correspondence (
                id, number, subject, direction, authority, category,
                submission_id, received_at, due_at, state, priority, preview
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        """,
            corr_id, number, corr["subject"], corr["direction"],
            corr["authority"], corr["category"], sub_id,
            corr["received_at"], corr["due_at"], corr["state"],
            corr["priority"], corr["preview"]
        )
    print("Demo correspondence seeded successfully.")


async def seed() -> None:
    if not os.getenv("DATABASE_URL"):
        print("DATABASE_URL not set — skipping seeding.")
        return

    print("Initializing database tables...")
    await init_all_tables()

    conn = await get_conn()
    try:
        await seed_demo_applications(conn)
        await seed_demo_submissions(conn)
        await seed_demo_registrations(conn)
        await seed_demo_correspondence(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
