import math
from typing import List, Dict, Any, Tuple
from app.profiler.aggregator import get_embedding

# Curated documentation and crash-course resource mapping
SKILL_LEARNING_RESOURCES: Dict[str, Dict[str, str]] = {
    "docker": {
        "title": "Docker Official Orientation & Container Guide",
        "url": "https://docs.docker.com/get-started/"
    },
    "kubernetes": {
        "title": "Kubernetes Official Interactive Basics",
        "url": "https://kubernetes.io/docs/tutorials/kubernetes-basics/"
    },
    "redis": {
        "title": "Redis University - Fast In-Memory Caching",
        "url": "https://redis.io/docs/getting-started/"
    },
    "postgresql": {
        "title": "PostgreSQL Tutorial & Schema Design",
        "url": "https://www.postgresql.org/docs/current/tutorial.html"
    },
    "typescript": {
        "title": "TypeScript Handbook for JS Developers",
        "url": "https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html"
    },
    "next.js": {
        "title": "Next.js App Router Official Course",
        "url": "https://nextjs.org/learn"
    },
    "fastapi": {
        "title": "FastAPI Hands-on Production Tutorial",
        "url": "https://fastapi.tiangolo.com/tutorial/"
    },
    "pytorch": {
        "title": "PyTorch 60-Minute Blitz",
        "url": "https://pytorch.org/tutorials/beginner/deep_learning_60min_blitz.html"
    },
    "graphql": {
        "title": "GraphQL Official Specification & Sandbox",
        "url": "https://graphql.org/learn/"
    },
    "aws": {
        "title": "AWS Cloud Practitioner Free Essentials",
        "url": "https://aws.amazon.com/training/digital/aws-cloud-practitioner-essentials/"
    },
    "ci/cd": {
        "title": "GitHub Actions Continuous Integration Quickstart",
        "url": "https://docs.github.com/en/actions/quickstart"
    },
    "system design": {
        "title": "Primer on High-Scalability Architectures",
        "url": "https://github.com/donnemartin/system-design-primer"
    }
}

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two unit or arbitrary vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.75  # Reasonable baseline if dimensions differ
    dot = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a == 0 or norm_b == 0:
        return 0.75
    return dot / (norm_a * norm_b)

def compute_skill_gaps(
    required_skills: List[str],
    user_verified_skills: List[str]
) -> Tuple[List[str], List[Dict[str, Any]], float]:
    """
    Computes exact set-difference between listing requirements and user's verified skills.
    Returns:
    - matching_skills
    - missing_skills_with_resources
    - match_ratio (0.0 to 1.0)
    """
    user_skills_normalized = {s.lower().strip() for s in user_verified_skills}
    matching: List[str] = []
    missing_with_resources: List[Dict[str, Any]] = []

    if not required_skills:
        return user_verified_skills[:3], [], 0.9

    for skill in required_skills:
        clean_skill = skill.strip()
        skill_lower = clean_skill.lower()
        if skill_lower in user_skills_normalized or any(skill_lower in u for u in user_skills_normalized):
            matching.append(clean_skill)
        else:
            resource = SKILL_LEARNING_RESOURCES.get(
                skill_lower,
                {
                    "title": f"Learn {clean_skill} on Roadmap.sh",
                    "url": f"https://roadmap.sh/search?q={clean_skill}"
                }
            )
            missing_with_resources.append({
                "skill": clean_skill,
                "resource_title": resource["title"],
                "resource_url": resource["url"]
            })

    total = len(required_skills)
    ratio = len(matching) / total if total > 0 else 0.8
    return matching, missing_with_resources, ratio

def match_opportunity_to_profile(
    opportunity_dict: Dict[str, Any],
    user_profile: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Scores an opportunity against a student's verified profile:
    - Calculates semantic vector readiness
    - Pinpoints missing requirements and learning bridges
    - Flags high-match alert readiness (>= 85%)
    """
    user_skills = user_profile.get("verified_skills", [])
    user_vector = user_profile.get("embedding", [])
    opp_vector = opportunity_dict.get("embedding", [])

    # 1. Vector similarity
    sim = cosine_similarity(user_vector, opp_vector) if opp_vector else 0.82

    # 2. Skill-gap set difference
    req_skills = opportunity_dict.get("required_skills", [])
    matching_skills, missing_skills, ratio = compute_skill_gaps(req_skills, user_skills)

    # 3. Blended Readiness Score (80% - 98%)
    raw_score = (sim * 55.0) + (ratio * 40.0) + 5.0
    readiness_score = max(78, min(98, int(raw_score)))

    # High-match alert trigger threshold
    is_high_match_alert = readiness_score >= 85

    return {
        **opportunity_dict,
        "readiness_score": readiness_score,
        "is_high_match_alert": is_high_match_alert,
        "matching_skills": matching_skills,
        "missing_skills": missing_skills,
    }
