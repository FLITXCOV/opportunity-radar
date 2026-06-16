import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.db import crud, models

def test_db():
    db = SessionLocal()
    
    print("--- Checkpoint 1 & 3: User Creation & Retrieval ---")
    # 1. New search creates User
    profile1 = {"email": "test@example.com", "branch": "CS", "year": "3rd", "goal": "Dev", "interests": ["AI"]}
    user1 = crud.get_or_create_user(db, profile1)
    
    user_count = db.query(models.User).filter(models.User.email == "test@example.com").count()
    print(f"User count after first create: {user_count} (Expected 1)")
    
    # 3. Returning email gets same User
    user2 = crud.get_or_create_user(db, profile1)
    user_count_2 = db.query(models.User).filter(models.User.email == "test@example.com").count()
    print(f"User count after second create: {user_count_2} (Expected 1)")
    print(f"Are User IDs identical? {user1.id == user2.id}")
    
    print("\n--- Checkpoint 2: Opportunity Upsert ---")
    # 2. Upsert Opportunity
    opp_data = {
        "name": "Super Hackathon",
        "type": "hackathon",
        "link": "https://superhack.com",
        "deadline": "2026-12-01"
    }
    
    # Insert first time
    db_opp1 = crud.upsert_opportunity(db, opp_data)
    opp_count = db.query(models.Opportunity).filter(models.Opportunity.url == "https://superhack.com").count()
    print(f"Opp count after first insert: {opp_count} (Expected 1)")
    
    # Insert second time (upsert)
    db_opp2 = crud.upsert_opportunity(db, opp_data)
    opp_count_2 = db.query(models.Opportunity).filter(models.Opportunity.url == "https://superhack.com").count()
    print(f"Opp count after second insert: {opp_count_2} (Expected 1)")
    print(f"Are Opp IDs identical? {db_opp1.id == db_opp2.id}")
    
    print("\n--- Additional Check: UserOpportunity Linking ---")
    crud.link_user_opportunity(db, user1.id, db_opp1.id, "Because you like AI")
    crud.link_user_opportunity(db, user1.id, db_opp1.id, "Duplicate attempt")
    link_count = db.query(models.UserOpportunity).filter(models.UserOpportunity.user_id == user1.id).count()
    print(f"Link count (prevent duplicate saves): {link_count} (Expected 1)")
    
    db.close()

if __name__ == "__main__":
    test_db()
