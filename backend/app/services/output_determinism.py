"""
Output Determinism & Caching System (Gap 9)

Addresses false assumption that temperature 0.1 guarantees identical outputs:
- Output caching by input_hash (same document + KB version = cached result)
- Human review as definitive source of truth
- Immutable finding storage
- Honest documentation of LLM limitations
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.core.datetime_utils import utc_now

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class CachedOutput(BaseModel):
    """Immutable cached output keyed by input hash"""
    cache_key: str
    input_hash: str
    kb_version: str
    prompt_version: str
    module: str
    output_data: Dict
    created_at: datetime = Field(default_factory=utc_now)
    human_reviewed: bool = False
    human_review_at: Optional[datetime] = None
    human_reviewer: Optional[str] = None
    is_definitive: bool = False  # True once human-reviewed


class ImmutableFinding(BaseModel):
    """Immutable record of what was shown to user"""
    finding_id: str
    session_id: str
    module: str
    content: Dict
    shown_at: datetime = Field(default_factory=utc_now)
    input_hash: str
    kb_version: str
    prompt_version: str = ""
    # Once shown, this is the fact — regardless of what LLM says on re-run
    locked: bool = True


# ──────────────────────────────────────────────────────
# Output Cache
# ──────────────────────────────────────────────────────

class OutputDeterminismManager:
    """
    Manages output caching and immutability for practical determinism.

    Since LLMs are inherently non-deterministic even at temperature 0.0,
    we achieve practical determinism through:
    1. Cache outputs by input_hash
    2. Human review is the definitive source of truth
    3. Once shown to user, findings are immutable
    """

    def __init__(self):
        self.cache: Dict[str, CachedOutput] = {}
        self.findings: List[ImmutableFinding] = []

    def compute_input_hash(
        self,
        document_content: str,
        kb_version: str,
        prompt_version: str = "",
        metadata: Dict = None
    ) -> str:
        """Compute deterministic hash from inputs."""
        parts = [document_content, kb_version, prompt_version]
        if metadata:
            parts.append(json.dumps(metadata, sort_keys=True, default=str))
        combined = "|".join(parts)
        return hashlib.sha256(combined.encode()).hexdigest()[:32]

    def check_cache(self, input_hash: str, kb_version: str) -> Optional[CachedOutput]:
        """
        Check if we have a cached output for this input.

        Same document + same KB version = return cached result.
        """
        cache_key = f"{input_hash}_{kb_version}"
        cached = self.cache.get(cache_key)

        if cached:
            logger.info(
                f"Cache HIT: {cache_key} "
                f"(human_reviewed: {cached.human_reviewed})",
                extra={"cache_key": cache_key}
            )
        return cached

    def store_output(
        self,
        input_hash: str,
        kb_version: str,
        prompt_version: str,
        module: str,
        output_data: Dict
    ) -> CachedOutput:
        """Store output in cache."""
        cache_key = f"{input_hash}_{kb_version}"

        # Don't overwrite human-reviewed outputs
        existing = self.cache.get(cache_key)
        if existing and existing.is_definitive:
            logger.info(f"Skipping cache update — definitive output exists: {cache_key}")
            return existing

        cached = CachedOutput(
            cache_key=cache_key,
            input_hash=input_hash,
            kb_version=kb_version,
            prompt_version=prompt_version,
            module=module,
            output_data=output_data
        )
        self.cache[cache_key] = cached

        logger.info(f"Output cached: {cache_key}", extra={"module": module})
        return cached

    def mark_human_reviewed(
        self,
        input_hash: str,
        kb_version: str,
        reviewer: str,
        reviewed_output: Dict = None
    ) -> bool:
        """
        Mark output as human-reviewed — this becomes the definitive truth.

        Once marked, this output is used for all future requests
        with the same input_hash + kb_version, regardless of what
        the LLM would produce on re-run.
        """
        cache_key = f"{input_hash}_{kb_version}"
        cached = self.cache.get(cache_key)
        if not cached:
            return False

        cached.human_reviewed = True
        cached.human_review_at = utc_now()
        cached.human_reviewer = reviewer
        cached.is_definitive = True

        # If reviewer provided corrected output, use that
        if reviewed_output:
            cached.output_data = reviewed_output

        logger.info(
            f"Output marked DEFINITIVE by {reviewer}: {cache_key}",
            extra={"cache_key": cache_key, "reviewer": reviewer}
        )
        return True

    # ── Immutable Findings ──

    def record_finding(
        self,
        finding_id: str,
        session_id: str,
        module: str,
        content: Dict,
        input_hash: str,
        kb_version: str,
        prompt_version: str = ""
    ) -> ImmutableFinding:
        """
        Record what was shown to the user — this is now immutable fact.

        Even if the LLM produces different output on re-run,
        what was shown to the user is what matters for the audit trail.
        """
        finding = ImmutableFinding(
            finding_id=finding_id,
            session_id=session_id,
            module=module,
            content=content,
            input_hash=input_hash,
            kb_version=kb_version,
            prompt_version=prompt_version
        )
        self.findings.append(finding)
        return finding

    def get_finding(self, finding_id: str) -> Optional[ImmutableFinding]:
        """Retrieve an immutable finding."""
        for f in self.findings:
            if f.finding_id == finding_id:
                return f
        return None

    def get_cache_stats(self) -> Dict:
        """Get cache statistics."""
        total = len(self.cache)
        reviewed = len([c for c in self.cache.values() if c.human_reviewed])
        definitive = len([c for c in self.cache.values() if c.is_definitive])

        return {
            "total_cached": total,
            "human_reviewed": reviewed,
            "definitive": definitive,
            "hit_rate_note": "Track cache hits vs misses in production metrics"
        }


# Global instance
output_determinism = OutputDeterminismManager()
