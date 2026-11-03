import httpx
from typing import List
from app.ingestion.schemas import IngestedOpportunity
from app.ingestion.extractor import extract_and_filter_markdown

# Curated High-Signal Markdown Feeds
HIGH_SIGNAL_FEEDS = [
    # Open curated GitHub internship trackers (Markdown tables)
    "https://raw.githubusercontent.com/SimplifyJobs/Summer2025-Internships/dev/README.md",
    "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md",
]

async def fetch_markdown_from_url(url: str) -> str:
    """
    Fetches raw markdown or runs through Jina Reader markdown converter (r.jina.ai)
    to eliminate boilerplate HTML and anti-bot obstacles.
    """
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        try:
            if "raw.githubusercontent.com" in url or url.endswith(".md"):
                res = await client.get(url)
                if res.status_code == 200:
                    return res.text
            
            # Use Jina Reader engine to fetch clean markdown from HTML job boards
            jina_url = f"https://r.jina.ai/{url}"
            res = await client.get(jina_url, headers={"Accept": "text/markdown"})
            if res.status_code == 200:
                return res.text
        except Exception as e:
            print(f"Error fetching markdown from {url}: {e}")
    return ""

async def run_resilient_ingestion(custom_urls: List[str] = None) -> List[IngestedOpportunity]:
    """
    Runs the automated ingestion pipeline across target high-signal feeds,
    parses them through the LLM schema extractor, and filters out scams.
    """
    target_urls = custom_urls if custom_urls else HIGH_SIGNAL_FEEDS
    all_opportunities: List[IngestedOpportunity] = []

    for feed_url in target_urls:
        markdown_content = await fetch_markdown_from_url(feed_url)
        if markdown_content:
            extracted = await extract_and_filter_markdown(markdown_content)
            all_opportunities.extend(extracted)

    # Deduplicate by apply_url
    unique_opps: List[IngestedOpportunity] = []
    seen_urls = set()
    for opp in all_opportunities:
        if opp.apply_url not in seen_urls:
            seen_urls.add(opp.apply_url)
            unique_opps.append(opp)

    return unique_opps
