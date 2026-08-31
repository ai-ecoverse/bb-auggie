import { describe, expect, it } from "vitest";
import {
  PROFILE,
  findOwnAgent,
  managedAgent,
  parseCustomAgents,
  removeAgent,
  stringifyCustomAgents,
  upsertAgent,
  type CustomAgent,
} from "./agent-entry.js";

const BINARY = "/opt/homebrew/bin/auggie";

function otherAgent(id: string): CustomAgent {
  return { id, displayName: id, command: id, args: ["--acp"], env: {} };
}

describe("managedAgent", () => {
  it("declares the fields the plugin owns", () => {
    const agent = managedAgent(BINARY);
    expect(agent).toMatchObject({
      id: PROFILE.id,
      displayName: PROFILE.displayName,
      command: BINARY,
      args: ["--acp"],
      env: {},
      nativeSkillRoots: {
        user: [".augment/skills", ".claude/skills", ".agents/skills"],
        project: [".augment/skills", ".claude/skills", ".agents/skills"],
      },
      permissionCli: {
        workspaceWrite: [
          "--permission=write:allow",
          "--permission=edit:allow",
          "--permission=apply_patch:allow",
          "--permission=remove-files:allow",
        ],
      },
    });
    expect(agent.permissionCli).not.toHaveProperty("full");
    expect(agent).not.toHaveProperty("supportsManualCompaction");
  });

  it("keeps keys the user added and env they set", () => {
    const existing: CustomAgent = {
      id: PROFILE.id,
      command: "auggie",
      args: ["--acp", "--banner"],
      env: { AUGMENT_SESSION_AUTH: "1" },
      cwd: "/tmp/workspace",
      dialect: "cursor",
      modelCli: { listArgs: ["model", "list"] },
    };
    const agent = managedAgent(BINARY, existing);
    expect(agent.cwd).toBe("/tmp/workspace");
    expect(agent.dialect).toBe("cursor");
    expect(agent.modelCli).toEqual({ listArgs: ["model", "list"] });
    expect(agent.env).toEqual({ AUGMENT_SESSION_AUTH: "1" });
    // Fields we manage are rewritten even when the user edited them.
    expect(agent.args).toEqual(["--acp"]);
    expect(agent.command).toBe(BINARY);
  });

  it("ignores a non-object env rather than passing it through", () => {
    expect(managedAgent(BINARY, { id: PROFILE.id, env: "nope" }).env).toEqual({});
  });
});

describe("findOwnAgent", () => {
  it("returns our entry and ignores other agents", () => {
    const ours = { ...managedAgent(BINARY), cwd: "/repo" };
    expect(findOwnAgent([otherAgent("droid"), ours])?.cwd).toBe("/repo");
    expect(findOwnAgent([otherAgent("droid")])).toBeUndefined();
  });
});

describe("upsertAgent", () => {
  it("appends the entry and leaves other agents in place", () => {
    const agents = [otherAgent("copilot"), otherAgent("droid")];
    const result = upsertAgent(agents, managedAgent(BINARY));
    expect(result.changed).toBe(true);
    expect(result.agents.map((agent) => agent.id)).toEqual(["copilot", "droid", PROFILE.id]);
  });

  it("is idempotent once provisioned", () => {
    const first = upsertAgent([otherAgent("droid")], managedAgent(BINARY));
    const second = upsertAgent(first.agents, managedAgent(BINARY));
    expect(second.changed).toBe(false);
    expect(second.agents).toEqual(first.agents);
  });

  it("reports a change when the resolved binary moved", () => {
    const provisioned = upsertAgent([], managedAgent("/usr/local/bin/auggie")).agents;
    const result = upsertAgent(provisioned, managedAgent(BINARY));
    expect(result.changed).toBe(true);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]?.command).toBe(BINARY);
  });

  it("rewrites owned fields without dropping unknown keys already on the entry", () => {
    const existing = managedAgent("/usr/bin/auggie", {
      id: PROFILE.id,
      cwd: "/repo",
      dialect: "opencode",
    });
    const result = upsertAgent([existing, otherAgent("droid")], managedAgent(BINARY, existing));
    expect(result.changed).toBe(true);
    expect(result.agents).toHaveLength(2);
    expect(result.agents[0]).toMatchObject({
      id: PROFILE.id,
      command: BINARY,
      cwd: "/repo",
      dialect: "opencode",
    });
    expect(result.agents[1]).toEqual(otherAgent("droid"));
  });
});

describe("removeAgent", () => {
  it("removes our entry and nothing else (legacy cleanup)", () => {
    const agents = [otherAgent("droid"), managedAgent(BINARY), otherAgent("copilot")];
    const result = removeAgent(agents);
    expect(result.changed).toBe(true);
    expect(result.agents).toEqual([otherAgent("droid"), otherAgent("copilot")]);
  });

  it("reports no change when nothing is registered", () => {
    expect(removeAgent([otherAgent("droid")]).changed).toBe(false);
  });
});

describe("parseCustomAgents", () => {
  it("treats an unset or blank setting as no agents", () => {
    expect(parseCustomAgents(undefined)).toEqual([]);
    expect(parseCustomAgents(null)).toEqual([]);
    expect(parseCustomAgents("")).toEqual([]);
    expect(parseCustomAgents("   \n")).toEqual([]);
  });

  it("round-trips what stringifyCustomAgents writes", () => {
    const agents = [otherAgent("droid"), managedAgent(BINARY)];
    expect(parseCustomAgents(stringifyCustomAgents(agents))).toEqual(agents);
  });

  it("refuses a setting it would otherwise clobber", () => {
    expect(() => parseCustomAgents('{"id":"auggie"}')).toThrow(/JSON array/);
    expect(() => parseCustomAgents(["already parsed"])).toThrow(/must be a string/);
    expect(() => parseCustomAgents("[not json")).toThrow();
  });
});
