import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
    getAddressBalance,
    getBlockHeader,
    getTransactionDetails,
    searchTokens,
    getErgoPrice,
    getAddressTransactions,
    getBoxesByAddress,
    getBoxesByTokenId,
    getNetworkState
} from "./tools.js";
import { SkillRegistry } from "./skill_registry.js";

// Initializing Registry
// Connects to the public Ergo-Skills repository via GitHub API.
const REPO_URL = process.env.GITHUB_REPO_URL || "https://github.com/Degens-World/Ergo-Skills";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Optional, boosts rate limits
const registry = new SkillRegistry(REPO_URL, GITHUB_TOKEN);

// Shared network property for all explorer tools
const networkProperty = {
    type: "string",
    description: "The network to query ('mainnet' or 'testnet'). Defaults to 'mainnet'.",
    default: "mainnet"
};

const server = new Server(
    {
        name: "ergo-mcp-server",
        version: "0.2.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Helper to wrap results consistently
function toolResult(data: any) {
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_address_balance",
                description: "Get the confirmed balance and tokens for an Ergo address.",
                inputSchema: {
                    type: "object",
                    properties: {
                        address: { type: "string", description: "The Ergo address to check balance for (e.g., 9...)." },
                        network: networkProperty,
                    },
                    required: ["address"],
                },
            },
            {
                name: "get_transaction_details",
                description: "Get details of an Ergo transaction by its ID.",
                inputSchema: {
                    type: "object",
                    properties: {
                        txId: { type: "string", description: "The transaction ID (64 hex characters)." },
                        network: networkProperty,
                    },
                    required: ["txId"],
                },
            },
            {
                name: "get_block_header",
                description: "Get the header details of an Ergo block by ID or Height.",
                inputSchema: {
                    type: "object",
                    properties: {
                        identifier: { type: "string", description: "The block ID (hash) or block height (integer)." },
                        network: networkProperty,
                    },
                    required: ["identifier"],
                },
            },
            {
                name: "search_tokens",
                description: "Search for tokens by name or ticker on the Ergo blockchain.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "The token name or ticker to search for." },
                        network: networkProperty,
                    },
                    required: ["query"],
                },
            },
            {
                name: "get_ergo_price",
                description: "Get current Ergo price in USD/EUR.",
                inputSchema: { type: "object", properties: {}, required: [] }
            },
            {
                name: "get_address_transactions",
                description: "Get transaction history for an Ergo address with pagination.",
                inputSchema: {
                    type: "object",
                    properties: {
                        address: { type: "string", description: "The Ergo address." },
                        offset: { type: "integer", description: "Pagination offset (default: 0).", default: 0 },
                        limit: { type: "integer", description: "Number of results (default: 20, max: 100).", default: 20 },
                        network: networkProperty,
                    },
                    required: ["address"],
                },
            },
            {
                name: "get_boxes_by_address",
                description: "Get unspent boxes (UTXOs) for an Ergo address.",
                inputSchema: {
                    type: "object",
                    properties: {
                        address: { type: "string", description: "The Ergo address." },
                        offset: { type: "integer", description: "Pagination offset (default: 0).", default: 0 },
                        limit: { type: "integer", description: "Number of results (default: 20, max: 100).", default: 20 },
                        network: networkProperty,
                    },
                    required: ["address"],
                },
            },
            {
                name: "get_boxes_by_token_id",
                description: "Get boxes containing a specific token ID.",
                inputSchema: {
                    type: "object",
                    properties: {
                        tokenId: { type: "string", description: "The token ID (64 hex characters)." },
                        offset: { type: "integer", description: "Pagination offset (default: 0).", default: 0 },
                        limit: { type: "integer", description: "Number of results (default: 20, max: 100).", default: 20 },
                        network: networkProperty,
                    },
                    required: ["tokenId"],
                },
            },
            {
                name: "get_network_state",
                description: "Get current network state: chain height, difficulty, and latest block info.",
                inputSchema: {
                    type: "object",
                    properties: {
                        network: networkProperty,
                    },
                    required: [],
                },
            },
            ...registry.getTools()
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;

        if (!args && name !== "get_ergo_price" && name !== "get_network_state") {
            throw new Error("No arguments provided");
        }

        const safeArgs = args || {};

        switch (name) {
            case "get_address_balance": {
                const { address, network } = z.object({
                    address: z.string().min(1),
                    network: z.enum(['mainnet', 'testnet']).optional(),
                }).parse(safeArgs);
                return toolResult(await getAddressBalance(address, network));
            }

            case "get_transaction_details": {
                const { txId, network } = z.object({
                    txId: z.string().regex(/^[0-9a-fA-F]{64}$/, "Transaction ID must be 64 hex characters"),
                    network: z.enum(['mainnet', 'testnet']).optional(),
                }).parse(safeArgs);
                return toolResult(await getTransactionDetails(txId, network));
            }

            case "get_block_header": {
                const { identifier, network } = z.object({
                    identifier: z.string().min(1),
                    network: z.enum(['mainnet', 'testnet']).optional(),
                }).parse(safeArgs);
                return toolResult(await getBlockHeader(identifier, network));
            }

            case "search_tokens": {
                const { query, network } = z.object({
                    query: z.string().min(1),
                    network: z.enum(['mainnet', 'testnet']).optional(),
                }).parse(safeArgs);
                return toolResult(await searchTokens(query, network));
            }

            case "get_ergo_price": {
                return toolResult(await getErgoPrice());
            }

            case "get_address_transactions": {
                const { address, offset, limit, network } = z.object({
                    address: z.string().min(1),
                    offset: z.number().int().min(0).default(0),
                    limit: z.number().int().min(1).max(100).default(20),
                    network: z.enum(['mainnet', 'testnet']).optional(),
                }).parse(safeArgs);
                return toolResult(await getAddressTransactions(address, offset, limit, network));
            }

            case "get_boxes_by_address": {
                const { address, offset, limit, network } = z.object({
                    address: z.string().min(1),
                    offset: z.number().int().min(0).default(0),
                    limit: z.number().int().min(1).max(100).default(20),
                    network: z.enum(['mainnet', 'testnet']).optional(),
                }).parse(safeArgs);
                return toolResult(await getBoxesByAddress(address, offset, limit, network));
            }

            case "get_boxes_by_token_id": {
                const { tokenId, offset, limit, network } = z.object({
                    tokenId: z.string().regex(/^[0-9a-fA-F]{64}$/, "Token ID must be 64 hex characters"),
                    offset: z.number().int().min(0).default(0),
                    limit: z.number().int().min(1).max(100).default(20),
                    network: z.enum(['mainnet', 'testnet']).optional(),
                }).parse(safeArgs);
                return toolResult(await getBoxesByTokenId(tokenId, offset, limit, network));
            }

            case "get_network_state": {
                const { network } = z.object({
                    network: z.enum(['mainnet', 'testnet']).optional(),
                }).parse(safeArgs);
                return toolResult(await getNetworkState(network));
            }

            default: {
                try {
                    const result = await registry.executeSkill(name, safeArgs);
                    return toolResult(result);
                } catch (e: any) {
                    if (e.message && e.message.startsWith("Skill not found")) {
                        throw new Error(`Unknown tool: ${name}`);
                    }
                    throw e;
                }
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return toolError(errorMessage);
    }
});

async function run() {
    await registry.loadSkills();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Ergo MCP Server running on stdio");
}

run().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
