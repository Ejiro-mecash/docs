// Local server for trying the assistant: `npm run dev`, then POST to http://localhost:8787/api/ask
import http from 'node:http';
import { handleAsk, handleOptions } from '../lib/assistant';

const port = Number(process.env.PORT || 8787);

http
  .createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
    });
    const response = req.method === 'OPTIONS' ? handleOptions(request) : await handleAsk(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) return res.end();
    for await (const chunk of response.body) res.write(chunk);
    res.end();
  })
  .listen(port, () => console.log(`Docs assistant listening on http://localhost:${port}/api/ask`));
