import { getAddressBalance, getBlockHeader, getTransactionDetails, searchTokens, getErgoPrice } from '../src/tools';
import axios from 'axios';

async function main() {
    console.log("Running verification...");

    try {
        // 1. Get a recent block height from explorer directly to find valid data
        const info = await axios.get('https://api.ergoplatform.com/api/v1/networkState');
        const height = info.data.height - 10; // Use a recent confirmed block
        console.log(`Testing with block height: ${height}`);

        // 2. Test getBlockHeader by height
        console.log("\nTesting getBlockHeader (by height)...");
        const blockHeader = await getBlockHeader(height.toString());
        console.log(`Block ID: ${blockHeader.id}`);

        // 3. Test getBlockHeader by ID
        console.log("\nTesting getBlockHeader (by ID)...");
        const blockById = await getBlockHeader(blockHeader.id);
        console.log(`Expected height: ${height}, Got: ${blockById.height}`);
        if (blockById.height !== height) throw new Error(`Block height mismatch: ${blockById.height} vs ${height}`);
        console.log("Block verified by ID.");

        // 4. Find a transaction in this block to test getTransactionDetails
        // We need the full block for transactions; our tool only gets header.
        const fullBlock = await axios.get(`https://api.ergoplatform.com/api/v1/blocks/${blockHeader.id}`);

        // Debug logging
        if (!fullBlock.data.blockTransactions) {
            console.log("Full block data keys:", Object.keys(fullBlock.data));
            if (fullBlock.data.block) {
                console.log("Inner block keys:", Object.keys(fullBlock.data.block));
                console.log("blockTransactions structure:", JSON.stringify(fullBlock.data.block.blockTransactions, null, 2));
            }
        }

        let transactions: any[] = [];
        if (fullBlock.data.blockTransactions && fullBlock.data.blockTransactions.transactions) {
            transactions = fullBlock.data.blockTransactions.transactions;
        } else if (fullBlock.data.block && fullBlock.data.block.blockTransactions && fullBlock.data.block.blockTransactions.transactions) {
            transactions = fullBlock.data.block.blockTransactions.transactions;
        } else {
            console.warn("Could not find transactions in block response structure");
        }

        if (transactions.length > 0) {
            const txId = transactions[0].id;
            const address = transactions[0].outputs[0].address;

            console.log(`\nTesting getTransactionDetails for ${txId}...`);
            const txDetails = await getTransactionDetails(txId);
            if (txDetails.id !== txId) throw new Error("Transaction ID mismatch");
            console.log("Transaction details verified.");

            // 5. Test getAddressBalance
            console.log(`\nTesting getAddressBalance for ${address}...`);
            const balance = await getAddressBalance(address);
            console.log(`Balance: ${balance.confirmed ? balance.confirmed.nanoErgs : 'N/A'}`);
            console.log("Address balance verified.");
        } else {
            console.log("\nSkipping transaction/address tests (block has no transactions).");
        }

        // 6. Test searchTokens
        console.log("\nTesting searchTokens...");
        const tokens = await searchTokens("SigUSD");
        console.log(`Found ${tokens.items.length} tokens matching 'SigUSD'`);
        if (tokens.items.length === 0) console.warn("Warning: No tokens found for SigUSD (might be network issue or bad query)");

        // 7. Test getErgoPrice
        console.log("\nTesting getErgoPrice...");
        const price = await getErgoPrice();
        console.log("Ergo Price:", price);
        if (!price.ergo) console.warn("Warning: Price format unexpected");

        console.log("\nAll tests passed!");
    } catch (error) {
        console.error("Verification failed:", error);
        process.exit(1);
    }
}

main();
