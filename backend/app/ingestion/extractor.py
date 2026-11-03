import os
import json
import re
from typing import List
import httpx
from app.ingestion.schemas import IngestedOpportunity

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

EXTRACTION_SYSTEM_PROMPT = """
You are an expert technical parser and scam detector for student engineering opportunities.
Analyze the provided Markdown feed and extract real, verified internships, hackathons, and certifications into strict JSON.

STRICT SCAM RULES:
1. If an internship requires the student to pay a "training fee", "registration charge", "security deposit", or buy a certificate: Mark is_scam: true.
2. If the deadline has already passed (before current date): Mark is_expired: true.
3. Only extract opportunities with direct links to apply.

Output format MUST be a valid JSON array of objects with keys:
- title (string)
- company (string)
- type (one of: "Internship", "Hackathon", "Certification")
- mode (one of: "Remote", "Hybrid", "On-site", "Any")
- location (string)
- stipend (string)
- deadline (string)
- required_skills (array of strings, e.g. ["Python", "React", "Docker"])
- apply_url (valid url)
- is_scam (boolean)
- is_expired (boolean)
"""

async def extract_and_filter_markdown(markdown_text: str) -> List[IngestedOpportunity]:
    """
    Feeds raw scraped markdown into an LLM with strict Pydantic extraction.
    Drops any listings flagged as scams (pay-to-work) or expired.
    """
    if not markdown_text.strip():
        return []

    if not GEMINI_API_KEY:
        # Fallback local regex extractor if API key missing
        return fallback_markdown_parser(markdown_text)

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        async with httpx.AsyncClient(timeout=25.0) as client:
            prompt = f"{EXTRACTION_SYSTEM_PROMPT}\n\nMARKDOWN FEED:\n{markdown_text[:12000]}"
            res = await client.post(
                url,
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.1
                    }
                }
            )
            
            if res.status_code == 200:
                raw_json = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                data = json.loads(raw_json)
                
                # If wrapped in an object like {"opportunities": [...]}
                if isinstance(data, dict):
                    data = data.get("opportunities") or data.get("listings") or []

                valid_opportunities: List[IngestedOpportunity] = []
                for item in data:
                    try:
                        opp = IngestedOpportunity(**item)
                        # Scam & Expiration Shield: automatically drop scams or expired deadlines
                        if not opp.is_scam and not opp.is_expired and opp.apply_url.startswith("http"):
                            valid_opportunities.append(opp)
                    except Exception:
                        continue
                return valid_opportunities
    except Exception as e:
        print(f"LLM markdown extraction error: {e}")

    return fallback_markdown_parser(markdown_text)

def fallback_markdown_parser(markdown_text: str) -> List[IngestedOpportunity]:
    """
    Heuristic regex parser for Markdown tables (e.g. GitHub internship trackers)
    when LLM is unavailable.
    """
    opportunities: List[IngestedOpportunity] = []
    # Match markdown table rows: | Company | Role | Location | Application Link |
    lines = markdown_text.splitlines()
    for line in lines:
        if "|" in line and "http" in line and not line.startswith("|-"):
            cols = [c.strip() for c in line.split("|") if c.strip()]
            if len(cols) >= 3:
                # Find URL
                url_match = re.search(r"https?://[^\s\)\>\]]+", line)
                if url_match:
                    url = url_match.group(0).rstrip(".,;")
                    company = cols[0].replace("[", "").replace("]", "").split("(")[0].strip()
                    role = cols[1] if len(cols) > 1 else "Software Engineering Intern"
                    location = cols[2] if len(cols) > 2 else "Remote"
                    
                    opportunities.append(
                        IngestedOpportunity(
                            title=role,
                            company=company,
                            type="Internship",
                            mode="Remote" if "remote" in location.lower() else "On-site",
                            location=location,
                            stipend="Competitive",
                            deadline="Rolling",
                            required_skills=["Software Engineering", "Git"],
                            apply_url=url,
                            is_scam=False,
                            is_expired=False
                        )
                    )
    return opportunities[:15]
