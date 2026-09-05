# Trading Card Collector — Card Studio v0.1.0

Mobile-first master card authoring prototype.

## Working in this build
- Add Card flow
- NBA-first metadata entry
- iPhone image upload from Photos/camera
- touch drag positioning
- two-finger pinch zoom
- live finished-card preview
- rendered static 750×1050 PNG
- deterministic card IDs and repository paths
- export payload containing image + metadata + target `main` paths
- local master catalogue fallback for immediate testing

## Publishing architecture
The browser never contains a GitHub write token.

`publisher.js` sends one JSON payload to `window.CARD_STUDIO_PUBLISH_ENDPOINT` when configured. The secure publisher is responsible for:
1. decoding the PNG data URL,
2. writing the PNG to `assets/cards/...`,
3. appending/updating `data/cards.json`,
4. creating one commit on `main`,
5. returning the commit SHA.

Until the endpoint is configured, Export writes the same card metadata and PNG into localStorage so the complete authoring UI can be tested immediately.

## Next repository step
Create a dedicated repository (recommended name: `trading-card-collector`) with GitHub Pages on `main`, then add the secure publisher service/GitHub App connection.
