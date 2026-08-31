export type JsonObject = Record<string, unknown>;
export type CustomAgent = JsonObject & { id?: unknown; command?: unknown; env?: unknown };

export const ACP_PLUGIN_ID = "provider-acp";

export const PROFILE = {
  id: "auggie",
  providerId: "acp-auggie",
  displayName: "Auggie",
  binary: "auggie",
  args: ["--acp"],
  // Directories Auggie actually reads (`docs.augmentcode.com/cli/skills` and
  // the CLI's own `[".augment", ".claude", ".agents"]` + `"skills"` scan).
  // User roots resolve from the home directory, project roots from the workspace.
  nativeSkillRoots: {
    user: [".augment/skills", ".claude/skills", ".agents/skills"],
    project: [".augment/skills", ".claude/skills", ".agents/skills"],
  },
  // bb's permission modes as Auggie `--permission tool:policy` flags. There is
  // no allow-everything switch (`--allow-all` is rejected). Accept-edits maps
  // to auto-approving Auggie's file-mutation tools; shell still asks. bb's
  // default "auto" mode adds nothing, so every request comes through ACP.
  permissionCli: {
    workspaceWrite: [
      "--permission=write:allow",
      "--permission=edit:allow",
      "--permission=apply_patch:allow",
      "--permission=remove-files:allow",
    ],
  },
  installHint: "Install Auggie with `npm install -g @augmentcode/auggie`, authenticate it, then run `bb plugin reload auggie`.",
} as const;

export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isOwnAgent(agent: CustomAgent | undefined): boolean {
  return agent?.id === PROFILE.id;
}

export function findOwnAgent(agents: CustomAgent[]): CustomAgent | undefined {
  return agents.find(isOwnAgent);
}

export function parseCustomAgents(value: unknown): CustomAgent[] {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value !== "string") {
    throw new Error(`${ACP_PLUGIN_ID} customAgents must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return [];
  const parsed: unknown = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error(`${ACP_PLUGIN_ID} customAgents must be a JSON array; refusing to overwrite it`);
  }
  return parsed as CustomAgent[];
}

export function stringifyCustomAgents(agents: CustomAgent[]): string {
  return `${JSON.stringify(agents, null, 2)}\n`;
}

export function managedAgent(binary: string, existing?: CustomAgent): CustomAgent {
  const existingEnv = isObject(existing?.env) ? existing.env : {};
  return {
    // Keys the user added themselves (cwd, dialect, modelCli, ...) survive a
    // reload; the fields below are ours and are rewritten every time.
    ...(existing ?? {}),
    id: PROFILE.id,
    displayName: PROFILE.displayName,
    command: binary,
    args: [...PROFILE.args],
    env: existingEnv,
    nativeSkillRoots: {
      user: [...PROFILE.nativeSkillRoots.user],
      project: [...PROFILE.nativeSkillRoots.project],
    },
    permissionCli: {
      workspaceWrite: [...PROFILE.permissionCli.workspaceWrite],
    },
  };
}

export function upsertAgent(agents: CustomAgent[], next: CustomAgent): { agents: CustomAgent[]; changed: boolean } {
  const index = agents.findIndex(isOwnAgent);
  const before = JSON.stringify(index >= 0 ? agents[index] : null);
  const copy = [...agents];
  if (index >= 0) copy[index] = next;
  else copy.push(next);
  return { agents: copy, changed: JSON.stringify(index >= 0 ? copy[index] : copy.at(-1)) !== before };
}

export function removeAgent(agents: CustomAgent[]): { agents: CustomAgent[]; changed: boolean } {
  const next = agents.filter((agent) => !isOwnAgent(agent));
  return { agents: next, changed: next.length !== agents.length };
}
