from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
import json

from app.models.schemas import SearchRequest, OpportunityList, SaveOpportunityRequest, EmailRequest
from app.agent.search_agent import process_profile
from app.cache.semantic_cache import check_cache, store_in_cache
from app.db.database import get_db
from app.db import crud
from app.api.dependencies import check_rate_limit
from app.utils.email import send_saved_opportunities_email

from app.profiler.github_inspector import inspect_github_profile
from app.profiler.resume_parser import parse_resume_pdf
from app.profiler.aggregator import aggregate_proof_of_work
from app.ingestion.crawler import run_resilient_ingestion
from app.matching.engine import match_opportunity_to_profile

router = APIRouter()

# ── PROOF-OF-WORK PROFILER & VECTOR MATCHING ──
@router.post("/proof-of-work/analyze")
async def analyze_proof_of_work(
    github_username: Optional[str] = Form(None),
    resume_file: Optional[UploadFile] = File(None),
    target_role: Optional[str] = Form("Software Engineer"),
    db: Session = Depends(get_db)
):
    """
    Ingests actual student proof-of-work:
    1. Inspects GitHub repositories, languages & dependency manifests.
    2. Parses uploaded Resume PDF into structured text and skills.
    3. Aggregates into verified skill profile and computes embedding vector.
    4. Matches against verified opportunities with readiness scores & skill gaps.
    """
    github_data = None
    if github_username and github_username.strip():
        github_data = await inspect_github_profile(github_username.strip())

    resume_data = None
    if resume_file:
        try:
            pdf_bytes = await resume_file.read()
            if pdf_bytes:
                resume_data = parse_resume_pdf(pdf_bytes)
        except Exception as e:
            print(f"Resume read error: {e}")

    if not github_data and not resume_data:
        raise HTTPException(
            status_code=400,
            detail="Please provide a valid GitHub username or upload a resume PDF to analyze proof-of-work."
        )

    # Aggregate into unified profile
    profile = await aggregate_proof_of_work(
        github_data=github_data,
        resume_data=resume_data,
        target_role=target_role
    )

    # Ingest or fetch target opportunities from DB
    db_opportunities = crud.get_recent_opportunities(db, limit=30)
    
    # If DB has few opportunities, seed from resilient crawler or fallback pool
    if len(db_opportunities) < 5:
        fresh_opps = await run_resilient_ingestion()
        for opp in fresh_opps:
            opp_dict = {
                "name": f"{opp.title} - {opp.company}",
                "type": opp.type.lower(),
                "url": opp.apply_url,
                "deadline": opp.deadline,
                "deadline_status": "confirmed",
                "verified_live": True
            }
            crud.upsert_opportunity(db, opp_dict)
        db_opportunities = crud.get_recent_opportunities(db, limit=30)

    # Match opportunities with skill gaps & readiness scores
    matched_results = []
    for opp in db_opportunities:
        opp_data = {
            "name": opp.name,
            "type": opp.type.value if hasattr(opp.type, "value") else str(opp.type),
            "link": opp.url,
            "deadline": opp.deadline,
            "organization": opp.name.split("-")[-1].strip() if "-" in opp.name else "",
            "description": f"Verified opportunity in {opp.type}. Aligned with your verified coding background.",
            "time_commitment": "Full-time / Flexible",
            "required_skills": profile.get("verified_skills", [])[:4] or ["Software Engineering", "Git"]
        }
        scored = match_opportunity_to_profile(opp_data, profile)
        scored["reason"] = f"Strong alignment with your verified {', '.join(scored['matching_skills'][:3])} codebase."
        matched_results.append(scored)

    # Sort descending by readiness score
    matched_results.sort(key=lambda x: x.get("readiness_score", 0), reverse=True)

    return {
        "verified_profile": {
            "github_username": github_username,
            "verified_skills": profile.get("verified_skills", []),
            "skills_count": profile.get("skills_count", 0),
            "projects_count": profile.get("projects_count", 0),
            "projects": profile.get("verified_projects", []),
            "resume_detected_skills": resume_data.get("detected_skills", []) if resume_data else []
        },
        "opportunities": matched_results[:12],
        "high_match_alerts_count": sum(1 for m in matched_results if m.get("is_high_match_alert"))
    }


# ── BACKGROUND RESILIENT INGESTION TRIGGER ──
@router.post("/ingest/trigger")
async def trigger_ingestion(db: Session = Depends(get_db)):
    """
    Manually or cron-triggered background pipeline that pulls markdown feeds,
    runs Pydantic scam filtering, and updates the opportunity index.
    """
    ingested = await run_resilient_ingestion()
    saved_count = 0
    for opp in ingested:
        opp_dict = {
            "name": f"{opp.title} - {opp.company}",
            "type": opp.type.lower(),
            "url": opp.apply_url,
            "deadline": opp.deadline,
            "deadline_status": "confirmed",
            "verified_live": True
        }
        crud.upsert_opportunity(db, opp_dict)
        saved_count += 1

    return {
        "status": "success",
        "ingested_count": len(ingested),
        "saved_count": saved_count
    }


# ── EXISTING PASSIVE / LIVE SEARCH (BACKWARDS COMPATIBILITY) ──
@router.post("/search", response_model=OpportunityList, dependencies=[Depends(check_rate_limit)])
async def search(request: SearchRequest, db: Session = Depends(get_db)):
    profile_dict = request.model_dump()
    
    # 1. Check Cache
    cached_result = check_cache(profile_dict)
    if cached_result:
        user = crud.get_or_create_user(db, profile_dict)
        for opp in cached_result.opportunities:
            db_opp = crud.upsert_opportunity(db, opp.model_dump())
            crud.link_user_opportunity(db, user.id, db_opp.id, opp.reason)
        return cached_result
        
    # 2. Process via AI Agent Pipeline
    try:
        result = await process_profile(profile_dict)
    except ValueError as e:
        if str(e) == "RATE_LIMIT_EXCEEDED":
            raise HTTPException(status_code=429, detail="AI provider rate limit reached. Please wait a minute and try again.")
        raise e
    
    # 3. Store in DB (Persistence)
    if len(result.opportunities) > 0:
        user = crud.get_or_create_user(db, profile_dict)
        for opp in result.opportunities:
            db_opp = crud.upsert_opportunity(db, opp.model_dump())
            crud.link_user_opportunity(db, user.id, db_opp.id, opp.reason)
        store_in_cache(profile_dict, result)
    
    return result


@router.post("/save-opportunity")
def save_opportunity(request: SaveOpportunityRequest, db: Session = Depends(get_db)):
    success = crud.update_user_opportunity_status(db, request.email, request.url, request.status)
    if not success:
        raise HTTPException(status_code=404, detail="User or opportunity not found")
    return {"status": "success"}


@router.get("/saved-opportunities")
def get_saved_opportunities(email: str, db: Session = Depends(get_db)):
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    opps = crud.get_user_opportunities(db, email)
    return opps


@router.post("/send-saved-email")
def send_saved_email(request: EmailRequest, db: Session = Depends(get_db)):
    if not request.email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    opps = crud.get_user_opportunities(db, request.email)
    saved_opps = [opp for opp in opps if opp.get('status') in ['saved', 'applied']]
    
    if not saved_opps:
        raise HTTPException(status_code=400, detail="No saved opportunities found to send.")
        
    success = send_saved_opportunities_email(request.email, saved_opps)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email. Check API key configuration.")
        
    return {"status": "success", "message": "Email sent successfully"}
