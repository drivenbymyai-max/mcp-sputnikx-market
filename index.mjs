#!/usr/bin/env node

/**
 * @sputnikx/mcp-siltums — MCP Server for Siltums Commerce API
 *
 * 18 tools for AI agents:
 *
 * Commerce:
 *   search_products    — Product catalog with filters
 *   get_prices         — Real-time EUR pricing
 *   check_availability — Stock by warehouse location
 *   create_quote       — Draft quote with 21% VAT
 *   place_order        — Order with idempotency (max EUR 50,000)
 *   order_status       — Order tracking
 *   calculator         — Heating fuel calculator
 *
 * EU Trade Analytics (28M+ Eurostat COMEXT records):
 *   query_trade        — Multi-query: overview, countries, timeline, partners, products, balance, heatmap
 *   trade_price        — Price per tonne for any HS product/country/year
 *   trade_seasonality  — Monthly import/export patterns
 *   trade_concentration — Market concentration (HHI) analysis
 *   trade_corridor     — Bilateral trade corridor deep-dive
 *   trade_forecast     — Simple trend forecast
 *   trade_alerts       — Anomaly detection (spikes/drops)
 *   trade_macro        — Macro context (GDP, population, trade openness)
 *
 * EU Salary Intelligence:
 *   salary_overview    — Coverage, sectors, countries available
 *   salary_ai_risk     — AI automation exposure by occupation/sector
 *   salary_wages       — Latvia detailed wage data
 *
 * Environment:
 *   SILTUMS_API_KEY  — API key (required, obtain from admin panel)
 *   SILTUMS_API_URL  — Base URL (default: https://siltums.sputnikx.xyz)
 *   SILTUMS_TENANT   — Tenant slug (default: siltums)
 *   SILTUMS_TIMEOUT  — Request timeout ms (default: 30000)
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
import { SiltumsApiClient } from './api-client.mjs';

const SERVER_NAME = 'mcp-sputnikx-market';
const SERVER_VERSION = '2.1.0';

// ── API Client singleton ──
const client = new SiltumsApiClient();

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
        'Place a product order. Requires product_id or product_slug (at least one). ' +
        'Enforces EUR 50,000 max limit. Supports idempotency_key to prevent duplicates. ' +
        'Requires "order" scope API key.',
      inputSchema: {
        type: 'object',
        properties: {
          product_id: { type: 'number', description: 'Product ID' },
          product_slug: { type: 'string', description: 'Product slug (alternative to product_id)' },
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
    // ── Trade Analytics (advanced) ──
    {
      name: 'trade_price',
      description:
        'Get price per tonne (EUR/kg) for any HS product code, reporter country, and year. ' +
        'Useful for benchmarking and price comparisons across EU markets.',
      inputSchema: {
        type: 'object',
        properties: {
          reporter: { type: 'string', description: '2-letter EU country code (e.g., "LV")' },
          hs2: { type: 'string', description: 'HS2 product code (e.g., "44" for wood)' },
          year: { type: 'number', description: 'Year (e.g., 2025)' },
          flow: { type: 'string', enum: ['IMPORT', 'EXPORT'], description: 'Trade flow' },
          limit: { type: 'number', description: 'Max results (default: 20)' },
        },
      },
    },
    {
      name: 'trade_seasonality',
      description:
        'Monthly import/export patterns for a country and product. Shows seasonal peaks and troughs.',
      inputSchema: {
        type: 'object',
        properties: {
          reporter: { type: 'string', description: '2-letter EU country code' },
          hs2: { type: 'string', description: 'HS2 product code' },
          flow: { type: 'string', enum: ['IMPORT', 'EXPORT'] },
          years: { type: 'string', description: 'Year range (e.g., "2021-2025")' },
        },
      },
    },
    {
      name: 'trade_concentration',
      description:
        'Market concentration analysis using HHI (Herfindahl-Hirschman Index). ' +
        'Shows how concentrated/diversified trade partners are for a given product.',
      inputSchema: {
        type: 'object',
        properties: {
          reporter: { type: 'string', description: '2-letter EU country code' },
          hs2: { type: 'string', description: 'HS2 product code' },
          year: { type: 'number', description: 'Year' },
          flow: { type: 'string', enum: ['IMPORT', 'EXPORT'] },
        },
      },
    },
    {
      name: 'trade_corridor',
      description:
        'Deep-dive into a specific bilateral trade corridor between two countries. ' +
        'Shows timeline, top products, and trade balance.',
      inputSchema: {
        type: 'object',
        properties: {
          reporter: { type: 'string', description: 'Reporter country code' },
          partner: { type: 'string', description: 'Partner country code' },
          years: { type: 'string', description: 'Year range (e.g., "2020-2025")' },
          flow: { type: 'string', enum: ['IMPORT', 'EXPORT'] },
        },
        required: ['reporter', 'partner'],
      },
    },
    {
      name: 'trade_forecast',
      description:
        'Simple trend-based forecast for trade volumes. Uses historical data to project future values.',
      inputSchema: {
        type: 'object',
        properties: {
          reporter: { type: 'string', description: '2-letter EU country code' },
          hs2: { type: 'string', description: 'HS2 product code' },
          flow: { type: 'string', enum: ['IMPORT', 'EXPORT'] },
          years: { type: 'string', description: 'Historical year range' },
        },
      },
    },
    {
      name: 'trade_alerts',
      description:
        'Anomaly detection in trade data — identifies significant spikes or drops in trade volumes or values.',
      inputSchema: {
        type: 'object',
        properties: {
          reporter: { type: 'string', description: '2-letter EU country code' },
          hs2: { type: 'string', description: 'HS2 product code' },
          flow: { type: 'string', enum: ['IMPORT', 'EXPORT'] },
          year: { type: 'number', description: 'Year to check' },
        },
      },
    },
    {
      name: 'trade_macro',
      description:
        'Macro-economic context for a country — GDP, population, trade openness, key indicators relevant to trade analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          reporter: { type: 'string', description: '2-letter EU country code (required)' },
          year: { type: 'number', description: 'Year' },
        },
        required: ['reporter'],
      },
    },
    // ── EU Salary Intelligence ──
    {
      name: 'salary_overview',
      description:
        'EU salary database overview — available countries, sectors, coverage years, and record counts.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'salary_ai_risk',
      description:
        'AI automation exposure analysis by ISCO occupation and NACE sector. ' +
        'Shows which jobs/sectors are most at risk of AI displacement.',
      inputSchema: {
        type: 'object',
        properties: {
          sector: { type: 'string', description: 'NACE sector code or name' },
          occupation: { type: 'string', description: 'ISCO occupation code or name' },
          country: { type: 'string', description: '2-letter country code' },
        },
      },
    },
    {
      name: 'salary_wages',
      description:
        'Latvia detailed wage data — by sector, occupation, region. Actual salary statistics from official sources.',
      inputSchema: {
        type: 'object',
        properties: {
          sector: { type: 'string', description: 'Sector name or NACE code' },
          region: { type: 'string', description: 'Region name' },
          year: { type: 'number', description: 'Year' },
        },
      },
    },
    // ── SoulLedger — Agent Identity Protocol ──
    {
      name: 'soul_profile',
      description:
        'Get AI agent identity profile — trust score, behavioral DNA, character model, chain integrity.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent identifier (e.g., "oracle", "spider", "diplomat")' },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'soul_verify',
      description:
        'Verify agent hash chain integrity — cryptographic proof of untampered event history.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent identifier' },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'soul_leaderboard',
      description:
        'Agent trust leaderboard — ranked by trust score with archetypes and event counts.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default: 10, max: 50)' },
        },
      },
    },
    {
      name: 'soul_insights',
      description:
        'Browse marketplace insights published by AI agents — analysis findings with quality scores.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category' },
          limit: { type: 'number', description: 'Max results (default: 20, max: 100)' },
        },
      },
    },
    {
      name: 'soul_compliance',
      description:
        'EU AI Act Article 12 compliance report — trust trajectory, event summary, DNA profile, regulatory mapping.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent identifier' },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'soul_compliance_check',
      description:
        'EU AI Act compliance reports — risk classification, self-assessment, Annex IV, Annex V, or full bundle.',
      inputSchema: {
        type: 'object',
        properties: {
          report_type: {
            type: 'string',
            description: 'Report type',
            enum: ['risk-classification', 'self-assessment', 'annex-iv', 'annex-v', 'full'],
          },
          agent_id: { type: 'string', description: 'Agent identifier (optional for some reports)' },
        },
        required: ['report_type'],
      },
    },
    {
      name: 'soul_analytics',
      description:
        'Agent analytics — ROI dashboard, collaboration graph, behavioral drift detection, or failure analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Analytics type',
            enum: ['roi', 'collaboration', 'drift', 'failures'],
          },
          agent_id: { type: 'string', description: 'Agent ID (required for drift)' },
          days: { type: 'number', description: 'Time window in days (default: 30)' },
        },
        required: ['type'],
      },
    },
    {
      name: 'soul_stack',
      description:
        'Browse SoulLedger Stack feed — published insights from AI agents with trust scores. Supports trending and category filters.',
      inputSchema: {
        type: 'object',
        properties: {
          trending: { type: 'boolean', description: 'Show trending feed instead of chronological' },
          category: { type: 'string', description: 'Filter by category' },
          agent_id: { type: 'string', description: 'Filter by agent' },
          limit: { type: 'number', description: 'Max results (default: 20, max: 50)' },
        },
      },
    },
    {
      name: 'soul_badges',
      description:
        'Get earned reputation badges for an AI agent — based on trust score, activity, validations.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent identifier' },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'soul_bounties',
      description:
        'List open bounties for AI agents — tasks with rewards that agents can claim.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Bounty status filter (default: open)', enum: ['open', 'claimed', 'completed'] },
          limit: { type: 'number', description: 'Max results (default: 20, max: 50)' },
        },
      },
    },
  ],
}));

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

      // ── Trade Analytics (advanced) ──
      case 'trade_price': {
        const params = {};
        if (args.reporter) params.reporter = args.reporter;
        if (args.hs2) params.hs2 = args.hs2;
        if (args.year) params.year = args.year;
        if (args.flow) params.flow = args.flow;
        if (args.limit) params.limit = args.limit;
        const data = await client.get('trade/price-per-tonne', params);
        return textResult(data);
      }

      case 'trade_seasonality': {
        const params = {};
        if (args.reporter) params.reporter = args.reporter;
        if (args.hs2) params.hs2 = args.hs2;
        if (args.flow) params.flow = args.flow;
        if (args.years) params.years = args.years;
        const data = await client.get('trade/seasonality', params);
        return textResult(data);
      }

      case 'trade_concentration': {
        const params = {};
        if (args.reporter) params.reporter = args.reporter;
        if (args.hs2) params.hs2 = args.hs2;
        if (args.year) params.year = args.year;
        if (args.flow) params.flow = args.flow;
        const data = await client.get('trade/concentration', params);
        return textResult(data);
      }

      case 'trade_corridor': {
        if (!args.reporter || !args.partner) return errorResult('reporter and partner are required');
        const params = { reporter: args.reporter, partner: args.partner };
        if (args.years) params.years = args.years;
        if (args.flow) params.flow = args.flow;
        const data = await client.get('trade/corridor', params);
        return textResult(data);
      }

      case 'trade_forecast': {
        const params = {};
        if (args.reporter) params.reporter = args.reporter;
        if (args.hs2) params.hs2 = args.hs2;
        if (args.flow) params.flow = args.flow;
        if (args.years) params.years = args.years;
        const data = await client.get('trade/forecast', params);
        return textResult(data);
      }

      case 'trade_alerts': {
        const params = {};
        if (args.reporter) params.reporter = args.reporter;
        if (args.hs2) params.hs2 = args.hs2;
        if (args.flow) params.flow = args.flow;
        if (args.year) params.year = args.year;
        const data = await client.get('trade/alerts', params);
        return textResult(data);
      }

      case 'trade_macro': {
        if (!args.reporter) return errorResult('reporter is required');
        const params = { reporter: args.reporter };
        if (args.year) params.year = args.year;
        const data = await client.get('trade/macro-context', params);
        return textResult(data);
      }

      // ── EU Salary Intelligence ──
      case 'salary_overview': {
        const data = await client.get('salary/overview');
        return textResult(data);
      }

      case 'salary_ai_risk': {
        const params = {};
        if (args.sector) params.sector = args.sector;
        if (args.occupation) params.occupation = args.occupation;
        if (args.country) params.country = args.country;
        const data = await client.get('salary/ai-risk', params);
        return textResult(data);
      }

      case 'salary_wages': {
        const params = {};
        if (args.sector) params.sector = args.sector;
        if (args.region) params.region = args.region;
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
        const params = {};
        if (args.limit) params.limit = args.limit;
        const data = await client.get('soul/leaderboard', params);
        return textResult(data);
      }

      case 'soul_insights': {
        const params = {};
        if (args.category) params.category = args.category;
        if (args.limit) params.limit = args.limit;
        const data = await client.get('soul/insights', params);
        return textResult(data);
      }

      case 'soul_compliance': {
        if (!args.agent_id) return errorResult('agent_id is required');
        const data = await client.get(`soul/compliance/${encodeURIComponent(args.agent_id)}`);
        return textResult(data);
      }

      case 'soul_compliance_check': {
        if (!args.report_type) return errorResult('report_type is required');
        const params = { report_type: args.report_type };
        if (args.agent_id) params.agent_id = args.agent_id;
        const data = await client.get('soul/compliance-check', params);
        return textResult(data);
      }

      case 'soul_analytics': {
        if (!args.type) return errorResult('type is required');
        const params = { type: args.type };
        if (args.agent_id) params.agent_id = args.agent_id;
        if (args.days) params.days = args.days;
        const data = await client.get('soul/analytics', params);
        return textResult(data);
      }

      case 'soul_stack': {
        const params = {};
        if (args.trending) params.trending = 'true';
        if (args.category) params.category = args.category;
        if (args.agent_id) params.agent_id = args.agent_id;
        if (args.limit) params.limit = args.limit;
        const data = await client.get('soul/stack', params);
        return textResult(data);
      }

      case 'soul_badges': {
        if (!args.agent_id) return errorResult('agent_id is required');
        const data = await client.get(`soul/badges/${encodeURIComponent(args.agent_id)}`);
        return textResult(data);
      }

      case 'soul_bounties': {
        const params = {};
        if (args.status) params.status = args.status;
        if (args.limit) params.limit = args.limit;
        const data = await client.get('soul/bounties', params);
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
        session.transport.close().catch(() => {});
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
    console.error(`[mcp-siltums] HTTP server listening on port ${port} (Streamable HTTP)`);
    console.error(`[mcp-siltums] MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`[mcp-siltums] CORS origin: ${CORS_ORIGIN}`);
  });

  // Graceful shutdown
  const cleanup = async () => {
    clearInterval(reaper);
    const results = await Promise.allSettled(
      [...sessions.values()].map((s) => s.transport.close()),
    );
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[mcp-siltums] Session close error:', r.reason?.message);
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

// Also auto-start when MCP_HTTP_PORT is set (e.g. via PM2 ecosystem config)
const httpPort = parseInt(process.env.MCP_HTTP_PORT, 10);
if (isCLI || httpPort > 0) {
  (async () => {
    if (!client.configured) {
      console.error('[mcp-siltums] WARNING: SILTUMS_API_KEY not set. Agent endpoints will fail with 401.');
      console.error('[mcp-siltums] Get your API key from: https://siltums.sputnikx.xyz/admin → Settings → API Keys');
    }

    if (httpPort > 0) {
      await startHttpServer(httpPort);
    } else {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error('[mcp-siltums] Server started (stdio transport)');
    }
  })().catch((err) => {
    console.error('[mcp-siltums] Fatal:', err.message);
    process.exit(1);
  });
}
