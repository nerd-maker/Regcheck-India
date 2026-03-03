"""
Weekly Digest Generator Service

Generates professional weekly regulatory intelligence digests for RA teams.
"""

import json
import logging
from datetime import datetime
from typing import List, Dict, Any
from openai import OpenAI

from app.core.config import settings
from app.models.regulatory_change_schemas import (
    RegulatoryChange,
    SubmissionImpactAssessment,
    WeeklyDigest,
    CriticalAction,
    DetailedChange,
    DigestGenerationRequest
)
from app.prompts.regulatory_intelligence_prompts import (
    SYSTEM_PROMPT,
    WEEKLY_DIGEST_PROMPT
)

logger = logging.getLogger(__name__)


class WeeklyDigestGenerator:
    """
    Generates weekly regulatory intelligence digest.
    
    Uses Claude API to:
    1. Aggregate changes for the week
    2. Format executive summary
    3. Identify critical actions
    4. Create detailed change log
    5. List monitoring items
    """
    
    def __init__(self):
        """Initialize the generator with Claude API client"""
        self.client = OpenAI(
            api_key=settings.llm_api_key or "placeholder",
            base_url=settings.llm_base_url
        )
        self.model = settings.llm_model
    
    
    def generate_digest(
        self,
        changes: List[RegulatoryChange],
        impact_assessments: List[SubmissionImpactAssessment],
        start_date: str,
        end_date: str
    ) -> WeeklyDigest:
        """
        Generate weekly digest from changes and impact assessments.
        
        Args:
            changes: List of RegulatoryChange objects for the week
            impact_assessments: List of SubmissionImpactAssessment objects
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            WeeklyDigest object
        """
        # Count metrics
        new_documents_count = len(set(c.source_citation for c in changes))
        changes_count = len(changes)
        critical_high_count = len([c for c in changes if c.urgency in ["CRITICAL", "HIGH"]])
        
        # Format changes and impacts for prompt
        changes_json = json.dumps([c.model_dump() for c in changes], indent=2)
        impact_assessments_json = json.dumps([ia.model_dump() for ia in impact_assessments], indent=2)
        
        # Format the digest prompt
        prompt = WEEKLY_DIGEST_PROMPT.format(
            start_date=start_date,
            end_date=end_date,
            new_documents_count=new_documents_count,
            changes_count=changes_count,
            critical_high_count=critical_high_count,
            changes_json=changes_json,
            impact_assessments_json=impact_assessments_json
        )
        
        # Call Claude API
        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=6000,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
        )
        
        # Parse response
        response_text = response.choices[0].message.content
        
        # Extract JSON from response
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            json_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            json_text = response_text[json_start:json_end].strip()
        else:
            json_text = response_text.strip()
        
        # Parse JSON response
        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Claude response as JSON: {e}\nResponse: {response_text}")
        
        # Add metadata
        parsed["period_start"] = start_date
        parsed["period_end"] = end_date
        parsed["new_documents_detected"] = new_documents_count
        parsed["changes_extracted"] = changes_count
        parsed["critical_high_urgency_changes"] = critical_high_count
        parsed["active_submissions_impacted"] = len(set(ia.submission_id for ia in impact_assessments if ia.impact_status in ["IMPACTED", "LIKELY_IMPACTED"]))
        
        # Create WeeklyDigest object
        return WeeklyDigest(**parsed)
    
    
    def format_executive_summary(self, changes: List[RegulatoryChange]) -> str:
        """
        Format executive summary (3-4 sentences).
        
        Args:
            changes: List of RegulatoryChange objects
        
        Returns:
            Executive summary text
        """
        if not changes:
            return "No material regulatory changes were published by CDSCO or MOHFW during this period."
        
        # Group by urgency
        critical = [c for c in changes if c.urgency == "CRITICAL"]
        high = [c for c in changes if c.urgency == "HIGH"]
        
        summary_parts = []
        
        if critical:
            summary_parts.append(f"{len(critical)} critical regulatory change(s) requiring immediate attention")
        
        if high:
            summary_parts.append(f"{len(high)} high-priority change(s)")
        
        if not critical and not high:
            summary_parts.append(f"{len(changes)} regulatory update(s)")
        
        # Add domain info
        domains = set(c.domain for c in changes)
        if len(domains) <= 3:
            summary_parts.append(f"affecting {', '.join(domains)}")
        else:
            summary_parts.append(f"affecting {len(domains)} regulatory domains")
        
        return ". ".join(summary_parts) + "."
    
    
    def format_critical_actions(self, changes: List[RegulatoryChange]) -> List[CriticalAction]:
        """
        Format critical actions requiring immediate attention.
        
        Args:
            changes: List of RegulatoryChange objects
        
        Returns:
            List of CriticalAction objects
        """
        critical_changes = [c for c in changes if c.urgency in ["CRITICAL", "HIGH"]]
        
        actions = []
        for change in critical_changes:
            action = CriticalAction(
                deadline=change.effective_date,
                action=change.recommended_action,
                affected_parties=", ".join(change.affected_submission_types),
                change_id=change.change_id
            )
            actions.append(action)
        
        # Sort by deadline
        actions.sort(key=lambda a: a.deadline if a.deadline not in ["IMMEDIATE", "UNCLEAR"] else "9999-12-31")
        
        return actions
    
    
    def format_detailed_changelog(self, changes: List[RegulatoryChange]) -> List[DetailedChange]:
        """
        Format detailed change log (one paragraph per change).
        
        Args:
            changes: List of RegulatoryChange objects
        
        Returns:
            List of DetailedChange objects
        """
        detailed_changes = []
        
        for change in changes:
            detailed = DetailedChange(
                change_title=f"{change.domain}: {change.change_type.replace('_', ' ').title()}",
                effective_date=change.effective_date,
                affects=f"{', '.join(change.affected_submission_types)} submissions for {', '.join(change.affected_product_categories)}",
                what_to_do=change.recommended_action,
                source_citation=change.source_citation,
                urgency=change.urgency
            )
            detailed_changes.append(detailed)
        
        # Sort by urgency
        urgency_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        detailed_changes.sort(key=lambda d: urgency_order.get(d.urgency, 4))
        
        return detailed_changes
    
    
    def format_monitoring_items(self, changes: List[RegulatoryChange]) -> List[str]:
        """
        Format lower-urgency changes to monitor.
        
        Args:
            changes: List of RegulatoryChange objects
        
        Returns:
            List of monitoring item strings
        """
        low_urgency = [c for c in changes if c.urgency in ["MEDIUM", "LOW"]]
        
        items = []
        for change in low_urgency:
            item = f"{change.domain}: {change.plain_language_summary[:100]}..."
            items.append(item)
        
        return items
    
    
    def export_digest(
        self,
        digest: WeeklyDigest,
        format: str = "text"
    ) -> str:
        """
        Export digest in specified format.
        
        Args:
            digest: WeeklyDigest object
            format: Export format (text, html, markdown)
        
        Returns:
            Formatted digest string
        """
        if format == "text":
            return self._export_as_text(digest)
        elif format == "html":
            return self._export_as_html(digest)
        elif format == "markdown":
            return self._export_as_markdown(digest)
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    
    def _export_as_text(self, digest: WeeklyDigest) -> str:
        """Export digest as plain text"""
        lines = []
        lines.append("=" * 80)
        lines.append("WEEKLY REGULATORY DIGEST")
        lines.append(f"Period: {digest.period_start} to {digest.period_end}")
        lines.append("=" * 80)
        lines.append("")
        
        lines.append("EXECUTIVE SUMMARY")
        lines.append("-" * 80)
        lines.append(digest.executive_summary)
        lines.append("")
        
        if digest.critical_actions:
            lines.append("CRITICAL ACTIONS REQUIRED")
            lines.append("-" * 80)
            for action in digest.critical_actions:
                lines.append(f"[DEADLINE: {action.deadline}] — {action.action} — {action.affected_parties}")
            lines.append("")
        
        if digest.detailed_changes:
            lines.append("DETAILED CHANGE LOG")
            lines.append("-" * 80)
            for change in digest.detailed_changes:
                lines.append(f"\nCHANGE: {change.change_title}")
                lines.append(f"EFFECTIVE: {change.effective_date}")
                lines.append(f"AFFECTS: {change.affects}")
                lines.append(f"WHAT TO DO: {change.what_to_do}")
                lines.append(f"SOURCE: {change.source_citation}")
                lines.append("")
        
        if digest.monitoring_items:
            lines.append("CHANGES TO MONITOR")
            lines.append("-" * 80)
            for item in digest.monitoring_items:
                lines.append(f"• {item}")
            lines.append("")
        
        lines.append("=" * 80)
        lines.append(f"Generated by RegWatch-India AI on {digest.generated_date.strftime('%Y-%m-%d %H:%M')}")
        lines.append("=" * 80)
        
        return "\n".join(lines)
    
    
    def _export_as_markdown(self, digest: WeeklyDigest) -> str:
        """Export digest as markdown"""
        lines = []
        lines.append(f"# Weekly Regulatory Digest")
        lines.append(f"**Period:** {digest.period_start} to {digest.period_end}")
        lines.append("")
        
        lines.append("## Executive Summary")
        lines.append(digest.executive_summary)
        lines.append("")
        
        if digest.critical_actions:
            lines.append("## Critical Actions Required")
            for action in digest.critical_actions:
                lines.append(f"- **[DEADLINE: {action.deadline}]** — {action.action} — *{action.affected_parties}*")
            lines.append("")
        
        if digest.detailed_changes:
            lines.append("## Detailed Change Log")
            for change in digest.detailed_changes:
                lines.append(f"\n### {change.change_title}")
                lines.append(f"- **Effective:** {change.effective_date}")
                lines.append(f"- **Affects:** {change.affects}")
                lines.append(f"- **What to Do:** {change.what_to_do}")
                lines.append(f"- **Source:** {change.source_citation}")
        
        if digest.monitoring_items:
            lines.append("\n## Changes to Monitor")
            for item in digest.monitoring_items:
                lines.append(f"- {item}")
        
        lines.append(f"\n---\n*Generated by RegWatch-India AI on {digest.generated_date.strftime('%Y-%m-%d %H:%M')}*")
        
        return "\n".join(lines)
    
    
    def _export_as_html(self, digest: WeeklyDigest) -> str:
        """Export digest as HTML"""
        # Simple HTML export - can be enhanced with CSS styling
        html = f"""
        <html>
        <head><title>Weekly Regulatory Digest</title></head>
        <body>
        <h1>Weekly Regulatory Digest</h1>
        <p><strong>Period:</strong> {digest.period_start} to {digest.period_end}</p>
        
        <h2>Executive Summary</h2>
        <p>{digest.executive_summary}</p>
        """
        
        if digest.critical_actions:
            html += "<h2>Critical Actions Required</h2><ul>"
            for action in digest.critical_actions:
                html += f"<li><strong>[DEADLINE: {action.deadline}]</strong> — {action.action} — <em>{action.affected_parties}</em></li>"
            html += "</ul>"
        
        if digest.detailed_changes:
            html += "<h2>Detailed Change Log</h2>"
            for change in digest.detailed_changes:
                html += f"""
                <h3>{change.change_title}</h3>
                <ul>
                <li><strong>Effective:</strong> {change.effective_date}</li>
                <li><strong>Affects:</strong> {change.affects}</li>
                <li><strong>What to Do:</strong> {change.what_to_do}</li>
                <li><strong>Source:</strong> {change.source_citation}</li>
                </ul>
                """
        
        if digest.monitoring_items:
            html += "<h2>Changes to Monitor</h2><ul>"
            for item in digest.monitoring_items:
                html += f"<li>{item}</li>"
            html += "</ul>"
        
        html += f"<hr><p><em>Generated by RegWatch-India AI on {digest.generated_date.strftime('%Y-%m-%d %H:%M')}</em></p>"
        html += "</body></html>"
        
        return html
