/**
 * Publishing adapter.
 *
 * GitHub Pages must never contain a GitHub write token. In production, set
 * window.CARD_STUDIO_PUBLISH_ENDPOINT to the HTTPS endpoint of the private
 * publisher service. It accepts the payload below and performs the GitHub
 * commit using server-side credentials/GitHub App auth.
 */
window.CardPublisher = {
  async publish(payload) {
    const endpoint = window.CARD_STUDIO_PUBLISH_ENDPOINT || "";
    if (!endpoint) {
      // v0.1.0 development mode: persist exactly what would be published so
      // the Card Studio and catalogue can be fully tested before the secure
      // GitHub bridge is attached.
      const local = JSON.parse(localStorage.getItem("tcc-master-catalogue") || "[]");
      local.push(payload.metadata);
      localStorage.setItem("tcc-master-catalogue", JSON.stringify(local));
      localStorage.setItem(`tcc-card-image:${payload.metadata.id}`, payload.imageDataUrl);
      return { mode: "local", commit: null };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Publish failed (${res.status})`);
    return res.json();
  }
};
