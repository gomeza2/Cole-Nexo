/**
 * Optional news proxy for Cloudflare Workers.
 * Store the provider key as a Worker Secret named GNEWS_API_KEY.
 * Set ALLOWED_ORIGIN to the website origin, without the path.
 *
 * GNews Free allows 1 request/second. Categories are fetched sequentially,
 * with a pause and one retry on HTTP 429, instead of a parallel burst.
 */
const CATEGORIES = [
  { api: 'technology', label: 'Tecnología' },
  { api: 'science', label: 'Ciencia' },
  { api: 'entertainment', label: 'Cultura' }
];
const CACHE_TTL = 600;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function respond(body, status, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

async function fetchCategory(category, apiKey) {
  const apiUrl = new URL('https://gnews.io/api/v4/top-headlines');
  apiUrl.searchParams.set('category', category.api);
  apiUrl.searchParams.set('lang', 'es');
  apiUrl.searchParams.set('country', 'ar');
  apiUrl.searchParams.set('max', '5');

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(1300);
    const response = await fetch(apiUrl, {
      headers: { 'X-Api-Key': apiKey }
    });

    if (response.status === 429 && attempt === 0) {
      try { await response.body?.cancel(); } catch {}
      continue;
    }
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('GNews rate limit (429). Wait a moment and try again.');
      }
      if (response.status === 403) {
        throw new Error('GNews daily quota reached (403). Check your account usage.');
      }
      throw new Error('GNews provider responded ' + response.status);
    }

    const data = await response.json();
    return (Array.isArray(data.articles) ? data.articles : []).map((article) => ({
      title: article.title,
      description: article.description || '',
      content: article.content || article.description || '',
      image: article.image || '',
      url: article.url || '',
      source: { name: article.source?.name || 'Fuente original' },
      briefCategory: category.label
    }));
  }
  return [];
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGIN || 'https://gomeza2.github.io').replace(/\/$/, '');

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin === allowed ? allowed : 'null',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin'
        }
      });
    }

    if (request.method !== 'GET' || !['/', '/api/news'].includes(url.pathname)) {
      return respond({ error: 'Not found' }, 404, origin === allowed ? allowed : '');
    }
    if (origin && origin !== allowed) {
      return respond({ error: 'Origin not allowed' }, 403, '');
    }
    if (!env.GNEWS_API_KEY) {
      return respond({ error: 'News provider secret is not configured' }, 503, origin);
    }

    const cacheKey = new Request(new URL('/__nexo_news_cache_v1', url.origin).toString());
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      if (origin) headers.set('Access-Control-Allow-Origin', origin);
      return new Response(cached.body, { status: cached.status, headers });
    }

    try {
      const batches = [];
      for (let index = 0; index < CATEGORIES.length; index++) {
        // Stay below GNews Free's limit of one request per second.
        if (index > 0) await sleep(1200);
        batches.push(await fetchCategory(CATEGORIES[index], env.GNEWS_API_KEY));
      }

      const seen = new Set();
      const articles = [];
      for (const batch of batches) {
        const article = batch.find((item) =>
          item.title && typeof item.url === 'string' &&
          item.url.startsWith('https://') && !seen.has(item.url)
        );
        if (article) {
          seen.add(article.url);
          articles.push(article);
        }
      }
      for (const batch of batches) {
        for (const article of batch) {
          if (articles.length >= 3) break;
          if (article.title && typeof article.url === 'string' &&
              article.url.startsWith('https://') && !seen.has(article.url)) {
            seen.add(article.url);
            articles.push(article);
          }
        }
      }
      if (articles.length < 3) {
        throw new Error('GNews returned fewer than three usable articles. Try again later.');
      }

      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=' + CACHE_TTL,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin'
      };
      if (origin) headers['Access-Control-Allow-Origin'] = origin;
      const response = new Response(JSON.stringify({
        articles: articles.slice(0, 3),
        cachedAt: new Date().toISOString()
      }), { status: 200, headers });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return respond({ error: error?.message || 'News unavailable' }, 502, origin);
    }
  }
};
