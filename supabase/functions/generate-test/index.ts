
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, topic, difficulty, questionType, questionCount, outputFormat, additionalRequirements } = await req.json();

    // Construct the prompt for the test generation
    const systemPrompt = `You are an expert educator tasked with creating high-quality ${subject} test questions. 
    Create ${questionCount} ${questionType} questions at ${difficulty} difficulty level.`;
    
    let userPrompt = `Generate a ${subject} test`;
    if (topic) userPrompt += ` on the topic of ${topic}`;
    userPrompt += `. The test should include ${questionCount} questions at ${difficulty} difficulty level in ${questionType} format.`;
    userPrompt += ` The output should be formatted as ${outputFormat}.`;
    if (additionalRequirements) userPrompt += ` Additional requirements: ${additionalRequirements}`;
    
    // Include output formatting instructions based on format type
    let formatInstructions = "";
    switch (outputFormat.toLowerCase()) {
      case "pdf":
      case "docx":
      case "html":
        formatInstructions = "Format the output as clean markup that could be easily converted to the requested format.";
        break;
      case "plain text":
        formatInstructions = "Format the output as plain text with clear question numbering and spacing.";
        break;
    }

    userPrompt += ` ${formatInstructions}`;
    
    // First try with DeepSeek API
    console.log("Trying DeepSeek API first...");
    try {
      const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 4000
        }),
      });

      if (deepseekResponse.ok) {
        const data = await deepseekResponse.json();
        const generatedTest = data.choices[0].message.content;
        console.log(`Successfully generated ${questionCount} ${subject} questions with DeepSeek API`);
        
        return new Response(
          JSON.stringify({ 
            test: generatedTest,
            provider: "deepseek",
            metadata: {
              subject,
              topic,
              difficulty,
              questionType,
              questionCount,
              generatedAt: new Date().toISOString()
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // DeepSeek API failed, check if it's an insufficient balance error
        const errorData = await deepseekResponse.json();
        console.error('DeepSeek API error:', errorData);
        
        // If it's not a balance error, or we don't have OpenAI key, return the error
        if (deepseekResponse.status !== 402 || !OPENAI_API_KEY) {
          return new Response(
            JSON.stringify({ 
              error: errorData.error?.message || 'DeepSeek API error', 
              code: deepseekResponse.status,
              details: errorData
            }),
            { 
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        // It's a balance error and we have an OpenAI key, so fallback to OpenAI
        console.log("DeepSeek API has insufficient balance. Falling back to OpenAI...");
      }
    } catch (deepseekError) {
      console.error("Error with DeepSeek API:", deepseekError);
      // Continue to OpenAI fallback if we have the key
      if (!OPENAI_API_KEY) {
        throw deepseekError; // Re-throw if we can't fall back
      }
      console.log("Falling back to OpenAI due to DeepSeek API error");
    }
    
    // Fallback to OpenAI
    console.log("Using OpenAI API as fallback...");
    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using a cost-effective model
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      
      return new Response(
        JSON.stringify({ 
          error: errorData.error?.message || 'OpenAI API error', 
          code: openaiResponse.status,
          details: errorData
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await openaiResponse.json();
    const generatedTest = data.choices[0].message.content;

    // Log successful test generation
    console.log(`Successfully generated ${questionCount} ${subject} questions with OpenAI fallback`);

    return new Response(
      JSON.stringify({ 
        test: generatedTest,
        provider: "openai", // Indicate which provider was used
        metadata: {
          subject,
          topic,
          difficulty,
          questionType,
          questionCount,
          generatedAt: new Date().toISOString()
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error in generate-test function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate test' }),
      { 
        status: 200, // Return 200 instead of 500 so frontend doesn't trigger fetch error
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
