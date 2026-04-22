"""
OCR Service for RegCheck-India.
Handles printed text extraction via Tesseract and 
handwritten text via Claude Vision.
Supports: PNG, JPG, JPEG, TIFF, BMP, PDF (image-based)
"""

import os
import io
import logging
import base64
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class OCRResult:
    text: str
    method: str          # "TESSERACT" | "CLAUDE_VISION" | "HYBRID"
    confidence: float    # 0.0 to 1.0
    page_count: int
    warnings: list[str]


def extract_text_from_image_bytes(
    image_bytes: bytes,
    filename: str,
    api_key: Optional[str] = None,
    force_vision: bool = False
) -> OCRResult:
    """
    Extract text from image bytes using Tesseract or Claude Vision.
    
    Args:
        image_bytes: Raw image bytes
        filename: Original filename for type detection
        api_key: Anthropic API key for Claude Vision fallback
        force_vision: Force use of Claude Vision regardless of Tesseract result
    
    Returns:
        OCRResult with extracted text and metadata
    """
    warnings = []
    filename_lower = filename.lower()

    # ── PDF handling ──────────────────────────────────────────────
    if filename_lower.endswith(".pdf"):
        return _extract_from_pdf(image_bytes, api_key, force_vision)

    # ── Image handling ────────────────────────────────────────────
    if not any(filename_lower.endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp']):
        raise ValueError(f"Unsupported file type: {filename}. Supported: PDF, PNG, JPG, JPEG, TIFF, BMP")

    return _extract_from_image(image_bytes, filename, api_key, force_vision)


def _extract_from_pdf(
    pdf_bytes: bytes,
    api_key: Optional[str],
    force_vision: bool
) -> OCRResult:
    """Extract text from image-based PDF using pdf2image + Tesseract."""
    warnings = []
    all_text = []
    page_count = 0

    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, dpi=300)
        page_count = len(images)
        logger.info(f"PDF converted to {page_count} images for OCR")

        for i, pil_image in enumerate(images):
            page_result = _run_tesseract(pil_image)
            
            if page_result["confidence"] < 0.6 and api_key and not force_vision:
                logger.info(f"Page {i+1} low Tesseract confidence ({page_result['confidence']:.2f}), falling back to Claude Vision")
                warnings.append(f"Page {i+1}: Low print quality detected — using AI vision")
                
                img_bytes = io.BytesIO()
                pil_image.save(img_bytes, format="PNG")
                vision_text = _run_claude_vision(img_bytes.getvalue(), api_key)
                all_text.append(f"[Page {i+1}]\n{vision_text}")
            else:
                all_text.append(f"[Page {i+1}]\n{page_result['text']}")

        method = "HYBRID" if warnings else "TESSERACT"
        avg_confidence = 0.85 if not warnings else 0.75

        return OCRResult(
            text="\n\n".join(all_text),
            method=method,
            confidence=avg_confidence,
            page_count=page_count,
            warnings=warnings
        )

    except ImportError:
        warnings.append("pdf2image not available — falling back to Claude Vision for entire PDF")
        if api_key:
            # Send first page as image to Claude Vision
            vision_text = _run_claude_vision_pdf(pdf_bytes, api_key)
            return OCRResult(
                text=vision_text,
                method="CLAUDE_VISION",
                confidence=0.80,
                page_count=1,
                warnings=warnings
            )
        raise ValueError("Cannot process PDF: pdf2image not installed and no API key for Vision fallback")

    except Exception as e:
        logger.error(f"PDF OCR failed: {e}")
        raise


def _extract_from_image(
    image_bytes: bytes,
    filename: str,
    api_key: Optional[str],
    force_vision: bool
) -> OCRResult:
    """Extract text from a single image."""
    warnings = []

    if force_vision and api_key:
        text = _run_claude_vision(image_bytes, api_key)
        return OCRResult(
            text=text,
            method="CLAUDE_VISION",
            confidence=0.85,
            page_count=1,
            warnings=[]
        )

    # Try Tesseract first
    try:
        from PIL import Image
        pil_image = Image.open(io.BytesIO(image_bytes))
        result = _run_tesseract(pil_image)

        if result["confidence"] >= 0.6:
            return OCRResult(
                text=result["text"],
                method="TESSERACT",
                confidence=result["confidence"],
                page_count=1,
                warnings=[]
            )

        # Low confidence — try Claude Vision
        if api_key:
            logger.info(f"Low Tesseract confidence ({result['confidence']:.2f}), trying Claude Vision")
            warnings.append("Low print quality — AI vision used for better accuracy")
            vision_text = _run_claude_vision(image_bytes, api_key)
            return OCRResult(
                text=vision_text,
                method="CLAUDE_VISION",
                confidence=0.85,
                page_count=1,
                warnings=warnings
            )

        # Return low-confidence Tesseract result
        warnings.append(f"Low OCR confidence ({result['confidence']:.2f}) — result may contain errors")
        return OCRResult(
            text=result["text"],
            method="TESSERACT",
            confidence=result["confidence"],
            page_count=1,
            warnings=warnings
        )

    except ImportError:
        if api_key:
            text = _run_claude_vision(image_bytes, api_key)
            return OCRResult(
                text=text,
                method="CLAUDE_VISION",
                confidence=0.85,
                page_count=1,
                warnings=["Tesseract not available — using Claude Vision"]
            )
        raise ValueError("Tesseract not installed and no API key for Vision fallback")


def _run_tesseract(pil_image) -> dict:
    """Run Tesseract OCR on a PIL image. Returns text and confidence."""
    try:
        import pytesseract

        # Get detailed data including confidence scores
        data = pytesseract.image_to_data(
            pil_image,
            lang='eng',
            output_type=pytesseract.Output.DICT,
            config='--psm 3'  # fully automatic page segmentation
        )

        # Calculate average confidence (exclude -1 values)
        confidences = [int(c) for c in data['conf'] if int(c) > 0]
        avg_confidence = sum(confidences) / len(confidences) / 100 if confidences else 0.0

        # Extract clean text
        text = pytesseract.image_to_string(
            pil_image,
            lang='eng',
            config='--psm 3'
        ).strip()

        return {"text": text, "confidence": avg_confidence}

    except Exception as e:
        logger.error(f"Tesseract failed: {e}")
        return {"text": "", "confidence": 0.0}


def _run_claude_vision(image_bytes: bytes, api_key: str) -> str:
    """Send image to Claude Vision for text extraction."""
    try:
        import anthropic

        image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

        # Detect media type from bytes signature
        media_type = _detect_media_type(image_bytes)

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-3-sonnet-20240229"), # Updated to a valid vision model
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64
                            }
                        },
                        {
                            "type": "text",
                            "text": """Extract ALL text from this image exactly as written. 
This is a pharmaceutical regulatory or clinical inspection document.
Preserve the original structure, headings, bullet points, and formatting.
If there is handwritten text, transcribe it carefully.
If there are tables, preserve the table structure using spaces/pipes.
Do not summarise or interpret — only transcribe what you see.
Return the raw extracted text only."""
                        }
                    ]
                }
            ]
        )
        return response.content[0].text.strip()

    except Exception as e:
        logger.error(f"Claude Vision failed: {e}")
        raise


def _run_claude_vision_pdf(pdf_bytes: bytes, api_key: str) -> str:
    """Send PDF to Claude Vision directly."""
    try:
        import anthropic

        pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-3-sonnet-20240229"), # Updated to a valid vision model
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_b64
                            }
                        },
                        {
                            "type": "text",
                            "text": """Extract ALL text from this document exactly as written.
This is a pharmaceutical regulatory or clinical inspection document.
Preserve the original structure, headings, and formatting.
If there is handwritten text, transcribe it carefully.
Do not summarise or interpret — only transcribe what you see.
Return the raw extracted text only."""
                        }
                    ]
                }
            ]
        )
        return response.content[0].text.strip()

    except Exception as e:
        logger.error(f"Claude Vision PDF failed: {e}")
        raise


def _detect_media_type(image_bytes: bytes) -> str:
    """Detect image media type from bytes signature."""
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif image_bytes[:2] == b'\xff\xd8':
        return "image/jpeg"
    elif image_bytes[:4] == b'GIF8':
        return "image/gif"
    elif image_bytes[:4] in (b'II*\x00', b'MM\x00*'):
        return "image/tiff"
    else:
        return "image/png"  # default fallback
