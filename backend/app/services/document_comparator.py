"""M6 document version comparison engine."""

import difflib
import json
import re
from typing import Any, Dict, List

from app.services.claude_client import call_claude, parse_claude_json, MODEL_SONNET


class DocumentVersionComparator:
    async def compare_versions(self, doc_v1_text: str, doc_v2_text: str, doc_type: str) -> Dict[str, Any]:
        structural_changes = await self._detect_structural_changes(doc_v1_text, doc_v2_text)
        substantive_changes = await self._detect_substantive_changes(doc_v1_text, doc_v2_text, doc_type)
        table_changes = await self._detect_table_changes(doc_v1_text, doc_v2_text)
        impact = await self._assess_change_impact(substantive_changes, doc_type)
        return {
            "summary": {
                "total_changes": len(structural_changes) + len(substantive_changes),
                "substantive_changes": len(substantive_changes),
                "formatting_only_changes": len(structural_changes),
                "table_changes": len(table_changes),
                "risk_level": impact.get("risk_level", "LOW"),
            },
            "structural_changes": structural_changes,
            "substantive_changes": substantive_changes,
            "table_changes": table_changes,
            "regulatory_impact": impact,
            "diff_html": self._generate_html_diff(doc_v1_text, doc_v2_text),
        }

    async def _detect_structural_changes(self, v1: str, v2: str) -> List[Dict]:
        headers = re.compile(r"^(?:\d+[\.\\)]\s+)?[A-Z][A-Za-z0-9\-\s]{4,}$", re.MULTILINE)
        s1 = set(headers.findall(v1))
        s2 = set(headers.findall(v2))
        changes = []
        for h in sorted(s2 - s1):
            changes.append({"section": h, "change_type": "ADDITION"})
        for h in sorted(s1 - s2):
            changes.append({"section": h, "change_type": "DELETION"})
        return changes

    async def _detect_table_changes(self, v1: str, v2: str) -> List[Dict]:
        rows1 = [line for line in v1.splitlines() if "|" in line]
        rows2 = [line for line in v2.splitlines() if "|" in line]
        if rows1 == rows2:
            return []
        return [{"change": "TABLE_CONTENT_MODIFIED", "row_delta": abs(len(rows2) - len(rows1))}]

    async def _assess_change_impact(self, substantive_changes: List[Dict], doc_type: str) -> Dict:
        high = sum(1 for c in substantive_changes if c.get("regulatory_significance") == "HIGH")
        medium = sum(1 for c in substantive_changes if c.get("regulatory_significance") == "MEDIUM")
        risk = "HIGH" if high else "MEDIUM" if medium else "LOW"
        return {"doc_type": doc_type, "risk_level": risk, "high": high, "medium": medium}

    async def _detect_substantive_changes(self, v1: str, v2: str, doc_type: str) -> List[Dict]:
        prompt = f"""
        You are a senior CDSCO reviewer comparing two versions of a {doc_type}.
        Identify substantive changes only (regulatory/patient safety/scientific/legal).
        Return JSON array with section, change_type, v1_text, v2_text,
        regulatory_significance, requires_amendment, relevant_guideline.
        VERSION 1: {v1[:3000]}
        VERSION 2: {v2[:3000]}
        """
        result = call_claude(
            prompt=prompt,
            system_prompt="Return JSON only.",
            model=MODEL_SONNET,
            max_tokens=1500,
            temperature=0.0,
        )
        try:
            parsed = json.loads(result["content"])
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []

    def _generate_html_diff(self, v1: str, v2: str) -> str:
        differ = difflib.HtmlDiff(wrapcolumn=80)
        return differ.make_file(
            v1.splitlines(keepends=True),
            v2.splitlines(keepends=True),
            fromdesc="Version 1",
            todesc="Version 2",
            context=True,
            numlines=3,
        )
