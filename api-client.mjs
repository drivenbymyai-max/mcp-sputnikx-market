/**
 * Siltums Commerce API Client — Thin REST wrapper for MCP server
 *
 * Calls the live Siltums API over HTTPS. No local database access.
 * Authentication via Bearer token (API key from admin panel).
 *
 * Environment:
 *   SILTUMS_API_KEY  — API key (required for agent endpoints)
 *   SILTUMS_API_URL  — Base URL (default: https://siltums.sputnikx.xyz)
 *   SILTUMS_TENANT   — Tenant slug for x-tenant-slug header (default: siltums)
 *   SILTUMS_TIMEOUT  — Request timeout in ms (default: 30000)
 */

const DEFAULT_URL = 'https://siltums.sputnikx.xyz';
const DEFAULT_TIMEOUT = 30000;
const MAX_TIMEOUT = 60000;
const USER_AGENT = 'mcp-sputnikx-market/1.0.2';

// ── Sanitization ──

function sanitizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT_URL;
  const trimmed = raw.trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_URL;
    return url.origin;
  } catch {
    return DEFAULT_URL;
  }
}

function sanitizeTimeout(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1000) return DEFAULT_TIMEOUT;
  return Math.min(n, MAX_TIMEOUT);
}

function sanitizeTenant(raw) {
  if (!raw || typeof raw !== 'string') return 'siltums';
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || 'siltums';
}

// ── Client ──

export class SiltumsApiClient {
  #baseUrl;
  #apiKey;
  #tenant;
  #timeout;

  constructor(opts = {}) {
    this.#baseUrl = sanitizeUrl(opts.baseUrl || process.env.SILTUMS_API_URL);
    this.#apiKey = opts.apiKey || process.env.SILTUMS_API_KEY || '';
    this.#tenant = sanitizeTenant(opts.tenant || process.env.SILTUMS_TENANT);
    this.#timeout = sanitizeTimeout(opts.timeout || process.env.SILTUMS_TIMEOUT);
  }

  get configured() {
    return !!this.#apiKey;
  }

  /**
   * Make an authenticated GET request to the agent API.
   * @param {string} path — Path relative to /api/v1/agent/ (e.g., 'products')
   * @param {Record<string, string>} [params] — Query parameters
   * @returns {Promise<object>} — Parsed JSON response
   */
  async get(path, params = {}) {
    const url = this.#buildUrl(path, params);
    return this.#request(url, { method: 'GET' });
  }

  /**
   * Make an authenticated POST request to the agent API.
   * @param {string} path — Path relative to /api/v1/agent/ (e.g., 'orders')
   * @param {object} body — JSON body
   * @returns {Promise<object>} — Parsed JSON response
   */
  async post(path, body) {
    const url = this.#buildUrl(path);
    return this.#request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /**
   * GET /api/health — no auth required.
   */
  async health() {
    const url = new URL('/api/health', this.#baseUrl);
    return this.#request(url, { method: 'GET', skipAuth: true });
  }

  // ── Internal ──

  #buildUrl(path, params = {}) {
    // Ensure path doesn't start with / to prevent double-slash
    const cleanPath = path.replace(/^\/+/, '');
    const url = new URL(`/api/v1/agent/${cleanPath}`, this.#baseUrl);

    // Defense in depth: prevent path traversal escaping the agent prefix
    if (!url.pathname.startsWith('/api/v1/agent/')) {
      throw new Error('Invalid API path');
    }

    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val));
      }
    }
    return url;
  }

  async #request(url, opts = {}) {
    const headers = {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'X-Tenant-Slug': this.#tenant,
    };

    if (!opts.skipAuth && this.#apiKey) {
      headers['Authorization'] = `Bearer ${this.#apiKey}`;
    }

    if (opts.headers) {
      Object.assign(headers, opts.headers);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeout);

    try {
      const response = await fetch(url.toString(), {
        method: opts.method || 'GET',
        headers,
        body: opts.body || undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Strip HTML tags and limit length to prevent server info leakage
        const clean = text.replace(/<[^>]*>/g, '').trim().slice(0, 100);
        throw new Error(`Invalid JSON response (${response.status}): ${clean}`);
      }

      if (!response.ok) {
        const msg = data?.error || data?.message || `HTTP ${response.status}`;
        const err = new Error(msg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timeout (${this.#timeout}ms): ${url.pathname}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
