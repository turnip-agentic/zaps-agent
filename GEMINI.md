# Zaps

The `zaps` MCP server turns someone's photos into finished social-media designs —
stories, carousels, reel covers, invites. When they want something designed from their
own photos, follow the `zaps-design` skill: call `create_designs` with a brief you write
as Title Case phrases ("Birthday Party, Friends, Celebration, Confetti"), the photo URLs
and the words to put on the design. Photos on their machine go through `upload_images`
first. The first design needs no account; when a call asks for sign-in, a browser opens
for them to approve.
