# Extensions

Optional add-on modules that are **not loaded by default**. Each extension can be imported and wired into the MCP server independently.

## Beacon Agent Discovery (`beacon_discovery.ts`)

Integrates with the [Beacon A2A protocol](https://rustchain.org/beacon) for agent-to-agent discovery across platforms.

**Tools provided:**
- `discover_beacon_agents` — Find agents by capability or provider
- `beacon_relay_info` — Relay network statistics

**Environment variable:**
- `BEACON_ATLAS_URL` — Override the default relay endpoint (default: `https://rustchain.org/beacon`)

**To enable**, import the extension in your server setup and register its tools and handlers.

Credits: @Scottcjn
