import uvicorn
import os
import sys

# Ensure the root directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Start the FastAPI Backend (Scanner is already mounted inside main.py)
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0"
    
    print(f"\n[Backend] 🚀 Starting Business Card Reader on {host}:{port}...")
    # reload=False is better for production
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)
