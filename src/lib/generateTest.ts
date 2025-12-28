// /src/lib/generateTest.ts - UPDATED WITH RAG
import { supabase } from "@/integrations/supabase/client";
import type { GenerateTestRequest } from "@/types/testgen";
import { RAGClient } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* TYPES                                                              */
/* ------------------------------------------------------------------ */
export type GenerateTestResponse = {
  ok: boolean;
  pdfUrl?: string | null;
  docxUrl?: string | null;
  csvUrl?: string | null;
  requestId?: string;
  meta: any;
  json: any;
};

type RawJson = {
  ok?: boolean;
  pdfUrl?: string;
  docxUrl?: string;
  csvUrl?: string;
  meta?: Record<string, any>;
  error?: string;
  rid?: string;
  [k: string]: any;
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */
function getFunctionsBaseUrl(): string {
  const fn = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
  if (fn) return fn.replace(/\/+$/, "");

  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supaUrl) throw new Error("VITE_SUPABASE_URL is missing");
  const url = new URL(supaUrl);
  const [ref] = url.hostname.split(".");
  return `https://${ref}.functions.supabase.co`;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return anon ?? null;
}

function normalizeServerJson(raw: RawJson): GenerateTestResponse {
  return {
    ok: !!raw.ok,
    pdfUrl: raw.pdfUrl ?? null,
    docxUrl: raw.docxUrl ?? null,
    csvUrl: raw.csvUrl ?? null,
    requestId: raw.rid,
    meta: raw.meta ?? {},
    json: raw,
  };
}

/* ------------------------------------------------------------------ */
/* RAG INTEGRATION HELPERS                                            */
/* ------------------------------------------------------------------ */
async function getRAGContextForTest(payload: GenerateTestRequest): Promise<{
  context: string;
  sources: any[];
}> {
  try {
    // Create a comprehensive query for RAG based on test parameters
    const query = `NCERT ${payload.subject} Class ${payload.classNum} content for generating a test with: 
    - Topic: ${payload.topic || 'general'}
    - Difficulty: ${payload.difficulty || 'medium'}
    - Question types needed: ${payload.buckets?.map(b => b.type).join(', ') || 'mixed'}
    - Total questions: ${payload.qCount || 10}
    
    Provide relevant textbook content, concepts, examples, and exercises that can be used to create questions.`;

    console.log("🔍 Querying RAG for NCERT context...");
    
    // Query RAG system (FastAPI backend)
    const ragResponse = await RAGClient.query(
      query,
      import.meta.env.VITE_RAG_API_URL || "http://localhost:5000"
    );

    if (!ragResponse) {
      console.warn("⚠️ RAG query returned no response");
      return { context: "", sources: [] };
    }

    console.log(`📚 Retrieved ${ragResponse.chunks_retrieved} NCERT chunks for context`);

    // Format context for test generation
    const context = `Based on NCERT ${payload.subject} Class ${payload.classNum}:

${ragResponse.answer}

Relevant NCERT Sources:
${ragResponse.sources.map((src, i) => 
  `[${i+1}] ${src.content.substring(0, 150)}...`
).join('\n')}`;

    return {
      context,
      sources: ragResponse.sources
    };
  } catch (error) {
    console.error("Error getting RAG context:", error);
    return { context: "", sources: [] };
  }
}

/* ------------------------------------------------------------------ */
/* VALIDATION & SAFETY TRANSFORMATION                                 */
/* ------------------------------------------------------------------ */
function validateAndTransformPayload(payload: GenerateTestRequest): any {
  // 1. Critical Validation
  if (!payload.userId) throw new Error("User ID is required");
  if (!payload.subject) throw new Error("Subject is required");
  if (!payload.classNum) throw new Error("Class Number is required");

  // 2. Generate Request ID if missing
  const requestId = payload.requestId || crypto.randomUUID();

  // 3. SAFETY NET: Ensure 'buckets' exist
  let buckets = payload.buckets;

  if (!buckets || buckets.length === 0) {
    console.warn("⚠️ Warning: No buckets found in payload. Attempting fallback generation.");
    
    const rawData = payload as any;
    if (rawData.simpleData && Array.isArray(rawData.simpleData)) {
      buckets = rawData.simpleData.map((row: any) => ({
        type: "mcq",
        difficulty: (row.difficulty || "medium").toLowerCase(),
        cognitive: "understand",
        count: row.quantity || 5,
        marks: 1,
      }));
    } else {
      buckets = [{
        type: "mcq",
        difficulty: "medium",
        cognitive: "understand",
        count: payload.qCount || 10,
        marks: 1,
      }];
    }
  }

  return {
    ...payload,
    requestId,
    buckets
  };
}

/* ------------------------------------------------------------------ */
/* PUBLIC API                                                         */
/* ------------------------------------------------------------------ */

export async function generateTest(
  payload: GenerateTestRequest
): Promise<GenerateTestResponse> {
  
  console.log("📝 Input Payload:", payload);
  
  // 1. Validate & Fix Payload
  const enhancedPayload = validateAndTransformPayload(payload);
  
  // 2. Get RAG context from NCERT
  const ragContext = await getRAGContextForTest(payload);
  
  // 3. Add RAG context to payload for backend
  const payloadWithRAG = {
    ...enhancedPayload,
    ragContext: ragContext.context,
    ragSources: ragContext.sources,
    useNCERT: true // Flag to indicate NCERT-based generation
  };

  console.log("🚀 Enhanced Payload with RAG (Sending to Brain):", {
    ...payloadWithRAG,
    ragContext: ragContext.context.substring(0, 200) + "..." // Log preview
  });

  // 4. Call Edge Function (with RAG context)
  try {
    const { data, error } = await supabase.functions.invoke("generate-test", {
      body: payloadWithRAG,
    });

    if (error) throw error;

    if (data && typeof data === "object") {
      const normalized = normalizeServerJson(data as RawJson);
      
      // Add RAG metadata to response
      normalized.meta = {
        ...normalized.meta,
        ragUsed: true,
        ragSourcesCount: ragContext.sources.length,
        ncertBased: true
      };
      
      if (!normalized.ok) {
        throw new Error((data as any)?.error || "Generation failed (invoke)");
      }
      return normalized;
    }

    throw new Error("Unexpected response format from backend");
  } catch (error: any) {
    console.error("Supabase Invoke Failed:", error);
    
    // Fallback: Direct Fetch
    console.log("🔄 Attempting Direct Fetch Fallback...");
    
    const base = getFunctionsBaseUrl();
    const url = `${base}/generate-test`;
    const token = await getAuthToken();

    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify(payloadWithRAG),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Backend Error (${res.status}): ${errText}`);
    }

    const raw = await res.json();
    const normalized = normalizeServerJson(raw);
    
    // Add RAG metadata to fallback response
    normalized.meta = {
      ...normalized.meta,
      ragUsed: true,
      ragSourcesCount: ragContext.sources.length,
      ncertBased: true
    };
    
    return normalized;
  }
}

// Helper to get user ID from auth
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error("Failed to get user ID:", error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* ADDITIONAL RAG FUNCTIONS                                           */
/* ------------------------------------------------------------------ */

/**
 * Query NCERT content directly (for chat/QA interface)
 */
export async function queryNCERT(
  question: string,
  subject?: string,
  classNum?: string
): Promise<{
  answer: string;
  sources: any[];
  success: boolean;
}> {
  try {
    // Enhance query with subject/class if provided
    let enhancedQuery = question;
    if (subject && classNum) {
      enhancedQuery = `NCERT ${subject} Class ${classNum}: ${question}`;
    }
    
    const ragResponse = await RAGClient.query(
      enhancedQuery,
      import.meta.env.VITE_RAG_API_URL || "http://localhost:5000"
    );
    
    if (!ragResponse) {
      return {
        answer: "Sorry, I couldn't retrieve NCERT information for your question.",
        sources: [],
        success: false
      };
    }
    
    return {
      answer: ragResponse.answer,
      sources: ragResponse.sources,
      success: true
    };
  } catch (error) {
    console.error("Error querying NCERT:", error);
    return {
      answer: "An error occurred while accessing NCERT content.",
      sources: [],
      success: false
    };
  }
}