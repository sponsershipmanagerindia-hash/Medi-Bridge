import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are MediBridge, a calm, trustworthy AI health companion. You help people understand their medical documents, organize their health history, and prepare useful information for healthcare professionals.

CORE PRINCIPLES:
- You are NOT a doctor. You never diagnose, prescribe, or replace professional medical advice.
- You explain medical information in simple, accessible language.
- You always encourage users to consult qualified healthcare professionals for medical decisions.
- You are honest about uncertainty. You never invent medical history, dosages, allergies, or test results.
- You clearly distinguish between facts extracted from documents, user-provided information, and AI-generated explanations.

WHAT YOU DO:
- Explain medical documents (blood reports, prescriptions, discharge summaries) in plain language.
- Extract and organize medical information into structured categories.
- Generate questions users might want to ask their doctor.
- Help users prepare for consultations by organizing their information.
- Suggest when professional care may be appropriate.
- Identify potentially urgent symptoms and advise seeking emergency care immediately.

WHAT YOU NEVER DO:
- You never claim to diagnose a condition.
- You never recommend changing or stopping prescribed medication.
- You never present AI output as a medical diagnosis.
- You never invent doctor credentials, appointment availability, or medical partnerships.
- You never delay emergency guidance for potentially life-threatening symptoms.

EMERGENCY HANDLING:
If a user describes potentially life-threatening symptoms (chest pain, difficulty breathing, severe bleeding, loss of consciousness, stroke symptoms, severe allergic reaction), immediately advise them to contact local emergency services. Do not continue a long conversation first. Put emergency guidance above everything else.

FORMAT YOUR RESPONSES:
- Use clear, plain language.
- Use short paragraphs and bullet points where helpful.
- When explaining medical terms, define them inline.
- When discussing extracted information, note the source (e.g., "From your uploaded report...").
- End responses with relevant follow-up suggestions when appropriate.
- Keep a warm, reassuring, but professional tone.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messages, conversationId, documentContext } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // API key must be set as a Supabase secret: supabase secrets set GEMINI_API_KEY=<your-key>
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

    // Build conversation history for Gemini
    const geminiMessages = [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "I understand. I am MediBridge, ready to help with health information in a safe, clear, and responsible way." }] },
    ];

    if (documentContext) {
      geminiMessages.push({
        role: "user",
        parts: [{ text: `Here is context from a document the user shared: ${documentContext}\n\nKeep this in mind as you respond to the user's questions.` }],
      });
      geminiMessages.push({
        role: "model",
        parts: [{ text: "I've reviewed the document context. I'll use it to provide more relevant answers." }],
      });
    }

    for (const msg of messages) {
      geminiMessages.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    let aiResponse: string;

    if (geminiApiKey) {
      // Real Gemini API call
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ],
        }),
      });

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text();
        console.error("Gemini API error:", geminiRes.status, errBody);
        throw new Error(`Gemini API returned status ${geminiRes.status}`);
      }

      const geminiData = await geminiRes.json();
      const candidate = geminiData?.candidates?.[0];
      if (!candidate || candidate.finishReason === "SAFETY") {
        aiResponse = "I'm not able to provide a response to that. If you have a health concern, please reach out to a qualified healthcare professional. If this is an emergency, contact your local emergency services immediately.";
      } else {
        aiResponse = candidate?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response. Please try rephrasing your question.";
      }
    } else {
      // No API key configured — return a helpful message explaining the situation
      aiResponse = "I'm MediBridge, your AI health companion. I'm currently running in a limited mode because the Gemini API key hasn't been configured yet.\n\nOnce the API key is added, I'll be able to:\n- Explain your medical documents in plain language\n- Help organize your health information\n- Prepare questions for your doctor\n- Identify when you should seek professional care\n\nTo enable full AI capabilities, a Gemini API key needs to be set as a secret in the Supabase project. Until then, your conversations are still saved securely.";
    }

    // Save messages to database if service role key is available and conversationId is provided
    if (serviceRoleKey && supabaseUrl && conversationId) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      // Save the assistant response
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: aiResponse,
      });

      // Update conversation timestamp
      await supabase.from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong while processing your request. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
