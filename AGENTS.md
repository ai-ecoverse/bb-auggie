# bb-auggie

GitHub: https://github.com/ai-ecoverse/bb-auggie
npm package: `bb-plugin-auggie` (unpublished; marketplace installs from git, not npm)
bb plugin id: `auggie` (from package name `bb-plugin-auggie`)
provider id: `acp-auggie`
CLI: `bb auggie status`, `bb auggie repair`, `bb auggie unregister`
Marketplace entry: `get-bb/marketplace` `entries/auggie.json`
Current range: `^0.3.0` → node-semver `>=0.3.0 <0.4.0-0`
`author.github`: `trieloff` (gates later entry changes)

Current ship: `v0.3.0` at `6dbfa61`. Tags: `v0.1.0`, `v0.2.0`, `v0.3.0`.

# Release

The listing is merged (get-bb/marketplace PR #118, `75e8f3d`). A compatible update is a new immutable tag on this repo, not a marketplace PR.

## Do not move a tag

bb resolves a marketplace `range` with node-semver `maxSatisfying` over this repo's `vX.Y.Z` tags, records the tag **and** the commit it selected, and refuses a tag that later points elsewhere. Never `git tag -f`, never delete-and-recreate, never retarget. Publish a fix as a new version.

`v0.1.0` and `v0.2.0` are annotated (`Release v0.X.0`). `v0.3.0` is a lightweight tag created by `gh release create`. Prefer annotated tags so the tag exists before the GitHub release.

## The range trap

Caret on `0.x` pins the **minor**:

| Version | `^0.3.0` |
| --- | --- |
| `0.3.0`, `0.3.1` | ships by tagging this repo |
| `0.4.0`, `1.0.0` | tagging is not enough; users stay on `0.3.x` until `entries/auggie.json` `source.git.range` changes |

Auggie already hit this: an earlier listing used `^0.1.0`, which cannot resolve `0.2.0`. PR #118 moved the range to `^0.3.0`.

Open a reviewed marketplace PR (must come from `author.github` = `trieloff`) when any of these change:

- `id`, `displayName`, `description`, `tags`, `icon`
- `source.git.url` or `source.git.range`
- `author.*`

A patch (`0.3.1`) does not need that PR. A minor (`0.4.0`) needs the tag **and** a range PR (`^0.3.0` → `^0.4.0`). Tag first so the new version exists before CI's liveness check; then change the range so bb will select it.

`npm run check` in the marketplace repo only confirms some `vX.Y.Z` tags exist at the git URL. It does **not** check that `maxSatisfying(tags, range)` is non-null. Confirm the range yourself with node-semver before cutting.

## Pre-release

Working tree must include the version you are about to tag. Bump without tagging (default `npm version` would tag too early, before `dist/` is rebuilt):

```
npm version patch --no-git-tag-version    # or: minor
```

That updates `package.json` and `package-lock.json`. Then:

```
npm run typecheck
npm test
bb plugin build .
```

`dist/` is committed and is what a git/marketplace install runs. A tag whose `dist/` does not match the sources at that commit ships the previous build. Catch it:

```
bb plugin build .
git diff --exit-code dist
```

Empty diff: committed `dist/` matches sources. Non-empty: commit the rebuilt `dist/` before tagging.

`dist/server.meta.json` and `dist/app.meta.json` `pluginVersion` must equal `package.json` `version`, and `pluginId` must be `auggie`. Managed installs reject a mismatch.

Commit `package.json`, `package-lock.json`, `dist/`, and the source change together. Push `main`. Do not tag yet.

## Local verification (before tagging)

```
bb plugin install . --yes
bb plugin reload auggie
bb plugin list
bb auggie status
bb provider models acp-auggie
bb plugin logs auggie -n 20
```

Expect:

- `auggie@<version>  running` with `source: path:…/bb-auggie`
- `bb auggie status` exit 0:
  - `CLI: /opt/homebrew/bin/auggie` (or another real binary)
  - `ACP customAgents entry: present`
  - `legacy config.json entry: absent`
  - `bb provider acp-auggie: registered`
- `bb provider models acp-auggie` prints a live catalog
- latest log line `level":"info"` `acp-auggie is already configured` (or `registered acp-auggie with …`)
- no `"level":"error"`; `handlerStats.errorCount` is 0

Boot can emit `"level":"warn"` `Could not read provider-acp customAgents: … HTTP 404` while ACP settings race the factory. That is expected if a later info line shows provision succeeded. Fail the release if the plugin is `needs-configuration` or status is not `running`.

`bb auggie --help` is not help; unknown argv is an error. Use `status` / `repair` / `unregister`.

Do not run `bb auggie unregister` as part of a release.

## Cut the release

Use `/opt/homebrew/bin/gh`, not `gh`. PATH `gh` is `~/.local/bin/gh` (ai-aligned-gh). From an agent it switches to the as-a-bot GitHub App, which cannot administer repositories. `/opt/homebrew/bin/gh` is the user CLI (`trieloff`, `admin: true` on this repo).

On the version commit that is already on `origin/main`:

```
git tag -a v0.3.1 -m "Release v0.3.1"
git push origin v0.3.1
/opt/homebrew/bin/gh release create v0.3.1 --repo ai-ecoverse/bb-auggie --verify-tag --title v0.3.1 --notes "one-paragraph summary of the tag"
```

`--verify-tag` aborts if the tag is not already on the remote, so `gh` cannot create a lightweight tag at whatever `main` currently is. Substitute the real version.

`--generate-notes` is also valid (`gh release create --help`); this repo's existing GitHub release (`v0.3.0`) used handwritten `--notes`.

## After the release

Tag visible and peeled to the intended commit:

```
git ls-remote --tags https://github.com/ai-ecoverse/bb-auggie.git 'refs/tags/v*'
```

Expect `refs/tags/vX.Y.Z` (and `refs/tags/vX.Y.Z^{}` for an annotated tag) at the release commit, not at some other SHA.

In a marketplace checkout (do not edit this plugin repo for that):

```
npm run check
```

That is `node scripts/build.mjs --liveness`: schema + `git ls-remote --tags <url> refs/tags/v*`. It writes `dist/marketplace.json` in the marketplace repo.

bb does not auto-install. A catalog refresh surfaces `bb plugin outdated`; the user applies with `bb plugin update`.

# Worked examples

Current range is `^0.3.0`. Current tag is `v0.3.0`.

## Patch `0.3.1` — tag only

1. Land the fix on `main`.
2. `npm version patch --no-git-tag-version` → `0.3.1`.
3. `npm run typecheck && npm test && bb plugin build .`
4. `git diff --exit-code dist` must be clean after committing the rebuilt `dist/` (meta `pluginVersion` is now `0.3.1`).
5. `bb plugin install . --yes && bb plugin reload auggie && bb auggie status && bb provider models acp-auggie`
6. Push `main`. `git tag -a v0.3.1 -m "Release v0.3.1"` and `git push origin v0.3.1`.
7. `/opt/homebrew/bin/gh release create v0.3.1 --repo ai-ecoverse/bb-auggie --verify-tag --title v0.3.1 --notes "…"`
8. `git ls-remote --tags https://github.com/ai-ecoverse/bb-auggie.git 'refs/tags/v*'` shows `v0.3.1`.
9. No marketplace PR. `maxSatisfying(['0.3.0','0.3.1'], '^0.3.0')` is `0.3.1`.

## Minor `0.4.0` — tag, then marketplace PR

1. Same as the patch path, but `npm version minor --no-git-tag-version` → `0.4.0`, tag `v0.4.0`.
2. Tagging alone does **not** ship to marketplace users: `semver.satisfies('0.4.0', '^0.3.0')` is `false`. They stay on `0.3.x`.
3. After `v0.4.0` is on GitHub, open a PR to `get-bb/marketplace` from `trieloff` that changes only `entries/auggie.json` `source.git.range` from `^0.3.0` to `^0.4.0`. Same PR if you also change display name, description, tags, icon, or source URL.
4. In that marketplace checkout: `npm run check`, then merge.
5. New range is `>=0.4.0 <0.5.0-0`. Later `0.4.x` patches tag-only again; `0.5.0` needs another range PR.
