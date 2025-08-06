import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { subject, topic, difficulty, questionType, questionCount, outputFormat, additionalRequirements } = await req.json();
    // Input validation
    if (!subject || !difficulty || !questionType || !questionCount || !outputFormat) {
      return new Response(JSON.stringify({
        error: "Missing required fields"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const systemPrompt = `You are an expert educator tasked with creating high-quality ${subject} test questions. Create ${questionCount} ${questionType} questions at ${difficulty} difficulty level.`;
    let userPrompt = `Generate a ${subject} test`;
    if (topic) userPrompt += ` on the topic of ${topic}`;
    userPrompt += `. The test should include ${questionCount} questions at ${difficulty} difficulty level in ${questionType} format. The output should be formatted as ${outputFormat}.`;
    if (additionalRequirements) userPrompt += ` Additional requirements: ${additionalRequirements}`;
    if ([
      "pdf",
      "docx",
      "html"
    ].includes(outputFormat.toLowerCase())) {
      userPrompt += " Format the output as clean markup that could be easily converted to the requested format.";
    } else if (outputFormat.toLowerCase() === "plain text") {
      userPrompt += " Format the output as plain text with clear question numbering and spacing.";
    }
    let deepseekText = "", openaiText = "";
    // DeepSeek Call
    if (DEEPSEEK_API_KEY) {
      try {
        const deepseekRes = await fetch(DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: userPrompt
              }
            ],
            temperature: 0.7,
            max_tokens: 2000
          })
        });
        const data = await deepseekRes.json();
        if (deepseekRes.ok) {
          deepseekText = data.choices?.[0]?.message?.content?.trim() || "";
        } else {
          console.warn("DeepSeek error:", data);
        }
      } catch (e) {
        console.error("DeepSeek fetch error:", e.message);
      }
    }
    // OpenAI Fallback
    if (!deepseekText && OPENAI_API_KEY) {
      try {
        const openaiRes = await fetch(OPENAI_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: userPrompt
              }
            ],
            temperature: 0.7,
            max_tokens: 4000
          })
        });
        const data = await openaiRes.json();
        if (openaiRes.ok) {
          openaiText = data.choices?.[0]?.message?.content?.trim() || "";
        } else {
          console.error("OpenAI error:", data);
        }
      } catch (e) {
        console.error("OpenAI fetch error:", e.message);
      }
    }
    // Keyword scoring
    const keywords = topic?.split(/\s|,/)?.filter(Boolean) || [];
    const score = (text)=>keywords.reduce((acc, word)=>text.toLowerCase().includes(word.toLowerCase()) ? acc + 1 : acc, 0);
    const deepseekScore = score(deepseekText);
    const openaiScore = score(openaiText);
    const bestText = deepseekScore >= openaiScore ? deepseekText : openaiText;
    const provider = deepseekScore >= openaiScore ? "deepseek" : "openai";
    if (!bestText) {
      return new Response(JSON.stringify({
        error: "No test content received from LLMs",
        debug: {
          deepseekText,
          openaiText
        }
      }), {
        status: 502,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      test: bestText,
      provider,
      metadata: {
        subject,
        topic,
        difficulty,
        questionType,
        questionCount,
        generatedAt: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: e.message || "Unexpected error occurred"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
