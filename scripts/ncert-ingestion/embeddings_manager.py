# -*- coding: utf-8 -*-
import logging
from typing import List, Optional, Dict, Any
import numpy as np

# First import sentence_transformers with a workaround for the import issue
try:
    from sentence_transformers import SentenceTransformer
except ImportError as e:
    print(f"Error importing sentence_transformers: {e}")
    print("Trying alternative import method...")
    
    # Try to work around the huggingface_hub import issue
    import sys
    import huggingface_hub
    
    # Monkey patch to fix the issue
    original_hf_hub_download = huggingface_hub.hf_hub_download
    
    def patched_hf_hub_download(*args, **kwargs):
        # Remove 'url' parameter if present (older versions used it)
        kwargs.pop('url', None)
        return original_hf_hub_download(*args, **kwargs)
    
    huggingface_hub.hf_hub_download = patched_hf_hub_download
    huggingface_hub.cached_download = patched_hf_hub_download
    
    # Try importing again
    from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

class EmbeddingManager:
    """Manages embedding generation for NCERT content."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self.embedding_dim = 384  # For all-MiniLM-L6-v2
        self.initialized = False
        
    def initialize(self) -> bool:
        """Initialize the embedding model."""
        try:
            logger.info(f"🚀 Initializing embedding model: {self.model_name}")
            
            # Workaround for huggingface_hub import issue
            import huggingface_hub
            
            # Define a patched version of hf_hub_download
            original_hf_hub_download = huggingface_hub.hf_hub_download
            
            def patched_hf_hub_download(*args, **kwargs):
                # Remove 'url' parameter if present
                kwargs.pop('url', None)
                return original_hf_hub_download(*args, **kwargs)
            
            # Apply the patch
            huggingface_hub.hf_hub_download = patched_hf_hub_download
            huggingface_hub.cached_download = patched_hf_hub_download
            
            # Load the model with cache_dir to avoid permission issues
            self.model = SentenceTransformer(
                self.model_name,
                cache_folder="./cache"  # Local cache to avoid issues
            )
            
            # Test the model
            test_embedding = self.model.encode("Test")
            self.embedding_dim = test_embedding.shape[0]
            
            self.initialized = True
            logger.info(f"✅ Embedding model loaded. Dimension: {self.embedding_dim}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize embedding model: {e}")
            logger.error("Trying alternative initialization method...")
            
            # Try alternative method with offline mode
            return self._initialize_alternative()
    
    def _initialize_alternative(self) -> bool:
        """Alternative initialization method."""
        try:
            logger.info("Trying alternative initialization...")
            
            # Import with specific settings
            import os
            os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
            os.environ['TRANSFORMERS_OFFLINE'] = '1'
            
            from sentence_transformers import SentenceTransformer
            
            # Try with local files only
            self.model = SentenceTransformer(
                self.model_name,
                use_auth_token=False,
                cache_folder="./model_cache"
            )
            
            test_embedding = self.model.encode("Test")
            self.embedding_dim = test_embedding.shape[0]
            self.initialized = True
            
            logger.info(f"✅ Alternative initialization successful. Dimension: {self.embedding_dim}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Alternative initialization also failed: {e}")
            return False
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a single text."""
        if not self.initialized:
            if not self.initialize():
                return None
        
        try:
            # Clean and prepare text
            if not text or not isinstance(text, str):
                return None
            
            # Generate embedding
            embedding = self.model.encode(text)
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return None
    
    def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        if not self.initialized:
            if not self.initialize():
                return []
        
        try:
            # Filter out empty texts
            valid_texts = [text for text in texts if text and isinstance(text, str)]
            if not valid_texts:
                return []
            
            # Generate embeddings in batch
            embeddings = self.model.encode(valid_texts)
            return embeddings.tolist()
            
        except Exception as e:
            logger.error(f"Batch embedding generation failed: {e}")
            return []
    
    def semantic_search(self, query: str, embeddings: List[List[float]], texts: List[str], 
                       top_k: int = 10) -> List[Dict[str, Any]]:
        """Perform semantic search on stored embeddings."""
        if not self.initialized:
            if not self.initialize():
                return []
        
        try:
            # Generate query embedding
            query_embedding = self.model.encode(query)
            
            # Calculate similarities
            results = []
            for i, (emb, text) in enumerate(zip(embeddings, texts)):
                if emb and len(emb) == self.embedding_dim:
                    similarity = self._cosine_similarity(query_embedding, emb)
                    results.append({
                        'index': i,
                        'text': text,
                        'similarity': similarity,
                        'embedding': emb
                    })
            
            # Sort by similarity (descending)
            results.sort(key=lambda x: x['similarity'], reverse=True)
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return []
    
    def _cosine_similarity(self, vec1: np.ndarray, vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        dot_product = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(dot_product / (norm1 * norm2))
    
    def test(self) -> bool:
        """Test the embedding manager."""
        print("=== EMBEDDING MANAGER TEST ===")
        
        if not self.initialize():
            print("❌ Initialization failed")
            print("Trying to install required packages...")
            
            # Try to guide user to install correct packages
            print("\nPlease install the required packages:")
            print("pip install --upgrade sentence-transformers huggingface-hub numpy")
            print("Or try: pip install sentence-transformers==2.2.2")
            return False
        
        # Test 1: Single embedding
        test_text = "Photosynthesis is the process by which plants convert light energy into chemical energy."
        embedding = self.generate_embedding(test_text)
        
        if embedding and len(embedding) == self.embedding_dim:
            print(f"✅ Single embedding: SUCCESS (dimension: {len(embedding)})")
        else:
            print(f"❌ Single embedding: FAILED")
            return False
        
        # Test 2: Batch embeddings
        batch_texts = [
            "Mitochondria is the powerhouse of the cell.",
            "Newton's laws of motion describe the relationship between a body and the forces acting upon it.",
            "Democracy is a system of government where citizens exercise power by voting."
        ]
        
        batch_embeddings = self.generate_batch_embeddings(batch_texts)
        
        if len(batch_embeddings) == len(batch_texts):
            print(f"✅ Batch embeddings: SUCCESS (generated: {len(batch_embeddings)})")
        else:
            print(f"❌ Batch embeddings: FAILED")
            return False
        
        # Test 3: Semantic search
        query = "biology plant energy process"
        search_results = self.semantic_search(query, batch_embeddings, batch_texts, top_k=2)
        
        if search_results:
            print(f"✅ Semantic search: SUCCESS (found: {len(search_results)} results)")
            print(f"   Top result: {search_results[0]['text'][:50]}... (similarity: {search_results[0]['similarity']:.3f})")
        else:
            print(f"❌ Semantic search: FAILED")
            return False
        
        print("✅ ALL TESTS PASSED!")
        return True

# Test if run directly
if __name__ == "__main__":
    import sys
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    print("🧪 Testing Embedding Manager...")
    print("If this fails, you may need to install/upgrade packages:")
    print("pip install --upgrade sentence-transformers huggingface-hub numpy")
    print()
    
    # Create and test manager
    manager = EmbeddingManager()
    
    if manager.test():
        print("\n🎉 EMBEDDING MANAGER READY FOR PHASE 1!")
        sys.exit(0)
    else:
        print("\n⚠️  Embedding Manager has issues")
        print("\nPlease try the following:")
        print("1. Upgrade packages: pip install --upgrade sentence-transformers huggingface-hub")
        print("2. Or downgrade: pip install sentence-transformers==2.2.2 huggingface_hub==0.19.4")
        print("3. Check your internet connection")
        sys.exit(1)