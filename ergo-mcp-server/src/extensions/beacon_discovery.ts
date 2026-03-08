/**
 * Beacon Agent Discovery Extension (A2A)
 *
 * Optional extension for discovering agents via the Beacon protocol.
 * Not loaded by default — must be explicitly enabled.
 *
 * Credits: @Scottcjn (PR #1)
 *
 * Usage: Import and register with the MCP server to enable
 * discover_beacon_agents and beacon_relay_info tools.
 */

import axios from 'axios';

const DEFAULT_BEACON_URL = 'https://rustchain.org/beacon';

function getBeaconUrl(): string {
    return process.env.BEACON_ATLAS_URL || DEFAULT_BEACON_URL;
}

export const beaconTools = [
    {
        name: "discover_beacon_agents",
        description: "Find agents by capability or provider via the Beacon A2A protocol.",
        inputSchema: {
            type: "object",
            properties: {
                capability: {
                    type: "string",
                    description: "Filter agents by capability (e.g., 'ergo', 'defi', 'nft')."
                },
                provider: {
                    type: "string",
                    description: "Filter agents by provider name."
                }
            }
        }
    },
    {
        name: "beacon_relay_info",
        description: "Get Beacon relay network statistics.",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    }
];

export async function discoverBeaconAgents(args: { capability?: string; provider?: string }) {
    const beaconUrl = getBeaconUrl();
    try {
        const params: Record<string, string> = {};
        if (args.capability) params.capability = args.capability;
        if (args.provider) params.provider = args.provider;

        const response = await axios.get(`${beaconUrl}/relay/agents`, {
            params,
            timeout: 10000
        });
        return response.data;
    } catch (error: any) {
        return {
            status: "error",
            message: `Failed to query Beacon relay: ${error.message}`,
            hint: `Ensure BEACON_ATLAS_URL is set (current: ${beaconUrl})`
        };
    }
}

export async function getBeaconRelayInfo() {
    const beaconUrl = getBeaconUrl();
    try {
        const response = await axios.get(`${beaconUrl}/relay/stats`, { timeout: 10000 });
        return response.data;
    } catch (error: any) {
        return {
            status: "error",
            message: `Failed to query Beacon relay: ${error.message}`,
            hint: `Ensure BEACON_ATLAS_URL is set (current: ${beaconUrl})`
        };
    }
}
