import httpx
import base64
import json
import os
import re
from typing import Dict, List, Any, Optional

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", None)

async def inspect_github_profile(username: str) -> Dict[str, Any]:
    """
    Inspects a user's public GitHub profile, top repositories, languages,
    and dependency manifests (package.json, requirements.txt, etc.)
    to extract verified proof-of-work skills and project summaries.
    """
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "OpportunityRadar-Engine/2.0"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Fetch user metadata
        user_url = f"https://api.github.com/users/{username}"
        user_res = await client.get(user_url, headers=headers)
        if user_res.status_code == 404:
            return {"error": f"GitHub user '{username}' not found"}
        elif user_res.status_code != 200:
            return {"error": f"GitHub API error: {user_res.status_code}"}

        user_data = user_res.json()

        # 2. Fetch top public repos (most recently updated, non-forks prioritized)
        repos_url = f"https://api.github.com/users/{username}/repos?sort=updated&per_page=12"
        repos_res = await client.get(repos_url, headers=headers)
        repos_data = repos_res.json() if repos_res.status_code == 200 else []

        language_counts: Dict[str, int] = {}
        detected_frameworks: set = set()
        projects_summary: List[Dict[str, Any]] = []

        # Analyze each repository
        for repo in repos_data:
            if not isinstance(repo, dict):
                continue
            
            repo_name = repo.get("name", "")
            description = repo.get("description") or ""
            is_fork = repo.get("fork", False)
            stars = repo.get("stargazers_count", 0)
            primary_language = repo.get("language")

            if primary_language:
                language_counts[primary_language] = language_counts.get(primary_language, 0) + 1

            topics = repo.get("topics", [])
            for t in topics:
                detected_frameworks.add(t.capitalize())

            # Inspect dependency manifests in root
            owner = repo.get("owner", {}).get("login", username)
            
            # Check package.json (Node/TS/JS)
            try:
                pkg_res = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo_name}/contents/package.json",
                    headers=headers
                )
                if pkg_res.status_code == 200:
                    content_b64 = pkg_res.json().get("content", "")
                    pkg_text = base64.b64decode(content_b64).decode("utf-8", errors="ignore")
                    pkg_json = json.loads(pkg_text)
                    deps = {**pkg_json.get("dependencies", {}), **pkg_json.get("devDependencies", {})}
                    
                    popular_node_libs = [
                        "react", "next", "vue", "svelte", "express", "fastify", "nestjs",
                        "tailwindcss", "typescript", "prisma", "supabase", "firebase",
                        "graphql", "redux", "zustand", "trpc", "docker", "framer-motion",
                        "mongodb", "mongoose", "postgresql", "drizzle-orm"
                    ]
                    for lib in popular_node_libs:
                        if lib in deps or f"@{lib}" in str(deps):
                            detected_frameworks.add(lib.capitalize() if lib != "tailwindcss" else "Tailwind CSS")
            except Exception:
                pass

            # Check requirements.txt or pyproject.toml (Python)
            try:
                req_res = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo_name}/contents/requirements.txt",
                    headers=headers
                )
                if req_res.status_code == 200:
                    content_b64 = req_res.json().get("content", "")
                    req_text = base64.b64decode(content_b64).decode("utf-8", errors="ignore")
                    
                    popular_py_libs = [
                        "fastapi", "django", "flask", "langchain", "langgraph", "pytorch", "torch",
                        "tensorflow", "pandas", "numpy", "scikit-learn", "transformers",
                        "pydantic", "sqlalchemy", "alembic", "celery", "redis", "playwright"
                    ]
                    for lib in popular_py_libs:
                        if re.search(rf"\b{lib}\b", req_text, re.IGNORECASE):
                            detected_frameworks.add(lib.capitalize())
            except Exception:
                pass

            projects_summary.append({
                "name": repo_name,
                "description": description,
                "stars": stars,
                "language": primary_language,
                "is_fork": is_fork,
                "topics": topics
            })

        # Combine verified skills
        verified_skills = list(language_counts.keys()) + list(detected_frameworks)
        # Deduplicate case-insensitively
        unique_skills = []
        seen = set()
        for s in verified_skills:
            if s and s.lower() not in seen:
                seen.add(s.lower())
                unique_skills.append(s)

        return {
            "username": username,
            "name": user_data.get("name") or username,
            "bio": user_data.get("bio") or "",
            "public_repos_count": user_data.get("public_repos", 0),
            "followers": user_data.get("followers", 0),
            "verified_languages": sorted(language_counts.keys(), key=lambda k: language_counts[k], reverse=True),
            "verified_skills": unique_skills,
            "projects": projects_summary[:8]
        }
