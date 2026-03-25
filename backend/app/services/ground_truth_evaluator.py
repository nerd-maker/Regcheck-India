"""
Ground Truth Validation Framework (Gap 14)

Measures M1 accuracy against expert-annotated real protocols:
- 10 CDSCO-approved + 10 rejected protocols
- Precision/recall measurement (targets: >=80% / >=75%)
- Quarterly re-evaluation schedule
- Error analysis (false positives/negatives)
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.config.llm_config import LLMConfig
from app.core.datetime_utils import utc_now

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class GroundTruthFinding(BaseModel):
    """Specific compliance issue identified by expert"""
    finding_type: str  # missing_element, incorrect_language, etc.
    regulatory_reference: str  # e.g. "NDCTR Rule 22(3)(a)"
    description: str
    severity: str  # CRITICAL, MAJOR, MINOR


class AnnotatedSection(BaseModel):
    """Section with expert-determined compliance status"""
    section_name: str
    section_text: str
    ground_truth_status: str  # COMPLIANT or NON_COMPLIANT
    ground_truth_findings: List[GroundTruthFinding] = Field(default_factory=list)
    annotation_confidence: str = "HIGH"  # HIGH, MEDIUM, LOW
    annotation_notes: Optional[str] = None


class GroundTruthDocument(BaseModel):
    """Real protocol with expert annotations"""
    document_id: str
    source: str  # CTRI_public, CRO_partner, CDSCO_published
    document_type: str  # protocol, icf, investigator_brochure
    cdsco_status: str  # APPROVED, REJECTED, QUERIED
    deficiency_letter: Optional[str] = None
    sections: List[AnnotatedSection]
    therapeutic_area: str = ""
    trial_phase: str = ""
    annotated_by: str = ""
    annotated_at: datetime = Field(default_factory=utc_now)


class EvaluationPrediction(BaseModel):
    """Single section prediction vs ground truth"""
    document_id: str
    section_name: str
    ground_truth: str
    m1_prediction: str
    correct: bool
    m1_findings: List[Dict] = Field(default_factory=list)
    ground_truth_findings: List[Dict] = Field(default_factory=list)


class ConfusionMatrix(BaseModel):
    """Standard confusion matrix"""
    true_positives: int = 0
    false_positives: int = 0
    true_negatives: int = 0
    false_negatives: int = 0


class EvaluationMetrics(BaseModel):
    """Precision, recall, F1 metrics"""
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    accuracy: float = 0.0
    confusion_matrix: ConfusionMatrix = Field(default_factory=ConfusionMatrix)
    precision_target: float = 0.80
    precision_met: bool = False
    recall_target: float = 0.75
    recall_met: bool = False
    total_sections: int = 0


class EvaluationReport(BaseModel):
    """Full evaluation run report"""
    report_id: str
    evaluation_date: datetime = Field(default_factory=utc_now)
    kb_version: str = ""
    prompt_version: str = ""
    dataset_size: int = 0
    total_sections: int = 0
    metrics: EvaluationMetrics = Field(default_factory=EvaluationMetrics)
    predictions: List[EvaluationPrediction] = Field(default_factory=list)
    meets_launch_criteria: bool = False


# ──────────────────────────────────────────────────────
# Ground Truth Evaluator
# ──────────────────────────────────────────────────────

class GroundTruthEvaluator:
    """
    Runs M1 against ground truth dataset and measures accuracy.

    Targets: Precision >= 80%, Recall >= 75%
    Re-run quarterly as prompts and KB evolve.
    """

    def __init__(self):
        self.evaluation_history: List[EvaluationReport] = []

    def evaluate_predictions(
        self,
        predictions: List[Dict],
        kb_version: str = "",
        prompt_version: str = ""
    ) -> EvaluationReport:
        """
        Evaluate a list of predictions against ground truth.

        Each prediction: {"document_id", "section_name", "ground_truth", "m1_prediction",
                          "m1_findings": [...], "ground_truth_findings": [...]}
        """
        parsed = []
        for p in predictions:
            pred = EvaluationPrediction(
                document_id=p["document_id"],
                section_name=p["section_name"],
                ground_truth=p["ground_truth"],
                m1_prediction=p["m1_prediction"],
                correct=p["m1_prediction"] == p["ground_truth"],
                m1_findings=p.get("m1_findings", []),
                ground_truth_findings=p.get("ground_truth_findings", [])
            )
            parsed.append(pred)

        metrics = self._calculate_metrics(parsed)

        report = EvaluationReport(
            report_id=f"eval-{utc_now().strftime('%Y%m%d-%H%M%S')}",
            kb_version=kb_version,
            prompt_version=prompt_version,
            dataset_size=len(set(p.document_id for p in parsed)),
            total_sections=len(parsed),
            metrics=metrics,
            predictions=parsed,
            meets_launch_criteria=(metrics.precision_met and metrics.recall_met)
        )

        self.evaluation_history.append(report)

        logger.info(
            f"Ground truth evaluation complete: "
            f"Precision={metrics.precision:.2%} (target {metrics.precision_target:.0%}), "
            f"Recall={metrics.recall:.2%} (target {metrics.recall_target:.0%}), "
            f"Launch criteria: {'MET' if report.meets_launch_criteria else 'NOT MET'}",
            extra={
                "precision": metrics.precision,
                "recall": metrics.recall,
                "f1": metrics.f1_score,
                "meets_criteria": report.meets_launch_criteria
            }
        )

        return report

    def _calculate_metrics(self, predictions: List[EvaluationPrediction]) -> EvaluationMetrics:
        """Calculate precision, recall, F1 from predictions."""
        cm = ConfusionMatrix()

        for p in predictions:
            if p.m1_prediction == "NON_COMPLIANT" and p.ground_truth == "NON_COMPLIANT":
                cm.true_positives += 1
            elif p.m1_prediction == "NON_COMPLIANT" and p.ground_truth == "COMPLIANT":
                cm.false_positives += 1
            elif p.m1_prediction == "COMPLIANT" and p.ground_truth == "COMPLIANT":
                cm.true_negatives += 1
            elif p.m1_prediction == "COMPLIANT" and p.ground_truth == "NON_COMPLIANT":
                cm.false_negatives += 1

        tp, fp, tn, fn = cm.true_positives, cm.false_positives, cm.true_negatives, cm.false_negatives
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        accuracy = (tp + tn) / len(predictions) if predictions else 0.0

        return EvaluationMetrics(
            precision=round(precision, 4),
            recall=round(recall, 4),
            f1_score=round(f1, 4),
            accuracy=round(accuracy, 4),
            confusion_matrix=cm,
            precision_target=LLMConfig.PRECISION_TARGET,
            precision_met=precision >= LLMConfig.PRECISION_TARGET,
            recall_target=LLMConfig.RECALL_TARGET,
            recall_met=recall >= LLMConfig.RECALL_TARGET,
            total_sections=len(predictions)
        )

    def check_degradation(self) -> Optional[Dict]:
        """Check if accuracy degraded compared to previous evaluation."""
        if len(self.evaluation_history) < 2:
            return None

        prev = self.evaluation_history[-2].metrics
        curr = self.evaluation_history[-1].metrics

        p_delta = curr.precision - prev.precision
        r_delta = curr.recall - prev.recall

        degraded = p_delta < -0.05 or r_delta < -0.05

        if degraded:
            logger.warning(
                f"Accuracy degradation detected! "
                f"Precision: {p_delta:+.2%}, Recall: {r_delta:+.2%}"
            )

        return {
            "degraded": degraded,
            "precision_delta": round(p_delta, 4),
            "recall_delta": round(r_delta, 4),
            "previous_precision": prev.precision,
            "current_precision": curr.precision,
            "previous_recall": prev.recall,
            "current_recall": curr.recall
        }

    def get_error_analysis(self, report: Optional[EvaluationReport] = None) -> Dict:
        """Categorize false positives and false negatives for improvement."""
        if report is None:
            if not self.evaluation_history:
                return {"false_positives": [], "false_negatives": []}
            report = self.evaluation_history[-1]

        fps = [p for p in report.predictions
               if p.m1_prediction == "NON_COMPLIANT" and p.ground_truth == "COMPLIANT"]
        fns = [p for p in report.predictions
               if p.m1_prediction == "COMPLIANT" and p.ground_truth == "NON_COMPLIANT"]

        return {
            "false_positives": {
                "count": len(fps),
                "sections": [p.section_name for p in fps],
                "recommendation": "Review prompt for overly strict criteria"
            },
            "false_negatives": {
                "count": len(fns),
                "sections": [p.section_name for p in fns],
                "missed_findings": [
                    {"section": p.section_name, "missed": p.ground_truth_findings}
                    for p in fns
                ],
                "recommendation": "Review KB coverage and retrieval quality"
            }
        }

    def get_trend_report(self) -> Dict:
        """Get accuracy trends across all evaluations."""
        return {
            "evaluations": [
                {
                    "report_id": r.report_id,
                    "date": r.evaluation_date.isoformat(),
                    "precision": r.metrics.precision,
                    "recall": r.metrics.recall,
                    "f1": r.metrics.f1_score,
                    "meets_targets": r.meets_launch_criteria,
                    "dataset_size": r.dataset_size
                }
                for r in self.evaluation_history
            ]
        }


# Global instance
ground_truth_evaluator = GroundTruthEvaluator()
