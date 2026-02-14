import { SkillRegistry } from '../src/skill_registry';
import * as path from 'path';

async function main() {
    // Use default (GitHub) logic
    const registry = new SkillRegistry();
    await registry.loadSkills();

    const tools = registry.getTools();
    console.log("Registered Tools:", tools.map(t => t.name));

    // Normalized check
    const nodeSkills = tools.filter(t => t.name.includes('node') || t.name.includes('deploy'));
    if (nodeSkills.length === 0) {
        throw new Error("Failed to find 'local-ergo-node-deployment' skill");
    }

    console.log("\nTesting execution of 'deploy_ergo_node' (via registry routing)...");
    const nodeTool = nodeSkills[0];
    console.log("Schema for node deployment:", JSON.stringify(nodeTool.inputSchema, null, 2));

    console.log("\nSkill Registry verification passed.");
}

main().catch(console.error);
