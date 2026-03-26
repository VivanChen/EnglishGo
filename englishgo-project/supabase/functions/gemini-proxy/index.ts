// supabase/functions/gemini-proxy/index.ts
// Supabase Edge Function — 代理 Gemini API 請求
// 這樣 API Key 安全地存在伺服器端，不會暴露給前端
//
// 部署步驟：
// 1. npm install -g supabase
// 2. supabase login
// 3. supabase link --project-ref YOUR_PROJECT_REF
// 4. supabase secrets set GEMINI_API_KEY=your-key-here
// 5. supabase functions deploy gemini-proxy

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured. Run: supabase secrets set GEMINI_API_KEY=your-key");
    }

    const { message, level, systemPrompt } = await req.json();

    if (!message) {
      throw new Error("Missing 'message' in request body");
    }

    const defaultSystem = `You are a friendly, encouraging English tutor for a Taiwanese ${level || "國中"} student. Reply in Traditional Chinese mixed with English. For vocabulary: include pronunciation, Chinese meaning, word forms, collocations, examples. For grammar: clear explanations with examples. Gently correct mistakes. Be concise and fun.`;

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt || defaultSystem }],
        },
        contents: [{ parts: [{ text: message }] }],
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.7,
        },
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Gemini API error");
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，暫時無法回答。";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
