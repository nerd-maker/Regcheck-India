"""
Regulatory document preprocessing script.
Run ONCE locally to generate regulatory_chunks.json.
Commit the output file to the repository.

Usage:
    cd backend
    python scripts/preprocess_regulatory_docs.py

Output:
    backend/knowledge_base/regulatory_chunks.json
"""

import json
import logging
import sys
from collections import Counter
from pathlib import Path

import pdfplumber

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Paths
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
DOCS_DIR = BACKEND_DIR / "knowledge_base" / "documents"
OUTPUT_FILE = BACKEND_DIR / "knowledge_base" / "regulatory_chunks.json"

# Chunking config
CHUNK_SIZE = 200    # words per chunk — reduced from 500 for more precise TF-IDF retrieval
CHUNK_OVERLAP = 30  # word overlap between chunks — reduced from 50

DOCUMENT_REGISTRY = [
    {
        "filename": "Clinical.pdf",
        "doc_name": "Schedule Y — Clinical Trial Requirements",
        "framework": "Schedule Y",
        "short_name": "SCHEDULE_Y",
        "authority": "CDSCO",
        "max_pages": None,
    },
    {
        "filename": "CTD Guidance Final.pdf",
        "doc_name": "CTD Guidance for Drug Registration",
        "framework": "CTD",
        "short_name": "CTD_GUIDANCE",
        "authority": "CDSCO",
        "max_pages": None,
    },
    {
        "filename": "DPDP_Rules_2025_English_only.pdf",
        "doc_name": "Digital Personal Data Protection Rules 2025",
        "framework": "DPDP Act 2023",
        "short_name": "DPDP_RULES",
        "authority": "MeitY",
        "max_pages": None,
    },
    {
        "filename": "E2A_Guideline.pdf",
        "doc_name": "ICH E2A — Clinical Safety Data Management",
        "framework": "ICH E2A",
        "short_name": "ICH_E2A",
        "authority": "ICH",
        "max_pages": None,
    },
    {
        "filename": "E3_Guideline.pdf",
        "doc_name": "ICH E3 — Structure and Content of Clinical Study Reports",
        "framework": "ICH E3",
        "short_name": "ICH_E3",
        "authority": "ICH",
        "max_pages": None,
    },
    {
        "filename": "E3_Q&As_R1_Q&As.pdf",
        "doc_name": "ICH E3 Q&A — Clinical Study Report Questions and Answers",
        "framework": "ICH E3",
        "short_name": "ICH_E3_QA",
        "authority": "ICH",
        "max_pages": None,
    },
    {
        "filename": "E9_Guideline.pdf",
        "doc_name": "ICH E9 — Statistical Principles for Clinical Trials",
        "framework": "ICH E9",
        "short_name": "ICH_E9",
        "authority": "ICH",
        "max_pages": None,
    },
    {
        "filename": "E9-R1_Step4_Guideline_2019_1203.pdf",
        "doc_name": "ICH E9(R1) — Estimands and Sensitivity Analysis",
        "framework": "ICH E9",
        "short_name": "ICH_E9R1",
        "authority": "ICH",
        "max_pages": None,
    },
    {
        "filename": "ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf",
        "doc_name": "ICH E6(R3) — Good Clinical Practice",
        "framework": "ICH E6(R3) GCP",
        "short_name": "ICH_E6R3",
        "authority": "ICH",
        "max_pages": None,
    },
    {
        "filename": "ICMR_National_Ethical_Guidelines.pdf",
        "doc_name": "ICMR National Ethical Guidelines for Biomedical Research",
        "framework": "ICMR Ethics",
        "short_name": "ICMR_ETHICS",
        "authority": "ICMR",
        "max_pages": 100,
    },
    {
        "filename": "india.pdf",
        "doc_name": "New Drugs and Clinical Trials Rules 2019 (NDCTR)",
        "framework": "NDCTR 2019",
        "short_name": "NDCTR_2019",
        "authority": "CDSCO",
        "max_pages": 80,
    },
    {
        "filename": "National-AEFI-Surveillance-and-Response-Operational-Guidelines-2024.pdf",
        "doc_name": "National AEFI Surveillance and Response Guidelines",
        "framework": "Pharmacovigilance",
        "short_name": "AEFI_GUIDELINES",
        "authority": "MoHFW",
        "max_pages": 80,
    },
    {
        "filename": "NEW DRUGS ANDctrS RULE, 2019.pdf",
        "doc_name": "New Drugs and Clinical Trials Rules 2019 (Official Gazette)",
        "framework": "NDCTR 2019",
        "short_name": "NDCTR_GAZETTE",
        "authority": "CDSCO",
        "max_pages": None,
    },
    {
        "filename": "PV_Guidance_Docs_for_MAH_Version_2_as_on_18.01.2024.pdf",
        "doc_name": "Pharmacovigilance Guidance for Marketing Authorisation Holders",
        "framework": "Pharmacovigilance",
        "short_name": "PV_MAH_GUIDANCE",
        "authority": "CDSCO",
        "max_pages": None,
    },
]


def is_valid_chunk(text: str) -> bool:
    """Filter out corrupted, reversed, or low-quality chunks.

    Catches PDF encoding artifacts where text appears reversed or heavily
    abbreviated (e.g. 'AEFI header: SENILEDIUG LANOITAREPO' reversed text).
    """
    stripped = text.strip()
    if len(stripped) < 100:
        return False
    words = stripped.split()
    if len(words) < 10:
        return False
    # Detect reversed-text artifacts: many long words with no vowels
    suspicious = sum(
        1 for w in words[:30]
        if len(w) > 6 and not any(v in w.lower() for v in 'aeiou')
    )
    if len(words) >= 10 and suspicious / min(len(words), 30) > 0.30:
        return False
    return True


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping word chunks."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        if len(chunk.strip()) > 100:  # skip tiny chunks under 100 chars
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def process_pdf(filepath: Path, meta: dict) -> list[dict]:
    """Extract and chunk text from a single PDF. Returns list of chunk dicts."""
    chunks = []
    max_pages = meta.get("max_pages")

    try:
        with pdfplumber.open(filepath) as pdf:
            pages = pdf.pages
            if max_pages:
                pages = pages[:max_pages]

            for page_num, page in enumerate(pages, 1):
                try:
                    page_text = page.extract_text()
                except Exception as e:
                    logger.warning(f"  Page {page_num} extraction failed: {e}")
                    continue

                if not page_text or len(page_text.strip()) < 50:
                    continue

                page_chunks = chunk_text(page_text.strip())
                for chunk_idx, chunk_content in enumerate(page_chunks):
                    if not is_valid_chunk(chunk_content):
                        logger.debug("  Skipping invalid chunk at page %d idx %d", page_num, chunk_idx)
                        continue
                    chunks.append({
                        "chunk_id": f"{meta['short_name']}_{page_num:04d}_{chunk_idx:03d}",
                        "doc_name": meta["doc_name"],
                        "framework": meta["framework"],
                        "short_name": meta["short_name"],
                        "authority": meta["authority"],
                        "page_number": page_num,
                        "chunk_index": chunk_idx,
                        "content": chunk_content,
                    })

    except Exception as e:
        logger.error(f"  Failed to process {filepath.name}: {e}")
        return []

    return chunks


def main():
    all_chunks = []
    processed = 0
    skipped = 0

    logger.info(f"Documents directory: {DOCS_DIR}")
    logger.info(f"Output file: {OUTPUT_FILE}")
    logger.info(f"Processing {len(DOCUMENT_REGISTRY)} documents...\n")

    for meta in DOCUMENT_REGISTRY:
        filepath = DOCS_DIR / meta["filename"]

        if not filepath.exists():
            logger.warning(f"SKIPPING (not found): {meta['filename']}")
            skipped += 1
            continue

        file_size_kb = filepath.stat().st_size // 1024
        logger.info(f"Processing: {meta['filename']} ({file_size_kb} KB)")

        doc_chunks = process_pdf(filepath, meta)

        if doc_chunks:
            all_chunks.extend(doc_chunks)
            logger.info(f"  -> {len(doc_chunks)} chunks from {meta['doc_name']}")
            processed += 1
        else:
            logger.warning(f"  -> No chunks extracted from {meta['filename']}")
            skipped += 1

    logger.info(f"\n{'='*50}")
    logger.info(f"Processed: {processed} documents")
    logger.info(f"Skipped:   {skipped} documents")
    logger.info(f"Total chunks: {len(all_chunks)}")

    if not all_chunks:
        logger.error("No chunks generated — aborting output write.")
        return 1

    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    output_size_kb = OUTPUT_FILE.stat().st_size // 1024
    logger.info(f"Output file size: {output_size_kb} KB")
    logger.info(f"Written to: {OUTPUT_FILE}")

    # Report per-document chunk counts
    logger.info("\nChunk counts per document:")
    counts = Counter(c["short_name"] for c in all_chunks)
    for short_name, count in sorted(counts.items()):
        logger.info(f"  {short_name}: {count} chunks")

    return 0 if processed > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
