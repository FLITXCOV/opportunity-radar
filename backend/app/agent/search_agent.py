import os
import asyncio
import re
from typing import List, Dict, Any
from datetime import datetime
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.tools.tavily_search import TavilySearchResults
from app.models.schemas import Opportunity, OpportunityList, SearchStrategy
from app.agent.verifier import filter_raw_results
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# ─── CURATED SENIOR KNOWLEDGE BASE ───
# This encodes the kind of advice an experienced senior or placed student would give.
# It's NOT a static list of opportunities — it's a knowledge prompt that teaches
# the AI evaluator HOW to think about quality, like a mentor would.

SENIOR_KNOWLEDGE = """
CERTIFICATION VALUE TIERS (from industry experience):

TIER 1 — Career-defining (worth paying for, recognized by FAANG+ recruiters):
- AWS Solutions Architect Associate / AWS Certified ML Specialty
- Google Cloud Professional ML Engineer / Data Engineer
- Microsoft Azure Fundamentals (AZ-900) / AI Fundamentals (AI-900)
- Oracle Cloud Infrastructure Foundations (OFTEN has free promotional windows — extremely valuable when available free, time-limited)
- Cisco CCNA (networking roles)
- Kubernetes CKAD/CKA (DevOps roles)
- TensorFlow Developer Certificate (ML roles)

TIER 2 — Strong resume boosters (free or affordable, well-recognized):
- NPTEL certifications (Elite+Gold = very strong in Indian placements, semester-based deadlines!)
- Google/IBM/Meta Professional Certificates on Coursera (the specialization series, not random courses)
- DeepLearning.AI specializations (Andrew Ng's courses — gold standard for ML)
- Harvard CS50 (free, universally respected)
- freeCodeCamp certifications (respected in web dev)

TIER 3 — Avoid recommending:
- Random Udemy certificates (zero placement value)
- Generic "Introduction to X" courses with no exam/project
- Certificates from unknown platforms with no industry recognition
- Paid certificates from platforms that sell certificates

IMPORTANT FOR CERTIFICATIONS:
- Some certifications (Oracle, AWS) have PROMOTIONAL FREE PERIODS. These are EXTREMELY valuable because students get industry certs at no cost. If you find evidence of an upcoming or current free exam voucher program, PRIORITIZE IT.
- NPTEL courses have STRICT semester deadlines. If the current semester enrollment is open, flag it.

HACKATHON VALUE TIERS:
TIER 1 — Career-defining (top companies actively recruit from these):
- Smart India Hackathon (SIH) — Government of India, massive prestige
- Google Solution Challenge — Global, Google mentorship
- Flipkart Grid — India's biggest corporate hackathon
- Amazon HackOn — Direct PPO pipeline
- Microsoft Imagine Cup — Global, strong brand
- MLH Hackathons — Well-organized, global community
- ICPC (competitive programming, not hackathon, but similar prestige)

TIER 2 — Strong resume builders:
- College-tier hackathons from IIT/NIT/BITS (e.g., Hackathon at Techfest IIT Bombay)
- Devfolio-hosted hackathons (generally well-vetted)
- Unstop featured hackathons with verified prize pools
- Domain-specific: HackBio (biotech), SpaceApps (NASA), Junction (Europe)

TIER 3 — Skip:
- Unknown college hackathons with no track record
- "Hackathons" that are really just marketing events
- Events with no verifiable prizes or outcomes

INTERNSHIP VALUE SIGNALS:
HIGH VALUE: Established companies (any size) where the intern gets real projects, mentorship, and a named manager. Look for:
- Named company with verifiable presence
- Specific project/team description (not just "assist the team")
- Stipend mentioned (shows they value the intern)
- Duration of 2+ months (enough to learn something real)
- Previous intern testimonials or Glassdoor reviews

RED FLAGS — SKIP THESE:
- "Internship" with no company name, just a platform listing
- Unpaid internships from for-profit companies
- "Internships" that ask the student to pay
- Generic descriptions like "Learn Python and make projects"
- Companies with no web presence outside the listing platform

UPCOMING OPPORTUNITIES INTELLIGENCE:
Many top opportunities follow ANNUAL CYCLES. Even if applications aren't open yet:
- GSoC: Orgs announced Jan-Feb, student applications Mar-Apr
- SIH: Usually announced Aug-Sep for implementation Dec-Jan
- Amazon HackOn: Usually Q1 each year
- Flipkart Grid: Usually May-Jun
- NPTEL: Jan and Jul semester enrollment
- Major companies open summer intern hiring Sep-Nov of previous year
If you find content suggesting an opportunity's NEXT EDITION is coming but not yet open, include it with deadline "Upcoming — Expected [Month Year]" so students can prepare early.
"""

def get_llm():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    return ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite", temperature=0.2, google_api_key=api_key)

def get_search_tool():
    return TavilySearchResults(max_results=8)

async def async_search(query: str, tool: TavilySearchResults) -> List[Dict[str, Any]]:
    loop = asyncio.get_event_loop()
    try:
        res = await loop.run_in_executor(None, tool.invoke, {"query": query})
        if isinstance(res, list):
            for r in res:
                r['query_used'] = query
            return res
        return []
    except Exception as e:
        print(f"Search error for '{query}': {e}")
        return []

def extract_retry_delay(error_msg: str) -> int:
    """Extract retry delay from Gemini rate limit error message."""
    match = re.search(r'retryDelay.*?(\d+)', str(error_msg))
    if match:
        return min(int(match.group(1)) + 2, 15)  # Cap at 15 seconds max
    return 15

async def invoke_with_retry(llm_chain, prompt, max_retries=1):
    """Invoke LLM with one retry on rate limit. Fails fast to avoid hanging."""
    for attempt in range(max_retries + 1):
        try:
            return await llm_chain.ainvoke(prompt)
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                if attempt < max_retries:
                    delay = extract_retry_delay(error_str)
                    print(f"Rate limited. Waiting {delay}s before retry...")
                    await asyncio.sleep(delay)
                else:
                    print(f"Rate limit exceeded. Giving up.")
                    raise e
            else:
                raise e

def build_fallback_queries(profile_dict: dict, categories: list) -> List[str]:
    """Generate targeted queries using dynamic dates and career-goal focus."""
    interests = profile_dict.get('interests', '')
    branch = profile_dict.get('branch', '')
    goal = profile_dict.get('goal', '')
    
    now = datetime.now()
    current_year = now.year
    current_month = now.strftime("%B")  # e.g., "September"
    
    fallbacks = []
    for cat in categories:
        if cat == "Hackathon":
            # Search for current year only, with action keywords
            fallbacks.append(f'{goal} {interests} hackathon {current_year} "register" OR "apply" India')
        elif cat == "Internship":
            # Search for current + next year (companies recruit ahead)
            fallbacks.append(f'{goal} {interests} internship {current_year} {current_year + 1} "apply now" OR "hiring" India')
        elif cat == "Certification":
            # Search for valuable certs + any time-limited free offers
            fallbacks.append(f'{goal} {interests} professional certification {current_year} "enroll" OR "free" OR "voucher"')
    return fallbacks

async def process_profile(profile_dict: dict) -> OpportunityList:
    try:
        llm = get_llm()
        search_tool = get_search_tool()
    except Exception as e:
        print(f"Initialization error: {e}")
        return OpportunityList(opportunities=[])

    # Extract fields with defaults
    mode = profile_dict.get('mode', 'Any')
    duration = profile_dict.get('duration', 'Any')
    location = profile_dict.get('location', '')
    budget = profile_dict.get('budget', 'Free only')
    categories = profile_dict.get('categories', ['Hackathon', 'Internship', 'Certification'])
    interests = profile_dict.get('interests', '')
    branch = profile_dict.get('branch', '')
    year = profile_dict.get('year', '')
    goal = profile_dict.get('goal', '')

    # Dynamic date — never hardcoded again
    now = datetime.now()
    current_date_str = now.strftime("%B %Y")  # e.g., "September 2026"

    # Build soft preference context (only for non-default values)
    pref_lines = []
    if mode != "Any":
        pref_lines.append(f"The student prefers {mode} opportunities when possible, but don't exclude results just because mode doesn't match.")
    if duration != "Any":
        pref_lines.append(f"The student prefers {duration} duration, but include other durations too.")
    if location:
        pref_lines.append(f"The student is based in {location}. For internships, prefer opportunities accessible from {location}, but also include remote and pan-India opportunities.")
    if budget == "Free only":
        pref_lines.append("For certifications, prioritize free courses but include paid ones that are highly valuable.")
    
    pref_context = "\n    ".join(pref_lines) if pref_lines else "No specific preferences — show the best opportunities available across India."

    # STAGE 1: Build search queries
    queries = build_fallback_queries(profile_dict, categories)
    print(f"Search queries: {queries}")

    # STAGE 2: Search (parallel) — tag each result with its source category
    category_query_pairs = list(zip(categories, queries))
    search_tasks = [async_search(q, search_tool) for q in queries]
    nested_raw_results = await asyncio.gather(*search_tasks)
    
    # Tag each result with its source category
    for i, results in enumerate(nested_raw_results):
        cat = categories[i]
        for r in results:
            r['source_category'] = cat
    
    flat_raw_results = [item for sublist in nested_raw_results for item in sublist]
    
    # STAGE 2.5: Verify
    verified_results = await filter_raw_results(flat_raw_results)
    print(f"Verification: {len(flat_raw_results)} raw -> {len(verified_results)} verified")
    
    if not verified_results:
        print("All search results failed verification (dead links or expired).")
        return OpportunityList(opportunities=[], queries_used=queries)
    
    # Group results by category
    context_sections = []
    for cat in categories:
        cat_results = [r for r in verified_results if r.get('source_category') == cat]
        if cat_results:
            section = f"=== {cat.upper()} RESULTS ===\n"
            for r in cat_results:
                content_snippet = r.get('content', '')[:1500]
                section += f"URL: {r.get('url')}\nContent: {content_snippet}\n---\n"
            context_sections.append(section)
    context = "\n".join(context_sections)
    
    allowed_types = ", ".join(categories)

    # STAGE 3: Evaluate & Format — with senior knowledge + dynamic date
    eval_prompt = f"""You are a career advisor for Indian engineering students. You have the experience and judgment of a senior student who has been through placements, hackathons, and certifications — you know what actually matters.

CURRENT DATE: {current_date_str}
ANY OPPORTUNITY WITH A DEADLINE BEFORE {current_date_str} IS EXPIRED. DO NOT INCLUDE IT.

VERIFIED SEARCH RESULTS (all links are live):
{context}

STUDENT PROFILE:
- Branch: {branch}
- Year: {year}
- Interests: {interests}
- Career Goal: {goal}

SOFT PREFERENCES (treat as nice-to-have, NOT deal-breakers):
{pref_context}

SELECTED CATEGORIES: {allowed_types}

─── YOUR EXPERT KNOWLEDGE ───
Use this knowledge base to evaluate the quality of search results. Think like a senior who has been through the system:

{SENIOR_KNOWLEDGE}

─── MANDATORY RULES ───
1. ONLY return opportunities of type: {allowed_types}. Set `type` to exactly one of these.
2. Return 2-3 results for EACH selected category. Aim for 6-8 total results.
3. Filter out opportunities that a {year} student is NOT eligible for.
4. Preferences are SOFT — an amazing remote internship should NOT be rejected because student said "On-site".
5. Focus on CAREER GOAL ({goal}) as primary filter. Skills ({interests}) are secondary.

─── EXPIRY RULES (CRITICAL) ───
6. Today is {current_date_str}. Any opportunity with a deadline BEFORE today is EXPIRED — DO NOT include it.
7. If the content mentions "applications closed", "registration closed", "deadline passed", "no longer accepting", "expired", "concluded", past years without current edition mention — DO NOT include it.
8. If a well-known opportunity's NEXT EDITION is expected soon but not yet open, you may include it with deadline "Upcoming — Expected [Month Year]" and explain in the description that applications haven't opened yet.
9. For always-available certifications (like Coursera courses), use "Self-paced" as deadline.

─── QUALITY RULES (THINK LIKE A SENIOR) ───
10. CERTIFICATIONS: Use the tier system from your knowledge base. Only recommend Tier 1 and Tier 2 certifications. If you find a time-limited free voucher/promotional certification, PRIORITIZE it and flag it in the description.
11. HACKATHONS: Only recommend well-organized hackathons from known hosts. Use your knowledge of annual cycles to include upcoming editions of prestigious hackathons.
12. INTERNSHIPS: Only recommend internships with real value signals (named company, specific project, stipend, mentorship). Drop anything that looks like cheap labor or "learn by yourself" programs.

─── FIELD FORMATTING ───
- `name`: Specific name with year (e.g. "Smart India Hackathon 2027", "AWS Solutions Architect Associate").
- `organization`: The host (e.g. "Google", "NPTEL/SWAYAM", "Unstop"). NEVER empty.
- `link`: EXACT URL from search results pointing to the SPECIFIC opportunity page. REJECT generic listing pages, blog posts, or search results pages.
- `description`: 2-3 sentences covering: what it is, who's eligible, what you gain. For time-limited certs, mention the window. For upcoming opportunities, mention expected timeline.
- `reason`: ONE sentence connecting this to the student's career goal of becoming a {goal}. Write this like a senior advising a junior — specific and actionable.
- `deadline`: Specific date (e.g. "15 Oct 2026"), "Self-paced", "Rolling", or "Upcoming — Expected [Month Year]". NEVER "Unclear" or "TBD".
- `time_commitment`: Duration if available (e.g. "2 months", "12 weeks", "Self-paced ~40 hours").

Return 6-8 results total. Never return fewer than 3.

Return the valid opportunities formatted as a JSON list."""

    structured_llm = llm.with_structured_output(OpportunityList)
    try:
        def is_deadline_future(deadline_str: str) -> bool:
            """Post-filter: reject any opportunity with a deadline in the past."""
            if not deadline_str:
                return True
            lower = deadline_str.lower().strip()
            # These are always valid
            if lower in ["ongoing", "rolling", "self-paced", "self paced"]:
                return True
            # "Upcoming" is always valid
            if "upcoming" in lower or "expected" in lower:
                return True
            try:
                from dateutil import parser as dateutil_parser
                parsed = dateutil_parser.parse(deadline_str, fuzzy=True)
                if parsed is None:
                    return True
                parsed = parsed.replace(tzinfo=None)
                return parsed > datetime.now()
            except:
                return True
                
        result = await invoke_with_retry(structured_llm, eval_prompt)
        
        # Post-filter stale deadlines — hard reject anything in the past
        valid_opps = [opp for opp in result.opportunities if is_deadline_future(opp.deadline)]
        
        # Log what was filtered
        filtered_count = len(result.opportunities) - len(valid_opps)
        if filtered_count > 0:
            print(f"Post-filter removed {filtered_count} expired opportunities")
        
        if len(valid_opps) > 0:
            result.opportunities = valid_opps
        else:
            print("WARNING: All opportunities were expired. Returning empty.")
            result.opportunities = []
            
        result.queries_used = queries
        return result
    except Exception as e:
        print(f"Error in Evaluator after retries: {e}")
        if "429" in str(e) or "exhausted" in str(e).lower():
            raise ValueError("RATE_LIMIT_EXCEEDED")
        return OpportunityList(opportunities=[], queries_used=queries)
