import os
import math
from typing import Dict, List, Any, Optional
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

def generate_local_embedding(text: str, dim: int = 768) -> List[float]:
    """
    Fallback deterministic feature vector generator if cloud embeddings fail or offline.
    Uses hash-based ngram bag-of-words to generate stable normalized 768d unit vectors.
    """
    vector = [0.0] * dim
    words = text.lower().split()
    if not words:
        return [0.0] * dim
    
    for i, word in enumerate(words):
        h = hash(word) % dim
        vector[h] += 1.0 / (1.0 + math.log(i + 1))
        
    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vector))
    if norm > 0:
        vector = [x / norm for x in vector]
    return vector

async def get_embedding(text: str) -> List[float]:
    """
    Generates semantic vector embeddings for user profile or opportunity listings.
    Uses Gemini embedding-001 or models/text-embedding-004 if API key is present,
    falling back seamlessly to local unit vector.
    """
    if not GEMINI_API_KEY:
        return generate_local_embedding(text)

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={GEMINI_API_KEY}"
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(
                url,
                json={
                    "model": "models/text-embedding-004",
                    "content": {"parts": [{"text": text[:2000]}]}
                }
            )
            if res.status_code == 200:
                values = res.json().get("embedding", {}).get("values", [])
                if values:
                    return values
    except Exception:
        pass
    
    return generate_local_embedding(text)

async def aggregate_proof_of_work(
    github_data: Optional[Dict[str, Any]] = None,
    resume_data: Optional[Dict[str, Any]] = None,
    target_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Merges verified GitHub codebases with parsed resume text into a single
    coherent proof-of-work profile and computes its semantic vector embedding.
    """
    verified_skills = set()
    verified_projects = []

    # Ingest GitHub proof-of-work
    if github_data and not github_data.get("error"):
        for skill in github_data.get("verified_skills", []):
            verified_skills.add(skill)
        verified_projects.extend(github_data.get("projects", []))

    # Ingest Resume proof-of-work
    if resume_data and not resume_data.get("error"):
        for skill in resume_data.get("detected_skills", []):
            verified_skills.add(skill)

    # Sort & normalize skills
    skills_list = sorted(list(verified_skills))
    
    # Construct structured summary for embedding
    summary_parts = [
        f"Candidate Target Track: {target_role or 'Software Engineering'}",
        f"Verified Coding Skills: {', '.join(skills_list) if skills_list else 'General Software'}",
    ]

    if verified_projects:
        project_titles = [f"{p.get('name')} ({p.get('language') or 'Code'}): {p.get('description') or ''}" for p in verified_projects[:5]]
        summary_parts.append(f"Recent Verified Projects: {' | '.join(project_titles)}")

    if resume_data and resume_data.get("full_text"):
        summary_parts.append(f"Resume Snippet: {resume_data.get('full_text')[:600]}")

    profile_text = "\n".join(summary_parts)
    embedding_vector = await get_embedding(profile_text)

    return {
        "verified_skills": skills_list,
        "verified_projects": verified_projects[:6],
        "profile_summary": profile_text,
        "embedding": embedding_vector,
        "skills_count": len(skills_list),
        "projects_count": len(verified_projects)
    }
