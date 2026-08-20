#!/usr/bin/env node
// Two jobs, one binary.
//
//   npx @turnip-agentic/zaps-mcp                 → stdio ⇄ HTTP bridge
//   npx @turnip-agentic/zaps-mcp install [client] → write that client's config
//
// The bridge exists because not every harness speaks remote HTTP MCP yet, and
// the ones that don't all speak stdio. It is a pipe, not a server: it adds the
// Authorization header and forwards bytes, so there is one implementation of the
// protocol (the hosted one) rather than two that can drift.
import { createInterface } from 'node:readline'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const ENDPOINT = process.env.ZAPS_MCP_URL || 'https://zaps.design/mcp'
const KEY_FLAG = process.argv.findIndex((a) => a === '--key')
const KEY = (KEY_FLAG > -1 ? process.argv[KEY_FLAG + 1] : '') || process.env.ZAPS_API_KEY || ''

const CLIENTS = {
  claude: {
    label: 'Claude Code',
    how: 'one line, no file to edit',
    command: [
      `claude mcp add --transport http zaps ${ENDPOINT} \\`,
      `  --header "Authorization: Bearer ${KEY || 'zak_your_key'}"`,
    ].join('\n'),
  },
  codex: {
    label: 'Codex',
    file: join(homedir(), '.codex', 'config.toml'),
    // TOML, and Codex reads the token from an env var rather than inline.
    toml: `\n[mcp_servers.zaps]\nurl = "${ENDPOINT}"\nbearer_token_env_var = "ZAPS_API_KEY"\n`,
  },
  cursor: {
    label: 'Cursor',
    file: join(homedir(), '.cursor', 'mcp.json'),
    key: 'mcpServers',
    entry: { url: ENDPOINT, headers: { Authorization: 'Bearer ${env:ZAPS_API_KEY}' } },
  },
  vscode: {
    label: 'VS Code / Copilot',
    file: join(process.cwd(), '.vscode', 'mcp.json'),
    // VS Code wraps servers under "servers", not "mcpServers".
    key: 'servers',
    entry: { type: 'http', url: ENDPOINT },
  },
  antigravity: {
    label: 'Antigravity',
    file: join(homedir(), '.gemini', 'config', 'mcp_config.json'),
    key: 'mcpServers',
    // Antigravity requires serverUrl and rejects url — the single most common
    // reason a copied config silently fails there.
    entry: { serverUrl: ENDPOINT, headers: { Authorization: `Bearer ${KEY || 'zak_your_key'}` } },
  },
}

function writeJsonConfig(spec) {
  mkdirSync(dirname(spec.file), { recursive: true })
  let doc = {}
  if (existsSync(spec.file)) {
    try {
      doc = JSON.parse(readFileSync(spec.file, 'utf8'))
    } catch {
      console.error(`! ${spec.file} is not valid JSON — leaving it alone. Add this by hand:`)
      console.error(JSON.stringify({ [spec.key]: { zaps: spec.entry } }, null, 2))
      process.exit(1)
    }
  }
  doc[spec.key] ||= {}
  const existed = 'zaps' in doc[spec.key]
  doc[spec.key].zaps = spec.entry
  writeFileSync(spec.file, JSON.stringify(doc, null, 2) + '\n')
  console.log(`${existed ? 'updated' : 'added'} "zaps" in ${spec.file}`)
}

function appendToml(spec) {
  mkdirSync(dirname(spec.file), { recursive: true })
  const current = existsSync(spec.file) ? readFileSync(spec.file, 'utf8') : ''
  if (current.includes('[mcp_servers.zaps]')) {
    console.log(`"zaps" is already in ${spec.file} — left unchanged`)
    return
  }
  writeFileSync(spec.file, current + spec.toml)
  console.log(`added [mcp_servers.zaps] to ${spec.file}`)
}

function install(which) {
  if (!which) {
    console.log('\nZaps MCP — pick your client:\n')
    for (const [name, c] of Object.entries(CLIENTS)) {
      console.log(`  npx @turnip-agentic/zaps-mcp install ${name.padEnd(12)} ${c.label}`)
    }
    console.log('\nOr add it by hand — the endpoint is just a url:\n')
    console.log(`  ${ENDPOINT}\n`)
    console.log('Mint a key at https://zaps.design/account (starts with zak_).\n')
    return
  }
  const spec = CLIENTS[which]
  if (!spec) {
    console.error(`unknown client "${which}". Known: ${Object.keys(CLIENTS).join(', ')}`)
    process.exit(1)
  }
  if (spec.command) {
    console.log(`\n${spec.label} takes it directly — ${spec.how}:\n`)
    console.log(spec.command + '\n')
    return
  }
  if (spec.toml) appendToml(spec)
  else writeJsonConfig(spec)
  if (!KEY) {
    console.log('\nNow set your key so the client can authenticate:')
    console.log("  export ZAPS_API_KEY='zak_...'   # from https://zaps.design/account\n")
  }
}

async function bridge() {
  if (!KEY) {
    // Fail loudly at startup rather than turning every tool call into a 401 the
    // user has to decode.
    process.stderr.write(
      'zaps-mcp: no key. Set ZAPS_API_KEY or pass --key. Mint one at https://zaps.design/account\n',
    )
  }
  const send = (obj) => process.stdout.write(JSON.stringify(obj) + '\n')
  const rl = createInterface({ input: process.stdin })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let msg
    try {
      msg = JSON.parse(trimmed)
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })
      continue
    }
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(KEY ? { authorization: `Bearer ${KEY}` } : {}),
        },
        body: JSON.stringify(msg),
      })
      // Notifications get 202 and no body; there is nothing to relay.
      if (res.status === 202 || res.headers.get('content-length') === '0') continue
      const text = await res.text()
      if (!text) continue
      // An HTTP-level error (a 401 challenge, say) has no JSON-RPC envelope, and a
      // client that receives one cannot match it to the request it sent — it waits
      // for a reply that never comes. Wrap it, and carry the WWW-Authenticate
      // challenge through so the user is told what to do about it.
      let envelope = null
      try {
        envelope = JSON.parse(text)
      } catch {
        // Not JSON at all — treat it as an error string below.
      }
      // `jsonrpc` is the only reliable discriminator: the server's 401 body is
      // {"error": "..."} , which has an error key but is not a JSON-RPC message.
      if (envelope && envelope.jsonrpc === '2.0') {
        process.stdout.write(text.endsWith('\n') ? text : text + '\n')
        continue
      }
      if (msg.id !== undefined) {
        const challenge = res.headers.get('www-authenticate')
        const detail = envelope?.error || text.slice(0, 200)
        send({
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: res.status === 401 ? -32001 : -32603,
            message:
              res.status === 401
                ? 'zaps-mcp: not authorized. Set ZAPS_API_KEY to a key from https://zaps.design/account'
                : `zaps-mcp: HTTP ${res.status}: ${detail}`,
            ...(challenge ? { data: { wwwAuthenticate: challenge } } : {}),
          },
        })
      }
    } catch (e) {
      // A transport failure must still answer the request or the client hangs.
      if (msg.id !== undefined) {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: `zaps-mcp: ${e.message}` } })
      }
    }
  }
}

const [, , cmd, arg] = process.argv
if (cmd === 'install') install(arg)
else if (cmd === '--help' || cmd === '-h') install(undefined)
else if (cmd === '--version' || cmd === '-v') console.log('1.0.0')
else await bridge()
