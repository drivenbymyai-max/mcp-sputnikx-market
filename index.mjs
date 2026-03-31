#!/usr/bin/env node

/**
 * @sputnikx/mcp-sputnikx-market — MCP Server for SputnikX — AI Lounge by Orion
 *
 * 20 tools for AI agents:
 *   search_products    — Product catalog with filters
 *   get_prices         — Real-time EUR pricing
 *   check_availability — Stock by warehouse location
 *   create_quote       — Draft quote with 21% VAT
 *   place_order        — Order with idempotency (max EUR 50,000)
 *   order_status       — Order tracking
 *   calculator         — Heating fuel calculator
 *   query_trade        — EU trade analytics (28M+ Eurostat COMEXT records)
 *   query_customs      — Latvia customs analytics (KN8 codes, trends, seasonal)
 *   list_skills        — Available CRM agent skills catalog
 *   run_skill          — Execute CRM agent skill (oracle, spider, etc.)
 *   salary_overview    — EU salary database metadata
 *   salary_ai_risk     — AI automation risk scores
 *   salary_lv_wages    — Latvia detailed wages
 *   soul_profile       — Agent identity + trust score
 *   soul_verify        — Hash chain integrity check
 *   soul_leaderboard   — Agent trust rankings
 *   soul_bounties      — Agent bounty marketplace
 *   prediction_signals — Prediction market signals (paper trading)
 *
 * Environment:
 *   SPUTNIKX_API_KEY  — API key (required, obtain from admin panel)
 *   SPUTNIKX_API_URL  — Base URL (default: https://sputnikx.xyz)
 *   SPUTNIKX_TENANT   — Tenant slug (default: siltums)
 *   SPUTNIKX_TIMEOUT  — Request timeout ms (default: 30000)
 *
 * Transport: stdio (default) or Streamable HTTP (set MCP_HTTP_PORT)
 *   MCP_HTTP_PORT  — Enable HTTP transport on this port (e.g. 3100)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SputnikXClient } from './api-client.mjs';

const SERVER_NAME = 'mcp-sputnikx-market';
const SERVER_VERSION = '2.3.0';

// ── API Client singleton ──
const client = new SputnikXClient();

/** Create a configured MCP Server instance with all tools registered */
function createMcpServer() {
  const srv = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );
  registerTools(srv);
  return srv;
}

// ── Primary server for stdio / sandbox ──
const server = createMcpServer();

// ══════════════════════════════════════════════════
// TOOLS — Definitions & Handlers
// ══════════════════════════════════════════════════

function registerTools(srv) {
srv.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_products',
      description:
        'Search in-stock products in the catalog. Returns name, price, type, availability. ' +
        'Filter by type (granulas, briketes, saplaksnis) or name search. ' +
        'Pass slug for single-product lookup.',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search text (matches name, type, category)' },
          type: { type: 'string', description: 'Product type filter (e.g., granulas, briketes, saplaksnis)' },
          slug: { type: 'string', description: 'Specific product slug for single-product lookup' },
        },
      },
    },
    {
      name: 'get_prices',
      description:
        'Get current product prices in EUR with calculated price_per_kg. ' +
        'Returns all in-stock products or a specific product by slug.',
      inputSchema: {
        type: 'object',
        properties: {
          product_slug: { type: 'string', description: 'Specific product slug (optional — omit for all)' },
        },
      },
    },
    {
      name: 'check_availability',
      description:
        'Check product stock across warehouse locations. Returns quantities (bags, pallets) per location. ' +
        'Pass product_id or product_slug for a specific product, or omit both for all in-stock products.',
      inputSchema: {
        type: 'object',
        properties: {
          product_id: { type: 'number', description: 'Product ID' },
          product_slug: { type: 'string', description: 'Product slug (alternative to product_id)' },
        },
      },
    },
    {
      name: 'create_quote',
      description:
        'Create a draft quote (piedavajums) with line items. Auto-calculates totals with 21% VAT. ' +
        'Returns quote number and pricing breakdown. Requires "quote" scope API key.',
      inputSchema: {
        type: 'object',
        properties: {
          client_name: { type: 'string', description: 'Client name (required)' },
          client_email: { type: 'string', description: 'Client email' },
          client_phone: { type: 'string', description: 'Client phone' },
          items: {
            type: 'array',
            description: 'Line items: each needs product_id or product_slug, quantity, and optionally unit (bag/pallet/m2)',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'number' },
                product_slug: { type: 'string' },
                quantity: { type: 'number', description: 'Quantity (required, > 0)' },
                unit: { type: 'string', enum: ['bag', 'pallet', 'm2'] },
              },
              required: ['quantity'],
            },
          },
          notes: { type: 'string', description: 'Quote notes' },
        },
        required: ['client_name', 'items'],
      },
    },
    {
      name: 'place_order',
      description:
        'Place a product order. You MUST provide product_id or product_slug (at least one). ' +
        'Enforces EUR 50,000 max limit. Supports idempotency_key to prevent duplicates. ' +
        'Requires "order" scope API key.',
      inputSchema: {
        type: 'object',
        properties: {
          product_id: { type: 'number', description: 'Product ID (required if no product_slug)' },
          product_slug: { type: 'string', description: 'Product slug (required if no product_id)' },
          quantity: { type: 'number', description: 'Quantity (required, > 0)' },
          unit: { type: 'string', description: 'Unit: bag or pallet (default: bag)', enum: ['bag', 'pallet'] },
          customer_name: { type: 'string', description: 'Customer name (required)' },
          customer_email: { type: 'string', description: 'Customer email (required)' },
          customer_phone: { type: 'string', description: 'Customer phone' },
          delivery_address: { type: 'string', description: 'Delivery address (required)' },
          notes: { type: 'string' },
          idempotency_key: { type: 'string', description: 'Unique key to prevent duplicate orders' },
        },
        required: ['quantity', 'customer_name', 'customer_email', 'delivery_address'],
      },
    },
    {
      name: 'order_status',
      description: 'Check order status by ID. Returns order details, product info, and delivery status.',
      inputSchema: {
        type: 'object',
        properties: {
          order_id: { type: 'number', description: 'Order ID (required)' },
        },
        required: ['order_id'],
      },
    },
    {
      name: 'calculator',
      description:
        'Calculate heating fuel needs from boiler specs. Returns required kg, bags, and pallets of granulas. ' +
        'Formula: kW * 350 * tempFactor * monthsFactor * insulationFactor.',
      inputSchema: {
        type: 'object',
        properties: {
          boiler_kw: { type: 'number', description: 'Boiler power in kW (1-500, default: 15)' },
          desired_temp: { type: 'number', description: 'Desired indoor temperature (default: 20)' },
          heating_months: { type: 'number', description: 'Heating months per year (1-12, default: 6)' },
          insulation: {
            type: 'string',
            description: 'Building insulation quality',
            enum: ['poor', 'average', 'good', 'excellent'],
          },
        },
      },
    },
    {
      name: 'query_trade',
      description:
        'Query EU trade data (Eurostat COMEXT DS-045409). 28M+ records, 27 EU countries, HS2-CN8 product codes. ' +
        'Supports: overview, countries, timeline, top_partners, top_products, balance, wood_products, heatmap, product_detail.',
      inputSchema: {
        type: 'object',
        properties: {
          query_type: {
            type: 'string',
            description: 'Query type',
            enum: [
              'overview',
              'countries',
              'timeline',
              'top_partners',
              'top_products',
              'balance',
              'wood_products',
              'heatmap',
              'product_detail',
            ],
          },
          reporter: { type: 'string', description: '2-letter EU country code, comma-separated for multiple (e.g., "LV" or "LV,DE,FR")' },
          partner: { type: 'string', description: 'Partner country code' },
          year: { type: 'number', description: 'Year filter (e.g., 2025)' },
          years: { type: 'string', description: 'Year range (e.g., "2021-2025")' },
          flow: { type: 'string', description: 'Trade flow', enum: ['IMPORT', 'EXPORT'] },
          hs2: { type: 'string', description: 'HS2 product code (e.g., "44" for wood)' },
          limit: { type: 'number', description: 'Max results (default: 20)' },
        },
        required: ['query_type'],
      },
    },
    {
      name: 'query_customs',
      description:
        'Query Latvia customs analytics (3.8GB database). KN8 product codes, import/export trends, seasonal patterns, country analysis. ' +
        'Supports: classifications, trends, top_commodities, country_analysis, tariff_lookup, seasonal.',
      inputSchema: {
        type: 'object',
        properties: {
          query_type: {
            type: 'string',
            description: 'Query type',
            enum: ['classifications', 'trends', 'top_commodities', 'country_analysis', 'tariff_lookup', 'seasonal'],
          },
          q: { type: 'string', description: 'Search text for classifications (e.g., "wood")' },
          code: { type: 'string', description: 'KN code (2-8 digits, e.g., "4401" or "44011100")' },
          country: { type: 'string', description: '2-3 letter country code for country_analysis (e.g., "DE")' },
          years: { type: 'string', description: 'Year range (e.g., "2020-2025")' },
          year: { type: 'number', description: 'Single year filter' },
          direction: { type: 'string', description: 'Trade direction', enum: ['IMPORT', 'EXPORT'] },
          limit: { type: 'number', description: 'Max results (default: 20)' },
          sort: { type: 'string', description: 'Sort by (top_commodities only)', enum: ['value', 'weight'] },
        },
        required: ['query_type'],
      },
    },
    {
      name: 'list_skills',
      description:
        'List available CRM agent skills. Returns skill catalog with names, descriptions, pricing, and example tasks. ' +
        'Available agents: oracle, spider, tracker, diplomat, sniper, strategist, finansist, gramatvedis.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'run_skill',
      description:
        'Execute a CRM agent skill. Runs an AI agent (oracle, spider, etc.) with a task description and returns the analysis. ' +
        'Requires "skill" scope API key. Execution typically takes 5-30 seconds.',
      inputSchema: {
        type: 'object',
        properties: {
          agent: {
            type: 'string',
            description: 'Agent to run',
            enum: ['oracle', 'spider', 'tracker', 'diplomat', 'sniper', 'strategist', 'finansist', 'gramatvedis'],
          },
          task: { type: 'string', description: 'Task description (3-2000 chars, e.g., "Analyze revenue trends last 6 months")' },
          tenant: { type: 'string', description: 'Tenant slug (default: woodpoint)', enum: ['siltums', 'woodpoint'] },
          format: { type: 'string', description: 'Output format', enum: ['markdown', 'json'] },
        },
        required: ['agent', 'task'],
      },
    },
    // ── EU Salary Intelligence ──
    {
      name: 'salary_overview',
      description: 'EU salary database metadata — countries, sectors, occupations coverage',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'salary_ai_risk',
      description: 'AI automation risk scores by ISCO occupation or NACE sector — exposure, complementarity, risk level',
      inputSchema: {
        type: 'object',
        properties: {
          occupation: { type: 'string', description: 'ISCO occupation code or keyword' },
          sector: { type: 'string', description: 'NACE sector code or keyword' },
        },
      },
    },
    {
      name: 'salary_lv_wages',
      description: 'Latvia detailed wage data — by sector, occupation, gender gap, regional breakdown',
      inputSchema: {
        type: 'object',
        properties: {
          sector: { type: 'string', description: 'NACE sector filter' },
          year: { type: 'integer', description: 'Year (default: latest)' },
        },
      },
    },
    // ── SoulLedger Agent Identity ──
    {
      name: 'soul_profile',
      description: 'Agent identity profile — trust score, behavioral DNA, character traits, SX# passport',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent identifier (e.g., oracle, spider-code)' },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'soul_verify',
      description: 'Verify agent event hash chain integrity — tamper detection for EU AI Act compliance',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent to verify' },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'soul_leaderboard',
      description: 'Agent trust leaderboard — ranked by trust score with DNA summaries',
      inputSchema: { type: 'object', properties: { limit: { type: 'integer', description: 'Max results (default: 20)' } } },
    },
    {
      name: 'soul_bounties',
      description: 'Browse open agent bounties — tasks with USDC rewards that agents can claim',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter', enum: ['open', 'awarded', 'expired'] },
          limit: { type: 'integer', description: 'Max results (default: 20)' },
        },
      },
    },
    // ── Prediction Market Signals ──
    {
      name: 'prediction_signals',
      description: 'Prediction market signals — paper trading strategy performance, active trades, signal feed from 7-strategy ensemble',
      inputSchema: {
        type: 'object',
        properties: {
          view: { type: 'string', description: 'View type', enum: ['stats', 'trades', 'prediction'] },
          limit: { type: 'integer', description: 'Max results for trades view (default: 10)' },
        },
      },
    },
  ],
}));

/** Map query_customs types to REST API endpoints */
const CUSTOMS_ENDPOINTS = {
  classifications: { path: 'customs/classifications', params: ['q', 'code', 'limit'] },
  trends: { path: 'customs/trends', params: ['years', 'direction', 'source'] },
  top_commodities: { path: 'customs/top-commodities', params: ['year', 'direction', 'limit', 'sort'] },
  country_analysis: { path: 'customs/country-analysis', params: ['country', 'years'] },
  tariff_lookup: { path: 'customs/tariff-lookup', params: ['code'] },
  seasonal: { path: 'customs/seasonal', params: ['code', 'years', 'direction'] },
};

/** Map query_trade types to REST API endpoints */
const TRADE_ENDPOINTS = {
  overview: { path: 'trade/overview', params: [] },
  countries: { path: 'trade/countries', params: [] },
  timeline: { path: 'trade/timeline', params: ['reporters', 'flow', 'years', 'limit'] },
  top_partners: { path: 'trade/top-partners', params: ['reporter', 'year', 'flow', 'limit'] },
  top_products: { path: 'trade/top-products', params: ['reporter', 'year', 'flow', 'limit'] },
  balance: { path: 'trade/balance', params: ['reporter', 'years'] },
  wood_products: { path: 'trade/wood-products', params: ['reporter', 'year', 'flow'] },
  heatmap: { path: 'trade/heatmap', params: ['year', 'flow', 'hs2'] },
  product_detail: { path: 'trade/product-detail', params: ['reporter', 'hs2', 'years'] },
};

srv.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'search_products': {
        if (args.slug) {
          const data = await client.get(`products/${encodeURIComponent(args.slug)}`);
          return textResult(data);
        }
        const data = await client.get('products');
        // Client-side filtering (API returns all in-stock products)
        let products = data.data || [];
        if (args.search) {
          const q = args.search.toLowerCase();
          products = products.filter(
            (p) =>
              (p.name && p.name.toLowerCase().includes(q)) ||
              (p.type && p.type.toLowerCase().includes(q)) ||
              (p.category && p.category.toLowerCase().includes(q)),
          );
        }
        if (args.type) {
          const t = args.type.toLowerCase();
          products = products.filter((p) => p.type && p.type.toLowerCase() === t);
        }
        return textResult({ success: true, data: products, count: products.length });
      }

      case 'get_prices': {
        const data = await client.get('prices');
        if (args.product_slug && data.data) {
          const filtered = data.data.filter((p) => p.slug === args.product_slug);
          return textResult({ ...data, data: filtered, count: filtered.length });
        }
        return textResult(data);
      }

      case 'check_availability': {
        const params = {};
        if (args.product_id) params.product_id = args.product_id;
        if (args.product_slug) params.slug = args.product_slug;
        const data = await client.get('availability', params);
        return textResult(data);
      }

      case 'create_quote': {
        if (!args.client_name) return errorResult('client_name is required');
        if (!args.items || !Array.isArray(args.items) || args.items.length === 0) {
          return errorResult('items array with at least one product is required');
        }
        // Map product_slug → slug for API compatibility
        const items = args.items.map((item) => ({
          product_id: item.product_id,
          slug: item.product_slug,
          quantity: item.quantity,
          unit: item.unit,
        }));
        const data = await client.post('quotes', {
          client_name: args.client_name,
          client_email: args.client_email,
          client_phone: args.client_phone,
          items,
          notes: args.notes,
        });
        return textResult(data);
      }

      case 'place_order': {
        if (!args.quantity) return errorResult('quantity is required');
        const qty = Number(args.quantity);
        if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) {
          return errorResult('quantity must be a positive number (max 100,000)');
        }
        if (!args.customer_name) return errorResult('customer_name is required');
        if (!args.customer_email) return errorResult('customer_email is required');
        if (!args.delivery_address) return errorResult('delivery_address is required');
        if (!args.product_id && !args.product_slug) {
          return errorResult('product_id or product_slug is required');
        }
        const data = await client.post('orders', {
          product_id: args.product_id,
          slug: args.product_slug,
          quantity: args.quantity,
          unit: args.unit,
          customer_name: args.customer_name,
          customer_email: args.customer_email,
          customer_phone: args.customer_phone,
          delivery_address: args.delivery_address,
          notes: args.notes,
          idempotency_key: args.idempotency_key,
        });
        return textResult(data);
      }

      case 'order_status': {
        if (!args.order_id) return errorResult('order_id is required');
        const orderId = parseInt(args.order_id, 10);
        if (!Number.isFinite(orderId) || orderId < 1) {
          return errorResult('order_id must be a positive integer');
        }
        const data = await client.get(`orders/${encodeURIComponent(orderId)}`);
        return textResult(data);
      }

      case 'calculator': {
        const data = await client.post('calculator', {
          boiler_kw: args.boiler_kw ?? 15,
          desired_temp: args.desired_temp ?? 20,
          heating_months: args.heating_months ?? 6,
          insulation: args.insulation ?? 'average',
        });
        return textResult(data);
      }

      case 'query_trade': {
        if (!args.query_type) return errorResult('query_type is required');
        const endpoint = TRADE_ENDPOINTS[args.query_type];
        if (!endpoint) {
          return errorResult(
            `Unknown query_type: ${args.query_type}. Valid: ${Object.keys(TRADE_ENDPOINTS).join(', ')}`,
          );
        }

        // Build query params from allowed fields only
        const params = {};
        for (const key of endpoint.params) {
          // Map 'reporters' to 'reporter' for timeline's CSV format
          const argKey = key === 'reporters' ? 'reporter' : key;
          const val = args[argKey] ?? args[key];
          if (val !== undefined && val !== null) {
            params[key] = val;
          }
        }

        const data = await client.get(endpoint.path, params);
        return textResult(data);
      }

      case 'query_customs': {
        if (!args.query_type) return errorResult('query_type is required');
        const endpoint = CUSTOMS_ENDPOINTS[args.query_type];
        if (!endpoint) {
          return errorResult(
            `Unknown query_type: ${args.query_type}. Valid: ${Object.keys(CUSTOMS_ENDPOINTS).join(', ')}`,
          );
        }
        const params = {};
        for (const key of endpoint.params) {
          if (args[key] !== undefined && args[key] !== null) {
            params[key] = args[key];
          }
        }
        const data = await client.get(endpoint.path, params);
        return textResult(data);
      }

      case 'list_skills': {
        const data = await client.get('skills/catalog');
        return textResult(data);
      }

      case 'run_skill': {
        if (!args.agent) return errorResult('agent is required');
        if (!args.task) return errorResult('task is required');
        if (args.task.length < 3 || args.task.length > 2000) {
          return errorResult('task must be 3-2000 characters');
        }
        const data = await client.post('skills/run', {
          agent: args.agent,
          task: args.task,
          tenant: args.tenant || 'woodpoint',
          format: args.format || 'markdown',
        });
        return textResult(data);
      }

      // ── Salary Intelligence ──
      case 'salary_overview': {
        const data = await client.get('salary/overview');
        return textResult(data);
      }
      case 'salary_ai_risk': {
        const params = {};
        if (args.occupation) params.occupation = args.occupation;
        if (args.sector) params.sector = args.sector;
        const data = await client.get('salary/ai-risk', params);
        return textResult(data);
      }
      case 'salary_lv_wages': {
        const params = {};
        if (args.sector) params.sector = args.sector;
        if (args.year) params.year = args.year;
        const data = await client.get('salary/lv-wages', params);
        return textResult(data);
      }

      // ── SoulLedger ──
      case 'soul_profile': {
        if (!args.agent_id) return errorResult('agent_id is required');
        const data = await client.get(`soul/profile/${encodeURIComponent(args.agent_id)}`);
        return textResult(data);
      }
      case 'soul_verify': {
        if (!args.agent_id) return errorResult('agent_id is required');
        const data = await client.get(`soul/verify/${encodeURIComponent(args.agent_id)}`);
        return textResult(data);
      }
      case 'soul_leaderboard': {
        const data = await client.get('soul/directory', { limit: args.limit || 20 });
        return textResult(data);
      }
      case 'soul_bounties': {
        const data = await client.get('soul/bounties', { status: args.status || 'open', limit: args.limit || 20 });
        return textResult(data);
      }

      // ── Prediction Signals ──
      case 'prediction_signals': {
        const view = args.view || 'stats';
        const endpoint = view === 'trades' ? 'signals/trades' : view === 'prediction' ? 'signals/prediction' : 'signals/stats';
        const params = {};
        if (args.limit) params.limit = args.limit;
        const data = await client.get(endpoint, params);
        return textResult(data);
      }

      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const status = err.status ? ` (${err.status})` : '';
    return errorResult(`${err.message}${status}`);
  }
});

} // end registerTools()

// ── Helpers ──

function textResult(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }],
    isError: true,
  };
}

// ── Smithery sandbox (allows tool scanning without real credentials) ──

export function createSandboxServer() {
  return server;
}

// ── HTTP Transport (Streamable HTTP) ──

const MAX_SESSIONS = 100;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_BODY_BYTES = 1024 * 1024;     // 1 MB
const REAPER_INTERVAL_MS = 60 * 1000;   // 1 minute

const CORS_ORIGIN = process.env.MCP_CORS_ORIGIN || '*';

async function startHttpServer(port) {
  const { createServer } = await import('node:http');
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );
  const { randomUUID } = await import('node:crypto');

  const sessions = new Map(); // sessionId → { server, transport, lastAccess }

  // Session reaper — evict expired sessions every minute
  const reaper = setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of sessions) {
      if (now - session.lastAccess > SESSION_TTL_MS) {
        session.transport.close().catch(err => {
          console.error(`[mcp-sputnikx] Session reaper close error (${sid}):`, err.message);
        });
        sessions.delete(sid);
      }
    }
  }, REAPER_INTERVAL_MS);
  reaper.unref(); // don't prevent process exit

  const httpServer = createServer(async (req, res) => {
    // CORS headers for cross-origin MCP clients
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, Last-Event-ID');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        server: SERVER_NAME,
        version: SERVER_VERSION,
        sessions: sessions.size,
      }));
      return;
    }

    // Only handle /mcp endpoint
    if (req.url !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Use /mcp for MCP protocol.' }));
      return;
    }

    // Parse JSON body for POST requests with size limit
    let body;
    if (req.method === 'POST') {
      try {
        const chunks = [];
        let totalBytes = 0;
        for await (const chunk of req) {
          totalBytes += chunk.length;
          if (totalBytes > MAX_BODY_BYTES) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request body too large (max 1 MB)' }));
            return;
          }
          chunks.push(chunk);
        }
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch (e) {
        if (!res.headersSent) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
        return;
      }
    }

    const sessionId = req.headers['mcp-session-id'];

    // New session (initialize request)
    if (req.method === 'POST' && !sessionId) {
      // Enforce session cap
      if (sessions.size >= MAX_SESSIONS) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many active sessions. Try again later.' }));
        return;
      }

      const srv = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          sessions.set(sid, { server: srv, transport, lastAccess: Date.now() });
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) sessions.delete(sid);
      };

      await srv.connect(transport);
      await transport.handleRequest(req, res, body);
      return;
    }

    // Existing session
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }
      session.lastAccess = Date.now();
      await session.transport.handleRequest(req, res, body);
      return;
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing mcp-session-id header' }));
  });

  httpServer.listen(port, () => {
    console.error(`[mcp-sputnikx] HTTP server listening on port ${port} (Streamable HTTP)`);
    console.error(`[mcp-sputnikx] MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`[mcp-sputnikx] CORS origin: ${CORS_ORIGIN}`);
  });

  // Graceful shutdown
  const cleanup = async () => {
    clearInterval(reaper);
    const results = await Promise.allSettled(
      [...sessions.values()].map((s) => s.transport.close()),
    );
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[mcp-sputnikx] Session close error:', r.reason);
      }
    }
    sessions.clear();
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// ── Start ──

import { fileURLToPath } from 'node:url';

// Detect if running as CLI entry point (vs imported as module by Smithery/bundler)
let isCLI = false;
try {
  isCLI = process.argv[1] &&
    fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`));
} catch { /* bundled as CJS (e.g. Smithery) — import.meta.url undefined, skip auto-start */ }

// Also auto-start when MCP_HTTP_PORT or PORT is set (e.g. via PM2, MCPize Cloud Run)
const httpPort = parseInt(process.env.MCP_HTTP_PORT || process.env.PORT, 10);
const validHttpPort = Number.isFinite(httpPort) && httpPort >= 1 && httpPort <= 65535;
if (isCLI || validHttpPort) {
  (async () => {
    if (!client.configured) {
      console.error('[mcp-sputnikx] WARNING: SPUTNIKX_API_KEY not set. Agent endpoints will fail with 401.');
      console.error('[mcp-sputnikx] Get your API key from: https://sputnikx.xyz/admin → Settings → API Keys');
    }

    if (validHttpPort) {
      await startHttpServer(httpPort);
    } else {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error('[mcp-sputnikx] Server started (stdio transport)');
    }
  })().catch((err) => {
    console.error('[mcp-sputnikx] Fatal:', err.message);
    process.exit(1);
  });
}
