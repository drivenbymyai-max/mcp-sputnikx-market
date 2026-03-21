#!/usr/bin/env node

/**
 * Smoke test — verify MCP package works against live API.
 * Usage: SPUTNIKX_API_KEY=sk_live_xxx node smoke-test.mjs
 *        or: node smoke-test.mjs (uses localhost:3000, no auth for health)
 */

import { SputnikXClient } from './api-client.mjs';

const client = new SputnikXClient({
  baseUrl: process.env.SPUTNIKX_API_URL || 'http://localhost:3000',
  apiKey: process.env.SPUTNIKX_API_KEY || '',
  tenant: 'siltums',
});

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  OK  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${name}: ${err.message}`);
    failed++;
  }
}

console.log('Smoke testing against:', process.env.SPUTNIKX_API_URL || 'http://localhost:3000');
console.log('API key:', client.configured ? 'configured' : 'NOT SET (some tests will fail)');
console.log('');

// Health — no auth required
await test('health check', async () => {
  const data = await client.health();
  if (data.status !== 'ok') throw new Error(`Expected status=ok, got ${data.status}`);
});

// Products — requires API key
if (client.configured) {
  await test('GET products', async () => {
    const data = await client.get('products');
    if (!data.success) throw new Error('Expected success=true');
    if (!Array.isArray(data.data)) throw new Error('Expected data array');
    if (data.data.length === 0) throw new Error('No products found');
    console.log(`       → ${data.count} products`);
  });

  await test('GET prices', async () => {
    const data = await client.get('prices');
    if (!data.success) throw new Error('Expected success=true');
    if (!data.currency) throw new Error('Expected currency field');
    console.log(`       → ${data.data.length} prices, currency: ${data.currency}`);
  });

  await test('GET availability', async () => {
    const data = await client.get('availability');
    if (!data.success) throw new Error('Expected success=true');
    console.log(`       → ${data.data.length} products with stock data`);
  });

  await test('POST calculator', async () => {
    const data = await client.post('calculator', {
      boiler_kw: 20,
      desired_temp: 21,
      heating_months: 7,
      insulation: 'good',
    });
    if (!data.success) throw new Error('Expected success=true');
    if (!data.data.granulas.kg) throw new Error('Expected kg calculation');
    console.log(`       → ${data.data.granulas.kg}kg, ${data.data.granulas.bags} bags`);
  });

  await test('GET trade/overview', async () => {
    const data = await client.get('trade/overview');
    if (!data.success) throw new Error('Expected success=true');
    if (!data.data.total_records) throw new Error('Expected total_records');
    console.log(`       → ${(data.data.total_records / 1e6).toFixed(1)}M records`);
  });

  await test('GET trade/countries', async () => {
    const data = await client.get('trade/countries');
    if (!data.success) throw new Error('Expected success=true');
    console.log(`       → ${data.total} countries`);
  });

  await test('GET trade/top-partners', async () => {
    const data = await client.get('trade/top-partners', { reporter: 'LV', year: '2024', flow: 'EXPORT' });
    if (!data.success) throw new Error('Expected success=true');
    console.log(`       → ${data.total} partners for LV exports 2024`);
  });

  // Customs Analytics
  await test('GET customs/classifications', async () => {
    const data = await client.get('customs/classifications', { q: 'wood' });
    if (!data.success) throw new Error('Expected success=true');
    console.log(`       → ${data.total} classifications for "wood"`);
  });

  await test('GET customs/trends', async () => {
    const data = await client.get('customs/trends', { years: '2022-2025' });
    if (!data.success) throw new Error('Expected success=true');
    console.log(`       → ${data.total} trend records`);
  });

  await test('GET customs/top-commodities', async () => {
    const data = await client.get('customs/top-commodities', { year: '2024', direction: 'IMPORT', limit: '5' });
    if (!data.success) throw new Error('Expected success=true');
    console.log(`       → ${data.total} top commodities`);
  });

  // Skills
  await test('GET skills/catalog', async () => {
    const data = await client.get('skills/catalog');
    if (!data.success) throw new Error('Expected success=true');
    if (!data.total || data.total < 1) throw new Error('Expected at least 1 skill');
    console.log(`       → ${data.total} skills available`);
  });
} else {
  console.log('  SKIP agent endpoints (no API key)');
}

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
