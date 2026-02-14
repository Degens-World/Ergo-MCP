import axios from 'axios';

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

export async function getAddressBalance(address: string) {
    try {
        const response = await axios.get(`${EXPLORER_API}/addresses/${address}/balance/total`);
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch balance for address ${address}: ${error.message}`);
    }
}

export async function getTransactionDetails(txId: string) {
    try {
        const response = await axios.get(`${EXPLORER_API}/transactions/${txId}`);
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch transaction ${txId}: ${error.message}`);
    }
}

export async function getBlockHeader(identifier: string) {
    try {
        const isHash = /^[0-9a-fA-F]{64}$/.test(identifier);

        if (isHash) {
            const response = await axios.get(`${EXPLORER_API}/blocks/${identifier}`);
            if (!response.data.block || !response.data.block.header) {
                // Fallback if structure is different
                if (response.data.header) return response.data.header;
                throw new Error("Invalid block structure received from Explorer");
            }
            return response.data.block.header;
        } else {
            // Search by height
            const height = parseInt(identifier);
            if (isNaN(height)) {
                throw new Error("Invalid block identifier. Must be a hash or a height number.");
            }
            const response = await axios.get(`${EXPLORER_API}/blocks?minHeight=${height}&maxHeight=${height}`);
            if (response.data.items && response.data.items.length > 0) {
                const block = response.data.items.find((b: any) => b.height === height);
                if (block) {
                    return block;
                }
            }
            throw new Error(`Block not found at height ${identifier}`);
        }
    } catch (error: any) {
        throw new Error(`Failed to fetch block ${identifier}: ${error.message}`);
    }
}

export async function searchTokens(query: string) {
    try {
        const response = await axios.get(`${EXPLORER_API}/tokens/search?query=${query}`);
        return { items: response.data.items || [] };
    } catch (error: any) {
        throw new Error(`Failed to search tokens: ${error.message}`);
    }
}

export async function getErgoPrice() {
    try {
        // Using a public oracle address or CoinGecko/Spectrum API?
        // Let's use Spectrum Finance API for real-time price or CoinGecko.
        // Or simpler: just use a known oracle box if possible, but that's complex to parse.
        // Let's use a reliable simple API. Coingecko is good but might have rate limits.
        // Let's try to find an oracle box on Explorer using a known Oracle Pool address?
        // ERG/USD Oracle Pool Address: 4MN4G8c8M... (simplified)
        // A safer bet for an MCP tool is a public price API.
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ergo&vs_currencies=usd,eur');
        return response.data;
    } catch (error: any) {
        // Fallback or error
        throw new Error(`Failed to fetch Ergo price: ${error.message}`);
    }
}
