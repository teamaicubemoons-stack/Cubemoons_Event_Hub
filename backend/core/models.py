from pydantic import BaseModel, Field
from typing import List, Optional

class OCRRequest(BaseModel):
    base64Image1: str # From Card Front
    base64Image2: Optional[str] = None # From Card Back
    eventMode: Optional[bool] = False
    eventInfo: Optional[dict] = None

class KeyPerson(BaseModel):
    name: str = Field(default="Not Found")
    role: str = Field(default="Not Found")
    contact: str = Field(default="Not Found")

class OCRResponse(BaseModel):
    # --- Card Data ---
    company: str = Field(default="", description="Company Name from Card")
    name: str = Field(default="", description="Person Name from Card")
    title: str = Field(default="", description="Job Title from Card")
    phone: str = Field(default="", description="Phone Number from Card")
    email: str = Field(default="", description="Email from Card")
    address: str = Field(default="", description="Address from Card")
    location: str = Field(default="", description="City/State from Card")
    
    # --- Enriched Data ---
    industry: str = Field(default="", description="Industry/Sector")
    website: str = Field(default="", description="Official Website URL")
    social_media: str = Field(default="", description="Comma-separated List of Raw Profile URLs")
    services: str = Field(default="", description="List of services/products")
    company_size: str = Field(default="", description="Number of employees")
    founded_year: str = Field(default="", description="Year established")
    registration_status: str = Field(default="", description="Registration details (GST/CIN/Active)")
    trust_score: str = Field(default="0", description="Reliability score 0-10")
    key_people: List[KeyPerson] = Field(default_factory=list, description="List of key leadership found")
    key_people_str: str = Field(default="", description="Backup string of key people")
    
    # --- Meta Data ---
    validation_source: str = Field(default="", description="Source URL for verification")
    is_validated: bool = Field(default=False)
    about_the_company: str = Field(default="", description="Short description of company")
    slogan: str = Field(default="")

class BasicOCR(BaseModel):
    company: str
    name: str
    title: str
    phone: str
    email: str
    address: str
    slogan: str
    location: str
    website: str
