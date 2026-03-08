import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import * as crypto from 'crypto';

// Runtime validation schema
const DeployNodeArgs = z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$|^latest$/, "Version must be semver (e.g. '5.0.16') or 'latest'"),
    api_key_password: z.string().min(8, "API key password must be at least 8 characters"),
    network: z.enum(['mainnet', 'testnet']).default('mainnet'),
    directory: z.string()
        .regex(/^[a-zA-Z0-9_\-]+$/, "Directory name must be alphanumeric (hyphens and underscores allowed, no path separators)")
        .default('ergo_node'),
    memory_allocation_gb: z.number().int().min(1).max(64).default(4)
});

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

const ALLOWED_DOWNLOAD_HOSTS = ['github.com', 'objects.githubusercontent.com'];

function validateDownloadUrl(url: string): void {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            throw new Error('Download URL must use HTTPS');
        }
        if (!ALLOWED_DOWNLOAD_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host))) {
            throw new Error(`Download URL host not allowed: ${parsed.hostname}`);
        }
    } catch (e: any) {
        if (e.message.startsWith('Download URL')) throw e;
        throw new Error(`Invalid download URL: ${url}`);
    }
}

export async function deployErgoNode(args: any) {
    // Validate all inputs at runtime
    const { version, api_key_password, network, directory, memory_allocation_gb } = DeployNodeArgs.parse(args);

    const isTestnet = network === 'testnet';

    try {
        // 1. Directory Creation (safe — directory is validated to be a simple name)
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
            const release = await axios.get(`https://api.github.com/repos/ergoplatform/ergo/releases/tags/v${encodeURIComponent(version)}`);
            const asset = release.data.assets.find((a: any) => a.name.endsWith('.jar'));
            if (!asset) throw new Error(`Could not find JAR in release v${version}`);
            downloadUrl = asset.browser_download_url;
            fileName = asset.name;
        }

        validateDownloadUrl(downloadUrl);

        if (!fileName) fileName = `ergo-${version}.jar`;

        const jarPath = path.join(nodeDir, fileName);
        if (!fs.existsSync(jarPath)) {
            console.error(`Downloading ${fileName}...`);
            const writer = fs.createWriteStream(jarPath);
            const response = await axios({
                url: downloadUrl,
                method: 'GET',
                responseType: 'stream',
                maxRedirects: 5
            });
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(null));
                writer.on('error', reject);
            });
        }

        // 3. Configuration File Generation
        const apiKeyHash = crypto.createHash('sha256').update(api_key_password).digest('hex');
        const apiPort = isTestnet ? 9052 : 9053;
        const p2pPort = isTestnet ? 9022 : 9030;

        let configContent = `
ergo {
  node {
    mining = false
  }${isTestnet ? `
  directory = ".ergo-testnet"` : ''}
}
scorex {
  restApi {
    apiKeyHash = "${apiKeyHash}"
    bindAddress = "0.0.0.0:${apiPort}"
  }
  network {
    bindAddress = "0.0.0.0:${p2pPort}"${isTestnet ? `
    magicBytes = [2, 3, 2, 3]
    knownPeers = [
      "213.239.193.208:9023",
      "176.9.15.237:9021",
      "128.253.41.110:9020"
    ]` : ''}
    upnpEnabled = false
  }
}
        `;
        const configPath = path.join(nodeDir, 'ergo.conf');
        fs.writeFileSync(configPath, configContent.trim());

        // 4. Node Execution
        const memoryFlag = `-Xmx${memory_allocation_gb}G`;
        const networkFlag = isTestnet ? '--testnet' : '--mainnet';

        console.error(`Starting Ergo Node in ${nodeDir}...`);

        const childArgs = [memoryFlag, '-jar', fileName, networkFlag, '-c', 'ergo.conf'];

        const child = spawn('java', childArgs, {
            cwd: nodeDir,
            detached: true,
            stdio: 'ignore'
        });

        child.unref();

        return {
            status: "success",
            message: `Ergo node launched successfully on ${network}.`,
            pid: child.pid,
            web_panel_url: `http://127.0.0.1:${apiPort}/panel`,
            api_url: `http://127.0.0.1:${apiPort}`
        };

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return { status: "error", message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` };
        }
        return { status: "error", message: `Failed to deploy Ergo node: ${error.message}` };
    }
}
