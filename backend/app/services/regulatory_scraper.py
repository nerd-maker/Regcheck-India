"""
Regulatory document scraper for RegCheck-India.

Scrapes CDSCO, MoHFW, and ICH for new circulars, guidelines, and orders.
All scraped documents are queued in regulatory_updates_queue for human review
before being ingested into the knowledge base.

Called daily by APScheduler at 02:00 IST.
Can also be triggered manually via POST /api/v1/regulatory-updates/trigger-scrape.
"""
import asyncio
import logging
import re
from datetime import date
from typing import Optional

import asyncpg
import httpx
from bs4 import BeautifulSoup

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Polite user-agent identifying our tool
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; RegCheck-India/1.0; "
        "regulatory-compliance-research)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

SCRAPE_SOURCES = [
    {
        "name": "CDSCO Circulars",
        "authority": "CDSCO",
        "url": "https://cdsco.gov.in/opencms/opencms/en/Notifications/Circulars/",
        "framework": "CDSCO",
        "document_type": "circular",
        "link_selector": "a[href*='.pdf'], a[href*='circular']",
        "base_url": "https://cdsco.gov.in",
    },
    {
        "name": "CDSCO Guidance Documents",
        "authority": "CDSCO",
        "url": "https://cdsco.gov.in/opencms/opencms/en/Guidance_Documents/",
        "framework": "CDSCO",
        "document_type": "guidance",
        "link_selector": "a[href*='.pdf']",
        "base_url": "https://cdsco.gov.in",
    },
    {
        "name": "CDSCO New Drug Approvals",
        "authority": "CDSCO",
        "url": "https://cdsco.gov.in/opencms/opencms/en/New_Drugs_Approval/",
        "framework": "CDSCO",
        "document_type": "notification",
        "link_selector": "a[href*='.pdf']",
        "base_url": "https://cdsco.gov.in",
    },
    {
        "name": "MoHFW Notifications",
        "authority": "MoHFW",
        "url": "https://www.mohfw.gov.in/",
        "framework": "MoHFW",
        "document_type": "notification",
        "link_selector": "a[href*='notification'], a[href*='circular'], a[href*='.pdf']",
        "base_url": "https://www.mohfw.gov.in",
    },
    {
        "name": "ICH Guidelines",
        "authority": "ICH",
        "url": "https://www.ich.org/page/efficacy-guidelines",
        "framework": "ICH",
        "document_type": "guidance",
        "link_selector": "a[href*='guideline'], a[href*='.pdf']",
        "base_url": "https://www.ich.org",
    },
]


async def scrape_all_sources() -> dict:
    """
    Main scraper entry point. Called by APScheduler daily.
    Fetches all sources, extracts new documents, queues them for review.
    Returns summary of what was found and queued.
    """
    settings = get_settings()
    db_url = settings.supabase_db_url or settings.database_url
    if not db_url:
        logger.error("regulatory_scraper: no database URL configured — aborting")
        return {
            "sources_checked": 0,
            "new_documents_found": 0,
            "already_known": 0,
            "errors": 1,
            "queued": [],
        }

    results: dict = {
        "sources_checked": 0,
        "new_documents_found": 0,
        "already_known": 0,
        "errors": 0,
        "queued": [],
    }

    conn = await asyncpg.connect(db_url)
    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            for source in SCRAPE_SOURCES:
                try:
                    source_results = await _scrape_single_source(client, conn, source)
                    results["sources_checked"] += 1
                    results["new_documents_found"] += source_results["queued"]
                    results["already_known"] += source_results["skipped"]
                    results["queued"].extend(source_results["titles"])
                except Exception as exc:
                    logger.error(
                        "scrape_source_failed: source=%s error=%s",
                        source["name"],
                        exc,
                        exc_info=True,
                    )
                    results["errors"] += 1

                # Polite delay between sources — avoid hammering government servers
                await asyncio.sleep(3)
    finally:
        await conn.close()

    logger.info(
        "scrape_complete: sources_checked=%d new=%d already_known=%d errors=%d",
        results["sources_checked"],
        results["new_documents_found"],
        results["already_known"],
        results["errors"],
    )
    return results


async def _scrape_single_source(
    client: httpx.AsyncClient,
    conn: asyncpg.Connection,
    source: dict,
) -> dict:
    """Scrape one source, extract PDF/document links, queue new ones."""
    result: dict = {"queued": 0, "skipped": 0, "titles": []}

    try:
        response = await client.get(source["url"])
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning(
            "source_fetch_failed: url=%s error=%s", source["url"], exc
        )
        return result

    soup = BeautifulSoup(response.text, "lxml")
    links = soup.select(source["link_selector"])

    for link in links[:20]:  # cap at 20 per source per run
        href: str = link.get("href", "")
        if not href:
            continue

        # Resolve relative URLs
        if href.startswith("/"):
            full_url = source["base_url"] + href
        elif href.startswith("http"):
            full_url = href
        else:
            continue

        # Deduplicate against queue
        existing = await conn.fetchval(
            "SELECT id FROM regulatory_updates_queue WHERE source_url = $1",
            full_url,
        )
        if existing:
            result["skipped"] += 1
            continue

        # Deduplicate against already-ingested embeddings
        already_ingested = await conn.fetchval(
            "SELECT id FROM regulatory_embeddings WHERE source_url = $1 LIMIT 1",
            full_url,
        )
        if already_ingested:
            result["skipped"] += 1
            continue

        # Extract document title from link text or URL
        title = link.get_text(strip=True) or _title_from_url(full_url)
        if len(title) < 5:
            title = _title_from_url(full_url)

        # Fetch and extract text content
        extracted_text = await _extract_text_from_url(client, full_url)
        if not extracted_text or len(extracted_text) < 100:
            logger.debug(
                "skipping_short_content: url=%s chars=%d",
                full_url,
                len(extracted_text or ""),
            )
            continue

        # Generate AI summary for reviewers
        summary = await _generate_summary(extracted_text[:3000], source["authority"])

        # Parse publication date from title or URL if possible
        pub_date: Optional[date] = _extract_date_from_text(title + " " + full_url)

        # Insert into review queue (ON CONFLICT DO NOTHING for race safety)
        await conn.execute(
            """
            INSERT INTO regulatory_updates_queue
                (title, source_url, authority, framework, document_type,
                 publication_date, summary, extracted_text, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_review')
            ON CONFLICT (source_url) DO NOTHING
            """,
            title,
            full_url,
            source["authority"],
            source.get("framework"),
            source["document_type"],
            pub_date,
            summary,
            extracted_text,
        )

        result["queued"] += 1
        result["titles"].append(title)
        logger.info("queued_for_review: title=%r url=%s", title, full_url)

        # Polite delay between individual document fetches
        await asyncio.sleep(1)

    return result


async def _extract_text_from_url(
    client: httpx.AsyncClient, url: str
) -> Optional[str]:
    """
    Fetch URL and extract text. Handles both HTML pages and PDFs.
    Returns extracted text or None if extraction fails.
    """
    try:
        response = await client.get(url, timeout=20.0)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")

        if "pdf" in content_type or url.lower().endswith(".pdf"):
            # Extract text from PDF bytes using pdfplumber
            import io
            import pdfplumber

            text_parts: list[str] = []
            with pdfplumber.open(io.BytesIO(response.content)) as pdf:
                for page in pdf.pages[:30]:  # cap at 30 pages
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text.strip())
            return "\n\n".join(text_parts) if text_parts else None

        if "html" in content_type:
            soup = BeautifulSoup(response.text, "lxml")
            # Strip boilerplate tags before extracting text
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            return soup.get_text(separator="\n", strip=True)

    except Exception as exc:
        logger.debug("text_extraction_failed: url=%s error=%s", url, exc)

    return None


async def _generate_summary(text: str, authority: str) -> str:
    """
    Generate a 2-3 sentence summary using Claude Haiku.
    Helps reviewers quickly understand what a queued document contains.
    Falls back to a placeholder if the LLM call fails.
    """
    try:
        from app.services.claude_client import call_claude_agent

        settings = get_settings()
        result = call_claude_agent(
            agent_name="regulatory-summariser",
            model=settings.llm_model_fast,
            system_prompt=(
                "You are a concise regulatory affairs summariser. "
                "Return only the summary, no preamble."
            ),
            user_content=(
                f"You are a regulatory affairs expert. Summarise this {authority} "
                "regulatory document in exactly 2-3 sentences. Focus on: what type "
                "of document it is, what it regulates, and why it matters to Indian "
                f"pharma/CRO companies.\n\nDocument:\n{text}"
            ),
            api_key="admin-regcheck",
            max_tokens=256,
        )

        # result.result may be a dict (if Claude returned JSON) or a string
        payload = result.result
        if isinstance(payload, dict):
            summary: str = (
                payload.get("summary")
                or payload.get("text")
                or str(payload)
            )
        elif isinstance(payload, str):
            summary = payload
        else:
            summary = str(payload)

        return summary[:500]  # cap at 500 chars

    except Exception as exc:
        logger.warning("summary_generation_failed: error=%s", exc)
        return "Summary unavailable — review document text directly."


def _title_from_url(url: str) -> str:
    """Extract a readable title from a URL."""
    filename = url.split("/")[-1].split("?")[0]
    name = re.sub(r"\.(pdf|html|htm|doc|docx)$", "", filename, flags=re.IGNORECASE)
    name = re.sub(r"[_\-]+", " ", name)
    return name.strip().title() or "Untitled Document"


def _extract_date_from_text(text: str) -> Optional[date]:
    """
    Try to extract a publication date from text/URL.
    Returns a date object or None.
    """
    patterns = [
        # 2024-03-15 or 2024_03_15
        (r"(\d{4})[_\-](\d{2})[_\-](\d{2})", "ymd"),
        # 15-03-2024 or 15_03_2024
        (r"(\d{2})[_\-](\d{2})[_\-](\d{4})", "dmy"),
        # 20240315
        (r"(\d{4})(\d{2})(\d{2})", "ymd"),
    ]
    for pattern, order in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                g = match.groups()
                if order == "ymd":
                    return date(int(g[0]), int(g[1]), int(g[2]))
                else:  # dmy
                    return date(int(g[2]), int(g[1]), int(g[0]))
            except (ValueError, OverflowError):
                continue
    return None
