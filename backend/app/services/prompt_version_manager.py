"""
Immutable Prompt Versioning System (Gap 8)

Ensures every audit trail entry links to the exact prompt used:
- Semantic versioning (M1_COMPLIANCE_v2.3.1)
- Immutable storage (never overwritten, only superseded)
- prompt_version_id in every audit entry
- Mandatory changelog with what/why/validation
- Prompt freeze for active CDSCO submissions
"""

import uuid
import hashlib
import logging
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class PromptChangelog(BaseModel):
    """Mandatory changelog entry for prompt updates"""
    what_changed: str
    why_changed: str
    validation_result: str = ""
    changed_by: str = ""


class PromptVersion(BaseModel):
    """Immutable prompt version record"""
    version_id: str = Field(default_factory=lambda: f"pv-{uuid.uuid4()}")
    prompt_name: str          # e.g., "M1_COMPLIANCE"
    semantic_version: str     # e.g., "v2.3.1"
    full_name: str = ""       # e.g., "M1_COMPLIANCE_v2.3.1"

    # Immutable content
    system_prompt: str
    content_hash: str = ""

    # Changelog (MANDATORY)
    changelog: PromptChangelog

    # Lifecycle
    status: str = "ACTIVE"  # ACTIVE, SUPERSEDED, FROZEN
    created_at: datetime = Field(default_factory=datetime.utcnow)
    superseded_at: Optional[datetime] = None
    superseded_by: Optional[str] = None  # version_id of replacement

    # Freeze tracking
    frozen_for_submissions: List[str] = Field(default_factory=list)
    frozen_at: Optional[datetime] = None


# ──────────────────────────────────────────────────────
# Prompt Version Manager
# ──────────────────────────────────────────────────────

class PromptVersionManager:
    """
    Manages immutable prompt versions with audit trail integration.

    Rules:
    1. Prompts are NEVER overwritten — only superseded
    2. Every audit entry must reference a prompt_version_id
    3. Changelog is MANDATORY for every version change
    4. Active CDSCO submissions freeze the prompt version
    """

    def __init__(self):
        self.versions: Dict[str, PromptVersion] = {}   # version_id -> PromptVersion
        self.active_versions: Dict[str, str] = {}      # prompt_name -> version_id
        self.frozen_prompts: Dict[str, str] = {}        # submission_id -> version_id

    def register_prompt(
        self,
        prompt_name: str,
        semantic_version: str,
        system_prompt: str,
        changelog: Dict,
    ) -> PromptVersion:
        """
        Register a new prompt version. Previous version is superseded.
        """
        full_name = f"{prompt_name}_{semantic_version}"
        content_hash = hashlib.sha256(system_prompt.encode()).hexdigest()[:16]

        version = PromptVersion(
            prompt_name=prompt_name,
            semantic_version=semantic_version,
            full_name=full_name,
            system_prompt=system_prompt,
            content_hash=content_hash,
            changelog=PromptChangelog(**changelog)
        )

        # Supersede previous active version
        prev_id = self.active_versions.get(prompt_name)
        if prev_id and prev_id in self.versions:
            prev = self.versions[prev_id]
            prev.status = "SUPERSEDED"
            prev.superseded_at = datetime.utcnow()
            prev.superseded_by = version.version_id

        # Store new version
        self.versions[version.version_id] = version
        self.active_versions[prompt_name] = version.version_id

        logger.info(
            f"Prompt version registered: {full_name} (id: {version.version_id})",
            extra={
                "prompt_name": prompt_name,
                "version": semantic_version,
                "version_id": version.version_id,
                "content_hash": content_hash
            }
        )

        return version

    def get_active_version(self, prompt_name: str) -> Optional[PromptVersion]:
        """Get the current active version for a prompt."""
        version_id = self.active_versions.get(prompt_name)
        if version_id:
            return self.versions.get(version_id)
        return None

    def get_version_by_id(self, version_id: str) -> Optional[PromptVersion]:
        """Get a specific version by its immutable ID."""
        return self.versions.get(version_id)

    def get_prompt_for_audit(self, prompt_name: str) -> Dict:
        """
        Get prompt version info for inclusion in audit trail.

        Returns dict with version_id, full_name, content_hash.
        """
        version = self.get_active_version(prompt_name)
        if not version:
            return {"prompt_version_id": "UNVERSIONED", "prompt_name": prompt_name}

        return {
            "prompt_version_id": version.version_id,
            "prompt_full_name": version.full_name,
            "prompt_content_hash": version.content_hash,
            "prompt_status": version.status
        }

    # ── Freeze Management ──

    def freeze_for_submission(self, prompt_name: str, submission_id: str) -> bool:
        """
        Freeze current prompt version for an active CDSCO submission.

        Once frozen, prompts cannot be updated for this submission.
        """
        version = self.get_active_version(prompt_name)
        if not version:
            return False

        version.frozen_for_submissions.append(submission_id)
        if version.status != "FROZEN":
            version.status = "FROZEN"
            version.frozen_at = datetime.utcnow()

        self.frozen_prompts[submission_id] = version.version_id

        logger.info(
            f"Prompt FROZEN for submission {submission_id}: {version.full_name}",
            extra={"submission_id": submission_id, "version_id": version.version_id}
        )
        return True

    def is_prompt_frozen(self, prompt_name: str) -> bool:
        """Check if a prompt has any active freeze."""
        version = self.get_active_version(prompt_name)
        return version is not None and version.status == "FROZEN"

    def get_frozen_version_for_submission(self, submission_id: str) -> Optional[PromptVersion]:
        """Get the frozen prompt version for a submission."""
        version_id = self.frozen_prompts.get(submission_id)
        if version_id:
            return self.versions.get(version_id)
        return None

    # ── Version History ──

    def get_version_history(self, prompt_name: str) -> List[Dict]:
        """Get full version history for a prompt."""
        history = [
            {
                "version_id": v.version_id,
                "full_name": v.full_name,
                "semantic_version": v.semantic_version,
                "status": v.status,
                "created_at": v.created_at.isoformat(),
                "content_hash": v.content_hash,
                "changelog": {
                    "what": v.changelog.what_changed,
                    "why": v.changelog.why_changed
                }
            }
            for v in self.versions.values()
            if v.prompt_name == prompt_name
        ]
        return sorted(history, key=lambda x: x["created_at"], reverse=True)


# Global instance
prompt_version_manager = PromptVersionManager()
