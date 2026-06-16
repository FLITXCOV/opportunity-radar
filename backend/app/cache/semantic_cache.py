import json
import os
from typing import Optional
from app.models.schemas import OpportunityList

try:
    from sentence_transformers import SentenceTransformer
    import faiss
    import numpy as np
    
    # Load quantized/small model for fast edge-like inference
    model = SentenceTransformer('all-MiniLM-L6-v2')
    dimension = model.get_sentence_embedding_dimension()
    index = faiss.IndexFlatL2(dimension)
    
    # Simple in-memory storage mapping vector ID to JSON string
    # In a real app, this would be Redis or Postgres
    cache_store = {}
    
    CACHE_ENABLED = True
except ImportError:
    print("WARNING: SentenceTransformers or FAISS not installed. Caching disabled.")
    CACHE_ENABLED = False

def generate_profile_string(profile: dict) -> str:
    """Creates a deterministic string representation of a profile for embedding."""
    return f"Branch: {profile.get('branch')} Year: {profile.get('year')} Interests: {' '.join(profile.get('interests', []))} Goal: {profile.get('goal')}"

def check_cache(profile: dict, threshold: float = 0.1) -> Optional[OpportunityList]:
    """Checks if a semantically similar profile was searched recently."""
    if not CACHE_ENABLED or index.ntotal == 0:
        return None
        
    profile_str = generate_profile_string(profile)
    embedding = model.encode([profile_str])
    
    # Search the top 1 most similar
    distances, indices = index.search(embedding, 1)
    
    if len(distances) > 0 and distances[0][0] < threshold:
        match_id = indices[0][0]
        if match_id in cache_store:
            print(f"CACHE HIT! Semantic distance: {distances[0][0]}")
            cached_data = cache_store[match_id]
            return OpportunityList.model_validate_json(cached_data)
            
    return None

def store_in_cache(profile: dict, result: OpportunityList):
    """Stores the result in the FAISS index."""
    if not CACHE_ENABLED:
        return
        
    profile_str = generate_profile_string(profile)
    embedding = model.encode([profile_str])
    
    # ID is the current number of items
    vector_id = index.ntotal
    index.add(embedding)
    
    # Store JSON representation
    cache_store[vector_id] = result.model_dump_json()
    print(f"Stored query in semantic cache with ID {vector_id}")
