# mcp-sputnikx-market

[![npm](https://img.shields.io/npm/v/mcp-sputnikx-market)](https://www.npmjs.com/package/mcp-sputnikx-market)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

MCP server for **SputnikX** — EU trade intelligence, customs analytics, salary data, agent identity, and commerce API. Connect any AI assistant to 63M+ Eurostat records via [Model Context Protocol](https://modelcontextprotocol.io).

## Data Sources

| Source | Records | Coverage | Update |
|--------|---------|----------|--------|
| **Eurostat COMEXT** | 63M+ | EU27, 260 partners, HS2-CN8, 2005-2025 | Monthly |
| **Latvia Customs** | 15M+ | KN8-level, declarations, 2005-2025 | Monthly |
| **EU Salary** | 70K+ | 44 countries, 21 NACE sectors, AI risk scores | Annual |
| **Fusion Engine** | Cross-source | Trade + Customs + Salary + Macro (ECB/FRED) | Real-time |
| **SoulLedger** | 130K+ agents | Trust scoring, behavioral DNA, ERC-8004 | Real-time |

## Quick Start

### Claude Desktop

```json
{
  "mcpServers": {
    "sputnikx": {
      "command": "npx",
      "args": ["-y", "mcp-sputnikx-market"],
      "env": {
        "SPUTNIKX_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add sputnikx -- npx -y mcp-sputnikx-market
export SPUTNIKX_API_KEY=sk_live_your_key_here
```

### Cursor / VS Code / Windsurf

```json
{
  "mcp": {
    "servers": {
      "sputnikx": {
        "command": "npx",
        "args": ["-y", "mcp-sputnikx-market"],
        "env": { "SPUTNIKX_API_KEY": "sk_live_your_key_here" }
      }
    }
  }
}
```

## 22 Tools

### EU Trade Analytics

| Tool | Description |
|------|-------------|
| `query_trade` | 9 query types: overview, countries, timeline, top_partners, top_products, balance, wood_products, heatmap, product_detail |
| `query_customs` | Latvia customs: classifications, trends, top commodities, country analysis, tariff lookup, seasonal patterns |
| `salary_overview` | EU salary DB metadata and coverage |
| `salary_ai_risk` | AI automation exposure scores (ISCO + NACE, OECD 2023) |
| `salary_lv_wages` | Latvia wages by year, NACE sector, region, gender |

### Fusion Engine (Cross-Source Intelligence)

| Tool | Description | x402 Price |
|------|-------------|------------|
| `fusion_query` | Universal query across Trade + Customs + Salary + Macro | $0.50 |
| `fusion_market_intel` | Market intelligence combining all data sources | $1.00 |
| `fusion_country_profile` | Country economic profile (trade + salary + macro) | $1.00 |
| `fusion_deep_analysis` | LLM-powered cross-source synthesis | $5.00 |

### Commerce

| Tool | Description |
|------|-------------|
| `search_products` | Product catalog (heating pellets, wood products) |
| `get_prices` | Real-time EUR pricing with price_per_kg |
| `check_availability` | Stock by warehouse location |
| `calculator` | Heating fuel calculator (kW, insulation, climate) |
| `create_quote` | Quote with line items + 21% VAT |
| `place_order` | Order with idempotency key (max EUR 50,000) |
| `order_status` | Track order by ID |

### SoulLedger (Agent Identity)

| Tool | Description |
|------|-------------|
| `soul_profile` | Agent trust score + 7D behavioral DNA |
| `soul_verify` | Cryptographic hash-chain verification |
| `soul_leaderboard` | Agent trust rankings |
| `soul_bounties` | Bounty marketplace (USDC rewards) |

### Intelligence

| Tool | Description |
|------|-------------|
| `prediction_signals` | Prediction market signals (paper trading) |
| `list_skills` / `run_skill` | CRM agent skills (oracle, spider, strategist) |

## Trade Query Types

```
overview       — High-level stats: total records, countries, date range
countries      — EU27 countries with data availability
timeline       — Monthly trade volume time series
top_partners   — Largest trading partners by EUR value
top_products   — Largest HS2 categories by EUR value
balance        — Trade balance (export - import) over years
wood_products  — HS4 wood trade breakdown (chapter 44)
heatmap        — Cross-country comparison for a product
product_detail — Deep HS2 chapter analysis
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPUTNIKX_API_KEY` | Yes | — | API key (get from admin panel or register agent) |
| `SPUTNIKX_API_URL` | No | `https://sputnikx.xyz` | API base URL |
| `SPUTNIKX_TENANT` | No | `siltums` | Tenant: `siltums` or `woodpoint` |
| `SPUTNIKX_TIMEOUT` | No | `30000` | Request timeout (ms) |
| `MCP_HTTP_PORT` | No | — | Enable Streamable HTTP transport |

## Payment (x402)

Paid endpoints support [x402 micropayments](https://www.x402.org/) — USDC on Base chain.

| Tier | Price Range | Examples |
|------|-------------|---------|
| Free | $0 | health, product feed, OpenAPI, soul directory |
| Basic | $0.001-$0.01 | catalog, prices, salary overview |
| Standard | $0.05-$0.10 | trade analytics, customs, seasonality, HHI |
| Premium | $0.50-$5.00 | fusion queries, deep analysis, agent skills |

## Example Prompts

- *"Show Latvia's top 5 trading partners for wood products in 2024"*
- *"What's the Herfindahl index for HS44 imports into Germany?"*
- *"Compare AI automation risk across EU manufacturing sectors"*
- *"Give me a country profile for Poland — trade, salary, macro combined"*
- *"Calculate heating pellet needs: 25kW boiler, 7 months, good insulation"*
- *"Check if 'Mikhail Petrov' appears on EU sanctions lists"*

## Discovery

- [OpenAPI Spec](https://sputnikx.xyz/api/openapi.json)
- [Agent Card](https://sputnikx.xyz/.well-known/agent-card.json)
- [LLM Documentation](https://sputnikx.xyz/llms.txt)
- [SoulLedger](https://soul.sputnikx.xyz)

## License

MIT
