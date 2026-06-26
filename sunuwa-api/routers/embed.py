from fastapi import APIRouter
from sentence_transformers import SentenceTransformer
from typing import List

router = APIRouter()

# Load model once at startup — ~200MB RAM, stays in memory
# paraphrase-multilingual-MiniLM-L12-v2 supports 50+ languages including Nepali
print("Loading embedding model...")
_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
print("Embedding model loaded.")


def get_embedding(text: str) -> List[float]:
    """Get a 384-dimensional embedding vector for any text (Nepali, English, mixed)."""
    embedding = _model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


@router.post("/embed")
def embed_text(payload: dict):
    """HTTP endpoint for embedding. Used for testing. Internal code calls get_embedding() directly."""
    text = payload.get("text", "")
    if not text:
        return {"error": "No text provided"}
    return {"embedding": get_embedding(text), "dimensions": 384}


@router.post("/embed-batch")
def embed_batch(payload: dict):
    """Embed multiple texts at once. More efficient than calling /embed repeatedly."""
    texts = payload.get("texts", [])
    if not texts:
        return {"error": "No texts provided"}
    embeddings = _model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return {"embeddings": embeddings.tolist(), "count": len(texts)}
