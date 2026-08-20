---
name: zaps-design
description: Create finished social-media and invite designs through the Zaps API. Use when the user wants a story, post, carousel, reel cover, invite or greeting card made — search the template catalogue by describing the occasion, then fill the chosen template with their images to render it. Needs a Zaps API key.
license: Apache-2.0
compatibility: Requires network access and a Zaps API key (prefix zak_) from https://zaps.design/account.
allowed-tools: Bash
metadata:
  vendor: Zaps
  homepage: https://zaps.design
  api: https://api.zaps.design
---

# Zaps: templates to finished designs

Two calls. `search` finds a template by what the design is *for*; `fill` puts the
user's images into it and renders it. Search is free. Each fill spends one
agentic token and refunds it if the render fails.

## Before the first call: the key

Every request needs the user's own key. Ask for it once:

> To make designs I need your Zaps API key — you can mint one at
> https://zaps.design/account. It starts with `zak_`.

Then keep it out of the transcript and out of your reasoning. Write it to the
environment for the session and read it from there:

```bash
export ZAPS_API_KEY='zak_...'          # the user's key, once per session
```

Never print the key back, never include it in a summary, and never write it into
a file in the user's repository. If a call returns `401`, the key is wrong or
revoked — say exactly that and point at the account page. Do not retry a
rejected key.

## 1. Search

```bash
curl -s -X POST https://api.zaps.design/api/v1/agentic/search \
  -H "Authorization: Bearer $ZAPS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"q":"coffee shop story","limit":5}'
```

`q` is a description of the occasion or mood, not a filename and not keywords
joined by commas. The index is built from what each template is for, so plain
phrases work best:

- good: `"thanksgiving family dinner invite"`, `"nail art beauty collage story"`
- weak: `"template"`, `"design"`, `"instagram"` — every template matches those

Each hit carries `coverId`, `name`, `segment`, `score` and **`scene`** — the url
step 2 needs. Prefer a hit whose `segment` matches the surface the user asked
for: `story` for a 9:16 story, `carousel` for a multi-slide post, `invite` for a
card.

If nothing scores well, say so and offer to search differently rather than
filling the closest miss — a bad template wastes the user's token.

## 2. Fill

```bash
curl -s -X POST https://api.zaps.design/api/v1/agentic/fill \
  -H "Authorization: Bearer $ZAPS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"scene":"<scene url from step 1>","images":["https://.../a.jpg","https://.../b.jpg"]}'
```

`images` are placed in order into the template's image slots. Pass publicly
reachable urls — the renderer fetches them, so a local path will fail.

The response carries the rendered output plus these headers, which are the only
place the accounting appears:

```
X-Agentic-Tokens-Cost: 1
X-Agentic-Tokens-Remaining: 499
```

Add `-D /dev/stderr` to the curl if you want to read them. Report the remaining
balance to the user when it gets low; a `402` means the balance is empty, not
that the request was malformed.

## Putting it together

The user says *"make me a story for my cafe's new winter menu, use these two
photos"*. The sequence is: search `"coffee shop winter menu story"` → pick the
best-scoring `segment: story` hit → fill it with the two photo urls in the order
the user listed them → hand back the rendered result and say which template you
used and what it cost.

Do not fill more than one template per request unless the user asked for
options — each one costs a token.

## Failure modes worth naming precisely

| Response | What it means | What to say |
|---|---|---|
| `401` | key missing, wrong, or revoked | "That key was rejected — mint a new one at https://zaps.design/account" |
| `402` | out of agentic tokens | "Your balance is empty; top up at https://zaps.design/account" |
| `400` on fill | the scene url is not a scene | re-run search and take `scene` verbatim from a hit |
| `5xx` | our side | the token is refunded automatically; offer to retry once |
