# Zaps for agents

Zaps turns a description into a finished design. This repo is the distribution
bundle: one skill, one MCP server pointer, and the three manifests different
clients look for.

Nothing here is a server. The MCP server is remote and hosted — you add a url,
you do not install code.

## Add it

### Claude Code — the marketplace (recommended)

Two lines. You get the MCP server *and* the skill, which is what teaches the
model to search before it fills instead of guessing at a template:

```
/plugin marketplace add turnip-agentic/zaps-agent
/plugin install zaps@zaps
```

It will ask for your API key once and store it in your keychain — no config file
to edit, and the key never lands in a repo. Non-interactively:

```bash
claude plugin marketplace add turnip-agentic/zaps-agent
claude plugin install zaps@zaps --config api_key=zak_your_key
```

### Just the server, no install

```bash
claude mcp add --transport http zaps https://zaps.design/mcp \
  --header "Authorization: Bearer zak_your_key"
```

### npx — any client, one command

Writes the right config for whichever client you name, with that client's own
quirks handled:

```bash
npx @turnip-agentic/zaps-mcp install            # lists the clients
npx @turnip-agentic/zaps-mcp install cursor
npx @turnip-agentic/zaps-mcp install antigravity
```

Run with no arguments and it becomes a **stdio bridge** to the hosted server, so
harnesses that only speak stdio still work:

```json
{
  "mcpServers": {
    "zaps": {
      "command": "npx",
      "args": ["-y", "@turnip-agentic/zaps-mcp"],
      "env": { "ZAPS_API_KEY": "zak_your_key" }
    }
  }
}
```

The bridge is a pipe, not a second implementation: it adds the Authorization
header and forwards bytes, so there is one copy of the protocol to keep correct.

**Codex** — in `~/.codex/config.toml`:

```toml
[mcp_servers.zaps]
url = "https://zaps.design/mcp"
bearer_token_env_var = "ZAPS_API_KEY"
```

**Antigravity** — in `~/.gemini/config/mcp_config.json`. Note the field name:
Antigravity requires `serverUrl` and rejects `url`.

```json
{
  "mcpServers": {
    "zaps": {
      "serverUrl": "https://zaps.design/mcp",
      "headers": { "Authorization": "Bearer zak_your_key" }
    }
  }
}
```

**Cursor** — `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "zaps": {
      "url": "https://zaps.design/mcp",
      "headers": { "Authorization": "Bearer ${env:ZAPS_API_KEY}" }
    }
  }
}
```

**VS Code / Copilot** — `.vscode/mcp.json`. Note the wrapper key is `servers`,
not `mcpServers`:

```json
{
  "servers": {
    "zaps": { "type": "http", "url": "https://zaps.design/mcp" }
  }
}
```

**Any other harness** — drop the skill in and it works with plain curl:

```bash
mkdir -p ~/.agents/skills
curl -s https://zaps.design/.well-known/agent-skills/zaps-design/SKILL.md \
  -o ~/.agents/skills/zaps-design/SKILL.md
```

`~/.agents/skills/` is the cross-client convention — around forty clients read
it, including Claude, Codex, Cursor, VS Code, Gemini CLI and Antigravity.

## The key

Mint one at https://zaps.design/account. It starts with `zak_`, it is shown once,
and revoking it takes effect immediately. Search is free; each render spends one
agentic token.

## What the tools do

| tool | cost | what it takes |
|---|---|---|
| `search_templates` | free | `query` — what the design is for, in plain words |
| `fill_template` | 1 token | `scene` from a search hit, plus `images` urls in placement order |

Full reference: https://zaps.design/docs/api · OpenAPI:
https://zaps.design/openapi.json · everything machine-readable:
https://zaps.design/.well-known/api-catalog

## Why three manifests

There is no single plugin format yet. `.claude-plugin/plugin.json` is
Anthropic's, `.codex-plugin/plugin.json` is OpenAI's, and the root `plugin.json`
is the vendor-neutral Agent Plugins v1.0.0 spec. All three describe the same
bundle, and each client ignores the others — Anthropic's loader ignores unknown
top-level keys, and Codex reads `.claude-plugin/marketplace.json` as a
legacy-compatible marketplace, so the overlap is deliberate rather than
duplicated by accident.
