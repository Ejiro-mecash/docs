import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Groq } from 'groq-sdk';

const app = express();
const port = process.env.PORT || 8787;
const groqApiKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || 'mixtral-8x7b-32768';

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

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.post('/ask', async (req, res) => {
  const { question, history = [] } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Missing question' });
  }

  if (!groq) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set on server' });
  }

  const messages = [
    {
      role: 'system',
      content:
        'You are the meCash API docs assistant. Cite the most relevant endpoints and parameters. Keep answers short. If unsure, say you are unsure.',
    },
    ...history.map(({ role, content }) => ({
      role: role === 'assistant' ? 'assistant' : 'user',
      content: String(content || '').slice(0, 2000),
    })),
    { role: 'user', content: question.slice(0, 2000) },
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: groqModel,
      messages,
      temperature: 0.3,
      max_tokens: 480,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim();
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
