import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const port = process.env.PORT || 8787;
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
  })
);

const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: geminiModel }) : null;

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.post('/ask', async (req, res) => {
  const { question, history = [] } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Missing question' });
  }

  if (!model) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });
  }

  // Construct history for Gemini
  // Gemini expects history in the format: { role: 'user' | 'model', parts: [{ text: string }] }
  const chatHistory = history.map(({ role, content }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(content || '').slice(0, 2000) }],
  }));

  try {
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'You are the meCash API docs assistant. Cite the most relevant endpoints and parameters. Keep answers short. If unsure, say you are unsure.' }],
        },
        {
          role: 'model',
          parts: [{ text: 'Understood. I am ready to assist with the meCash API documentation.' }],
        },
        ...chatHistory
      ],
      generationConfig: {
        maxOutputTokens: 480,
        temperature: 0.3,
      },
    });

    const result = await chat.sendMessage(question.slice(0, 2000));
    const response = await result.response;
    const answer = response.text();

    if (!answer) {
      return res.status(502).json({ error: 'Empty answer from model' });
    }

    return res.json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Upstream error' });
  }
});

app.listen(port, () => {
  console.log(`Ask AI endpoint listening on http://localhost:${port}`);
});
