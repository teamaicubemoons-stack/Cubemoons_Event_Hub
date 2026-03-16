import httpx
from backend.core.config import logger

async def scrape_jina(url: str):
    if not url or not url.startswith("http"):
        return ""
        
    logger.info(f"Deep Scraping URL: {url}")
    try:
        jina_url = f"https://r.jina.ai/{url}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(jina_url, headers={"X-Return-Format": "markdown"})
            if resp.status_code == 200:
                # Limit content size to avoid context bloat
                return resp.text[:30000]
            logger.warning(f"Jina scrape failed for {url} with status {resp.status_code}")
            return ""
    except Exception as e:
        logger.error(f"Jina Scrape Error for {url}: {e}")
        return ""
