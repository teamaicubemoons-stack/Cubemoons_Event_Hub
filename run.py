import uvicorn
import os
import sys

# Ensure the root directory is in the path so 'backend' acts as a package
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("🚀 Starting Business Card Reader (Modular Mode)...")
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
