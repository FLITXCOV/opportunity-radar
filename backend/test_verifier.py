import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.agent.verifier import filter_raw_results

mock_results = [
    # 1. Dead link (404)
    {"url": "https://github.com/404-this-does-not-exist", "content": "This is a great hackathon."},
    # 2. Redirecting link (301/302 to 200)
    {"url": "http://github.com", "content": "This redirects to a valid page."}, 
    # 3. Live link with expired deadline (2024 is past)
    {"url": "https://example.com", "content": "Applications close on Jan 15, 2024."},
    # 4. Live link with no detectable deadline (Unclear, valid)
    {"url": "https://example.com", "content": "Join our upcoming 2026 hackathon! No dates announced yet."}
]

async def main():
    print("Running verification...")
    valid = await filter_raw_results(mock_results)
    print(f"Passed items: {len(valid)}")
    for i, v in enumerate(valid):
        print(f" {i+1}. {v['content']} (Status: {v['deadline_status']})")

if __name__ == "__main__":
    asyncio.run(main())
