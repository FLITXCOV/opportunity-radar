from pydantic import BaseModel, Field
from typing import List, Optional

class IngestedOpportunity(BaseModel):
    title: str = Field(description="Role title or hackathon name")
    company: str = Field(description="Company, startup, or organizing entity")
    type: str = Field(description="One of: Internship, Hackathon, Certification")
    mode: str = Field(default="Any", description="One of: Remote, Hybrid, On-site, Any")
    location: Optional[str] = Field(default="", description="City, country or Remote")
    stipend: Optional[str] = Field(default="Not specified", description="Stipend, prize pool, or compensation")
    deadline: str = Field(description="Application deadline date or timeframe (e.g. 'Nov 30, 2026' or 'Rolling')")
    required_skills: List[str] = Field(default_factory=list, description="Array of required technical skills")
    apply_url: str = Field(description="Direct official apply link or platform page")
    is_scam: bool = Field(default=False, description="True if listing requires paying registration, training, or deposit fees")
    is_expired: bool = Field(default=False, description="True if application deadline has already passed")

class IngestionBatch(BaseModel):
    opportunities: List[IngestedOpportunity] = Field(default_factory=list)
