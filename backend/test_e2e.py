import httpx
import asyncio

async def run():
    url = "http://127.0.0.1:8000/api/v1/search"
    payload = {
        "email": "e2e_test2@example.com",
        "branch": "Computer Science",
        "year": "3rd Year",
        "interests": ["AI", "Machine Learning"],
        "goal": "Software Engineer"
    }
    print(f"Calling {url} (Request 1)...", flush=True)
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, json=payload)
            print(f"Status 1: {res.status_code}")
            
        print("Waiting 1 second...", flush=True)
        await asyncio.sleep(1)
        
        print(f"Calling {url} (Request 2)...", flush=True)
        async with httpx.AsyncClient(timeout=45.0) as client:
            res2 = await client.post(url, json=payload)
            print(f"Status 2: {res2.status_code}")
            print(f"Response 2: {res2.text}")
    except Exception as e:
        import traceback
        print(f"Error: {traceback.format_exc()}")

if __name__ == "__main__":
    asyncio.run(run())
