import { createRequire as __createRequire } from "node:module";
import { dirname as __pathDirname } from "node:path";
import { fileURLToPath as __fileURLToPath } from "node:url";
const require = __createRequire(import.meta.url);
var __filename = __fileURLToPath(import.meta.url);
var __dirname = __pathDirname(__filename);

// server.ts
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
var ACP_PLUGIN_ID = "provider-acp";
var PROFILE = {
  id: "auggie",
  providerId: "acp-auggie",
  displayName: "Auggie",
  binary: "auggie",
  args: ["--acp"],
  installHint: "Install Auggie with `npm install -g @augmentcode/auggie`, authenticate it, then run `bb plugin reload auggie`."
};
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function findBinary(existing) {
  if (typeof existing?.command === "string" && existing.command.includes(delimiter) && isExecutable(existing.command)) {
    return existing.command;
  }
  const names = process.platform === "win32" ? [`${PROFILE.binary}.exe`, `${PROFILE.binary}.cmd`, PROFILE.binary] : [PROFILE.binary];
  const directories = [
    ...(process.env.PATH ?? "").split(delimiter),
    join(homedir(), ".local", "bin"),
    join(homedir(), ".npm-global", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin"
  ].filter(Boolean);
  for (const directory of new Set(directories)) {
    for (const name of names) {
      const candidate = join(directory, name);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return null;
}
function readConfig(configPath) {
  if (!existsSync(configPath)) return {};
  const parsed = JSON.parse(readFileSync(configPath, "utf8"));
  if (!isObject(parsed)) {
    throw new Error(`${configPath} must contain a JSON object; refusing to overwrite it`);
  }
  return parsed;
}
function writeAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.auggie.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}
`, { encoding: "utf8", mode: 384 });
    chmodSync(temporary, 384);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
function parseCustomAgents(value) {
  if (value === void 0 || value === null || value === "") return [];
  if (typeof value !== "string") {
    throw new Error(`${ACP_PLUGIN_ID} customAgents must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return [];
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error(`${ACP_PLUGIN_ID} customAgents must be a JSON array; refusing to overwrite it`);
  }
  return parsed;
}
function stringifyCustomAgents(agents) {
  return `${JSON.stringify(agents, null, 2)}
`;
}
function managedAgent(binary, existing) {
  const existingEnv = isObject(existing?.env) ? existing.env : {};
  return {
    id: PROFILE.id,
    displayName: PROFILE.displayName,
    command: binary,
    args: [...PROFILE.args],
    env: existingEnv
  };
}
function upsertAgent(agents, next) {
  const index = agents.findIndex((agent) => agent?.id === PROFILE.id);
  const before = JSON.stringify(index >= 0 ? agents[index] : null);
  const copy = [...agents];
  if (index >= 0) copy[index] = next;
  else copy.push(next);
  return { agents: copy, changed: JSON.stringify(index >= 0 ? copy[index] : copy.at(-1)) !== before };
}
function removeAgent(agents) {
  const next = agents.filter((agent) => agent?.id !== PROFILE.id);
  return { agents: next, changed: next.length !== agents.length };
}
function readLegacyAgents(dataDir) {
  const config = readConfig(join(dataDir, "config.json"));
  return Array.isArray(config.customAcpAgents) ? [...config.customAcpAgents] : [];
}
function writeLegacyAgents(dataDir, agents) {
  const configPath = join(dataDir, "config.json");
  const config = readConfig(configPath);
  const current = Array.isArray(config.customAcpAgents) ? config.customAcpAgents : [];
  if (JSON.stringify(current) === JSON.stringify(agents)) return false;
  if (agents.length === 0) delete config.customAcpAgents;
  else config.customAcpAgents = agents;
  writeAtomic(configPath, config);
  return true;
}
function plugin(bb) {
  async function dataDir() {
    try {
      const config = await bb.sdk.system.config();
      if (config.dataDir.length > 0) return config.dataDir;
    } catch (error) {
      bb.log.warn(`Could not resolve bb data directory through the SDK: ${String(error)}`);
    }
    return process.env.BB_DATA_DIR ?? join(homedir(), ".bb");
  }
  async function readSettingAgents() {
    try {
      const settings = await bb.sdk.plugins.getSettings({ pluginId: ACP_PLUGIN_ID });
      return parseCustomAgents(settings.values.customAgents);
    } catch (error) {
      bb.log.warn(`Could not read ${ACP_PLUGIN_ID} customAgents: ${String(error)}`);
      return null;
    }
  }
  async function writeSettingAgents(agents) {
    const serialized = agents.length === 0 ? "" : stringifyCustomAgents(agents);
    await bb.sdk.plugins.updateSettings({
      pluginId: ACP_PLUGIN_ID,
      values: { customAgents: serialized }
    });
    return true;
  }
  async function provision() {
    const root = await dataDir();
    const settingAgents = await readSettingAgents();
    const legacyAgents = readLegacyAgents(root);
    const existing = settingAgents?.find((agent) => agent?.id === PROFILE.id) ?? legacyAgents.find((agent) => agent?.id === PROFILE.id);
    const binary = findBinary(existing);
    if (binary === null) throw new Error(`${PROFILE.binary} was not found. ${PROFILE.installHint}`);
    const managed = managedAgent(binary, existing);
    let changed = false;
    if (settingAgents !== null) {
      const next = upsertAgent(settingAgents, managed);
      if (next.changed) {
        await writeSettingAgents(next.agents);
        changed = true;
      }
    } else {
      const next = upsertAgent(legacyAgents, managed);
      if (next.changed && writeLegacyAgents(root, next.agents)) {
        await bb.sdk.system.reloadConfig();
        changed = true;
      }
      return { changed, binary };
    }
    const stripped = removeAgent(legacyAgents);
    if (stripped.changed && writeLegacyAgents(root, stripped.agents)) {
      await bb.sdk.system.reloadConfig();
      changed = true;
    }
    return { changed, binary };
  }
  async function unregister() {
    const root = await dataDir();
    let changed = false;
    const settingAgents = await readSettingAgents();
    if (settingAgents !== null) {
      const next = removeAgent(settingAgents);
      if (next.changed) {
        await writeSettingAgents(next.agents);
        changed = true;
      }
    }
    const stripped = removeAgent(readLegacyAgents(root));
    if (stripped.changed && writeLegacyAgents(root, stripped.agents)) {
      await bb.sdk.system.reloadConfig();
      changed = true;
    }
    return changed;
  }
  bb.background.service("provision", {
    async start() {
      try {
        const result = await provision();
        bb.log.info(
          result.changed ? `registered ${PROFILE.providerId} with ${result.binary}` : `${PROFILE.providerId} is already configured`
        );
      } catch (error) {
        const message = String(error);
        bb.log.error(message);
        bb.status.needsConfiguration(message);
      }
    }
  });
  bb.cli.register({
    name: PROFILE.id,
    summary: `Manage the ${PROFILE.displayName} ACP provider.`,
    commands: [
      { name: "status", summary: "Check the CLI and bb provider registration", usage: `${PROFILE.id} status` },
      { name: "repair", summary: "Rewrite and reload the managed ACP configuration", usage: `${PROFILE.id} repair` },
      { name: "unregister", summary: "Remove this plugin's managed ACP configuration", usage: `${PROFILE.id} unregister` }
    ],
    async run(argv) {
      const command = argv[0] ?? "status";
      if (command === "repair") {
        try {
          const result = await provision();
          return { exitCode: 0, stdout: `${PROFILE.providerId}: ${result.changed ? "repaired" : "already up to date"}
CLI: ${result.binary}
` };
        } catch (error) {
          return { exitCode: 1, stderr: `${String(error)}
` };
        }
      }
      if (command === "unregister") {
        try {
          const changed = await unregister();
          return { exitCode: 0, stdout: `${PROFILE.providerId}: ${changed ? "unregistered" : "not configured"}
` };
        } catch (error) {
          return { exitCode: 1, stderr: `${String(error)}
` };
        }
      }
      if (command === "status") {
        const root = await dataDir();
        const settingAgents = await readSettingAgents();
        const legacyAgents = readLegacyAgents(root);
        const entry = settingAgents?.find((agent) => agent?.id === PROFILE.id) ?? legacyAgents.find((agent) => agent?.id === PROFILE.id);
        const binary = findBinary(entry);
        let registered = false;
        try {
          registered = (await bb.sdk.providers.list()).some((provider) => provider.id === PROFILE.providerId);
        } catch {
        }
        const setting = settingAgents?.some((agent) => agent?.id === PROFILE.id) ? "present" : "missing";
        const legacy = legacyAgents.some((agent) => agent?.id === PROFILE.id) ? "present" : "absent";
        return {
          exitCode: binary && entry && registered ? 0 : 1,
          stdout: [
            `CLI: ${binary ?? "NOT FOUND"}`,
            `ACP customAgents entry: ${setting}`,
            `legacy config.json entry: ${legacy}`,
            `bb provider ${PROFILE.providerId}: ${registered ? "registered" : "NOT registered"}`
          ].join("\n") + "\n"
        };
      }
      return { exitCode: 2, stderr: `Unknown subcommand "${command}". Use "bb ${PROFILE.id} status".
` };
    }
  });
}
export {
  plugin as default
};
//# sourceMappingURL=server.js.map
