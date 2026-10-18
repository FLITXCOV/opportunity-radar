import json
import os
from typing import Optional
from app.models.schemas import OpportunityList

# In-memory storage mapping vector ID to JSON string
cache_store = {}
model = None
index = None
# In memory-constrained cloud environments (e.g. Render 512MB free tier),
# semantic cache defaults to false to prevent OOM SIGKILL unless explicitly enabled.
CACHE_ENABLED = os.getenv("ENABLE_SEMANTIC_CACHE", "false").lower() in ["true", "1", "yes"]

def _init_model_lazy():
    """Lazily loads SentenceTransformers and FAISS with strict thread & memory caps."""
    global model, index, CACHE_ENABLED
    if not CACHE_ENABLED:
        return False
    if model is not None and index is not None:
        return True

    try:
        # Cap PyTorch threads to 1 to drastically reduce memory overhead on small containers (e.g., Render 512MB)
        try:
            import torch
            torch.set_num_threads(1)
        except Exception:
            pass

        from sentence_transformers import SentenceTransformer
        import faiss

        # Load small model for fast inference
        loaded_model = SentenceTransformer('all-MiniLM-L6-v2')
        dim = loaded_model.get_sentence_embedding_dimension()
        new_index = faiss.IndexFlatL2(dim)

        model = loaded_model
        index = new_index
        print("Semantic cache initialized successfully (lazy loaded).")
        return True
    except (ImportError, MemoryError, Exception) as e:
        print(f"WARNING: Semantic cache disabled due to initialization error: {e}")
        CACHE_ENABLED = False
        return False

def generate_profile_string(profile: dict) -> str:
    """Creates a deterministic string representation of a profile for embedding."""
    interests = profile.get('interests', '')
    if isinstance(interests, list):
        interests = ' '.join(interests)
    return f"Branch: {profile.get('branch')} Year: {profile.get('year')} Interests: {interests} Goal: {profile.get('goal')}"

def check_cache(profile: dict, threshold: float = 0.1) -> Optional[OpportunityList]:
    """Checks if a semantically similar profile was searched recently."""
    if not CACHE_ENABLED:
        return None

    if not _init_model_lazy():
        return None

    if index.ntotal == 0:
        return None

    try:
        profile_str = generate_profile_string(profile)
        embedding = model.encode([profile_str])

        distances, indices = index.search(embedding, 1)

        if len(distances) > 0 and distances[0][0] < threshold:
            match_id = indices[0][0]
            if match_id in cache_store:
                print(f"CACHE HIT! Semantic distance: {distances[0][0]}")
                cached_data = cache_store[match_id]
                return OpportunityList.model_validate_json(cached_data)
    except Exception as e:
        print(f"Semantic cache lookup error: {e}")

    return None

def store_in_cache(profile: dict, result: OpportunityList):
    """Stores the result in the FAISS index."""
    if not CACHE_ENABLED:
        return

    if not _init_model_lazy():
        return

    try:
        profile_str = generate_profile_string(profile)
        embedding = model.encode([profile_str])

        vector_id = index.ntotal
        index.add(embedding)

        cache_store[vector_id] = result.model_dump_json()
        print(f"Stored query in semantic cache with ID {vector_id}")
    except Exception as e:
        print(f"Semantic cache store error: {e}")
