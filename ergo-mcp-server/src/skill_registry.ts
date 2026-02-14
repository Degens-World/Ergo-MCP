
import axios from 'axios';
import * as yaml from 'js-yaml';
import { DeployNodeSchema, deployErgoNode } from './skills/node_deployment.js';

interface SkillMetadata {
    name: string;
    description: string;
}

interface Skill {
    name: string;
    description: string;
    content: string;
    path: string;
    metadata: SkillMetadata;
}

export class SkillRegistry {
    private skills: Map<string, Skill> = new Map();
    private repoOwner: string;
    private repoName: string;
    private startPath: string;
    private githubToken?: string;

    constructor(repoUrl: string = "https://github.com/Degens-World/Ergo-Skills", githubToken?: string) {
        // Parse owner/repo from URL
        // Expected format: https://github.com/OWNER/REPO
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
            this.repoOwner = match[1];
            this.repoName = match[2].replace('.git', '');
        } else {
            // Fallback default
            this.repoOwner = "Degens-World";
            this.repoName = "Ergo-Skills";
        }
        this.startPath = "skills";
        this.githubToken = githubToken;
    }

    public async loadSkills() {
        console.log(`Loading skills from GitHub: ${this.repoOwner}/${this.repoName}/${this.startPath}`);
        try {
            await this.scanDirectory(this.startPath);
            console.log(`Loaded ${this.skills.size} skills from GitHub registry.`);
        } catch (error: any) {
            console.error(`Failed to load skills from GitHub: ${error.message}`);
        }
    }

    private async scanDirectory(path: string) {
        // Construct GitHub API URL for contents
        const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${path}`;
        const headers: any = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Ergo-MCP-Server'
        };
        if (this.githubToken) {
            headers['Authorization'] = `token ${this.githubToken}`;
        }

        try {
            const response = await axios.get(url, { headers });
            const items = response.data;

            if (!Array.isArray(items)) return;

            for (const item of items) {
                if (item.type === 'dir') {
                    // Recurse into subdirectories
                    await this.scanDirectory(item.path);
                } else if (item.type === 'file' && item.name === 'SKILL.md') {
                    // Start fetching the skill content if found
                    await this.fetchAndParseSkill(item.download_url, item.path);
                }
            }
        } catch (error: any) {
            console.error(`Error scanning ${path}: ${error.message}`);
        }
    }

    private async fetchAndParseSkill(downloadUrl: string, filePath: string) {
        try {
            const response = await axios.get(downloadUrl);
            let content = '';

            if (typeof response.data === 'string') {
                content = response.data;
            } else {
                // Should be raw text usually
                content = JSON.stringify(response.data);
            }

            // Extract frontmatter
            // Using regex that handles both CRLF and LF
            const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
            if (match) {
                const frontmatter = match[1];
                const meta = yaml.load(frontmatter) as SkillMetadata;
                if (meta && meta.name) {
                    this.skills.set(meta.name, {
                        name: meta.name,
                        description: meta.description || "No description provided",
                        content: content,
                        path: filePath,
                        metadata: meta
                    });
                }
            }
        } catch (error) {
            console.error(`Error fetching/parsing skill at ${filePath}:`, error);
        }
    }

    public getTools() {
        const tools: any[] = [];

        for (const [key, skill] of this.skills.entries()) {
            const toolName = skill.name.replace(/-/g, '_').toLowerCase();

            // Native Implementation Check
            let inputSchema;
            if (key === 'local-ergo-node-deployment' || toolName === 'deploy_ergo_node') {
                inputSchema = DeployNodeSchema;
            } else {
                inputSchema = {
                    type: "object",
                    properties: {
                        context: {
                            type: "string",
                            description: "Context or arguments for the skill execution."
                        }
                    }
                };
            }

            tools.push({
                name: toolName,
                description: skill.description,
                inputSchema: inputSchema
            });
        }
        return tools;
    }

    public async executeSkill(name: string, args: any): Promise<any> {
        const skillKey = Array.from(this.skills.keys()).find(k => k.replace(/-/g, '_').toLowerCase() === name);

        if (!skillKey) {
            throw new Error(`Skill not found: ${name}`);
        }

        const skill = this.skills.get(skillKey)!;

        // Native Execution
        if (skillKey === 'local-ergo-node-deployment' || name === 'deploy_ergo_node') {
            return await deployErgoNode(args);
        }

        // Return Instructions
        return {
            status: "manual_instructions",
            description: `No automated implementation for ${skill.name} yet.`,
            instructions: skill.content
        };
    }
}
