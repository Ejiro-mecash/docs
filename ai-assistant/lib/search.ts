// BM25 keyword search over the docs chunks. Exact API terms (paymentChannel, MOBILE_MONEY)
// matter more in these docs than loose semantic similarity, so lexical ranking works well.
export interface DocChunk {
  id: number;
  title: string;
  section: string;
  url: string;
  text: string;
}

const STOPWORDS = new Set(
  'a an and are as at be by can do does for from how i in is it me my of on or that the this to what when where which with you your'.split(' '),
);

const K1 = 1.2;
const B = 0.75;
const HEADING_WEIGHT = 3;

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of text.match(/[A-Za-z0-9_]+/g) ?? []) {
    const parts = new Set([raw, ...raw.split('_'), ...raw.split(/(?<=[a-z])(?=[A-Z])/)]);
    for (const part of parts) {
      let token = part.toLowerCase();
      if (token.length < 2 || STOPWORDS.has(token)) continue;
      if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')) token = token.slice(0, -1);
      tokens.push(token);
    }
  }
  return tokens;
}

export class DocSearch {
  private termFreqs: Map<string, number>[];
  private lengths: number[];
  private docFreq = new Map<string, number>();
  private avgLength: number;

  constructor(private chunks: DocChunk[]) {
    this.termFreqs = chunks.map((chunk) => {
      const heading = `${chunk.title} ${chunk.section} `.repeat(HEADING_WEIGHT);
      const freqs = new Map<string, number>();
      for (const token of tokenize(heading + chunk.text)) freqs.set(token, (freqs.get(token) ?? 0) + 1);
      for (const token of freqs.keys()) this.docFreq.set(token, (this.docFreq.get(token) ?? 0) + 1);
      return freqs;
    });
    this.lengths = this.termFreqs.map((f) => [...f.values()].reduce((a, b) => a + b, 0));
    this.avgLength = this.lengths.reduce((a, b) => a + b, 0) / Math.max(this.lengths.length, 1);
  }

  search(query: string, limit = 6, maxPerPage = 2): DocChunk[] {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    const total = this.chunks.length;
    const scored: { chunk: DocChunk; score: number }[] = [];
    this.termFreqs.forEach((freqs, i) => {
      let score = 0;
      for (const term of terms) {
        const tf = freqs.get(term);
        if (!tf) continue;
        const df = this.docFreq.get(term) ?? 0;
        const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
        score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * this.lengths[i]) / this.avgLength));
      }
      if (score > 0) scored.push({ chunk: this.chunks[i], score });
    });
    scored.sort((a, b) => b.score - a.score);

    const perPage = new Map<string, number>();
    const results: DocChunk[] = [];
    for (const { chunk } of scored) {
      const page = chunk.url.split('#')[0];
      const count = perPage.get(page) ?? 0;
      if (count >= maxPerPage) continue;
      perPage.set(page, count + 1);
      results.push(chunk);
      if (results.length >= limit) break;
    }
    return results;
  }
}
