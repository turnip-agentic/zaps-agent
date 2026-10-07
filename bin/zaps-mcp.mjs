#!/usr/bin/env node
// Two jobs, one binary.
//
//   npx github:turnip-agentic/zaps-agent install [client]  → connect that client to Zaps
//   npx github:turnip-agentic/zaps-agent                   → stdio ⇄ HTTP bridge
//
// Connecting is only ever the URL. The server lets anyone search and make a first design,
// and when a call needs an account the client is sent through a browser sign-in (OAuth),
// so there is no key to mint, paste or store.
//
// The bridge is for a harness that speaks only stdio. It is a pipe, not a server: one
// implementation of the protocol (the hosted one) rather than two that can drift. A stdio
// client cannot run the browser sign-in, so through the bridge the free design is the limit.
import { createInterface } from 'node:readline'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const ENDPOINT = process.env.ZAPS_MCP_URL || 'https://api.zaps.design/mcp'
const INVOKE = 'npx github:turnip-agentic/zaps-agent'

// A client with its own "add a server" command is told to use it: that command knows the
// client's config better than a file write does. The rest get their config file updated.
const CLIENTS = {
  claude: { label: 'Claude Code', run: ['claude', 'mcp', 'add', '--transport', 'http', 'zaps', ENDPOINT] },
  codex: { label: 'Codex', run: ['codex', 'mcp', 'add', 'zaps', '--url', ENDPOINT] },
  gemini: { label: 'Gemini CLI', run: ['gemini', 'mcp', 'add', '--transport', 'http', 'zaps', ENDPOINT] },
  antigravity: { label: 'Antigravity', run: ['agy', 'mcp', 'add', 'zaps', ENDPOINT] },
  vscode: {
    label: 'VS Code / GitHub Copilot',
    run: ['code', '--add-mcp', JSON.stringify({ name: 'zaps', type: 'http', url: ENDPOINT })],
  },
  cursor: {
    label: 'Cursor',
    file: join(homedir(), '.cursor', 'mcp.json'),
    key: 'mcpServers',
    entry: { url: ENDPOINT },
  },
  windsurf: {
    label: 'Windsurf',
    file: join(homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
    key: 'mcpServers',
    entry: { serverUrl: ENDPOINT },
  },
  opencode: {
    label: 'opencode',
    file: join(homedir(), '.config', 'opencode', 'opencode.json'),
    key: 'mcp',
    entry: { type: 'remote', url: ENDPOINT },
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

function install(which) {
  if (!which) {
    console.log('\nZaps for agents — pick your client:\n')
    for (const [name, c] of Object.entries(CLIENTS)) {
      console.log(`  ${INVOKE} install ${name.padEnd(12)} ${c.label}`)
    }
    console.log('\nOr add it by hand. The whole configuration is one URL:\n')
    console.log(`  ${ENDPOINT}\n`)
    console.log('No key: the first design is free, and signing in happens in your browser when needed.\n')
    return
  }
  const spec = CLIENTS[which]
  if (!spec) {
    console.error(`unknown client "${which}". Known: ${Object.keys(CLIENTS).join(', ')}`)
    process.exit(1)
  }
  if (spec.run) {
    const [cmd, ...args] = spec.run
    const res = spawnSync(cmd, args, { stdio: 'inherit' })
    if (res.error) {
      console.error(`\n${cmd} is not on your PATH. Run this once ${spec.label} is installed:\n`)
      console.error(`  ${[cmd, ...args.map((a) => (/[\s{"]/.test(a) ? `'${a}'` : a))].join(' ')}\n`)
      process.exit(1)
    }
    process.exit(res.status ?? 0)
  }
  writeJsonConfig(spec)
}

async function bridge() {
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
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify(msg),
      })
      // Notifications get 202 and no body; there is nothing to relay.
      if (res.status === 202 || res.headers.get('content-length') === '0') continue
      const text = await res.text()
      if (!text) continue
      let envelope = null
      try {
        envelope = JSON.parse(text)
      } catch {
        // Not JSON at all — treated as an error string below.
      }
      // `jsonrpc` is the only reliable discriminator: an HTTP-level refusal is
      // {"error": "..."}, which has an error key but is not a JSON-RPC message, and a
      // client that receives it cannot match it to its request and waits forever.
      if (envelope && envelope.jsonrpc === '2.0') {
        process.stdout.write(text.endsWith('\n') ? text : text + '\n')
        continue
      }
      if (msg.id !== undefined) {
        const detail = envelope?.error || text.slice(0, 200)
        send({
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: res.status === 401 ? -32001 : -32603,
            message:
              res.status === 401
                ? `zaps: ${detail}. Connect ${ENDPOINT} directly as a remote server to sign in.`
                : `zaps: HTTP ${res.status}: ${detail}`,
          },
        })
      }
    } catch (e) {
      // A transport failure must still answer the request or the client hangs.
      if (msg.id !== undefined) {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: `zaps: ${e.message}` } })
      }
    }
  }
}

const [, , cmd, arg] = process.argv
if (cmd === 'install') install(arg)
else if (cmd === '--help' || cmd === '-h') install(undefined)
else if (cmd === '--version' || cmd === '-v') console.log('1.1.0')
else await bridge()
