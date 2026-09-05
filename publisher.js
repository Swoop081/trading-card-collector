const TCC_GITHUB = {
  owner: "Swoop081",
  repo: "trading-card-collector",
  branch: "main",
  tokenKey: "tcc-github-token"
};

function ghHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

async function ghFetch(path, token, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { ...ghHeaders(token), ...(options.headers || {}) }
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message ? `: ${body.message}` : "";
    } catch {}
    throw new Error(`GitHub ${res.status}${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

function decodeGitHubText(base64) {
  const binary = atob(String(base64 || "").replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function dataUrlBase64(dataUrl) {
  const marker = ";base64,";
  const at = dataUrl.indexOf(marker);
  if (at < 0) throw new Error("Card image is not a base64 PNG.");
  return dataUrl.slice(at + marker.length);
}

function getSavedToken() {
  return localStorage.getItem(TCC_GITHUB.tokenKey) || "";
}

function saveToken(token) {
  localStorage.setItem(TCC_GITHUB.tokenKey, token.trim());
}

function clearToken() {
  localStorage.removeItem(TCC_GITHUB.tokenKey);
}

async function requestToken() {
  let token = getSavedToken();
  if (token) return token;

  token = window.prompt(
    "One-time GitHub setup: paste a fine-grained token with Contents: Read and write access to Swoop081/trading-card-collector. It will be stored only in this browser on this device."
  ) || "";
  token = token.trim();
  if (!token) throw new Error("GitHub access is required before exporting.");

  const repo = await ghFetch(`/repos/${TCC_GITHUB.owner}/${TCC_GITHUB.repo}`, token);
  if (!repo?.permissions?.push && repo?.permissions?.admin !== true) {
    throw new Error("This token does not have write access to the trading-card-collector repository.");
  }
  saveToken(token);
  return token;
}

async function readCatalogue(token) {
  const file = await ghFetch(`/repos/${TCC_GITHUB.owner}/${TCC_GITHUB.repo}/contents/data/cards.json?ref=${encodeURIComponent(TCC_GITHUB.branch)}`, token);
  const parsed = JSON.parse(decodeGitHubText(file.content));
  return Array.isArray(parsed) ? parsed : (Array.isArray(parsed.cards) ? parsed.cards : []);
}

async function createBlob(token, content, encoding) {
  return ghFetch(`/repos/${TCC_GITHUB.owner}/${TCC_GITHUB.repo}/git/blobs`, token, {
    method: "POST",
    body: JSON.stringify({ content, encoding })
  });
}

async function publishAtomic(payload, token) {
  const { metadata, imageDataUrl, target } = payload;
  const branch = target?.branch || TCC_GITHUB.branch;

  const ref = await ghFetch(`/repos/${TCC_GITHUB.owner}/${TCC_GITHUB.repo}/git/ref/heads/${encodeURIComponent(branch)}`, token);
  const parentSha = ref.object.sha;
  const parentCommit = await ghFetch(`/repos/${TCC_GITHUB.owner}/${TCC_GITHUB.repo}/git/commits/${parentSha}`, token);

  const catalogue = await readCatalogue(token);
  const existing = catalogue.findIndex(card => card.id === metadata.id);
  if (existing >= 0) catalogue[existing] = metadata;
  else catalogue.push(metadata);

  catalogue.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  const catalogueText = JSON.stringify(catalogue, null, 2) + "\n";

  const [imageBlob, catalogueBlob] = await Promise.all([
    createBlob(token, dataUrlBase64(imageDataUrl), "base64"),
    createBlob(token, catalogueText, "utf-8")
  ]);

  const tree = await ghFetch(`/repos/${TCC_GITHUB.owner}/${TCC_GITHUB.repo}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({
      base_tree: parentCommit.tree.sha,
      tree: [
        { path: target.imagePath, mode: "100644", type: "blob", sha: imageBlob.sha },
        { path: target.cataloguePath, mode: "100644", type: "blob", sha: catalogueBlob.sha }
      ]
    })
  });

  const commit = await ghFetch(`/repos/${TCC_GITHUB.owner}/${TCC_GITHUB.repo}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({
      message: `Add card: ${metadata.name}${metadata.cardNumber ? ` #${metadata.cardNumber}` : ""}`,
      tree: tree.sha,
      parents: [parentSha]
    })
  });

  await ghFetch(`/repos/${TCC_GITHUB.owner}/${TCC_GITHUB.repo}/git/refs/heads/${encodeURIComponent(branch)}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false })
  });

  return { mode: "github", commit: commit.sha, imagePath: target.imagePath };
}

window.CardPublisher = {
  config: TCC_GITHUB,
  getSavedToken,
  clearToken,

  async connect() {
    const token = await requestToken();
    await ghFetch(`/repos/${TCC_GITHUB.owner}/${TCC_GITHUB.repo}`, token);
    return true;
  },

  async publish(payload) {
    let token = await requestToken();
    try {
      return await publishAtomic(payload, token);
    } catch (err) {
      if (/GitHub 401|GitHub 403/.test(String(err?.message || ""))) clearToken();
      throw err;
    }
  }
};
