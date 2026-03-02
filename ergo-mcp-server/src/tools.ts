import axios from 'axios';

const MAINNET_EXPLORER_API = 'https://api.ergoplatform.com/api/v1';
const TESTNET_EXPLORER_API = 'https://api-testnet.ergoplatform.com/api/v1';

/**
 * Returns the Explorer API base URL for the specified network.
 * Defaults to mainnet if not specified.
 */
function getExplorerApi(network?: string): string {
    return network === 'testnet' ? TESTNET_EXPLORER_API : MAINNET_EXPLORER_API;
}

export async function getAddressBalance(address: string, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/addresses/${address}/balance/total`);
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch balance for address ${address}: ${error.message}`);
    }
}

export async function getTransactionDetails(txId: string, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/transactions/${txId}`);
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch transaction ${txId}: ${error.message}`);
    }
}

export async function getBlockHeader(identifier: string, network?: string) {
    const api = getExplorerApi(network);
    try {
        const isHash = /^[0-9a-fA-F]{64}$/.test(identifier);

        if (isHash) {
            const response = await axios.get(`${api}/blocks/${identifier}`);
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
            const response = await axios.get(`${api}/blocks?minHeight=${height}&maxHeight=${height}`);
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

export async function searchTokens(query: string, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/tokens/search?query=${query}`);
        return { items: response.data.items || [] };
    } catch (error: any) {
        throw new Error(`Failed to search tokens: ${error.message}`);
    }
}

/**
 * Get unspent boxes for an address.
 * Useful for building transactions or checking UTXO state.
 */
export async function getBoxesByAddress(address: string, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/boxes/byAddress/${address}`);
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch boxes for address ${address}: ${error.message}`);
    }
}

/**
 * Get boxes containing a specific token ID.
 * Useful for finding oracle boxes, NFTs, or pool state boxes on-chain.
 */
export async function getBoxesByTokenId(tokenId: string, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/boxes/byTokenId/${tokenId}`);
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch boxes for token ${tokenId}: ${error.message}`);
    }
}

export async function getErgoPrice() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ergo&vs_currencies=usd,eur');
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch Ergo price: ${error.message}`);
    }
}
