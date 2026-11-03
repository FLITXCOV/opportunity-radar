import io
import re
from typing import Dict, List, Any
from pypdf import PdfReader

COMMON_TECH_KEYWORDS = [
    "Python", "JavaScript", "TypeScript", "C++", "Java", "Go", "Rust", "SQL",
    "React", "Next.js", "Node.js", "Express", "FastAPI", "Django", "Flask",
    "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Git", "GitHub", "Linux",
    "PostgreSQL", "MongoDB", "Redis", "MySQL", "GraphQL", "REST API",
    "Tailwind CSS", "HTML5", "CSS3", "Machine Learning", "Deep Learning",
    "PyTorch", "TensorFlow", "Pandas", "NumPy", "Scikit-Learn", "NLP",
    "LangChain", "OpenAI", "Gemini", "CI/CD", "Playwright", "Supabase"
]

def parse_resume_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    Parses an uploaded PDF resume into normalized plain text,
    extracts structured sections, and identifies verified tech keywords.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        extracted_text_pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text_pages.append(text)
        
        full_text = "\n".join(extracted_text_pages).strip()
        if not full_text:
            return {"error": "Could not extract text from the provided PDF (scanned image or empty)."}

        # Extract detected tech keywords
        detected_skills = []
        for kw in COMMON_TECH_KEYWORDS:
            pattern = rf"(?<!\w){re.escape(kw)}(?!\w)"
            if re.search(pattern, full_text, re.IGNORECASE):
                detected_skills.append(kw)

        # Detect email if present
        email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", full_text)
        email = email_match.group(0) if email_match else None

        # Detect phone if present
        phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", full_text)
        phone = phone_match.group(0) if phone_match else None

        return {
            "full_text": full_text[:4000], # Keep clean summary for LLM context
            "detected_skills": detected_skills,
            "email": email,
            "phone": phone,
            "pages_count": len(reader.pages)
        }
    except Exception as e:
        return {"error": f"Failed to parse PDF resume: {str(e)}"}
