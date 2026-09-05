# Trading Card Collector — Card Studio v0.1.1

Mobile-first master card authoring tool for the Trading Card Collector game.

## Working in this build
- Add Card flow
- NBA-first metadata entry
- iPhone image upload from Photos/camera
- touch drag positioning
- two-finger pinch zoom
- live finished-card preview
- rendered static 750×1050 PNG
- deterministic card IDs and repository paths
- live catalogue loaded from `data/cards.json`
- direct GitHub publishing from the Card Studio
- one atomic commit writes both the finished PNG and updated catalogue to `main`

## Direct publishing
GitHub Pages cannot safely contain a permanent repository credential in its source code. Card Studio therefore asks once for a fine-grained GitHub personal access token on the device being used to create cards.

The token should be limited to the `Swoop081/trading-card-collector` repository and needs **Contents: Read and write** permission. The token is saved only in that browser's localStorage and is never committed to the repository.

After this one-time setup, every `EXPORT TO GAME` action automatically:
1. renders the finished card to PNG,
2. reads the current `data/cards.json`,
3. adds or updates the card metadata,
4. creates Git blobs for the PNG and catalogue,
5. creates one Git tree and one commit,
6. advances `main` to that commit.

This makes the exported card a permanent master asset inherited by fresh game sessions.

## Repository paths
Finished card images are stored under:

`assets/cards/<sport>/<set-year>/<card>.png`

The master catalogue is:

`data/cards.json`

## Security note
Use a fine-grained token restricted to this repository only. Do not use a classic token with broad account access. Clearing site data on the phone removes the saved token and causes Card Studio to ask for it again on the next export.
