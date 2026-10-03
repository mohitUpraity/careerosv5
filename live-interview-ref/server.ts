import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client (lazy-safe)
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Run Code simulation endpoint
app.post("/api/run-code", async (req, res) => {
  try {
    const { code, language = "javascript" } = req.body;
    if (!code) {
      return res.status(400).json({ error: "No code provided" });
    }

    if (language === "javascript" || language === "typescript") {
      const logs: string[] = [];
      try {
        const customConsole = {
          log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          error: (...args: any[]) => logs.push("[ERROR] " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          warn: (...args: any[]) => logs.push("[WARN] " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
          info: (...args: any[]) => logs.push("[INFO] " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        };
        const runFn = new Function("console", `"use strict";\n${code}`);
        const result = runFn(customConsole);
        return res.json({
          success: true,
          output: logs.length > 0 ? logs.join("\n") : (result !== undefined ? String(result) : "Code executed successfully (no output)."),
        });
      } catch (err: any) {
        return res.json({
          success: false,
          output: logs.join("\n") + (logs.length > 0 ? "\n" : "") + `Runtime Error: ${err.message}`,
        });
      }
    }

    // For Python or other languages, evaluate with Gemini Flash
    const ai = getGeminiClient();
    const prompt = `You are a code execution engine. Execute the following ${language} code and output ONLY the exact standard output and standard error that would be printed by the runtime:\n\n\`\`\`${language}\n${code}\n\`\`\``;
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
      }
    });

    return res.json({
      success: true,
      output: response.text || "Execution completed.",
    });
  } catch (err: any) {
    console.error("Code execution error:", err);
    res.status(500).json({ error: err.message || "Failed to execute code" });
  }
});

// Comprehensive Post-Interview Evaluation Endpoint
app.post("/api/evaluate-interview", async (req, res) => {
  try {
    const { transcript, role, seniority, format, codeSnippet, notes } = req.body;
    const ai = getGeminiClient();

    const evaluationPrompt = `You are an elite Senior Principal Technical Interviewer and Hiring Committee Member. Evaluate this candidate based on their interview transcript, code, and notes.

Candidate Interview Metadata:
- Target Role: ${role || "Software Engineer"}
- Seniority Level: ${seniority || "Senior"}
- Interview Format: ${format || "Full Technical Interview"}

Interview Transcript:
${JSON.stringify(transcript, null, 2)}

Candidate Code / System Design Notes:
${codeSnippet || notes || "No separate code snippet provided."}

Please output a comprehensive, structured evaluation JSON adhering STRICTLY to this schema:
{
  "overallScore": number (0-100),
  "hiringDecision": "Strong Hire" | "Hire" | "Lean Hire" | "Lean No Hire" | "No Hire",
  "executiveSummary": string,
  "metrics": [
    { "category": "Technical Competence & Knowledge", "score": number (0-100), "feedback": string },
    { "category": "Problem Solving & Algorithmic Thinking", "score": number (0-100), "feedback": string },
    { "category": "System Design & Scalability", "score": number (0-100), "feedback": string },
    { "category": "Code Quality & Edge Case Handling", "score": number (0-100), "feedback": string },
    { "category": "Communication, Clarity & Collaboration", "score": number (0-100), "feedback": string }
  ],
  "topStrengths": string[],
  "areasForImprovement": string[],
  "questionBreakdown": [
    {
      "topic": string,
      "candidateResponseQuality": "Exceptional" | "Solid" | "Adequate" | "Needs Improvement",
      "interviewerNotes": string
    }
  ],
  "actionableStudyRoadmap": string[]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: evaluationPrompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (err: any) {
    console.error("Evaluation error:", err);
    res.status(500).json({ error: err.message || "Failed to generate evaluation" });
  }
});

// Create HTTP Server & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/api/live" });

wss.on("connection", (clientWs: WebSocket) => {
  console.log("Client connected to Live WebSocket");
  let liveSession: any = null;
  let isClosing = false;

  clientWs.on("message", async (rawMessage) => {
    try {
      const msg = JSON.parse(rawMessage.toString());

      if (msg.type === "setup") {
        const {
          role = "Senior Full Stack Software Engineer",
          seniority = "Senior",
          voice = "Zephyr",
          candidateName = "Candidate",
          customContext = "",
          interviewType = "Technical & Coding",
        } = msg;

        console.log(`Setting up Gemini Live session for ${candidateName} (${role}, ${seniority}) with voice ${voice}`);

        const systemInstruction = `You are Sarah, an elite Staff Engineer and Lead Technical Interviewer conducting a live Google Meet video interview for the position of ${seniority} ${role}.
The interview format is: ${interviewType}.
Candidate Name: ${candidateName}.
Additional Candidate Resume & Job Context: ${customContext || "Standard industry benchmarks"}.

INTERVIEW CONDUCT GUIDELINES:
1. You are in a live, real-time Google Meet video call with the candidate. Be warm, professional, authentic, natural, and encouraging, just like a real Google interviewer.
2. Introduce yourself briefly at the beginning, welcome ${candidateName}, set the agenda (e.g. 5 min warmup & background, 20-30 min deep technical problem solving / architecture, 5 min for questions), and kick off with a warm opener.
3. Keep your verbal turns concise, conversational, and interactive (typically 1-3 sentences per turn) so it feels like a real fluid conversation instead of a lecture.
4. FULL DUPLEX & INTERRUPTIBLE: The candidate can interrupt you at any point. If they speak or clarify, pause naturally, acknowledge what they said, and adapt immediately.
5. MULTIMODAL AWARENESS: You can see the candidate's webcam video feed, their shared screen, and any code or diagrams they write in real time. If they point at their code or diagram, reference it naturally (e.g., "I see you're using a hash map on line 12", "Looking at your architecture diagram, where would the caching layer sit?").
6. Ask clarifying follow-ups, challenge assumptions constructively, and provide subtle nudges if they get stuck.
7. Balance technical rigor with empathy and high emotional intelligence.`;

        try {
          const ai = getGeminiClient();
          liveSession = await ai.live.connect({
            model: "gemini-3.1-flash-live-preview",
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice || "Zephyr" },
                },
              },
              systemInstruction,
              outputAudioTranscription: {},
              inputAudioTranscription: {},
            },
            callbacks: {
              onmessage: (serverMessage: LiveServerMessage) => {
                if (isClosing || clientWs.readyState !== WebSocket.OPEN) return;

                // 1. Audio payload from Gemini Live
                const audioData = serverMessage.serverContent?.modelTurn?.parts?.find(
                  (p: any) => p.inlineData && p.inlineData.data
                )?.inlineData?.data;

                if (audioData) {
                  clientWs.send(JSON.stringify({ type: "audio", data: audioData }));
                }

                // 2. Output Transcription (AI captions)
                const outputText =
                  (serverMessage.serverContent as any)?.outputAudioTranscription?.text ||
                  serverMessage.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;

                if (outputText) {
                  clientWs.send(JSON.stringify({ type: "output_transcript", text: outputText }));
                }

                // 3. Input Transcription (User captions)
                const inputText = (serverMessage.serverContent as any)?.inputAudioTranscription?.text;
                if (inputText) {
                  clientWs.send(JSON.stringify({ type: "input_transcript", text: inputText }));
                }

                // 4. Interrupted signal
                if (serverMessage.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ type: "interrupted" }));
                }

                // 5. Turn completion
                if (serverMessage.serverContent?.turnComplete) {
                  clientWs.send(JSON.stringify({ type: "turn_complete" }));
                }
              },
              onclose: () => {
                console.log("Gemini Live session closed");
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: "session_closed" }));
                }
              },
              onerror: (err: any) => {
                console.error("Gemini Live session error:", err);
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: "error", message: err.message || "Gemini Live error" }));
                }
              },
            },
          });

          clientWs.send(JSON.stringify({ type: "ready", message: "Gemini Live session established" }));
        } catch (err: any) {
          console.error("Failed to connect to Gemini Live:", err);
          clientWs.send(JSON.stringify({ type: "error", message: err.message || "Failed to initialize Gemini Live session" }));
        }
      } else if (msg.type === "audio") {
        // Send raw 16kHz PCM audio chunk to Gemini
        if (liveSession && msg.data) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        }
      } else if (msg.type === "video") {
        // Send webcam / screen video frame (JPEG base64) to Gemini
        if (liveSession && msg.data) {
          liveSession.sendRealtimeInput({
            video: {
              data: msg.data,
              mimeType: "image/jpeg",
            },
          });
        }
      } else if (msg.type === "text") {
        // Text message / code context update to interviewer
        if (liveSession && msg.data) {
          liveSession.sendRealtimeInput({
            text: msg.data,
          });
        }
      } else if (msg.type === "interrupt") {
        // Client requested manual interruption
        if (liveSession) {
          // Sending brief audio frame or input breaks output
          clientWs.send(JSON.stringify({ type: "interrupted" }));
        }
      }
    } catch (err: any) {
      console.error("WebSocket message handling error:", err);
    }
  });

  clientWs.on("close", () => {
    isClosing = true;
    console.log("Client disconnected from Live WebSocket");
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {
        // ignore
      }
    }
  });

  clientWs.on("error", (err) => {
    console.error("Client WebSocket error:", err);
  });
});

// Vite middleware setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Google Meet AI Interviewer Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
