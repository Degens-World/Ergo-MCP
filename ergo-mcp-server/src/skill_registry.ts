
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

const ALLOWED_SKILL_HOSTS = ['raw.githubusercontent.com', 'github.com'];

export class SkillRegistry {
    private skills: Map<string, Skill> = new Map();
    private repoOwner: string;
    private repoName: string;
    private startPath: string;
    private githubToken?: string;

    constructor(repoUrl: string = "https://github.com/Degens-World/Ergo-Skills", githubToken?: string) {
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
            this.repoOwner = match[1];
            this.repoName = match[2].replace('.git', '');
        } else {
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

    private async scanDirectory(dirPath: string) {
        const url = `https://api.github.com/repos/${encodeURIComponent(this.repoOwner)}/${encodeURIComponent(this.repoName)}/contents/${dirPath}`;
        const headers: Record<string, string> = {
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
                    await this.scanDirectory(item.path);
                } else if (item.type === 'file' && item.name === 'SKILL.md') {
                    if (this.isAllowedUrl(item.download_url)) {
                        await this.fetchAndParseSkill(item.download_url, item.path);
                    } else {
                        console.error(`Skipping skill at ${item.path}: download URL not from allowed host`);
                    }
                }
            }
        } catch (error: any) {
            console.error(`Error scanning ${dirPath}: ${error.message}`);
        }
    }

    private isAllowedUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' && ALLOWED_SKILL_HOSTS.some(
                host => parsed.hostname === host || parsed.hostname.endsWith('.' + host)
            );
        } catch {
            return false;
        }
    }

    private async fetchAndParseSkill(downloadUrl: string, filePath: string) {
        try {
            const response = await axios.get(downloadUrl);
            let content = '';

            if (typeof response.data === 'string') {
                content = response.data;
            } else {
                content = JSON.stringify(response.data);
            }

            // Extract frontmatter using safe YAML schema
            const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
            if (match) {
                const frontmatter = match[1];
                const meta = yaml.load(frontmatter, { schema: yaml.JSON_SCHEMA }) as SkillMetadata;
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

        if (skillKey === 'local-ergo-node-deployment' || name === 'deploy_ergo_node') {
            return await deployErgoNode(args);
        }

        return {
            status: "manual_instructions",
            description: `No automated implementation for ${skill.name} yet.`,
            instructions: skill.content
        };
    }
}
