```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getAddressBalance, getBlockHeader, getTransactionDetails, searchTokens, getErgoPrice } from "./tools.js";
import { SkillRegistry } from "./skill_registry.js";
import * as path from 'path';

// Initializing Registry
// Connects to the public Ergo-Skills repository via GitHub API.
const REPO_URL = process.env.GITHUB_REPO_URL || "https://github.com/Degens-World/Ergo-Skills";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Optional, boosts rate limits
const registry = new SkillRegistry(REPO_URL, GITHUB_TOKEN);

const server = new Server(
    {
        name: "ergo-mcp-server",
        version: "0.1.0",
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
                    },
                    required: ["identifier"],
                },
            },
            {
                name: "get_ergo_price",
                description: "Get current Ergo price in USD/EUR.",
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
                const { address } = z
                    .object({
                        address: z.string(),
                    })
                    .parse(args);
                const result = await getAddressBalance(address);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case "get_transaction_details": {
                const { txId } = z
                    .object({
                        txId: z.string(),
                    })
                    .parse(args);
                const result = await getTransactionDetails(txId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case "get_block_header": {
                const { identifier } = z
                    .object({
                        identifier: z.string(),
                    })
                    .parse(args);
                const result = await getBlockHeader(identifier);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }



            case "search_tokens": {
                const { query } = z.object({ query: z.string() }).parse(args);
                const result = await searchTokens(query);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            case "get_ergo_price": {
                const result = await getErgoPrice();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }

            default: {
                // Check if it's a dynamic skill
                try {
                    const result = await registry.executeSkill(name, args);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                } catch (e: any) {
                    if (e.message && e.message.startsWith("Skill not found")) {
                        throw new Error(`Unknown tool: ${ name } `);
                    }
                    throw e;
                }
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${ errorMessage } `,
                },
            ],
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
