from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
import enum, uuid
from datetime import datetime
from app.db.database import Base

class OpportunityType(enum.Enum):
    hackathon = "hackathon"
    certification = "certification"
    internship = "internship"
    competition = "competition"
    other = "other" # Fallback

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    branch = Column(String)
    year = Column(String)
    interests = Column(String)  # JSON string
    goal = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    opportunities = relationship("UserOpportunity", back_populates="user")

class Opportunity(Base):
    __tablename__ = "opportunities"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    type = Column(Enum(OpportunityType))
    url = Column(String, unique=True, nullable=False, index=True)
    deadline = Column(String)
    deadline_status = Column(String)  # "confirmed", "unclear", "none_found"
    verified_live = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserOpportunity(Base):
    __tablename__ = "user_opportunities"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=False)
    why_relevant = Column(String)  # Personalized LLM reason
    status = Column(String, default="new")  # new/saved/applied/rejected
    seen_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="opportunities")
