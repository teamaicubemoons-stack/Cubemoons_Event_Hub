import requests
from backend.core.config import APPS_SCRIPT_URL, logger

def submit_to_sheets(payload: dict):
    logger.info("Submitting data to Google Sheets...")
    try:
        resp = requests.post(APPS_SCRIPT_URL, json=payload, timeout=15)
        logger.info(f"Sheets Response: {resp.status_code}")
        return resp
    except Exception as e:
        logger.error(f"Sheets Submission Error: {e}")
        return None
