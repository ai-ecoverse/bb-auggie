# bb-auggie

Adds Augment Code's Auggie CLI to [bb](https://getbb.app) as an ACP coding-agent provider.

After installation, **Auggie** appears in bb as provider **`acp-auggie`**.

## Prerequisites

- bb 0.40 or newer with its built-in ACP providers plugin enabled.
- Install with `npm install -g @augmentcode/auggie`, then authenticate with `auggie login`.

## Install

Until the marketplace entry is merged, install directly from GitHub:

```bash
bb plugin install https://github.com/ai-ecoverse/bb-auggie
```

For local development:

```bash
npm install
npm run typecheck
npm run build
npm test
bb plugin install .
```

The plugin locates the CLI and writes or repairs its managed entry in the ACP
providers plugin's `customAgents` setting without disturbing other agents. It
uses `auggie --acp` over stdio. Model ids come from Auggie's ACP session catalog.

## Skills

The managed entry declares the skill directories the Auggie CLI reads, so bb
lists them in the composer next to its own:

- project: `.augment/skills/`, `.claude/skills/`, `.agents/skills/`
- user: `~/.augment/skills/`, `~/.claude/skills/`, `~/.agents/skills/`

## Permission modes

bb's thread permission mode becomes an Auggie `--permission` launch flag.
Auggie has no allow-everything switch (`--allow-all` is rejected), so Full
access is omitted and behaves like Auto.

| bb mode      | Auggie flags |
| ------------ | ------------ |
| Auto         | none — every tool call comes through ACP for approval |
| Accept edits | `--permission=write:allow --permission=edit:allow --permission=apply_patch:allow --permission=remove-files:allow` — file mutations run unattended, shell still asks |
| Full access  | none — Auggie has no honest equivalent |

## Check or repair

```bash
bb auggie status
bb auggie repair
bb provider models acp-auggie
```

If the CLI moves after an upgrade, `bb auggie repair` records its new
absolute path and reloads bb.

## Uninstall

Remove the managed provider entry before removing the plugin:

```bash
bb auggie unregister
bb plugin remove auggie
```

The legacy `scripts/install.sh` and `scripts/uninstall.sh` remain available for
installations made before this repository became a bb plugin. Do not use them
for new installs: they write the `customAcpAgents` array that bb removes in
0.41. Installing the plugin migrates such an entry to the setting and deletes
the legacy one.

## How it works

bb's built-in ACP provider supplies the ACP-to-bb runtime. This plugin manages
the provider-specific launch profile in that plugin's `customAgents` setting
(the old `customAcpAgents` array in `config.json` is deprecated in bb 0.40 and
removed in 0.41). Authentication and model availability remain owned by the
vendor CLI and the user's account.

The package ID is `auggie`; the provider ID is `acp-auggie`. The compact icon
is a `currentColor` mask so it follows the bb theme.

## Development

```bash
npm run typecheck
npm run build
npm test
```

The plugin requires bb 0.40+ and plugin SDK 0.4.8+.
