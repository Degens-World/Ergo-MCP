import axios from 'axios';

const MAINNET_API = 'https://api.ergoplatform.com/api/v1';
const TESTNET_API = 'https://api-testnet.ergoplatform.com/api/v1';

function getExplorerApi(network?: string): string {
    return network === 'testnet' ? TESTNET_API : MAINNET_API;
}

export async function getAddressBalance(address: string, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/addresses/${encodeURIComponent(address)}/balance/total`);
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch balance for address ${address}: ${error.message}`);
    }
}

export async function getTransactionDetails(txId: string, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/transactions/${encodeURIComponent(txId)}`);
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
            const response = await axios.get(`${api}/blocks/${encodeURIComponent(identifier)}`);
            if (!response.data.block || !response.data.block.header) {
                if (response.data.header) return response.data.header;
                throw new Error("Invalid block structure received from Explorer");
            }
            return response.data.block.header;
        } else {
            const height = parseInt(identifier);
            if (isNaN(height) || height < 0) {
                throw new Error("Invalid block identifier. Must be a hash or a non-negative height number.");
            }
            const response = await axios.get(`${api}/blocks`, {
                params: { minHeight: height, maxHeight: height }
            });
            if (response.data.items && response.data.items.length > 0) {
                const block = response.data.items.find((b: any) => b.height === height);
                if (block) return block;
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
        const response = await axios.get(`${api}/tokens/search`, {
            params: { query }
        });
        return { items: response.data.items || [] };
    } catch (error: any) {
        throw new Error(`Failed to search tokens: ${error.message}`);
    }
}

export async function getErgoPrice() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: { ids: 'ergo', vs_currencies: 'usd,eur' }
        });
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch Ergo price: ${error.message}`);
    }
}

// --- New explorer tools (credits: @Scottcjn PR#1, @a-shannon PR#2) ---

export async function getAddressTransactions(address: string, offset: number = 0, limit: number = 20, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/addresses/${encodeURIComponent(address)}/transactions`, {
            params: { offset, limit }
        });
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch transactions for address ${address}: ${error.message}`);
    }
}

export async function getBoxesByAddress(address: string, offset: number = 0, limit: number = 20, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/boxes/unspent/byAddress/${encodeURIComponent(address)}`, {
            params: { offset, limit }
        });
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch boxes for address ${address}: ${error.message}`);
    }
}

export async function getBoxesByTokenId(tokenId: string, offset: number = 0, limit: number = 20, network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/boxes/unspent/byTokenId/${encodeURIComponent(tokenId)}`, {
            params: { offset, limit }
        });
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch boxes for token ${tokenId}: ${error.message}`);
    }
}

export async function getNetworkState(network?: string) {
    const api = getExplorerApi(network);
    try {
        const response = await axios.get(`${api}/info`);
        return response.data;
    } catch (error: any) {
        throw new Error(`Failed to fetch network state: ${error.message}`);
    }
}
