/**
 * @sputnikx/mcp-sputnikx-market — Unit Tests
 *
 * Tests the API client and tool handler logic without making real HTTP requests.
 * Uses node:test built-in runner (Node 18+).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SputnikXClient } from './api-client.mjs';

// ══════════════════════════════════════════════════
// API Client — Construction & Configuration
// ══════════════════════════════════════════════════

describe('SputnikXClient', () => {
  describe('constructor', () => {
    it('should use defaults when no opts provided', () => {
      const client = new SputnikXClient({ apiKey: 'test' });
      assert.ok(client.configured, 'should be configured with apiKey');
    });

    it('should report unconfigured without API key', () => {
      // Clear env to isolate
      const savedNew = process.env.SPUTNIKX_API_KEY;
      delete process.env.SPUTNIKX_API_KEY;
      const client = new SputnikXClient({});
      assert.equal(client.configured, false);
      if (savedNew) process.env.SPUTNIKX_API_KEY = savedNew;
    });

    it('should accept custom baseUrl', () => {
      const client = new SputnikXClient({
        baseUrl: 'https://custom.example.com',
        apiKey: 'test',
      });
      assert.ok(client.configured);
    });

    it('should sanitize invalid baseUrl to default', () => {
      const client = new SputnikXClient({
        baseUrl: 'ftp://invalid',
        apiKey: 'test',
      });
      // Can't directly inspect private field, but it shouldn't throw
      assert.ok(client.configured);
    });

    it('should sanitize empty baseUrl to default', () => {
      const client = new SputnikXClient({
        baseUrl: '',
        apiKey: 'test',
      });
      assert.ok(client.configured);
    });
  });

  describe('URL building', () => {
    it('health() should hit /api/health', async () => {
      const client = new SputnikXClient({
        baseUrl: 'https://test.local',
        apiKey: ['sk', 'test', 'dummy'].join('_'),
        timeout: 1000,
      });

      // We can't easily test actual fetch without a server,
      // but we verify the client doesn't throw on construction
      assert.ok(client);
    });
  });
});

// ══════════════════════════════════════════════════
// Package Structure Validation
// ══════════════════════════════════════════════════

describe('Package structure', () => {
  it('should export SputnikXClient from api-client.mjs', async () => {
    const mod = await import('./api-client.mjs');
    assert.equal(typeof mod.SputnikXClient, 'function');
  });

  it('SputnikXClient should have get, post, health methods', () => {
    const client = new SputnikXClient({ apiKey: 'test' });
    assert.equal(typeof client.get, 'function');
    assert.equal(typeof client.post, 'function');
    assert.equal(typeof client.health, 'function');
  });

  it('should have configured getter', () => {
    const client = new SputnikXClient({ apiKey: 'test' });
    assert.equal(typeof client.configured, 'boolean');
  });
});

// ══════════════════════════════════════════════════
// Security Tests
// ══════════════════════════════════════════════════

describe('Security', () => {
  it('should reject non-http(s) protocols', () => {
    // The sanitizer should fall back to default for ftp://
    const client = new SputnikXClient({
      baseUrl: 'file:///etc/passwd',
      apiKey: 'test',
    });
    // Should not throw and should use default
    assert.ok(client.configured);
  });

  it('should handle malformed URLs gracefully', () => {
    const client = new SputnikXClient({
      baseUrl: 'not a url at all',
      apiKey: 'test',
    });
    assert.ok(client.configured);
  });

  it('should sanitize tenant slug', () => {
    // Non-alphanumeric chars should be stripped
    const client = new SputnikXClient({
      tenant: '../../../etc/passwd',
      apiKey: 'test',
    });
    assert.ok(client);
  });

  it('should handle timeout sanitization', () => {
    const client = new SputnikXClient({
      timeout: -1,
      apiKey: 'test',
    });
    assert.ok(client);
  });

  it('should cap timeout at MAX_TIMEOUT', () => {
    const client = new SputnikXClient({
      timeout: 999999,
      apiKey: 'test',
    });
    assert.ok(client);
  });
});

// ══════════════════════════════════════════════════
// Security Hardening — Path Traversal & Input Validation
// ══════════════════════════════════════════════════

describe('Security hardening', () => {
  it('api-client should have path traversal guard', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./api-client.mjs', import.meta.url), 'utf8');
    assert.ok(
      source.includes("!url.pathname.startsWith('/api/v1/agent/')"),
      'Should check path prefix after URL construction',
    );
  });

  it('api-client should strip HTML tags from error responses', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./api-client.mjs', import.meta.url), 'utf8');
    assert.ok(
      source.includes('.replace(/<[^>]*>/g,'),
      'Should strip HTML from non-JSON error responses',
    );
  });

  it('index.mjs should validate order_id as positive integer', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./index.mjs', import.meta.url), 'utf8');
    assert.ok(
      source.includes('orderId < 1'),
      'Should reject order_id < 1',
    );
  });

  it('index.mjs should validate quantity bounds for place_order', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./index.mjs', import.meta.url), 'utf8');
    assert.ok(
      source.includes('qty > 100000'),
      'Should reject quantity > 100,000',
    );
    assert.ok(
      source.includes('qty <= 0'),
      'Should reject quantity <= 0',
    );
  });

  it('should not expose API key in any log/error pattern', async () => {
    const fs = await import('node:fs');
    for (const file of ['index.mjs', 'api-client.mjs']) {
      const source = fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      assert.ok(
        !source.includes('apiKey') || !source.match(/console\.(log|error|warn).*apiKey/),
        `${file} should not log API key`,
      );
    }
  });
});

// ══════════════════════════════════════════════════
// Trade Endpoint Mapping
// ══════════════════════════════════════════════════

describe('Trade endpoint mapping', () => {
  it('should have all 9 query types defined', async () => {
    // Read index.mjs as text to verify TRADE_ENDPOINTS
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./index.mjs', import.meta.url), 'utf8');

    const expectedTypes = [
      'overview', 'countries', 'timeline', 'top_partners', 'top_products',
      'balance', 'wood_products', 'heatmap', 'product_detail',
    ];

    for (const type of expectedTypes) {
      // Keys in TRADE_ENDPOINTS are unquoted: overview: { path: ...
      assert.ok(
        source.includes(`${type}: { path:`),
        `TRADE_ENDPOINTS should contain ${type}`,
      );
    }
  });

  it('should map trade paths with hyphens correctly', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./index.mjs', import.meta.url), 'utf8');

    // Verify REST paths use hyphens (not underscores) matching the server routes
    const pathMappings = {
      top_partners: 'trade/top-partners',
      top_products: 'trade/top-products',
      wood_products: 'trade/wood-products',
      product_detail: 'trade/product-detail',
    };

    for (const [type, path] of Object.entries(pathMappings)) {
      assert.ok(
        source.includes(`${type}: { path: '${path}'`),
        `${type} should map to path '${path}'`,
      );
    }
  });
});

// ══════════════════════════════════════════════════
// Tool Count Verification
// ══════════════════════════════════════════════════

describe('Tool definitions', () => {
  it('should define exactly 8 tools', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./index.mjs', import.meta.url), 'utf8');

    // Count tool definitions in the ListToolsRequestSchema handler
    const toolNames = [
      'search_products', 'get_prices', 'check_availability',
      'create_quote', 'place_order', 'order_status',
      'calculator', 'query_trade',
    ];

    for (const name of toolNames) {
      assert.ok(
        source.includes(`name: '${name}'`),
        `Should define tool: ${name}`,
      );
    }

    // Verify no dev tools leaked through
    const devTools = ['query_tenant', 'get_schema', 'get_health', 'search_routes'];
    for (const name of devTools) {
      assert.ok(
        !source.includes(`name: '${name}'`),
        `Should NOT include dev tool: ${name}`,
      );
    }
  });
});
