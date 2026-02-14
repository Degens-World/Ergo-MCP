import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import * as crypto from 'crypto';

export const DeployNodeSchema = {
    type: "object",
    properties: {
        version: {
            type: "string",
            description: "The version of the Ergo node to download (e.g., '5.0.16' or 'latest')."
        },
        api_key_password: {
            type: "string",
            description: "A plaintext password for securing the node's REST API."
        },
        network: {
            type: "string",
            description: "The network to connect to ('mainnet' or 'testnet').",
            default: "mainnet"
        },
        directory: {
            type: "string",
            description: "The name of the folder to create for the Ergo node files.",
            default: "ergo_node"
        },
        memory_allocation_gb: {
            type: "integer",
            description: "The amount of RAM (in GB) to allocate to the JVM.",
            default: 4
        }
    },
    required: ["version", "api_key_password"]
};

export async function deployErgoNode(args: any) {
    const { version, api_key_password, network = 'mainnet', directory = 'ergo_node', memory_allocation_gb = 4 } = args;

    try {
        // 1. Directory Creation
        const nodeDir = path.resolve(process.cwd(), directory);
        if (!fs.existsSync(nodeDir)) {
            fs.mkdirSync(nodeDir, { recursive: true });
        }

        // 2. Software Download
        let downloadUrl = '';
        let fileName = '';

        if (version === 'latest') {
            const release = await axios.get('https://api.github.com/repos/ergoplatform/ergo/releases/latest');
            const asset = release.data.assets.find((a: any) => a.name.endsWith('.jar'));
            if (!asset) throw new Error("Could not find JAR in latest release");
            downloadUrl = asset.browser_download_url;
            fileName = asset.name;
        } else {
            // Find specific version logic 
            // Simplified: direct download URL construction or tag search
            // Let's assume the user provides a valid version like '5.0.16'
            try {
                const release = await axios.get(`https://api.github.com/repos/ergoplatform/ergo/releases/tags/v${version}`);
                const asset = release.data.assets.find((a: any) => a.name.endsWith('.jar'));
                if (!asset) throw new Error(`Could not find JAR in release v${version}`);
                downloadUrl = asset.browser_download_url;
                fileName = asset.name;
            } catch (e) {
                // Fallback for different tag naming conventions if needed, or rethrow
                throw new Error(`Failed to find release v${version}: ${e}`);
            }
        }

        // Ensure we have a filename
        if (!fileName) fileName = `ergo-${version}.jar`;

        const jarPath = path.join(nodeDir, fileName);
        if (!fs.existsSync(jarPath)) {
            console.error(`Downloading ${fileName} from ${downloadUrl}...`);
            const writer = fs.createWriteStream(jarPath);
            const response = await axios({
                url: downloadUrl,
                method: 'GET',
                responseType: 'stream'
            });
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(null));
                writer.on('error', reject);
            });
        }

        // 3. Configuration File Generation
        const apiKeyHash = crypto.createHash('sha256').update(api_key_password).digest('hex');
        const configContent = `
ergo {
  node {
    mining = false
  }
}
scorex {
  restApi {
    apiKeyHash = "${apiKeyHash}"
  }
}
        `;
        const configPath = path.join(nodeDir, 'ergo.conf');
        fs.writeFileSync(configPath, configContent.trim());

        // 4. Node Execution
        const memoryFlag = `-Xmx${memory_allocation_gb}G`;
        const networkFlag = network === 'testnet' ? '--testnet' : '--mainnet';

        console.error(`Starting Ergo Node in ${nodeDir}...`);

        // Prepare arguments
        const childArgs = [memoryFlag, '-jar', fileName, networkFlag, '-c', 'ergo.conf'];

        const child = spawn('java', childArgs, {
            cwd: nodeDir,
            detached: true,
            stdio: 'ignore'
        });

        child.unref();

        const port = network === 'testnet' ? 9052 : 9053;

        return {
            status: "success",
            message: `Ergo node launched successfully on ${network}.`,
            node_directory: nodeDir,
            pid: child.pid,
            web_panel_url: `http://127.0.0.1:${port}/panel`,
            api_url: `http://127.0.0.1:${port}`,
            command_executed: `java ${childArgs.join(' ')}`
        };

    } catch (error: any) {
        return {
            status: "error",
            message: `Failed to deploy Ergo node: ${error.message}`
        };
    }
}
