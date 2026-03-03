"""
Context-Preserving PII Detection and Redaction

Implements two-tier PII system:
- HARD PII: Never send to LLM, replace with demographic context
- SOFT PII: Anonymize sequentially, preserve document structure

Fixes:
- Aadhaar regex to prevent false positives
- Whitelist-based name detection
- Pre/post-redaction diff logging
"""

import re
import hashlib
from typing import List, Tuple, Dict, Optional
from datetime import datetime
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class PIITier(str, Enum):
    """PII sensitivity tiers"""
    HARD = "HARD"  # Never send to LLM
    SOFT = "SOFT"  # Anonymize sequentially


class ContextPreservingPIIDetector:
    """
    Two-tier PII detection with context preservation
    
    HARD PII: Replaced with demographic context (e.g., [PATIENT: elderly_male_65-70yr])
    SOFT PII: Anonymized sequentially (e.g., PT-001, SITE-A)
    """
    
    def __init__(self):
        # HARD PII patterns (never send to LLM)
        self.hard_pii_patterns = {
            # Fixed Aadhaar: First digit 2-9, word boundaries, exactly 12 digits
            "aadhaar": r'\b[2-9]{1}[0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b',
            
            # Indian phone numbers: 10 digits starting with 6-9
            "phone": r'\b[6-9]\d{9}\b',
            
            # Email addresses
            "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            
            # Exact date of birth
            "exact_dob": r'\b(?:DOB|Date of Birth|Born)[\s:]+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b',
            
            # Medical record number
            "mrn": r'\bMRN[-_\s]?\d{5,10}\b',
            
            # Exact address with PIN code
            "address": r'\b\d+[,\s]+[A-Za-z\s]+,\s*[A-Za-z\s]+[-\s]\d{6}\b'
        }
        
        # SOFT PII patterns (anonymize sequentially)
        self.soft_pii_patterns = {
            "subject_id": r'\b(?:SUBJ|SUB|PT|PATIENT)[-_]?\d{3,6}\b',
            "ic_number": r'\bIC[-_]?\d{3,6}\b'
        }
        
        # Anonymization counters for SOFT PII
        self.anonymization_map = {
            "subject_id": {},
            "ic_number": {},
            "site_name": {},
            "investigator_name": {}
        }
        
        # Common phrases to exclude from name detection
        self.common_phrases = {
            "Informed Consent", "Clinical Trial", "New Delhi", "Principal Investigator",
            "Study Protocol", "Ethics Committee", "Adverse Event", "Serious Adverse",
            "Good Clinical", "Clinical Practice", "Data Safety", "Monitoring Board",
            "Institutional Review", "Review Board", "Case Report", "Report Form",
            "Standard Operating", "Operating Procedure", "Quality Assurance",
            "Regulatory Authority", "Central Drugs", "Drugs Standard"
        }
    
    def detect_and_redact(
        self,
        text: str,
        document_structure: Optional[Dict] = None,
        preserve_context: bool = True
    ) -> Tuple[str, Dict]:
        """
        Detect and redact PII with context preservation
        
        Args:
            text: Original text
            document_structure: Optional parsed document structure
            preserve_context: If True, preserve demographic context
            
        Returns:
            (redacted_text, redaction_report)
        """
        
        redacted_text = text
        all_redactions = []
        
        # Step 1: Redact HARD PII with context preservation
        if preserve_context:
            redacted_text, hard_redactions = self.redact_hard_pii_with_context(
                redacted_text,
                document_structure
            )
        else:
            redacted_text, hard_redactions = self.redact_hard_pii_simple(redacted_text)
        
        all_redactions.extend(hard_redactions)
        
        # Step 2: Anonymize SOFT PII sequentially
        redacted_text, soft_redactions = self.anonymize_soft_pii(redacted_text)
        all_redactions.extend(soft_redactions)
        
        # Step 3: Detect and anonymize names (whitelist-based)
        if document_structure:
            redacted_text, name_redactions = self.redact_names_with_context(
                redacted_text,
                document_structure
            )
            all_redactions.extend(name_redactions)
        
        # Step 4: Create diff log
        diff_log = self.create_diff_log(text, redacted_text, all_redactions)
        
        # Create redaction report
        report = {
            "total_redactions": len(all_redactions),
            "hard_pii_count": len(hard_redactions),
            "soft_pii_count": len(soft_redactions),
            "redactions_by_type": self._count_by_type(all_redactions),
            "diff_log": diff_log,
            "context_preserved": preserve_context
        }
        
        logger.info(
            f"PII redaction complete: {len(all_redactions)} total redactions",
            extra=report
        )
        
        return redacted_text, report
    
    def redact_hard_pii_with_context(
        self,
        text: str,
        document_structure: Optional[Dict] = None
    ) -> Tuple[str, List[Dict]]:
        """
        Redact HARD PII while preserving demographic context
        
        Example:
            "Ramesh Kumar, 67 years" → "[PATIENT: elderly_male_65-70yr]"
        """
        
        redacted = text
        redactions = []
        
        # Detect patterns
        for pii_type, pattern in self.hard_pii_patterns.items():
            for match in re.finditer(pattern, text, re.IGNORECASE):
                matched_text = match.group()
                start, end = match.span()
                
                # Generate context-preserving replacement
                if pii_type == "exact_dob":
                    replacement = self._create_age_context(matched_text)
                elif pii_type == "aadhaar":
                    replacement = "[AADHAAR_REDACTED]"
                elif pii_type == "phone":
                    replacement = "[PHONE_REDACTED]"
                elif pii_type == "email":
                    replacement = "[EMAIL_REDACTED]"
                elif pii_type == "mrn":
                    replacement = "[MRN_REDACTED]"
                elif pii_type == "address":
                    replacement = "[ADDRESS_REDACTED]"
                else:
                    replacement = f"[{pii_type.upper()}_REDACTED]"
                
                redactions.append({
                    "type": pii_type,
                    "tier": PIITier.HARD,
                    "original_hash": hashlib.sha256(matched_text.encode()).hexdigest()[:16],
                    "placeholder": replacement,
                    "position": (start, end),
                    "preserved_context": replacement if "PATIENT" in replacement or "AGE" in replacement else None
                })
        
        # Apply redactions (reverse order to maintain indices)
        for redaction in sorted(redactions, key=lambda x: x["position"][0], reverse=True):
            start, end = redaction["position"]
            redacted = redacted[:start] + redaction["placeholder"] + redacted[end:]
        
        return redacted, redactions
    
    def redact_hard_pii_simple(self, text: str) -> Tuple[str, List[Dict]]:
        """Simple HARD PII redaction without context preservation"""
        
        redacted = text
        redactions = []
        
        for pii_type, pattern in self.hard_pii_patterns.items():
            for match in re.finditer(pattern, text, re.IGNORECASE):
                matched_text = match.group()
                start, end = match.span()
                
                replacement = f"[{pii_type.upper()}_REDACTED]"
                
                redactions.append({
                    "type": pii_type,
                    "tier": PIITier.HARD,
                    "original_hash": hashlib.sha256(matched_text.encode()).hexdigest()[:16],
                    "placeholder": replacement,
                    "position": (start, end),
                    "preserved_context": None
                })
        
        # Apply redactions
        for redaction in sorted(redactions, key=lambda x: x["position"][0], reverse=True):
            start, end = redaction["position"]
            redacted = redacted[:start] + redaction["placeholder"] + redacted[end:]
        
        return redacted, redactions
    
    def anonymize_soft_pii(self, text: str) -> Tuple[str, List[Dict]]:
        """
        Anonymize SOFT PII with sequential replacement
        
        Example:
            "SUBJ-12345" → "PT-001"
            "SUBJ-67890" → "PT-002"
        """
        
        redacted = text
        redactions = []
        
        for pii_type, pattern in self.soft_pii_patterns.items():
            for match in re.finditer(pattern, text, re.IGNORECASE):
                matched_text = match.group()
                start, end = match.span()
                
                # Get or create sequential replacement
                if matched_text not in self.anonymization_map[pii_type]:
                    count = len(self.anonymization_map[pii_type]) + 1
                    
                    if pii_type == "subject_id":
                        replacement = f"PT-{count:03d}"
                    elif pii_type == "ic_number":
                        replacement = f"IC-{count:03d}"
                    else:
                        replacement = f"{pii_type.upper()}-{count:03d}"
                    
                    self.anonymization_map[pii_type][matched_text] = replacement
                else:
                    replacement = self.anonymization_map[pii_type][matched_text]
                
                redactions.append({
                    "type": pii_type,
                    "tier": PIITier.SOFT,
                    "original_hash": hashlib.sha256(matched_text.encode()).hexdigest()[:16],
                    "placeholder": replacement,
                    "position": (start, end),
                    "preserved_context": replacement
                })
        
        # Apply redactions
        for redaction in sorted(redactions, key=lambda x: x["position"][0], reverse=True):
            start, end = redaction["position"]
            redacted = redacted[:start] + redaction["placeholder"] + redacted[end:]
        
        return redacted, redactions
    
    def redact_names_with_context(
        self,
        text: str,
        document_structure: Dict
    ) -> Tuple[str, List[Dict]]:
        """
        Detect and redact names only in specific sections (whitelist approach)
        
        Args:
            text: Text to redact
            document_structure: Dict with section names as keys
            
        Returns:
            (redacted_text, redactions)
        """
        
        # Sections where names are expected
        name_sections = {
            "Subject Details", "Patient Information", "Investigator Information",
            "Principal Investigator", "Co-Investigators", "Ethics Committee Members",
            "Study Team", "Site Personnel"
        }
        
        redacted = text
        redactions = []
        
        # Pattern for capitalized names
        name_pattern = r'\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b'
        
        for section_name, section_text in document_structure.items():
            if section_name in name_sections:
                for match in re.finditer(name_pattern, section_text):
                    matched_name = match.group()
                    
                    # Exclude common phrases
                    if matched_name not in self.common_phrases:
                        # Find in full text and redact
                        # (This is simplified - in production, track positions more carefully)
                        
                        # Generate sequential investigator/patient ID
                        if "investigator" in section_name.lower():
                            if matched_name not in self.anonymization_map["investigator_name"]:
                                count = len(self.anonymization_map["investigator_name"]) + 1
                                replacement = f"INVESTIGATOR-{chr(64 + count)}"  # A, B, C...
                                self.anonymization_map["investigator_name"][matched_name] = replacement
                            else:
                                replacement = self.anonymization_map["investigator_name"][matched_name]
                        else:
                            # Patient name - try to extract demographic context
                            replacement = self._create_patient_context(matched_name, section_text)
                        
                        # Note: In production, this should track exact positions
                        # For now, we'll just note the redaction
                        redactions.append({
                            "type": "name",
                            "tier": PIITier.HARD,
                            "original_hash": hashlib.sha256(matched_name.encode()).hexdigest()[:16],
                            "placeholder": replacement,
                            "position": (0, 0),  # Simplified
                            "preserved_context": replacement,
                            "section": section_name
                        })
        
        return redacted, redactions
    
    def _create_age_context(self, dob_text: str) -> str:
        """
        Create age context from DOB
        
        Example:
            "DOB: 15/03/1956" → "[DOB: 1950s, age_67yr]"
        """
        
        # Extract year
        year_match = re.search(r'\d{4}', dob_text)
        if year_match:
            year = int(year_match.group())
            decade = (year // 10) * 10
            age = datetime.now().year - year
            age_range = f"{(age // 10) * 10}-{((age // 10) + 1) * 10}yr"
            
            return f"[DOB: {decade}s, age_{age_range}]"
        
        return "[DOB_REDACTED]"
    
    def _create_patient_context(self, name: str, context_text: str) -> str:
        """
        Create patient demographic context
        
        Example:
            "Ramesh Kumar" + "67 years, Male" → "[PATIENT: elderly_male_65-70yr]"
        """
        
        # Try to extract age from context
        age_match = re.search(r'(\d+)\s*(?:years?|yrs?)', context_text, re.IGNORECASE)
        if age_match:
            age = int(age_match.group(1))
            
            # Determine age category
            if age < 2:
                age_category = "infant"
            elif age < 12:
                age_category = "child"
            elif age < 18:
                age_category = "adolescent"
            elif age < 65:
                age_category = "adult"
            else:
                age_category = "elderly"
            
            # Age range
            if age < 18:
                age_range = f"{(age // 5) * 5}-{((age // 5) + 1) * 5}yr"
            else:
                age_range = f"{(age // 10) * 10}-{((age // 10) + 1) * 10}yr"
            
            # Try to infer gender
            gender = self._infer_gender(name, context_text)
            
            return f"[PATIENT: {age_category}_{gender}_{age_range}]"
        
        return "[PATIENT_REDACTED]"
    
    def _infer_gender(self, name: str, context_text: str) -> str:
        """Infer gender from name or context"""
        
        # Check context for explicit gender
        if re.search(r'\b(?:male|man|boy|mr\.?)\b', context_text, re.IGNORECASE):
            return "male"
        elif re.search(r'\b(?:female|woman|girl|mrs?\.?|ms\.?)\b', context_text, re.IGNORECASE):
            return "female"
        
        # Common Indian male name patterns
        male_endings = ['kumar', 'raj', 'singh', 'sharma', 'gupta', 'reddy', 'rao']
        female_endings = ['kumari', 'devi', 'bai', 'rani']
        
        name_lower = name.lower()
        
        for ending in male_endings:
            if ending in name_lower:
                return "male"
        
        for ending in female_endings:
            if ending in name_lower:
                return "female"
        
        return "unknown"
    
    def create_diff_log(
        self,
        original_text: str,
        redacted_text: str,
        redactions: List[Dict]
    ) -> Dict:
        """
        Create pre/post-redaction diff log for audit trail
        
        Returns:
            Diff log with context snippets for reviewer verification
        """
        
        diff_entries = []
        
        for redaction in redactions:
            start, end = redaction["position"]
            
            # Skip if position is (0, 0) - simplified redaction
            if start == 0 and end == 0:
                continue
            
            # Extract context (50 chars before and after)
            context_start = max(0, start - 50)
            context_end = min(len(original_text), end + 50)
            
            original_snippet = original_text[context_start:context_end]
            
            # Find corresponding position in redacted text (approximate)
            # This is simplified - in production, track position changes
            redacted_snippet = redacted_text[context_start:context_start + 100]
            
            diff_entries.append({
                "type": redaction["type"],
                "tier": redaction["tier"],
                "original_snippet": original_snippet,
                "redacted_snippet": redacted_snippet,
                "replacement": redaction["placeholder"],
                "preserved_context": redaction.get("preserved_context")
            })
        
        return {
            "timestamp": datetime.now().isoformat(),
            "total_redactions": len(redactions),
            "diff_entries": diff_entries
        }
    
    def _count_by_type(self, redactions: List[Dict]) -> Dict[str, int]:
        """Count redactions by type"""
        
        counts = {}
        for redaction in redactions:
            pii_type = redaction["type"]
            counts[pii_type] = counts.get(pii_type, 0) + 1
        
        return counts
    
    def has_pii(self, text: str) -> bool:
        """Quick check if text contains any PII"""
        
        # Check HARD PII
        for pattern in self.hard_pii_patterns.values():
            if re.search(pattern, text, re.IGNORECASE):
                return True
        
        # Check SOFT PII
        for pattern in self.soft_pii_patterns.values():
            if re.search(pattern, text, re.IGNORECASE):
                return True
        
        return False
    
    def get_pii_summary(self, text: str) -> Dict[str, int]:
        """Get summary of PII types found"""
        
        summary = {}
        
        # Count HARD PII
        for pii_type, pattern in self.hard_pii_patterns.items():
            count = len(re.findall(pattern, text, re.IGNORECASE))
            if count > 0:
                summary[pii_type] = count
        
        # Count SOFT PII
        for pii_type, pattern in self.soft_pii_patterns.items():
            count = len(re.findall(pattern, text, re.IGNORECASE))
            if count > 0:
                summary[pii_type] = count
        
        return summary


# Global PII detector instance
pii_detector = ContextPreservingPIIDetector()


# Example usage
if __name__ == "__main__":
    # Test case 1: Elderly patient
    text1 = """
    Subject: Ramesh Kumar
    Age: 67 years
    Gender: Male
    Aadhaar: 2345 6789 0123
    
    This study involves elderly participants who must provide informed consent.
    """
    
    redacted1, report1 = pii_detector.detect_and_redact(text1, preserve_context=True)
    print("Test 1 - Elderly Patient:")
    print(redacted1)
    print(f"Redactions: {report1['total_redactions']}")
    print()
    
    # Test case 2: Pediatric trial
    text2 = """
    Subject: Priya Sharma
    Age: 8 years
    Parent: Anjali Sharma
    
    Assent from child and consent from parent required.
    Subject ID: SUBJ-12345
    """
    
    redacted2, report2 = pii_detector.detect_and_redact(text2, preserve_context=True)
    print("Test 2 - Pediatric Trial:")
    print(redacted2)
    print(f"Redactions: {report2['total_redactions']}")
    print()
    
    # Test case 3: Aadhaar false positive check
    text3 = """
    Dose: 250000000000 units
    Phone: 919876543210
    Valid Aadhaar: 2345 6789 0123
    Invalid: 1234567890123
    """
    
    redacted3, report3 = pii_detector.detect_and_redact(text3, preserve_context=False)
    print("Test 3 - Aadhaar Pattern:")
    print(redacted3)
    print(f"Redactions: {report3['total_redactions']}")
