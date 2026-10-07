# Zaps for agents

Turn someone's photos into finished social-media designs (stories, carousels, reel covers,
invites) from any AI agent. Give it photos and a brief, and Zaps picks matching templates,
places the photos and the words, and returns finished images with a link to keep editing
each one in the Zaps editor.

- **No key, no signup to start.** Searching and the first design are free with no account.
- **Signing in is a browser click.** When a call needs an account, your client opens a
  Zaps sign-in page (OAuth). After that it stays signed in.
- **One hosted server:** `https://api.zaps.design/mcp` (MCP, Streamable HTTP).

## Install

| Client | Command |
|---|---|
| Claude Code | `/plugin marketplace add turnip-agentic/zaps-agent` then `/plugin install zaps@zaps` |
| Claude Code (server only) | `claude mcp add --transport http zaps https://api.zaps.design/mcp` |
| Codex | `codex plugin marketplace add turnip-agentic/zaps-agent` then `codex plugin add zaps@zaps` |
| Antigravity | `agy plugin install <path to a clone of this repo>` or `agy mcp add zaps https://api.zaps.design/mcp` |
| Gemini CLI | `gemini extensions install https://github.com/turnip-agentic/zaps-agent` |
| Cursor | `npx github:turnip-agentic/zaps-agent install cursor` |
| Windsurf | `npx github:turnip-agentic/zaps-agent install windsurf` |
| opencode | `npx github:turnip-agentic/zaps-agent install opencode` |
| VS Code / GitHub Copilot | `code --add-mcp '{"name":"zaps","type":"http","url":"https://api.zaps.design/mcp"}'` |
| Any agent with skills | `npx skills add turnip-agentic/zaps-agent` |
| ChatGPT | Find **Zaps** in the ChatGPT plugin directory |
| Anything else | Add `https://api.zaps.design/mcp` as a remote (HTTP) MCP server |

No install at all? One GET makes a design:
`https://api.zaps.design/make?brief=Birthday%20Party,%20Friends&photo=<public photo url>&text=Happy%20Birthday`.
In a browser, `https://api.zaps.design/make` is a form that takes photo files.

## What is in here

| Path | For |
|---|---|
| `skills/zaps-design/SKILL.md` | The skill: how to write the brief, upload photos and make designs |
| `plugin.json`, `mcp.json` | [Agent Plugins](https://agent-plugins.org) manifest (ChatGPT, Codex, Cursor) |
| `.claude-plugin/`, `.mcp.json` | Claude Code plugin and marketplace |
| `.agents/plugins/marketplace.json` | Codex marketplace |
| `mcp_config.json` | Antigravity plugin MCP config |
| `gemini-extension.json`, `GEMINI.md` | Gemini CLI extension |
| `server.json` | [MCP Registry](https://registry.modelcontextprotocol.io) entry |
| `bin/zaps-mcp.mjs` | `install <client>` helper, and a stdio bridge for clients without remote MCP |

## Tools

| Tool | Does |
|---|---|
| `create_designs` | Photos and a brief in, several finished designs out. The main call. |
| `upload_images` | Upload links (or inline bytes) for photos on the caller's machine. Free. |
| `search_templates` | Rank the template catalogue by a description. Free. |
| `fill_template` | Render one chosen template with photos. |

Docs: https://zaps.design/docs/api · Privacy: https://zaps.design/privacy ·
Terms: https://zaps.design/terms · Support: https://zaps.design/support

## Privacy Policy

The photos and text you send are used to make your designs. How Zaps collects, uses,
shares and retains data is set out in its privacy policy: https://zaps.design/privacy.
Contact: https://zaps.design/support.
