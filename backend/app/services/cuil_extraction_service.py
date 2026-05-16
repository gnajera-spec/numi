"""
Extract CUIL from a PDF using a configured bounding-box region.

Uses pdfplumber for machine-generated (text-based) PDFs.
The region coordinates match pdfplumber's coordinate system:
  - Origin (0, 0) is at the TOP-LEFT of the page
  - x increases to the right, y increases downward
  - Units are PDF points (1pt = 1/72 inch)
"""
import io
import re
from typing import IO

import pdfplumber

from app.schemas.recibos import CuilExtractionTestResult


_CUIL_RE = re.compile(r"\b(\d{2}[-\s]?\d{8}[-\s]?\d)\b")


def _normalize_cuil(raw: str) -> str:
    return re.sub(r"[-\s]", "", raw)


def extract_cuil_from_pdf(
    pdf_bytes: bytes,
    page_number: int,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
) -> tuple[str | None, str | None]:
    """
    Returns (cuil_11digits, raw_text_in_region).
    Raises ValueError if page doesn't exist.
    """
    bbox = (x0, y0, x1, y1)
    page_idx = page_number - 1  # pdfplumber uses 0-based index

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        if page_idx >= len(pdf.pages):
            raise ValueError(
                f"El PDF tiene {len(pdf.pages)} página(s); "
                f"la configuración apunta a la página {page_number}"
            )
        page = pdf.pages[page_idx]
        cropped = page.crop(bbox)
        raw_text = cropped.extract_text(x_tolerance=3, y_tolerance=3) or ""

    match = _CUIL_RE.search(raw_text)
    if match:
        return _normalize_cuil(match.group(1)), raw_text.strip()
    return None, raw_text.strip()


def test_extraction(
    pdf_bytes: bytes,
    page_number: int,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
) -> CuilExtractionTestResult:
    try:
        cuil, raw = extract_cuil_from_pdf(pdf_bytes, page_number, x0, y0, x1, y1)
    except ValueError as exc:
        return CuilExtractionTestResult(
            cuil_extraido=None,
            texto_crudo=None,
            exito=False,
            detalle=str(exc),
        )
    if cuil:
        return CuilExtractionTestResult(
            cuil_extraido=cuil,
            texto_crudo=raw,
            exito=True,
            detalle=f"CUIL extraído correctamente: {cuil}",
        )
    return CuilExtractionTestResult(
        cuil_extraido=None,
        texto_crudo=raw or "(sin texto en la región)",
        exito=False,
        detalle="No se encontró un CUIL válido en la región seleccionada. "
                "Verificá que la región cubra completamente el número.",
    )
