import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getAddressBalance, getBlockHeader, getTransactionDetails, searchTokens, getErgoPrice, getBoxesByAddress, getBoxesByTokenId } from "./tools.js";
import { SkillRegistry } from "./skill_registry.js";
import * as path from 'path';

// Initializing Registry
// Connects to the public Ergo-Skills repository via GitHub API.
const REPO_URL = process.env.GITHUB_REPO_URL || "https://github.com/Degens-World/Ergo-Skills";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Optional, boosts rate limits
const registry = new SkillRegistry(REPO_URL, GITHUB_TOKEN);

// Optional network parameter for all tools (shared definition)
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_address_balance",
                description: "Get the confirmed balance and tokens for an Ergo address.",
                inputSchema: {
                    type: "object",
                    properties: {
                        address: {
                            type: "string",
                            description: "The Ergo address to check balance for (e.g., 9...).",
                        },
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
                        txId: {
                            type: "string",
                            description: "The transaction ID (64 hex characters).",
                        },
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
                        identifier: {
                            type: "string",
                            description: "The block ID (hash) or block height (integer).",
                        },
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
                        query: {
                            type: "string",
                            description: "The token name or ticker to search for (e.g., 'SigUSD').",
                        },
                        network: networkProperty,
                    },
                    required: ["query"],
                },
            },
            {
                name: "get_boxes_by_address",
                description: "Get unspent boxes (UTXOs) for an Ergo address. Useful for building transactions or checking on-chain state.",
                inputSchema: {
                    type: "object",
                    properties: {
                        address: {
                            type: "string",
                            description: "The Ergo address to fetch boxes for.",
                        },
                        network: networkProperty,
                    },
                    required: ["address"],
                },
            },
            {
                name: "get_boxes_by_token_id",
                description: "Get boxes containing a specific token ID. Useful for finding oracle boxes, NFTs, or pool state boxes on-chain.",
                inputSchema: {
                    type: "object",
                    properties: {
                        tokenId: {
                            type: "string",
                            description: "The token ID (64 hex characters).",
                        },
                        network: networkProperty,
                    },
                    required: ["tokenId"],
                },
            },
            {
                name: "get_ergo_price",
                description: "Get current Ergo price in USD/EUR via CoinGecko.",
                inputSchema: { type: "object", properties: {}, required: [] }
            },
            ...registry.getTools()
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;

        if (!args) {
            throw new Error("No arguments provided");
        }

        switch (name) {
            case "get_address_balance": {
                const parsed = z.object({ address: z.string(), network: z.string().optional() }).parse(args);
                const result = await getAddressBalance(parsed.address, parsed.network);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "get_transaction_details": {
                const parsed = z.object({ txId: z.string(), network: z.string().optional() }).parse(args);
                const result = await getTransactionDetails(parsed.txId, parsed.network);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "get_block_header": {
                const parsed = z.object({ identifier: z.string(), network: z.string().optional() }).parse(args);
                const result = await getBlockHeader(parsed.identifier, parsed.network);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "search_tokens": {
                const parsed = z.object({ query: z.string(), network: z.string().optional() }).parse(args);
                const result = await searchTokens(parsed.query, parsed.network);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "get_boxes_by_address": {
                const parsed = z.object({ address: z.string(), network: z.string().optional() }).parse(args);
                const result = await getBoxesByAddress(parsed.address, parsed.network);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "get_boxes_by_token_id": {
                const parsed = z.object({ tokenId: z.string(), network: z.string().optional() }).parse(args);
                const result = await getBoxesByTokenId(parsed.tokenId, parsed.network);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            case "get_ergo_price": {
                const result = await getErgoPrice();
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }

            default: {
                // Check if it's a dynamic skill
                try {
                    const result = await registry.executeSkill(name, args);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
        return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
        };
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
