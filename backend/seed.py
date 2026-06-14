# backend/seed.py
# Seeds the database with mockData equivalents on first run.
# Safe to call multiple times — uses INSERT ... ON CONFLICT DO NOTHING

import asyncio
import json
from db import get_conn, DATABASE_URL

PEOPLE = {
    'p1': {'id': 'p1', 'name': 'Anika Sharma', 'initials': 'AS', 'role': 'Regulatory Lead'},
    'p2': {'id': 'p2', 'name': 'Rajat Iyer', 'initials': 'RI', 'role': 'CMC Lead'},
    'p3': {'id': 'p3', 'name': 'Dr. Priya Menon', 'initials': 'PM', 'role': 'Clinical Lead'},
    'p4': {'id': 'p4', 'name': 'Karan Bhatt', 'initials': 'KB', 'role': 'Pharmacovigilance'},
    'p5': {'id': 'p5', 'name': 'Meera Nair', 'initials': 'MN', 'role': 'Quality Assurance'},
    'p6': {'id': 'p6', 'name': 'Vikram Joshi', 'initials': 'VJ', 'role': 'RA Specialist'},
}

SUBMISSIONS = [
    {'id': 's-001', 'number': 'RC-SUB-2025-0042', 'name': 'ZP-101 – IND Application',
     'type': 'IND', 'product': 'ZP-101', 'indication': 'Type 2 Diabetes Mellitus',
     'state': 'review', 'state_label': 'In CDSCO Review', 'ha_authority': 'CDSCO',
     'phase': 'Phase II', 'owner_id': 'p1', 'risk_level': 'medium',
     'target_submit_date': '2025-12-15', 'documents': 18, 'open_gaps': 4,
     'compliance_score': 72, 'frameworks': ['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)'],
     'application_id': 'a-001', 'updated_at': '12 minutes ago'},
    {'id': 's-002', 'number': 'RC-SUB-2025-0089', 'name': 'BX-400 – SAE Expedited Report',
     'type': 'CT-04', 'product': 'BX-400', 'indication': 'Complicated Urinary Tract Infection',
     'state': 'rejected', 'state_label': 'Deficiency Issued', 'ha_authority': 'CDSCO',
     'phase': 'Phase III', 'owner_id': 'p4', 'risk_level': 'high',
     'target_submit_date': '2025-10-30', 'documents': 6, 'open_gaps': 7,
     'compliance_score': 48, 'frameworks': ['NDCTR 2019', 'ICH E2A'],
     'application_id': 'a-002', 'updated_at': '1 hour ago'},
    {'id': 's-003', 'number': 'RC-SUB-2025-0117', 'name': 'BX-500 – Pre-IND Briefing',
     'type': 'Pre-IND Meeting', 'product': 'BX-500',
     'indication': 'JAK Inhibitor – Rheumatoid Arthritis',
     'state': 'approved', 'state_label': 'Ready for Submission', 'ha_authority': 'CDSCO',
     'phase': 'Phase I', 'owner_id': 'p3', 'risk_level': 'low',
     'target_submit_date': '2025-11-22', 'documents': 9, 'open_gaps': 0,
     'compliance_score': 94, 'frameworks': ['Schedule Y', 'ICH E6(R3)'],
     'application_id': 'a-003', 'updated_at': '3 hours ago'},
    {'id': 's-004', 'number': 'RC-SUB-2025-0091', 'name': 'AX-220 Annual Update',
     'type': 'Annual Update', 'product': 'AX-220', 'indication': 'Hypertension',
     'state': 'draft', 'state_label': None, 'ha_authority': 'CDSCO',
     'phase': 'Post-Marketing', 'owner_id': 'p6', 'risk_level': 'low',
     'target_submit_date': '2026-01-10', 'documents': 4, 'open_gaps': 2,
     'compliance_score': 81, 'frameworks': ['NDCTR 2019'],
     'application_id': 'a-004', 'updated_at': 'yesterday'},
    {'id': 's-005', 'number': 'RC-SUB-2025-0073', 'name': 'CX-310 – NDA Filing',
     'type': 'NDA', 'product': 'CX-310', 'indication': 'Acute Myeloid Leukaemia (AML)',
     'state': 'effective', 'state_label': 'Submitted', 'ha_authority': 'CDSCO + DCGI',
     'phase': 'Post-Marketing', 'owner_id': 'p1', 'risk_level': 'high',
     'target_submit_date': '2025-09-04', 'documents': 27, 'open_gaps': 1,
     'compliance_score': 88,
     'frameworks': ['NDCTR 2019', 'Schedule Y', 'ICH E6(R3)', 'ICH E2A'],
     'application_id': 'a-005', 'updated_at': '2 days ago'},
    {'id': 's-006', 'number': 'RC-SUB-2025-0124', 'name': 'DM-700 Schedule M Inspection',
     'type': 'Schedule M', 'product': 'DM-700',
     'indication': 'Manufacturing facility – Vadodara',
     'state': 'review', 'state_label': 'In QA Review',
     'ha_authority': 'CDSCO + State FDA', 'phase': 'Post-Marketing',
     'owner_id': 'p5', 'risk_level': 'medium',
     'target_submit_date': '2025-12-01', 'documents': 12, 'open_gaps': 3,
     'compliance_score': 79, 'frameworks': ['Schedule M', 'CDSCO GMP'],
     'application_id': 'a-006', 'updated_at': '5 hours ago'},
]

DOCUMENTS = [
    {'id': 'd-001', 'number': 'DOC-0042', 'name': 'ZP-101 Phase II Protocol v2.1',
     'type': 'Protocol', 'classification': 'Clinical / Protocol', 'state': 'review',
     'version': '2.1 (In Review)', 'owner_id': 'p3', 'country': 'India', 'language': 'en',
     'size': '1.8 MB', 'updated_at': '14 min ago', 'updated_by': 'Dr. Priya Menon',
     'submission_id': 's-001', 'application_id': 'a-001', 'compliance_score': 72,
     'flags': ['critical-gap'], 'excerpt': 'Phase II Protocol – ZP-101 in Type 2 Diabetes Mellitus.'},
    {'id': 'd-002', 'number': 'DOC-0043', 'name': 'ZP-101 Informed Consent Form (English)',
     'type': 'ICF', 'classification': 'Clinical / Consent', 'state': 'review',
     'version': '1.4', 'owner_id': 'p3', 'country': 'India', 'language': 'en',
     'size': '342 KB', 'updated_at': '1 hour ago', 'updated_by': 'Dr. Priya Menon',
     'submission_id': 's-001', 'application_id': 'a-001', 'compliance_score': 88,
     'flags': [], 'excerpt': 'Informed Consent Form – ZP-101 Phase II – English version 1.4.'},
    {'id': 'd-003', 'number': 'DOC-0044', 'name': 'ZP-101 Investigator Brochure',
     'type': 'IB', 'classification': 'Clinical / IB', 'state': 'approved',
     'version': '3.0', 'owner_id': 'p2', 'country': 'India', 'language': 'en',
     'size': '4.2 MB', 'updated_at': 'yesterday', 'updated_by': 'Rajat Iyer',
     'submission_id': 's-001', 'application_id': 'a-001', 'compliance_score': 95, 'flags': []},
    {'id': 'd-008', 'number': 'DOC-0089', 'name': 'BX-400 SAE CT-04 Narrative',
     'type': 'SAE Narrative', 'classification': 'Pharmacovigilance / SAE',
     'state': 'review', 'version': '0.5', 'owner_id': 'p4', 'country': 'India',
     'language': 'en', 'size': '256 KB', 'updated_at': '2 hours ago',
     'updated_by': 'Karan Bhatt', 'submission_id': 's-002', 'compliance_score': 51,
     'flags': ['critical-gap', 'expedited'],
     'excerpt': 'A 47-year-old male subject developed anaphylactic shock.'},
    {'id': 'd-010', 'number': 'DOC-0117', 'name': 'BX-500 Pre-IND Briefing Document',
     'type': 'Protocol', 'classification': 'Regulatory / Pre-IND', 'state': 'approved',
     'version': '1.0', 'owner_id': 'p3', 'country': 'India', 'language': 'en',
     'size': '2.4 MB', 'updated_at': '3 hours ago', 'updated_by': 'Dr. Priya Menon',
     'submission_id': 's-003', 'compliance_score': 96, 'flags': []},
    {'id': 'd-011', 'number': 'DOC-0124', 'name': 'DM-700 Schedule M Inspection Report',
     'type': 'Inspection Report', 'classification': 'GMP / Inspection', 'state': 'review',
     'version': '1.0', 'owner_id': 'p5', 'country': 'India', 'language': 'en',
     'size': '3.6 MB', 'updated_at': '5 hours ago', 'updated_by': 'Meera Nair',
     'submission_id': 's-006', 'compliance_score': 79, 'flags': []},
]

APPLICATIONS = [
    {'id': 'a-001', 'number': 'RC-APP-2025-014', 'product': 'ZP-101',
     'sponsor': 'Zephyr Pharma Pvt Ltd', 'type': 'Clinical Trial',
     'status': 'Pending CDSCO', 'submissions': 3, 'registrations': 0,
     'owner_id': 'p1', 'opened_at': '2025-08-12'},
    {'id': 'a-002', 'number': 'RC-APP-2025-022', 'product': 'BX-400',
     'sponsor': 'Beacon Therapeutics', 'type': 'Clinical Trial',
     'status': 'On Hold', 'submissions': 2, 'registrations': 0,
     'owner_id': 'p4', 'opened_at': '2025-09-03'},
    {'id': 'a-003', 'number': 'RC-APP-2025-031', 'product': 'BX-500',
     'sponsor': 'Beacon Therapeutics', 'type': 'Clinical Trial',
     'status': 'Active', 'submissions': 1, 'registrations': 0,
     'owner_id': 'p3', 'opened_at': '2025-10-18'},
    {'id': 'a-004', 'number': 'RC-APP-2024-088', 'product': 'AX-220',
     'sponsor': 'Apex Biosciences', 'type': 'Subsequent New Drug',
     'status': 'Active', 'submissions': 4, 'registrations': 1,
     'owner_id': 'p6', 'opened_at': '2024-04-22'},
    {'id': 'a-005', 'number': 'RC-APP-2024-104', 'product': 'CX-310',
     'sponsor': 'Cyrus Oncology', 'type': 'New Drug',
     'status': 'Approved', 'submissions': 2, 'registrations': 1,
     'owner_id': 'p1', 'opened_at': '2024-07-15'},
    {'id': 'a-006', 'number': 'RC-APP-2025-049', 'product': 'DM-700',
     'sponsor': 'Demeter Labs', 'type': 'Subsequent New Drug',
     'status': 'Active', 'submissions': 2, 'registrations': 1,
     'owner_id': 'p5', 'opened_at': '2025-06-30'},
]

REGISTRATIONS = [
    {'id': 'r-001', 'number': 'CT-NOC-2024/AX-220', 'product': 'AX-220',
     'certificate': 'Form CT-23', 'market': 'India', 'state': 'Effective',
     'approved_date': '2024-08-14', 'expiry_date': '2027-08-13', 'application_id': 'a-004'},
    {'id': 'r-002', 'number': 'IN-NDA-2024/CX-310', 'product': 'CX-310',
     'certificate': 'Form 46', 'market': 'India', 'state': 'Effective',
     'approved_date': '2024-12-02', 'expiry_date': '2029-12-01', 'application_id': 'a-005'},
    {'id': 'r-003', 'number': 'CT-NOC-2022/DM-700-MFG', 'product': 'DM-700',
     'certificate': 'Schedule M License', 'market': 'India',
     'state': 'Expiring Soon', 'approved_date': '2022-03-18',
     'expiry_date': '2026-03-17', 'application_id': 'a-006'},
]

HA_CORRESPONDENCE = [
    {'id': 'h-001', 'number': 'CDSCO-Q-2025-0089',
     'subject': 'Deficiency Letter – BX-400 CT-04 SAE Narrative',
     'direction': 'inbound', 'authority': 'CDSCO',
     'category': 'Deficiency Letter', 'submission_id': 's-002',
     'received_at': '2025-10-21', 'due_at': '2025-10-28',
     'state': 'open', 'priority': 'critical',
     'preview': 'CDSCO has issued a deficiency notice regarding inadequate causality assessment.'},
    {'id': 'h-002', 'number': 'CDSCO-Q-2025-0091',
     'subject': 'Query – ZP-101 Protocol v2 Dose Justification',
     'direction': 'inbound', 'authority': 'CDSCO', 'category': 'Query',
     'submission_id': 's-001', 'received_at': '2025-10-19', 'due_at': '2025-11-02',
     'state': 'response-drafted', 'priority': 'high',
     'preview': 'Justify the choice of 400 mg starting dose for ZP-101.'},
    {'id': 'h-003', 'number': 'CDSCO-AK-2025-0084',
     'subject': 'Acknowledgement – CX-310 NDA Submission',
     'direction': 'inbound', 'authority': 'CDSCO', 'category': 'Acknowledgement',
     'submission_id': 's-005', 'received_at': '2025-09-08',
     'due_at': None, 'state': 'closed', 'priority': 'standard',
     'preview': 'CDSCO acknowledges receipt of NDA submission for CX-310.'},
    {'id': 'h-004', 'number': 'CDSCO-AP-2025-0072',
     'subject': 'Approval – CX-310 New Drug Approval',
     'direction': 'inbound', 'authority': 'DCGI', 'category': 'Approval',
     'submission_id': 's-005', 'received_at': '2025-09-19',
     'due_at': None, 'state': 'closed', 'priority': 'standard',
     'preview': 'Approval letter granted for CX-310 per NDCTR 2019 Rule 80.'},
]


async def seed():
    if not DATABASE_URL:
        print("DATABASE_URL not set — skipping seed.")
        return

    conn = await get_conn()
    seeded = 0
    try:
        # Submissions (Legacy mockup seeding commented out for Sprint 3)
        # for s in SUBMISSIONS:
        #     p = PEOPLE[s['owner_id']]
        #     result = await conn.execute("""
        #         INSERT INTO submissions (
        #             id, number, name, type, product, indication, state,
        #             state_label, ha_authority, phase, owner_id, owner_name,
        #             owner_initials, owner_role, target_submit_date,
        #             risk_level, documents, open_gaps, compliance_score,
        #             frameworks, application_id, updated_at
        #         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
        #                   $15,$16,$17,$18,$19,$20,$21,$22)
        #         ON CONFLICT (id) DO NOTHING
        #     """, s['id'], s['number'], s['name'], s['type'], s['product'],
        #         s['indication'], s['state'], s.get('state_label'),
        #         s['ha_authority'], s['phase'], p['id'], p['name'],
        #         p['initials'], p['role'], s.get('target_submit_date'),
        #         s['risk_level'], s['documents'], s['open_gaps'],
        #         s['compliance_score'], json.dumps(s['frameworks']),
        #         s.get('application_id'), s['updated_at'])
        #     if result == 'INSERT 0 1':
        #         seeded += 1

        # Documents
        for d in DOCUMENTS:
            p = PEOPLE[d['owner_id']]
            await conn.execute("""
                INSERT INTO documents (
                    id, number, name, type, classification, state, version,
                    owner_id, owner_name, owner_initials, owner_role,
                    country, language, size, updated_at, updated_by,
                    submission_id, application_id, compliance_score,
                    flags, excerpt
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                          $15,$16,$17,$18,$19,$20,$21)
                ON CONFLICT (id) DO NOTHING
            """, d['id'], d['number'], d['name'], d['type'],
                d['classification'], d['state'], d['version'],
                p['id'], p['name'], p['initials'], p['role'],
                d['country'], d['language'], d['size'],
                d['updated_at'], d['updated_by'],
                d.get('submission_id'), d.get('application_id'),
                d.get('compliance_score'), json.dumps(d.get('flags', [])),
                d.get('excerpt'))

        # Applications
        for a in APPLICATIONS:
            p = PEOPLE[a['owner_id']]
            await conn.execute("""
                INSERT INTO applications (
                    id, number, product, sponsor, type, status,
                    submissions, registrations, owner_id, owner_name,
                    owner_initials, owner_role, opened_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                ON CONFLICT (id) DO NOTHING
            """, a['id'], a['number'], a['product'], a['sponsor'],
                a['type'], a['status'], a['submissions'],
                a['registrations'], p['id'], p['name'],
                p['initials'], p['role'], a['opened_at'])

        # Registrations
        for r in REGISTRATIONS:
            await conn.execute("""
                INSERT INTO registrations (
                    id, number, product, certificate, market, state,
                    approved_date, expiry_date, application_id
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT (id) DO NOTHING
            """, r['id'], r['number'], r['product'], r['certificate'],
                r['market'], r['state'], r['approved_date'],
                r['expiry_date'], r.get('application_id'))

        # HA Correspondence
        for h in HA_CORRESPONDENCE:
            await conn.execute("""
                INSERT INTO ha_correspondence (
                    id, number, subject, direction, authority, category,
                    submission_id, received_at, due_at, state, priority, preview
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                ON CONFLICT (id) DO NOTHING
            """, h['id'], h['number'], h['subject'], h['direction'],
                h['authority'], h['category'], h.get('submission_id'),
                h['received_at'], h.get('due_at'), h['state'],
                h['priority'], h['preview'])

        print(f"Seed complete. ({seeded} new submissions inserted)")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
