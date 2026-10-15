// src/integrations/supabase/client.ts

// The app has ONE persisting Supabase client: "@/lib/supabaseClient" (the one login uses).
// This file used to create a second one with its own storage key, which never had a session —
// requests through it went out logged-out. Re-export the real client instead.
import { supabase } from "@/lib/supabaseClient";
export { supabase };

// RAG-related types
export interface ChunkMetadata {
  chunk_index?: number;
  start_char?: number;
  end_char?: number;
  chunk_number?: number;
  total_chunks?: number;
  source?: string;
  page?: string | number;
  document_id?: string;
  [key: string]: any;
}

export interface RetrievedChunk {
  id?: string;
  content: string;
  metadata: ChunkMetadata;
  similarity?: number;
}

export interface RAGResponse {
  question: string;
  answer: string;
  sources: Array<{
    content: string;
    metadata: ChunkMetadata;
    similarity: number;
  }>;
  chunks_retrieved: number;
}

// RAG Functions
export class RAGClient {
  /**
   * Retrieve relevant document chunks using vector similarity
   */
  static async retrieveChunks(
    query: string, 
    matchCount: number = 5, 
    matchThreshold: number = 0.7
  ): Promise<RetrievedChunk[]> {
    try {
      // First, we need to get the query embedding from our FastAPI backend
      // OR if we have a PostgreSQL function that handles embedding + matching
      // For now, we'll assume we're calling a FastAPI endpoint
      // We'll implement this properly once the backend is ready
      console.warn("Direct Supabase vector search requires query embedding first. Using FastAPI endpoint recommended.");
      
      // Alternative: If you have a PostgreSQL function that accepts text query
      // and returns matches (handles embedding internally)
      // const { data, error } = await supabase.rpc('match_documents_with_query', {
      //   query_text: query,
      //   match_count: matchCount,
      //   match_threshold: matchThreshold
      // });
      
      // For now, return empty array - we'll call FastAPI endpoint instead
      return [];
    } catch (error) {
      console.error("Error retrieving chunks:", error);
      return [];
    }
  }

  /**
   * Query the RAG system (retrieve + generate)
   * This will call our FastAPI backend
   */
  static async query(
    question: string,
    apiEndpoint: string = "http://localhost:8000"
  ): Promise<RAGResponse | null> {
    try {
      const response = await fetch(`${apiEndpoint}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question,
          top_k: 5  // Optional: can be passed from frontend
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as RAGResponse;
    } catch (error) {
      console.error("Error querying RAG system:", error);
      return null;
    }
  }

  /**
   * Upload document to RAG system (for admin use)
   */
  static async uploadDocument(
    document: File | string,
    metadata: Record<string, any>,
    apiEndpoint: string = "http://localhost:8000"
  ): Promise<boolean> {
    try {
      const formData = new FormData();
      
      if (typeof document === "string") {
        // If it's text content
        formData.append("text", document);
      } else {
        // If it's a file
        formData.append("file", document);
      }
      
      formData.append("metadata", JSON.stringify(metadata));

      const response = await fetch(`${apiEndpoint}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("Error uploading document:", error);
      return false;
    }
  }
}

// Also export the supabase client for direct use
export default supabase;