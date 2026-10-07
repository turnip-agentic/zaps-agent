---
name: zaps-design
description: "Turn someone's photos into finished social-media designs — stories, carousels, reel covers, invites. Use when they want something designed from their own images ('make me an Instagram story for my coffee shop', 'turn these 3 photos into a birthday invite', 'I need a carousel for this launch'), including when they just drop photos in and say make something. One call does the whole job: it finds matching templates, renders each with their photos, and returns finished images. No account is needed to try it."
license: proprietary
compatibility: Needs network access to api.zaps.design.
metadata:
  vendor: Zaps
  homepage: https://zaps.design
  api: https://api.zaps.design
  mcp: https://api.zaps.design/mcp
---

# Zaps: photos in, finished designs out

**The whole job is one call.** `create_designs` takes a sentence and some photo URLs,
finds templates that fit, renders each with the photos, and hands back finished images.
Do not orchestrate a search and separate renders yourself — that tool exists, but this
one is the path.

Anyone can make one design without an account. Signing in is what raises the limit.

## No install? Use the one URL

If you cannot add an MCP server — which is every chat assistant — a single GET makes a
finished design, with no key and no account:

```
https://api.zaps.design/make?brief=BRIEF&photo=PHOTO_URL&text=LINE_ONE&text=LINE_TWO
```

Write `brief` yourself in the register below. Repeat `photo` and `text` once per item,
in order, url-encoded; `photo` must be publicly reachable. The reply names the finished
image and a link to keep editing it. `&format=json` returns it as data, and
`/make.png?...` redirects to the image itself.

**Driving a browser, with the photos as files?** Open `https://api.zaps.design/make`: a
plain form with the brief, the lines of text and a file input for the photos. Submit it
and the result page names the finished image and the editor link.

## Connect

```
claude mcp add --transport http zaps https://api.zaps.design/mcp
```

That is the whole install. Searching, uploading and the first design work immediately
with no account and no key.

When a call needs an account, the server answers `401` with a `WWW-Authenticate` header
pointing at `/.well-known/oauth-protected-resource`. Follow it: the client opens a
browser, the person signs in and approves, and the client receives a token. Say
*"a browser will open — sign in and approve, then I'll continue"* before it happens, so
the window is not a surprise. Never ask anyone to paste a key.

## The flow

### 1. Write the search query yourself

`create_designs` takes a `brief`, and that string IS the search query against the template
catalogue. Nothing on our side rewrites it or builds it from anything else — what you send
is what gets embedded and matched, so its wording decides which templates come back.

**Write it as Title Case phrases separated by commas.** Each template is described in the
catalogue that way — *"Birthday Invitation, Turning 40, Adult Birthday, Celebration
Invite"* — and a query in the same register matches its own format. Measured against the
live catalogue, that scores about 0.11 higher than the same intent written as a sentence:

| query | top score |
|---|---|
| `Birthday Party, Friends, Celebration, Confetti, Party Invite` | **0.868** |
| `30th birthday party invitation, playful and colourful` | 0.840 |
| `a birthday party invitation for my friend` | 0.779 |
| `birthday` | 0.772 |
| `make me something for a birthday` | 0.754 |

Five or six phrases covering **the occasion, the subject, and the mood**. A single word is
the worst option — it matches everything equally and tells the ranker nothing.

**Where the phrases come from is your job.** You can see the photos; the server cannot.

- They named the occasion → use it, and add the phrases it implies.
  *"birthday, my friends"* → `Birthday Party, Friends, Celebration, Confetti, Party Invite`
- They said nothing → **look at the photos and write it from what you see**.
  Three people on a beach at sunset → `Summer Trip, Beach Day, Friends, Golden Hour, Photo Dump`
  A plated dish on marble → `Restaurant Menu, New Dish, Food Photography, Fine Dining`

Do not ask a clarifying question first. Send the call, show the designs, and adjust from
what they say about real results — a person judges a picture faster than a question.

### 2. Get the photos somewhere the renderer can reach

Our renderer fetches images over the network. **A local path can never be used.**

If the photos are already public URLs, pass them straight through. If they are files on
the person's machine — the normal case — call `upload_images` first. It costs nothing and
needs no account.

**If you can run a shell, use the link route.** Ask for one link per photo, PUT each file,
then pass the matching `publicUrl`s on:

```
upload_images { "count": 3, "mimeType": "image/jpeg" }
```
```bash
curl -X PUT -T ./photo1.jpg -H 'Content-Type: image/jpeg' "<uploadUrl>"
```

**If you have no shell**, send the bytes instead — read each file and pass it base64 in
`files`, and the reply gives you a `publicUrl` per photo with nothing to run:

```
upload_images { "files": [{ "data": "<base64>", "mimeType": "image/jpeg" }] }
```

Prefer the link route whenever it is available. A full-size photo is well over a hundred
thousand tokens once base64-encoded, which is more than a tool call should carry — the
bytes route is for small images and for clients that have no other option.

### 3. Make the designs

```
create_designs {
  "brief": "grand opening of a neighbourhood coffee shop",
  "images": ["https://…/a.jpg", "https://…/b.jpg", "https://…/c.jpg"],
  "text": ["Grand Opening", "Your new neighbourhood coffee shop"],
  "count": 5
}
```

**Always pass `text`.** A template ships with the designer's placeholder copy, and leaving
it means a coffee shop opening goes out reading whatever they typed while laying it out.
Write the lines yourself from the brief: headline first, then any supporting lines. Keep
the headline to a few words — templates are laid out for short lines, and long copy has to
be shrunk to fit.

Photos fill the template's slots **in the order given**, so pass them in the order they
should appear. Pass every photo you have: only templates that hold exactly that many are
used, so three photos means three-photo designs. `count` defaults to 5, caps at 10.
Optional `segment` (`story`, `carousel`, `invite`) narrows the shape.

Each option comes back with `imageUrl` (the finished design), `editorUrl` (where a person
opens it to keep editing), and `label`. Some options may carry `failed` instead — that
template alone did not render. Show the ones that worked; do not mention the ones that
did not unless nothing worked at all.

If the reply carries a `note`, no template in the catalogue took that many photos and the
designs are the closest fits, so some photos may be repeated or unused. Say so in one line
rather than presenting them as an exact match.

## Showing the results

The person cannot see an image inside a tool result. Your reply IS the gallery, so make
every design openable in one click:

```markdown
Five designs from your photos:

1. **Coffee Shop, Cafe Vibes** — [view design](https://…/scene.png) · [edit](https://zaps.design/templates/…/edit)
2. **Cafe Culture, Morning Light** — [view design](https://…/scene.png) · [edit](https://zaps.design/templates/…/edit)
```

- Always give both links. The image is the result; the `editorUrl` is how they take over
  and change it — a design they can see but not edit is half an answer.
- Bare URLs on their own line are clickable in every terminal; markdown links are
  clickable in most. Use markdown and keep each on its own line.
- Offer to open them: on macOS `open <url>`, on Linux `xdg-open <url>`. If they say yes,
  open the images, not the editor pages.
- If you can render images inline, do — but still print the links, because the person
  may want them later.

## What each plan gets

`create_designs` returns `entitlement`, and when fewer designs came back than were asked
for, an `upsell` sentence and the `requested` count.

| | Designs per call |
|---|---|
| No account | 1 |
| Signed in, free | 1 |
| Pro or Premium | up to 10 |

**Relay the `upsell` sentence as it is written.** It names the real number withheld. Do
not invent a figure, do not soften it, and do not present one design as though it were
the full set they asked for. Say it once, plainly, after the design:

> That's your free design. 4 more options for this brief are included with Pro —
> https://zaps.design/pricing

When `upsell` is absent, nothing was withheld: say nothing about plans.

## When something fails

| What you see | What it means | What to do |
|---|---|---|
| `401` with `WWW-Authenticate` | The free design is used up | Tell them signing in continues, then follow the challenge |
| `403 insufficient_scope` | The token lacks this scope | Re-authorize including the scope the challenge names |
| `isError` with "no templates matched" | The brief was too thin | Rewrite it as a fuller sentence about the finished piece and retry once |
| An option carries `failed` | That one template would not render | Ignore it; the others stand |
| Every option failed | Our renderer | Say so plainly and retry once, then stop |

`matchedBy: "text"` means the ranking model was unavailable and matches are weaker. Say
so rather than presenting them as the best available.

Never invent a `coverId` or an image URL. Only ids and urls the server returned are real.

## The other two tools

`create_designs` is the path. The two steps behind it are also exposed, for when you want
to pick the template yourself: `search_templates` ranks the catalogue for a sentence and
returns a `coverId` each, and `fill_template` renders one of those with your photos. They
cost the same as doing it in one call and give you no more control over the result, so
reach for them only when someone asks to choose.

## Without MCP

The same operations are plain REST at `https://api.zaps.design`, authenticated with an
account API key in `Authorization: Bearer zak_…`:

| | |
|---|---|
| `POST /api/v1/agentic/designs` | `{brief, images, count, segment}` — the whole job |
| `POST /api/v1/agentic/search` | `{query, limit, segment}` — ranked templates |
| `POST /api/v1/agentic/fill` | `{coverId, images}` — render one template |

A key is minted by the account holder from a signed-in session
(`POST /api/v1/agentic/keys`); there is no way to self-issue one, which is why MCP is the
better path for a first-time user. Full reference: https://zaps.design/docs/api
