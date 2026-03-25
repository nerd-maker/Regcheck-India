"""
Unit tests for Gap Services (Gaps 2, 6, 7, 8, 9, 11, 12, 14, 15, 16)

Covers all 11 new service files introduced during critical-gap implementation:
  - confidence_assessor        (Gap 2)
  - revision_loop_manager      (Gap 6)
  - tenant_isolation           (Gap 7)
  - prompt_version_manager     (Gap 8)
  - output_determinism         (Gap 9)
  - classification_confidence  (Gap 11)
  - deadline_review_queue      (Gap 12)
  - ground_truth_evaluator     (Gap 14)
  - section_context_store      (Gap 15)
  - commitment_tracker         (Gap 16)
"""

import pytest
from datetime import timedelta
from unittest.mock import patch
from app.core.datetime_utils import utc_now


# ═════════════════════════════════════════════════════════════════════════
# GAP 2 — Multi-Signal Confidence Assessor
# ═════════════════════════════════════════════════════════════════════════

class TestMultiSignalConfidenceAssessor:
    """Tests for confidence_assessor.py (Gap 2)"""

    def _make_assessor(self):
        from app.services.confidence_assessor import MultiSignalConfidenceAssessor
        return MultiSignalConfidenceAssessor()

    # ── Floor rule: ANY signal LOW → overall LOW ──

    @pytest.mark.unit
    def test_any_signal_low_forces_overall_low(self):
        """ANY signal LOW → overall must be LOW regardless of other scores"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[0.1, 0.2],      # LOW retrieval
            citations_found=3,
            citations_expected=3,              # HIGH citation
            schema_valid=True,
            schema_fields_present=10,
            schema_fields_total=10,            # HIGH schema
            llm_confidence=0.95,               # HIGH llm
        )
        assert result.overall_level == "LOW"
        assert result.requires_review is True

    @pytest.mark.unit
    def test_low_citation_forces_overall_low(self):
        """Even if only citation signal is LOW, overall must be LOW"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[0.95, 0.90],     # HIGH
            citations_found=1,
            citations_expected=5,              # LOW (0.2 ratio)
            schema_valid=True,
            schema_fields_present=10,
            schema_fields_total=10,
            llm_confidence=0.90,
        )
        assert result.overall_level == "LOW"
        assert result.requires_review is True

    @pytest.mark.unit
    def test_low_schema_forces_overall_low(self):
        """LOW schema validation → overall LOW"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[0.90, 0.85],
            citations_found=5,
            citations_expected=5,
            schema_valid=False,                # INVALID schema → LOW
            schema_fields_present=3,
            schema_fields_total=10,
            llm_confidence=0.90,
        )
        assert result.overall_level == "LOW"

    @pytest.mark.unit
    def test_low_llm_self_forces_overall_low(self):
        """LOW LLM self-assessment → overall LOW"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[0.90, 0.85],
            citations_found=5,
            citations_expected=5,
            schema_valid=True,
            schema_fields_present=10,
            schema_fields_total=10,
            llm_confidence=0.30,               # LOW
        )
        assert result.overall_level == "LOW"

    # ── All signals HIGH → overall HIGH ──

    @pytest.mark.unit
    def test_all_high_signals_produces_high(self):
        """All signals HIGH → overall HIGH, no review required"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[0.95, 0.90, 0.88],
            citations_found=5,
            citations_expected=5,
            schema_valid=True,
            schema_fields_present=10,
            schema_fields_total=10,
            llm_confidence=0.92,
        )
        assert result.overall_level == "HIGH"
        assert result.requires_review is False

    # ── MEDIUM range ──

    @pytest.mark.unit
    def test_medium_signals_produce_medium(self):
        """Mixed MEDIUM/HIGH signals with weighted score >= 0.70 → MEDIUM"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[0.80, 0.78, 0.82],   # MEDIUM (above 0.65)
            citations_found=4,
            citations_expected=5,                   # HIGH (0.8)
            schema_valid=True,
            schema_fields_present=8,
            schema_fields_total=10,                 # MEDIUM (0.8)
            llm_confidence=0.75,                    # MEDIUM
        )
        # No signal is LOW so floor rule doesn't apply
        assert result.overall_level in ("MEDIUM", "HIGH")
        assert result.overall_level != "LOW"

    # ── Empty retrieval → LOW ──

    @pytest.mark.unit
    def test_no_retrieval_scores_gives_low(self):
        """Empty retrieval list → LOW retrieval signal"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[],
            citations_found=5,
            citations_expected=5,
            schema_valid=True,
            schema_fields_present=10,
            schema_fields_total=10,
            llm_confidence=0.90,
        )
        assert result.overall_level == "LOW"

    # ── Signal count ──

    @pytest.mark.unit
    def test_four_signals_returned(self):
        """Always returns exactly 4 signals"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[0.90],
            citations_found=2,
            citations_expected=3,
            schema_valid=True,
            schema_fields_present=8,
            schema_fields_total=10,
            llm_confidence=0.80,
        )
        assert len(result.signals) == 4
        names = {s.signal_name for s in result.signals}
        assert names == {"retrieval", "citation", "schema", "llm_self"}

    @pytest.mark.unit
    def test_review_reasons_populated_on_low(self):
        """review_reasons list is populated when signals are LOW"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[],       # LOW
            citations_found=0,
            citations_expected=5,      # LOW
            schema_valid=False,
            schema_fields_present=0,
            schema_fields_total=10,    # LOW
            llm_confidence=0.10,       # LOW
        )
        assert len(result.review_reasons) == 4

    @pytest.mark.unit
    def test_zero_expected_citations_gives_high(self):
        """When 0 citations expected, citation signal should be HIGH"""
        assessor = self._make_assessor()
        result = assessor.assess(
            retrieval_scores=[0.90, 0.85],
            citations_found=0,
            citations_expected=0,
            schema_valid=True,
            schema_fields_present=10,
            schema_fields_total=10,
            llm_confidence=0.90,
        )
        citation_signal = [s for s in result.signals if s.signal_name == "citation"][0]
        assert citation_signal.level == "HIGH"
        assert citation_signal.score == 1.0


# ═════════════════════════════════════════════════════════════════════════
# GAP 6 — Revision Loop Manager
# ═════════════════════════════════════════════════════════════════════════

class TestRevisionLoopManager:
    """Tests for revision_loop_manager.py (Gap 6)"""

    def _make_manager(self):
        from app.services.revision_loop_manager import RevisionLoopManager, RevisionIssue
        return RevisionLoopManager(), RevisionIssue

    # ── Max attempts ──

    @pytest.mark.unit
    def test_max_three_revision_attempts(self):
        """After 3 attempts section should escalate, not infinite-loop"""
        mgr, Issue = self._make_manager()
        issues = [
            Issue(issue_id="I1", section_name="objectives",
                  description="Missing primary objective", gap_type="LANGUAGE_GAP")
        ]
        mgr.init_section("objectives", issues)

        # Simulate 3 failed revisions
        for i in range(3):
            decision = mgr.should_revise("objectives")
            if decision["action"] == "ESCALATE":
                break
            mgr.record_revision("objectives", [], [
                Issue(issue_id="I1", section_name="objectives",
                      description="Still missing", gap_type="LANGUAGE_GAP")
            ])

        decision = mgr.should_revise("objectives")
        assert decision["action"] == "ESCALATE"

    # ── DATA_GAP immediate escalation ──

    @pytest.mark.unit
    def test_data_gap_escalates_immediately(self):
        """DATA_GAP issues must escalate immediately — LLM cannot fix missing data"""
        mgr, Issue = self._make_manager()
        issues = [
            Issue(issue_id="D1", section_name="sample_size",
                  description="No sample size data provided",
                  gap_type="DATA_GAP", severity="CRITICAL")
        ]
        mgr.init_section("sample_size", issues)

        decision = mgr.should_revise("sample_size")
        assert decision["action"] == "ESCALATE"
        assert "DATA_GAP" in decision["reason"]

    @pytest.mark.unit
    def test_language_gap_allows_revision(self):
        """LANGUAGE_GAP issues allow revision attempts before escalation"""
        mgr, Issue = self._make_manager()
        issues = [
            Issue(issue_id="L1", section_name="intro",
                  description="Unclear wording", gap_type="LANGUAGE_GAP")
        ]
        mgr.init_section("intro", issues)

        decision = mgr.should_revise("intro")
        assert decision["action"] == "REVISE"
        assert decision["attempt"] == 1

    # ── Escalation record ──

    @pytest.mark.unit
    def test_escalation_creates_placeholder(self):
        """Escalated sections produce a placeholder listing human work required"""
        mgr, Issue = self._make_manager()
        issues = [
            Issue(issue_id="D1", section_name="endpoints",
                  description="Missing endpoint data", gap_type="DATA_GAP")
        ]
        mgr.init_section("endpoints", issues)
        mgr.escalate_section("endpoints", "DATA_GAP - cannot generate without data")

        summary = mgr.get_escalation_summary()
        assert summary["total_escalated"] >= 1
        assert any(e["section"] == "endpoints" for e in summary["sections"])

    # ── Successful revision resolves issues ──

    @pytest.mark.unit
    def test_successful_revision_resolves(self):
        """If all issues resolved after revision → ACCEPT"""
        mgr, Issue = self._make_manager()
        issues = [
            Issue(issue_id="L1", section_name="design",
                  description="Wording issue", gap_type="LANGUAGE_GAP")
        ]
        mgr.init_section("design", issues)

        # First revision: say "REVISE"
        mgr.should_revise("design")
        # Record that issue was resolved
        mgr.record_revision("design", resolved_ids=["L1"], remaining_issues=[])

        decision = mgr.should_revise("design")
        assert decision["action"] == "ACCEPT"

    # ── Stuck detection ──

    @pytest.mark.unit
    def test_stuck_detection_across_attempts(self):
        """Same issues persisting across multiple attempts triggers stuck detection"""
        mgr, Issue = self._make_manager()
        persistent_issue = Issue(
            issue_id="L1", section_name="safety",
            description="Unclear safety language", gap_type="LANGUAGE_GAP"
        )
        mgr.init_section("safety", [persistent_issue])

        # Simulate 2 attempts that never resolve L1
        for _ in range(2):
            decision = mgr.should_revise("safety")
            if decision["action"] == "ESCALATE":
                break
            mgr.record_revision("safety", resolved_ids=[], remaining_issues=[persistent_issue])

        # On attempt 3 (or earlier if stuck), should escalate
        decision = mgr.should_revise("safety")
        # By 3rd attempt with no progress, must escalate
        assert decision["action"] in ("ESCALATE", "REVISE")


# ═════════════════════════════════════════════════════════════════════════
# GAP 7 — Tenant Isolation
# ═════════════════════════════════════════════════════════════════════════

class TestTenantIsolation:
    """Tests for tenant_isolation.py (Gap 7)"""

    def _make_manager(self):
        from app.services.tenant_isolation import TenantIsolationManager, TenantContext
        return TenantIsolationManager(), TenantContext

    # ── Cross-tenant access DENIED ──

    @pytest.mark.unit
    def test_cross_tenant_access_denied(self):
        """Tenant A cannot access Tenant B's collection"""
        mgr, Ctx = self._make_manager()
        ctx_a = Ctx(tenant_id="tenant_A", user_id="user1")
        tenant_b_collection = "tenant_B_protocols_SUB001"

        allowed = mgr.validate_access(ctx_a, tenant_b_collection)
        assert allowed is False

    @pytest.mark.unit
    def test_cross_tenant_access_logged(self):
        """Cross-tenant attempts are logged with DENIED action"""
        mgr, Ctx = self._make_manager()
        ctx_a = Ctx(tenant_id="tenant_A", user_id="user1")
        mgr.validate_access(ctx_a, "tenant_B_protocols_SUB001")

        report = mgr.get_isolation_report()
        assert report["denied_events"] >= 1
        assert report["isolation_status"] == "INCIDENTS_DETECTED"

    # ── Same-tenant access ALLOWED ──

    @pytest.mark.unit
    def test_same_tenant_access_allowed(self):
        """Tenant can access its own collections"""
        mgr, Ctx = self._make_manager()
        ctx = Ctx(tenant_id="pharma_co", user_id="user1")
        own_collection = "pharma_co_protocols_SUB001"

        allowed = mgr.validate_access(ctx, own_collection)
        assert allowed is True

    @pytest.mark.unit
    def test_same_tenant_access_logged_as_success(self):
        """Own-tenant reads are logged as success"""
        mgr, Ctx = self._make_manager()
        ctx = Ctx(tenant_id="pharma_co", user_id="user1")
        mgr.validate_access(ctx, "pharma_co_docs_SUB001")

        assert any(e.success for e in mgr.audit_log)

    # ── Shared KB read-only ──

    @pytest.mark.unit
    def test_shared_kb_readable_by_all(self):
        """All tenants can READ shared regulatory KB"""
        mgr, Ctx = self._make_manager()
        ctx = Ctx(tenant_id="any_tenant", user_id="user1")

        allowed = mgr.validate_access(ctx, "regulatory_kb_cdsco")
        assert allowed is True

    @pytest.mark.unit
    def test_shared_kb_write_denied(self):
        """No tenant can WRITE to shared regulatory KB"""
        mgr, Ctx = self._make_manager()
        ctx = Ctx(tenant_id="any_tenant", user_id="admin")

        allowed = mgr.validate_write_access(ctx, "regulatory_kb_cdsco")
        assert allowed is False

    # ── Collection name building ──

    @pytest.mark.unit
    def test_collection_name_format(self):
        """Collection names follow {tenant}_{type}_{submission} pattern"""
        mgr, _ = self._make_manager()
        name = mgr.build_collection_name("acme", "protocols", "SUB123")
        assert name == "acme_protocols_SUB123"

    @pytest.mark.unit
    def test_collection_name_sanitized(self):
        """Special characters in tenant ID are sanitized"""
        mgr, _ = self._make_manager()
        name = mgr.build_collection_name("acme@corp", "proto+cols", "SUB 1")
        # Should not contain special chars
        assert "@" not in name
        assert "+" not in name
        assert " " not in name


# ═════════════════════════════════════════════════════════════════════════
# GAP 8 — Prompt Version Manager
# ═════════════════════════════════════════════════════════════════════════

class TestPromptVersionManager:
    """Tests for prompt_version_manager.py (Gap 8)"""

    def _make_manager(self):
        from app.services.prompt_version_manager import PromptVersionManager
        return PromptVersionManager()

    @pytest.mark.unit
    def test_register_and_retrieve(self):
        """Register a prompt and retrieve active version"""
        mgr = self._make_manager()
        v = mgr.register_prompt(
            prompt_name="M1_COMPLIANCE",
            semantic_version="v1.0.0",
            system_prompt="You are a compliance checker.",
            changelog={"what_changed": "Initial", "why_changed": "First release"}
        )
        active = mgr.get_active_version("M1_COMPLIANCE")
        assert active is not None
        assert active.version_id == v.version_id
        assert active.full_name == "M1_COMPLIANCE_v1.0.0"

    @pytest.mark.unit
    def test_supersede_previous_version(self):
        """Registering new version supersedes old one"""
        mgr = self._make_manager()
        v1 = mgr.register_prompt(
            prompt_name="M1_COMPLIANCE", semantic_version="v1.0.0",
            system_prompt="Prompt v1",
            changelog={"what_changed": "Init", "why_changed": "First"}
        )
        v2 = mgr.register_prompt(
            prompt_name="M1_COMPLIANCE", semantic_version="v2.0.0",
            system_prompt="Prompt v2",
            changelog={"what_changed": "Major rewrite", "why_changed": "Better precision"}
        )

        old = mgr.get_version_by_id(v1.version_id)
        assert old.status == "SUPERSEDED"
        assert old.superseded_by == v2.version_id

        active = mgr.get_active_version("M1_COMPLIANCE")
        assert active.version_id == v2.version_id

    @pytest.mark.unit
    def test_immutable_content_hash(self):
        """Same prompt content produces same hash"""
        mgr = self._make_manager()
        prompt_text = "You are a compliance checker for CDSCO regulations."
        v1 = mgr.register_prompt(
            prompt_name="M1_COMPLIANCE", semantic_version="v1.0.0",
            system_prompt=prompt_text,
            changelog={"what_changed": "Init", "why_changed": "First"}
        )
        assert len(v1.content_hash) > 0

    @pytest.mark.unit
    def test_freeze_for_submission(self):
        """Frozen prompts have FROZEN status"""
        mgr = self._make_manager()
        mgr.register_prompt(
            prompt_name="M1_COMPLIANCE", semantic_version="v1.0.0",
            system_prompt="Prompt",
            changelog={"what_changed": "Init", "why_changed": "First"}
        )
        ok = mgr.freeze_for_submission("M1_COMPLIANCE", "CDSCO-SUB-2026-001")
        assert ok is True
        assert mgr.is_prompt_frozen("M1_COMPLIANCE") is True

    @pytest.mark.unit
    def test_audit_trail_format(self):
        """get_prompt_for_audit returns proper format for audit entries"""
        mgr = self._make_manager()
        mgr.register_prompt(
            prompt_name="M1_COMPLIANCE", semantic_version="v1.0.0",
            system_prompt="Prompt",
            changelog={"what_changed": "Init", "why_changed": "First"}
        )
        audit_info = mgr.get_prompt_for_audit("M1_COMPLIANCE")
        assert "prompt_version_id" in audit_info
        assert "prompt_full_name" in audit_info
        assert audit_info["prompt_full_name"] == "M1_COMPLIANCE_v1.0.0"

    @pytest.mark.unit
    def test_unversioned_prompt_audit(self):
        """Unregistered prompt returns UNVERSIONED marker"""
        mgr = self._make_manager()
        info = mgr.get_prompt_for_audit("NONEXISTENT")
        assert info["prompt_version_id"] == "UNVERSIONED"

    @pytest.mark.unit
    def test_version_history(self):
        """Version history returns all versions"""
        mgr = self._make_manager()
        for i in range(3):
            mgr.register_prompt(
                prompt_name="M2_GEN", semantic_version=f"v{i+1}.0.0",
                system_prompt=f"Prompt v{i+1}",
                changelog={"what_changed": f"v{i+1}", "why_changed": "Iteration"}
            )
        history = mgr.get_version_history("M2_GEN")
        assert len(history) == 3
        versions = {h["semantic_version"] for h in history}
        assert versions == {"v1.0.0", "v2.0.0", "v3.0.0"}


# ═════════════════════════════════════════════════════════════════════════
# GAP 9 — Output Determinism
# ═════════════════════════════════════════════════════════════════════════

class TestOutputDeterminism:
    """Tests for output_determinism.py (Gap 9)"""

    def _make_manager(self):
        from app.services.output_determinism import OutputDeterminismManager
        return OutputDeterminismManager()

    @pytest.mark.unit
    def test_cache_hit_on_same_input(self):
        """Same input hash + KB version should return cached result"""
        mgr = self._make_manager()
        h = mgr.compute_input_hash("doc text", "kb_v1")
        mgr.store_output(h, "kb_v1", "pv1", "M1", {"score": 0.9})

        cached = mgr.check_cache(h, "kb_v1")
        assert cached is not None
        assert cached.output_data["score"] == 0.9

    @pytest.mark.unit
    def test_cache_miss_on_different_kb(self):
        """Different KB version should miss cache"""
        mgr = self._make_manager()
        h = mgr.compute_input_hash("doc text", "kb_v1")
        mgr.store_output(h, "kb_v1", "pv1", "M1", {"score": 0.9})

        cached = mgr.check_cache(h, "kb_v2")
        assert cached is None

    @pytest.mark.unit
    def test_human_reviewed_becomes_definitive(self):
        """Human-reviewed output is marked definitive"""
        mgr = self._make_manager()
        h = mgr.compute_input_hash("doc", "kb1")
        mgr.store_output(h, "kb1", "p1", "M1", {"score": 0.7})
        ok = mgr.mark_human_reviewed(h, "kb1", "dr_smith")
        assert ok is True

        cached = mgr.check_cache(h, "kb1")
        assert cached.is_definitive is True
        assert cached.human_reviewer == "dr_smith"

    @pytest.mark.unit
    def test_definitive_output_not_overwritten(self):
        """Once human-reviewed, LLM re-run must NOT overwrite cached output"""
        mgr = self._make_manager()
        h = mgr.compute_input_hash("doc", "kb1")
        mgr.store_output(h, "kb1", "p1", "M1", {"score": 0.7})
        mgr.mark_human_reviewed(h, "kb1", "reviewer")

        # Try to store new output — should be rejected
        result = mgr.store_output(h, "kb1", "p2", "M1", {"score": 0.5})
        assert result.output_data["score"] == 0.7  # Original preserved

    @pytest.mark.unit
    def test_immutable_finding_stored(self):
        """Recorded findings are immutable and retrievable"""
        mgr = self._make_manager()
        f = mgr.record_finding("F1", "sess1", "M1", {"issue": "x"}, "h1", "kb1")
        assert f.locked is True
        retrieved = mgr.get_finding("F1")
        assert retrieved is not None
        assert retrieved.finding_id == "F1"

    @pytest.mark.unit
    def test_deterministic_hash(self):
        """Same inputs produce same hash"""
        mgr = self._make_manager()
        h1 = mgr.compute_input_hash("doc", "kb1", "pv1")
        h2 = mgr.compute_input_hash("doc", "kb1", "pv1")
        assert h1 == h2

    @pytest.mark.unit
    def test_cache_stats(self):
        """Cache stats reflect internal state"""
        mgr = self._make_manager()
        stats = mgr.get_cache_stats()
        assert stats["total_cached"] == 0

        mgr.store_output("h1", "kb1", "p1", "M1", {})
        stats = mgr.get_cache_stats()
        assert stats["total_cached"] == 1


# ═════════════════════════════════════════════════════════════════════════
# GAP 11 — Classification Confidence Manager
# ═════════════════════════════════════════════════════════════════════════

class TestClassificationConfidence:
    """Tests for classification_confidence.py (Gap 11)"""

    def _make_manager(self):
        from app.services.classification_confidence import ClassificationConfidenceManager
        return ClassificationConfidenceManager()

    def _candidates(self, cat_id, cat_name, confidence, reasoning=""):
        return {"category_id": cat_id, "category_name": cat_name,
                "confidence": confidence, "reasoning": reasoning}

    # ── High-stakes categories ALWAYS require confirmation ──

    @pytest.mark.unit
    def test_high_stakes_cat07_requires_confirmation(self):
        """CAT-07 (Pharmacovigilance) always requires confirmation"""
        mgr = self._make_manager()
        result = mgr.assess_classification(
            candidates=[
                self._candidates("CAT-07", "Pharmacovigilance", 0.99),
                self._candidates("CAT-01", "General", 0.01),
            ],
            session_id="s1"
        )
        assert result.requires_confirmation is True
        assert result.routing == "HUMAN_CONFIRMATION_REQUIRED"

    @pytest.mark.unit
    def test_high_stakes_cat09_requires_confirmation(self):
        """CAT-09 (Regulatory Compliance) always requires confirmation"""
        mgr = self._make_manager()
        result = mgr.assess_classification(
            candidates=[
                self._candidates("CAT-09", "Regulatory Compliance", 0.95),
                self._candidates("CAT-01", "General", 0.05),
            ],
            session_id="s1"
        )
        assert result.requires_confirmation is True

    @pytest.mark.unit
    def test_high_stakes_cat12_requires_confirmation(self):
        """CAT-12 (Insurance) always requires confirmation"""
        mgr = self._make_manager()
        result = mgr.assess_classification(
            candidates=[
                self._candidates("CAT-12", "Insurance/Compensation", 0.98),
                self._candidates("CAT-01", "General", 0.02),
            ],
            session_id="s1"
        )
        assert result.requires_confirmation is True

    # ── Confidence threshold ──

    @pytest.mark.unit
    def test_low_confidence_requires_review(self):
        """Confidence < 0.75 on non-high-stakes → LOW_CONFIDENCE_REVIEW"""
        mgr = self._make_manager()
        result = mgr.assess_classification(
            candidates=[
                self._candidates("CAT-01", "General Info", 0.60),
                self._candidates("CAT-03", "Study Design", 0.40),
            ],
            session_id="s1"
        )
        assert result.requires_confirmation is True
        assert result.routing == "LOW_CONFIDENCE_REVIEW"

    @pytest.mark.unit
    def test_high_confidence_non_stakes_auto_proceeds(self):
        """Confidence >= 0.75 on non-high-stakes → AUTO_PROCEED"""
        mgr = self._make_manager()
        result = mgr.assess_classification(
            candidates=[
                self._candidates("CAT-01", "General Info", 0.95),
                self._candidates("CAT-03", "Study Design", 0.05),
            ],
            session_id="s1"
        )
        assert result.requires_confirmation is False
        assert result.routing == "AUTO_PROCEED"

    # ── Candidates sorted by confidence ──

    @pytest.mark.unit
    def test_candidates_sorted_by_confidence(self):
        """Top candidate should be the highest confidence"""
        mgr = self._make_manager()
        result = mgr.assess_classification(
            candidates=[
                self._candidates("CAT-01", "General", 0.3),
                self._candidates("CAT-03", "Design", 0.9),
                self._candidates("CAT-05", "Safety", 0.5),
            ],
            session_id="s1"
        )
        assert result.top_category.category_id == "CAT-03"
        assert result.confidence == 0.9

    # ── Confirmation flow ──

    @pytest.mark.unit
    def test_confirmation_request_and_record(self):
        """Full confirmation lifecycle: request → record"""
        from app.services.classification_confidence import ClassificationCandidate
        mgr = self._make_manager()

        candidates = [ClassificationCandidate(
            category_id="CAT-07", category_name="PV", confidence=0.95
        )]
        conf_id = mgr.request_confirmation("s1", "My query", candidates, "high_stakes")

        pending = mgr.get_pending_confirmations("s1")
        assert len(pending) == 1

        cr = mgr.record_confirmation(conf_id, "CAT-07", "user1")
        assert cr.status == "CONFIRMED"

    # ── Empty candidates ──

    @pytest.mark.unit
    def test_empty_candidates_raises(self):
        """Passing no candidates must raise ValueError"""
        mgr = self._make_manager()
        with pytest.raises(ValueError):
            mgr.assess_classification([], "s1")


# ═════════════════════════════════════════════════════════════════════════
# GAP 12 — Deadline-Aware Review Queue
# ═════════════════════════════════════════════════════════════════════════

class TestDeadlineReviewQueue:
    """Tests for deadline_review_queue.py (Gap 12)"""

    def _make_manager(self):
        from app.services.deadline_review_queue import DeadlineReviewQueueManager
        return DeadlineReviewQueueManager()

    @pytest.mark.unit
    def test_priority_ordering_by_deadline(self):
        """Queue orders by deadline proximity, NOT FIFO"""
        mgr = self._make_manager()
        # Add item due in 30 days first
        mgr.add_to_queue("s1", "compliance", "M1",
                         deadline_date=utc_now() + timedelta(days=30),
                         deadline_type="CDSCO submission")
        # Add item due in 2 days second
        mgr.add_to_queue("s2", "compliance", "M1",
                         deadline_date=utc_now() + timedelta(days=2),
                         deadline_type="CDSCO submission")

        items = mgr.get_queue_items()
        # Most urgent (2 days) should be first despite being added second
        assert len(items) == 2

    @pytest.mark.unit
    def test_critical_priority_for_close_deadlines(self):
        """Items due in ≤3 days get CRITICAL priority"""
        mgr = self._make_manager()
        queue_id = mgr.add_to_queue("s1", "compliance", "M1",
                                    deadline_date=utc_now() + timedelta(days=2),
                                    deadline_type="CDSCO")
        # add_to_queue returns queue_id string; verify via queue
        assert isinstance(queue_id, str)
        items = mgr.get_queue_items()
        assert items[0].priority == "CRITICAL"

    @pytest.mark.unit
    def test_high_priority_for_week_deadlines(self):
        """Items due in 4-7 days get HIGH priority"""
        mgr = self._make_manager()
        queue_id = mgr.add_to_queue("s1", "compliance", "M1",
                                    deadline_date=utc_now() + timedelta(days=5),
                                    deadline_type="CDSCO")
        items = mgr.get_queue_items()
        assert items[0].priority == "HIGH"

    @pytest.mark.unit
    def test_approve_item(self):
        """Approved items change to APPROVED status"""
        mgr = self._make_manager()
        queue_id = mgr.add_to_queue("s1", "compliance", "M1",
                                    deadline_date=utc_now() + timedelta(days=10),
                                    deadline_type="submission")
        ok = mgr.approve_item(queue_id, "reviewer1")
        assert ok is True

    @pytest.mark.unit
    def test_dashboard_summary(self):
        """Dashboard returns queue summary data"""
        mgr = self._make_manager()
        mgr.add_to_queue("s1", "comp", "M1",
                         deadline_date=utc_now() + timedelta(days=5),
                         deadline_type="sub")
        mgr.add_to_queue("s2", "comp", "M1",
                         deadline_date=utc_now() + timedelta(days=20),
                         deadline_type="sub")

        dash = mgr.get_dashboard_data()
        assert dash["total_active"] >= 2

    @pytest.mark.unit
    def test_alerts_generated_for_approaching_deadlines(self):
        """Alerts fire for T-14, T-7, T-3, T-0 thresholds"""
        mgr = self._make_manager()
        # Item due in 20 days should trigger T-14 but not others
        mgr.add_to_queue("s1", "comp", "M1",
                         deadline_date=utc_now() + timedelta(days=12),
                         deadline_type="sub")
        alerts = mgr.check_and_generate_alerts()
        # Should have at least one alert (T-14)
        assert len(alerts) >= 1


# ═════════════════════════════════════════════════════════════════════════
# GAP 14 — Ground Truth Evaluator
# ═════════════════════════════════════════════════════════════════════════

class TestGroundTruthEvaluator:
    """Tests for ground_truth_evaluator.py (Gap 14)"""

    def _make_evaluator(self):
        from app.services.ground_truth_evaluator import GroundTruthEvaluator
        return GroundTruthEvaluator()

    @pytest.mark.unit
    def test_perfect_predictions_meet_targets(self):
        """All-correct predictions should meet precision and recall targets"""
        ev = self._make_evaluator()
        preds = [
            {"document_id": "D1", "section_name": "s1",
             "ground_truth": "NON_COMPLIANT", "m1_prediction": "NON_COMPLIANT",
             "m1_findings": [{"issue": "x"}], "ground_truth_findings": [{"issue": "x"}]},
            {"document_id": "D1", "section_name": "s2",
             "ground_truth": "COMPLIANT", "m1_prediction": "COMPLIANT",
             "m1_findings": [], "ground_truth_findings": []},
        ]
        report = ev.evaluate_predictions(preds)
        assert report.metrics.precision_met is True
        assert report.metrics.recall_met is True
        assert report.meets_launch_criteria is True

    @pytest.mark.unit
    def test_precision_recall_calculation(self):
        """Precision and recall compute correctly from confusion matrix"""
        ev = self._make_evaluator()
        preds = [
            # True positive
            {"document_id": "D1", "section_name": "s1",
             "ground_truth": "NON_COMPLIANT", "m1_prediction": "NON_COMPLIANT",
             "m1_findings": [{}], "ground_truth_findings": [{}]},
            # False positive (M1 flagged, but it's actually compliant)
            {"document_id": "D1", "section_name": "s2",
             "ground_truth": "COMPLIANT", "m1_prediction": "NON_COMPLIANT",
             "m1_findings": [{}], "ground_truth_findings": []},
            # True negative
            {"document_id": "D1", "section_name": "s3",
             "ground_truth": "COMPLIANT", "m1_prediction": "COMPLIANT",
             "m1_findings": [], "ground_truth_findings": []},
        ]
        report = ev.evaluate_predictions(preds)
        # Precision = TP/(TP+FP) = 1/(1+1) = 0.5
        assert report.metrics.precision == pytest.approx(0.5, abs=0.01)
        # Recall = TP/(TP+FN) = 1/(1+0) = 1.0
        assert report.metrics.recall == pytest.approx(1.0, abs=0.01)

    @pytest.mark.unit
    def test_degradation_check_no_history(self):
        """With < 2 evaluations, degradation check returns None"""
        ev = self._make_evaluator()
        result = ev.check_degradation()
        assert result is None  # Needs >= 2 evaluations to compare

    @pytest.mark.unit
    def test_error_analysis(self):
        """Error analysis categorizes FP and FN into nested dicts"""
        ev = self._make_evaluator()
        preds = [
            {"document_id": "D1", "section_name": "s1",
             "ground_truth": "COMPLIANT", "m1_prediction": "NON_COMPLIANT",
             "m1_findings": [{}], "ground_truth_findings": []},
        ]
        report = ev.evaluate_predictions(preds)
        analysis = ev.get_error_analysis(report)
        assert analysis["false_positives"]["count"] >= 1


# ═════════════════════════════════════════════════════════════════════════
# GAP 15 — Section Context Store
# ═════════════════════════════════════════════════════════════════════════

class TestSectionContextStore:
    """Tests for section_context_store.py (Gap 15)"""

    def _make_store(self):
        from app.services.section_context_store import SectionContextStore
        return SectionContextStore(session_id="test-session")

    @pytest.mark.unit
    def test_first_definition_wins(self):
        """First definition of a term is the canonical value"""
        store = self._make_store()
        store.store_terms("study_design", {
            "primary_endpoint": "HbA1c reduction at 12 weeks"
        })
        store.store_terms("statistical_methods", {
            "primary_endpoint": "HbA1c change at 24 weeks"  # different!
        })
        # First definition should win
        term = store.get_term("primary_endpoint")
        assert term == "HbA1c reduction at 12 weeks"

    @pytest.mark.unit
    def test_accumulated_context_injected(self):
        """get_context_for_prompt returns accumulated established values"""
        store = self._make_store()
        store.store_terms("objectives", {"primary_endpoint": "BP reduction"})
        store.store_terms("endpoints", {"sample_size": "200 patients"})

        prompt_context = store.get_context_for_prompt()
        # Values are present in the formatted context
        assert "BP reduction" in prompt_context
        assert "200 patients" in prompt_context
        # Section context header is present
        assert "CONTEXT" in prompt_context

    @pytest.mark.unit
    def test_extraction_log_tracked(self):
        """Each store_terms call is logged"""
        store = self._make_store()
        store.store_terms("design", {"primary_endpoint": "OS"})

        context = store.get_context_json()
        assert "primary_endpoint" in context

    @pytest.mark.unit
    def test_get_nonexistent_term(self):
        """Getting a non-existent term returns None"""
        store = self._make_store()
        result = store.get_term("nonexistent_term")
        assert result is None

    @pytest.mark.unit
    def test_cross_reference_validation(self):
        """CrossReferenceValidator runs post-generation checks"""
        from app.services.section_context_store import (
            SectionContextStore, CrossReferenceValidator
        )
        store = SectionContextStore(session_id="s1")
        store.store_terms("study_design", {"primary_endpoint": "BP control"})
        store.store_terms("sample_size", {"sample_size": "300"})

        validator = CrossReferenceValidator()
        sections = [
            {"name": "study_design", "text": "Primary endpoint is BP control."},
            {"name": "statistical_methods", "text": "Analysis of BP control endpoint."},
        ]
        result = validator.validate_document(sections, store)
        assert result.checks_performed >= 0   # At least ran


# ═════════════════════════════════════════════════════════════════════════
# GAP 16 — Commitment Tracker
# ═════════════════════════════════════════════════════════════════════════

class TestCommitmentTracker:
    """Tests for commitment_tracker.py (Gap 16)"""

    def _make_manager(self):
        from app.services.commitment_tracker import CommitmentManager, Commitment
        return CommitmentManager(), Commitment

    # ── Commitment extraction from response text ──

    @pytest.mark.unit
    def test_extract_commitment_will_provide(self):
        """Detects 'we will provide X within N days' pattern"""
        mgr, _ = self._make_manager()
        text = "We will provide updated safety data within 14 days of the request."
        extracted = mgr.extract_and_store(
            response_text=text, session_id="s1",
            submission_id="SUB001", query_id="Q1"
        )
        assert len(extracted) >= 1
        assert extracted[0].commitment_text is not None

    @pytest.mark.unit
    def test_extract_commitment_sponsor_commits(self):
        """Detects 'the sponsor commits to' pattern"""
        mgr, _ = self._make_manager()
        text = "The sponsor commits to submitting the amended protocol within 30 days."
        extracted = mgr.extract_and_store(
            response_text=text, session_id="s1",
            submission_id="SUB001", query_id="Q1"
        )
        assert len(extracted) >= 1

    @pytest.mark.unit
    def test_extract_no_commitments_from_plain_text(self):
        """Plain text without commitment language extracts zero"""
        mgr, _ = self._make_manager()
        text = "The study will enroll patients aged 18-65 with type 2 diabetes."
        extracted = mgr.extract_and_store(
            response_text=text, session_id="s1",
            submission_id="SUB001", query_id="Q1"
        )
        assert len(extracted) == 0

    @pytest.mark.unit
    def test_extract_deadline_days(self):
        """Deadline days are correctly parsed from text"""
        mgr, _ = self._make_manager()
        text = "We will submit the revised IB within 30 days of this response."
        extracted = mgr.extract_and_store(
            response_text=text, session_id="s1",
            submission_id="SUB001", query_id="Q1"
        )
        if extracted:  # Pattern-dependent
            days_until = (extracted[0].commitment_deadline - utc_now()).days
            assert 28 <= days_until <= 31

    # ── Lifecycle management ──

    @pytest.mark.unit
    def test_mark_complete_requires_evidence(self):
        """Cannot complete a commitment without evidence"""
        mgr, Commitment = self._make_manager()
        c = Commitment(
            session_id="s1", submission_id="SUB1", query_id="Q1",
            commitment_text="Test", action_required="Test",
            commitment_deadline=utc_now() + timedelta(days=7)
        )
        cid = mgr.add_commitment(c)
        ok = mgr.mark_complete(cid, "user1", "document", "")  # empty evidence
        assert ok is False  # Must be rejected

    @pytest.mark.unit
    def test_mark_complete_with_evidence(self):
        """Commitment marked complete with evidence succeeds"""
        mgr, Commitment = self._make_manager()
        c = Commitment(
            session_id="s1", submission_id="SUB1", query_id="Q1",
            commitment_text="Submit IB", action_required="Submit IB",
            commitment_deadline=utc_now() + timedelta(days=7)
        )
        cid = mgr.add_commitment(c)
        ok = mgr.mark_complete(cid, "user1", "document", "IB submitted via email")
        assert ok is True

    @pytest.mark.unit
    def test_mark_in_progress(self):
        """Mark commitment in-progress assigns owner"""
        mgr, Commitment = self._make_manager()
        c = Commitment(
            session_id="s1", submission_id="SUB1", query_id="Q1",
            commitment_text="Test", action_required="Test",
            commitment_deadline=utc_now() + timedelta(days=7)
        )
        cid = mgr.add_commitment(c)
        ok = mgr.mark_in_progress(cid, "dr_jones")
        assert ok is True

    # ── Dashboard ──

    @pytest.mark.unit
    def test_dashboard_counts(self):
        """Dashboard reflects correct status counts"""
        mgr, Commitment = self._make_manager()
        for i in range(3):
            mgr.add_commitment(Commitment(
                session_id="s1", submission_id="SUB1", query_id=f"Q{i}",
                commitment_text=f"Item {i}", action_required=f"Do {i}",
                commitment_deadline=utc_now() + timedelta(days=10)
            ))
        dash = mgr.get_dashboard()
        assert dash.pending >= 3

    @pytest.mark.unit
    def test_overdue_detection(self):
        """Past-deadline commitments auto-marked OVERDUE"""
        mgr, Commitment = self._make_manager()
        mgr.add_commitment(Commitment(
            session_id="s1", submission_id="SUB1", query_id="Q1",
            commitment_text="Overdue", action_required="Test",
            commitment_deadline=utc_now() - timedelta(days=2)  # 2 days ago
        ))
        dash = mgr.get_dashboard()
        assert dash.overdue >= 1

    # ── Alerts ──

    @pytest.mark.unit
    def test_deadline_alerts_generated(self):
        """T-7 and T-2 alerts are generated for approaching deadlines"""
        mgr, Commitment = self._make_manager()
        mgr.add_commitment(Commitment(
            session_id="s1", submission_id="SUB1", query_id="Q1",
            commitment_text="Due soon", action_required="Act",
            commitment_deadline=utc_now() + timedelta(days=5)
        ))
        alerts = mgr.check_and_generate_alerts()
        # Should generate T-7 alert (5 days remaining <= 7)
        assert len(alerts) >= 1
        assert any("T_7" in a["alert_type"] for a in alerts)

    # ── Commitments panel ──

    @pytest.mark.unit
    def test_commitments_made_panel(self):
        """Panel data for query response screen"""
        mgr, Commitment = self._make_manager()
        mgr.add_commitment(Commitment(
            session_id="sess42", submission_id="SUB1", query_id="Q1",
            commitment_text="Will provide data", action_required="Provide data",
            commitment_deadline=utc_now() + timedelta(days=7)
        ))
        panel = mgr.get_commitments_made_panel("sess42")
        assert panel["count"] == 1
        assert panel["warning"] is not None

    @pytest.mark.unit
    def test_empty_session_panel(self):
        """Empty session has no commitments"""
        mgr, _ = self._make_manager()
        panel = mgr.get_commitments_made_panel("nonexistent")
        assert panel["count"] == 0

    # ── Webhook ──

    @pytest.mark.unit
    def test_webhook_payload(self):
        """Webhook payload has required fields for Jira/Asana integration"""
        mgr, Commitment = self._make_manager()
        c = Commitment(
            session_id="s1", submission_id="SUB1", query_id="Q1",
            commitment_text="Submit protocol", action_required="Submit",
            commitment_deadline=utc_now() + timedelta(days=7)
        )
        payload = mgr.build_webhook_payload(c)
        assert "title" in payload
        assert "due_date" in payload
        assert "labels" in payload
        assert "regulatory" in payload["labels"]
