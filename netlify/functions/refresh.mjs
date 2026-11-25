import { scrape } from '../../scripts/scrape.mjs';

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  try {
    // Keep the on-demand call fast; the scheduled GitHub Action does full enrichment.
    const data = await scrape({ enrichCount: 10 });
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) };
  } catch (error) {
    return {
      statusCode: 502,
      headers: HEADERS,
      body: JSON.stringify({ error: String(error?.message || error), jobs: [] }),
    };
  }
}
