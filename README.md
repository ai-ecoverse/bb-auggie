# bb-auggie

Register [Auggie](https://docs.augmentcode.com/cli/overview) (Augment Code CLI) as a **bb custom ACP provider**.

bb already speaks [Agent Client Protocol](https://agentclientprotocol.com) via `bb-acp-bridge`. Known agents (opencode, grok, hermes, …) auto-detect when their CLI is on PATH. Auggie is **not** in that built-in list, so this repo ships a `customAcpAgents` entry that bb loads from `~/.bb/config.json`.

After install, Auggie appears as provider **`acp-auggie`**.

## Prerequisites

1. **bb** desktop app running (host daemon co-located with the CLI).
2. **Auggie** on PATH (`npm install -g @augmentcode/auggie`, Node 22+).
3. **Logged in**: `auggie login` (or `AUGMENT_SESSION_AUTH`).

Verify:

```bash
which auggie
auggie --version
auggie model list
```

## Install into bb

```bash
# from this directory
./scripts/install.sh
```

What it does:

1. Merges `config/custom-acp-agent.json` into `~/.bb/config.json` under `customAcpAgents` (by id `auggie`).
2. Copies `assets/logo.svg` into the bb data dir as `auggie-logo.svg` and points the agent `logo` field at it.
3. Tries `bb-app config refresh` when available; otherwise prints a restart hint.

Then check:

```bash
bb provider list
bb provider models acp-auggie
```

Spawn a thread:

```bash
bb thread spawn --project <project-id> --provider acp-auggie --prompt "Say hello and list the workspace root"
```

## Uninstall

```bash
./scripts/uninstall.sh
```

Removes the `auggie` entry from `customAcpAgents` (leaves other custom agents alone) and the optional logo copy.

## Launch profile

| Field | Value |
|--------|--------|
| Provider id | `acp-auggie` |
| Display name | Auggie |
| Command | `auggie` |
| Args | `["--acp"]` |
| Model list | `auggie model list` |
| Model select | `--model` (global flag before ACP mode) |

Source of truth for the agent object: [`config/custom-acp-agent.json`](config/custom-acp-agent.json).

ACP mode docs: [Augment ACP](https://docs.augmentcode.com/cli/acp/agent) — `auggie --acp` speaks JSON-RPC over stdio.

### Capabilities (bb ACP defaults)

Custom ACP providers share bb’s generic ACP capability set:

- Permission modes: `accept-edits`, `full` (no `auto`)
- No native fork / archive / rename
- Agent owns tools and most session policy
- Skills slash affordance is available

### Model listing notes

`modelCli.listArgs` is `["model", "list"]`. bb’s ACP bridge parses CLI list output into model families; if listing fails or is empty, threads may still start with the agent’s default model. Prefer the short names from `auggie model list` (e.g. `opus5`, `sonnet5-high`, `prism-a`) when pinning via `primaryModels` or bb model pickers.

`primaryModels` in the agent config is a preference order for the UI, not a hard allowlist of what Auggie can run.

## Manual config (no script)

Create or edit `~/.bb/config.json`:

```json
{
  "customAcpAgents": [
    {
      "id": "auggie",
      "displayName": "Auggie",
      "command": "auggie",
      "args": ["--acp"],
      "modelCli": {
        "listArgs": ["model", "list"],
        "selectFlag": "--model",
        "primaryModels": [
          "prism-a",
          "opus5",
          "sonnet5-high",
          "fable-5",
          "haiku4.5"
        ]
      }
    }
  ]
}
```

Refresh or restart bb, then `bb provider list`.

## Layout

```text
bb-auggie/
  README.md
  config/custom-acp-agent.json   # agent definition merged into config.json
  assets/logo.svg                # optional provider logo
  scripts/install.sh
  scripts/uninstall.sh
```

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `acp-auggie` missing | `cat ~/.bb/config.json`; restart bb; daemon must be on the machine with `auggie` |
| Provider present, models empty | `auggie model list`; login (`auggie login`); try without `modelCli` temporarily |
| Thread fails at start | Run `auggie --acp` manually — should sit on stdio as ACP agent; confirm auth |
| Remote machine | Install auggie **on that host** and install this config on the bb data dir used by that server/daemon |

## Related

- bb ACP custom agents: data-dir `config.json` → `customAcpAgents` (see `bb guide providers`)
- Sibling idea: `bb-droid` for Factory Droid (`droid exec --output-format acp`)
