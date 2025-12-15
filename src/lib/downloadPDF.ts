// src/lib/generateTest.ts

import type { GeneratedTest } from "@/integrations/supabase/types";
import { RAGClient } from "@/integrations/supabase/client";

/**
 * Test generation using RAG (NCERT context)
 */
export async function generateTestWithRAG(params: {
  subject: string;
  topic?: string;
  grade?: string;
  difficulty: string;
  questionType: string;
  numQuestions: number;
  apiEndpoint?: string;
}): Promise<{
  testContent: string;
  ragContext?: string[];
  error?: string;
}> {
  try {
    // Step 1: Create a prompt/query based on parameters
    const query = `Generate a ${params.difficulty} level ${params.questionType} test for ${params.subject}${params.topic ? ` on topic: ${params.topic}` : ""}${params.grade ? ` for grade ${params.grade}` : ""}. The test should have ${params.numQuestions} questions.`;

    // Step 2: Query RAG system to get NCERT context
    const ragResponse = await RAGClient.query(query, params.apiEndpoint);

    if (!ragResponse) {
      throw new Error("Failed to retrieve NCERT context");
    }

    // Step 3: Use the RAG answer (which should be the generated test)
    // OR combine with additional LLM generation if needed
    const testContent = ragResponse.answer;

    // Step 4: Also store context sources for reference
    const contextSources = ragResponse.sources.map(src => 
      `[Source: ${src.metadata.source || 'Unknown'}, Page: ${src.metadata.page || 'N/A'}] ${src.content}`
    );

    return {
      testContent,
      ragContext: contextSources
    };

  } catch (error) {
    console.error("Error generating test with RAG:", error);
    return {
      testContent: "",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Store generated test in Supabase
 */
export async function storeGeneratedTest(testData: {
  userId?: string;
  subject: string;
  difficulty: string;
  questionType: string;
  qcount: number;
  outputContent: string;
  ragContext?: string[];
}): Promise<GeneratedTest | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    
    // Create a blob from the test content
    const blob = new Blob([testData.outputContent], { type: "text/plain" });
    
    // Upload to storage or keep as text
    // For now, we'll store the content directly
    const { data, error } = await supabase
      .from("generated_tests")
      .insert({
        user_id: testData.userId,
        subject: testData.subject,
        difficulty: testData.difficulty,
        question_type: testData.questionType,
        qcount: testData.qcount,
        output_url: null, // Could store URL if uploaded to storage
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Optionally save RAG context in another table or as metadata
    if (testData.ragContext && testData.ragContext.length > 0) {
      // Could store in a separate table or as JSON metadata
      console.log("RAG context available:", testData.ragContext.length, "sources");
    }

    return data;
  } catch (error) {
    console.error("Error storing generated test:", error);
    return null;
  }
}

/**
 * Legacy function - for backward compatibility
 * You can update this to use RAG or keep as is
 */
export async function generateTest(params: {
  subject: string;
  difficulty: string;
  questionType: string;
  qcount: number;
  userId?: string;
}): Promise<GeneratedTest | null> {
  // Option 1: Call the new RAG-based function
  const { testContent, error } = await generateTestWithRAG({
    subject: params.subject,
    difficulty: params.difficulty,
    questionType: params.questionType,
    numQuestions: params.qcount,
  });

  if (error) {
    console.error("RAG test generation failed:", error);
    // Fallback to old method if needed
  }

  // Store the generated test
  const storedTest = await storeGeneratedTest({
    userId: params.userId,
    subject: params.subject,
    difficulty: params.difficulty,
    questionType: params.questionType,
    qcount: params.qcount,
    outputContent: testContent || "Test generation failed. Please try again.",
  });

  return storedTest;
}