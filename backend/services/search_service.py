import urllib.parse
import httpx
from backend.core.config import GOOGLE_API_KEY, GOOGLE_CSE_ID, logger

async def google_search(query: str, num: int = 3):
    if not GOOGLE_API_KEY or not GOOGLE_CSE_ID:
        logger.error("Missing Google CSE credentials")
        return []
        
    try:
        url = f"https://www.googleapis.com/customsearch/v1?q={urllib.parse.quote(query)}&key={GOOGLE_API_KEY}&cx={GOOGLE_CSE_ID}&num={num}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            data = resp.json()
            return data.get("items") or []
    except Exception as e:
        logger.error(f"Google CSE Error: {e}")
        return []
