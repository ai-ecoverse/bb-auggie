# bb-auggie

Adds Augment Code's Auggie CLI to [bb](https://getbb.app) as an ACP coding-agent provider.

After installation, **Auggie** appears in bb as provider **`acp-auggie`**.

## Prerequisites

- bb 0.39 or newer with its built-in ACP providers plugin enabled.
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
bb plugin install .
```

The plugin locates the CLI, writes or repairs its managed `customAcpAgents`
entry without disturbing other agents, installs the approved monochrome icon,
and reloads bb's configuration. It uses `auggie --acp` over stdio.

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

The legacy `scripts/install.sh` and `scripts/uninstall.sh` remain available
for installations made before this repository became a bb plugin.

## How it works

bb's built-in ACP provider supplies the ACP-to-bb runtime. This plugin manages
the provider-specific launch profile and branding in bb's data-directory
configuration. Authentication and model availability remain owned by the
vendor CLI and the user's account.

The package ID is `auggie`; the provider ID is `acp-auggie`.

## Development

```bash
npm run typecheck
npm run build
```

The plugin requires bb 0.39+ and plugin SDK 0.4.8+.
