# Ergo MCP Server

A Model Context Protocol (MCP) server for the Ergo Platform. This server provides a suite of tools for exploring the blockchain, querying real-time data, and dynamically loading "skills" (agentic workflows) from the Ergo ecosystem.

## Features

### 1. Blockchain Explorer Tools

All explorer tools support an optional `network` parameter (`"mainnet"` or `"testnet"`).

| Tool | Description |
|------|-------------|
| `get_address_balance` | Check confirmed ERG and token balances for any address |
| `get_transaction_details` | Retrieve detailed information about a transaction |
| `get_block_header` | Fetch block headers by ID or height |
| `search_tokens` | Find tokens by name or ticker |
| `get_ergo_price` | Get real-time ERG price in USD and EUR via CoinGecko |
| `get_address_transactions` | Transaction history with pagination |
| `get_boxes_by_address` | Fetch unspent boxes (UTXOs) for an address |
| `get_boxes_by_token_id` | Get boxes containing a specific token |
| `get_network_state` | Current chain height, difficulty, and latest block info |

### 2. Dynamic Ergo Skills (Agentic Tools)
The server includes a **Dynamic Skill Registry** that scans the `ergo-skills-repo` to automatically load and expose capabilities.

- **`local_ergo_node_deployment`** (Native Support):
    - Automates the deployment of a local Ergo full node.
    - Downloads JAR, configures API security (hashed password), and launches the process.
    - Supports both **mainnet** and **testnet** (with correct magicBytes, peers, and ports).

- **Other Skills** (Text-Based):
    - **`ergo_appkit_code_generator`**
    - **`ergo_wasm_cryptographic_toolkit`**
    - **`nautilus_wallet_dapp_connector`**
    - These tools return their instruction manuals (from `SKILL.md`) when called, allowing an AI agent to follow the guide.

### 3. Extensions (Optional Add-ons)
Located in `src/extensions/`. These are **not loaded by default** and can be enabled independently.

- **Beacon Agent Discovery** (`beacon_discovery.ts`): A2A agent discovery via the Beacon protocol. See [extensions/README.md](src/extensions/README.md) for details.

## Installation

1.  **Clone this repository**:
    ```bash
    git clone https://github.com/Degens-World/Ergo-MCP.git
    cd ergo-mcp-server
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Build the project**:
    ```bash
    npm run build
    ```

## Usage

### Configuration

The server automatically fetches skills from `https://github.com/Degens-World/Ergo-Skills`.

**Optional Environment Variables:**

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token to increase API rate limits |
| `GITHUB_REPO_URL` | Override the target skills repository URL |
| `BEACON_ATLAS_URL` | Beacon relay endpoint (extensions only) |

```bash
# Example with token (Linux/Mac)
export GITHUB_TOKEN=ghp_yourtoken...
node dist/index.js
```

### Running with MCP Inspector
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Running in Production
```bash
node dist/index.js
```

## Development

- **Run in dev mode**:
    ```bash
    npm run dev
    ```
- **Run verification tests**:
    ```bash
    npm test
    ```

## Project Structure

- `src/index.ts`: Main server entry point and tool registration.
- `src/tools.ts`: Implementation of core explorer tools.
- `src/skill_registry.ts`: Logic for dynamically loading skills from the repo.
- `src/skills/`: Native implementations for specific skills (e.g., node deployment).
- `src/extensions/`: Optional add-on modules (not loaded by default).
- `test/`: Verification scripts.

## Security

v0.2.0 includes the following security hardening:
- Input validation with Zod on all tool handlers (format, bounds, enums)
- `encodeURIComponent` on all user-supplied values in API URLs
- Path traversal protection on node deployment directory parameter
- Download URL allowlist for JAR downloads (GitHub domains only)
- Safe YAML schema (`JSON_SCHEMA`) for parsing remote skill frontmatter
- No internal paths or command lines leaked in responses

## Contributors

- **@Scottcjn** — Explorer tools (`get_address_transactions`, `get_network_state`, UTXO retrieval), Beacon agent discovery ([PR #1](https://github.com/Degens-World/Ergo-MCP/pull/1))
- **@a-shannon** — Testnet support (network parameter, magicBytes fix, testnet peers/ports), `get_boxes_by_token_id`, `search_tokens` listing fix ([PR #2](https://github.com/Degens-World/Ergo-MCP/pull/2))
