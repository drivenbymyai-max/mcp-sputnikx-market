# @sputnikx/mcp-siltums

MCP server for the **Siltums Commerce API** — EU trade analytics, product catalog, orders, and heating fuel calculator.

## Data

- **28M+ Eurostat COMEXT records** — EU27 bilateral trade data (1988-2025)
- **Product catalog** — Heating pellets, briquettes, wood products (plywood, veneer, OSB)
- **Real-time pricing** — EUR with VAT calculations
- **Warehouse availability** — Stock levels by location

## Quick Start

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "siltums": {
      "command": "npx",
      "args": ["-y", "@sputnikx/mcp-siltums"],
      "env": {
        "SILTUMS_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add siltums -- npx -y @sputnikx/mcp-siltums
```

Set your API key:

```bash
export SILTUMS_API_KEY=sk_live_your_key_here
```

### Cursor / VS Code

Add to MCP settings:

```json
{
  "mcp": {
    "servers": {
      "siltums": {
        "command": "npx",
        "args": ["-y", "@sputnikx/mcp-siltums"],
        "env": {
          "SILTUMS_API_KEY": "sk_live_your_key_here"
        }
      }
    }
  }
}
```

## Tools

| Tool | Description | API Scope |
|------|-------------|-----------|
| `search_products` | Product catalog with filters (type, name, stock) | read |
| `get_prices` | Real-time EUR pricing with price_per_kg | read |
| `check_availability` | Stock quantities by warehouse location | read |
| `calculator` | Heating fuel needs from boiler specs (kW, temp, insulation) | read |
| `create_quote` | Draft quote with line items + 21% VAT | quote |
| `place_order` | Order with idempotency key (max EUR 50,000) | order |
| `order_status` | Track order by ID | order |
| `query_trade` | EU trade analytics — 9 query types (see below) | read |

### Trade Analytics Query Types

| Type | Description | Required Params |
|------|-------------|-----------------|
| `overview` | High-level stats: total records, countries, date range | — |
| `countries` | EU27 countries with data availability | — |
| `timeline` | Monthly trade volume time series | reporter, flow, years |
| `top_partners` | Top trading partners by EUR value | reporter |
| `top_products` | Top HS2 product categories | reporter |
| `balance` | Trade balance (export - import) over years | reporter |
| `wood_products` | HS4 wood trade breakdown (chapter 44) | reporter |
| `heatmap` | Cross-country comparison for a product | year |
| `product_detail` | Detailed HS2 chapter analysis | reporter, hs2 |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SILTUMS_API_KEY` | Yes | — | API key (get from admin panel) |
| `SILTUMS_API_URL` | No | `https://siltums.sputnikx.xyz` | API base URL |
| `SILTUMS_TENANT` | No | `siltums` | Tenant: `siltums` or `woodpoint` |
| `SILTUMS_TIMEOUT` | No | `30000` | Request timeout (ms) |

## API Key Scopes

Keys are created in the admin panel at `/admin` → Settings → API Keys.

| Scope | Access |
|-------|--------|
| `read` | Products, prices, availability, calculator, trade analytics |
| `quote` | + Create draft quotes |
| `order` | + Place orders, check order status |
| `admin` | + Full access |

## Payment (x402)

Paid endpoints support [x402 micropayments](https://www.x402.org/) — USDC on Base chain.
Prices range from $0.001 (product catalog) to $0.10 (trade deep analysis).

Free endpoints: health, product feed, OpenAPI spec.

## Examples

Ask your AI assistant:

- *"What heating pellets are available?"*
- *"Calculate fuel needs for a 25kW boiler, 7 months, good insulation"*
- *"Show Latvia's top trading partners in 2024"*
- *"What's the wood trade balance for Germany 2021-2025?"*
- *"Create a quote for 10 pallets of premium granulas for John Smith"*

## Links

- [OpenAPI Spec](https://siltums.sputnikx.xyz/api/openapi.json)
- [Agent Discovery](https://siltums.sputnikx.xyz/.well-known/agent-card.json)
- [LLM Documentation](https://siltums.sputnikx.xyz/llms.txt)
- [SputnikX](https://sputnikx.xyz)

## License

MIT
