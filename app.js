const $ = (id) => document.getElementById(id);
const views = { library: $("libraryView"), editor: $("editorView") };
const canvas = $("cardCanvas");
const ctx = canvas.getContext("2d");
const gestureLayer = $("imageGestureLayer");

const state = {
  image: null,
  imageSrc: "",
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  pointers: new Map(),
  dragOrigin: null,
  pinchStart: null
};

const inputs = {
  sport: $("sportInput"), year: $("yearInput"), name: $("nameInput"), brand: $("brandInput"),
  set: $("setInput"), number: $("numberInput"), team: $("teamInput"), category: $("categoryInput")
};

function showView(name) {
  Object.values(views).forEach(v => v.classList.remove("active"));
  views[name].classList.add("active");
  if (name === "library") renderLibrary();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function slug(s) {
  return String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getMetadata() {
  const sport = inputs.sport.value || "NBA";
  const year = inputs.year.value.trim();
  const name = inputs.name.value.trim();
  const brand = inputs.brand.value.trim();
  const set = inputs.set.value.trim();
  const number = inputs.number.value.trim();
  const team = inputs.team.value.trim();
  const category = inputs.category.value.trim();
  const idParts = [sport, brand || set, year, number, name].filter(Boolean);
  const id = slug(idParts.join("-")) || `card-${Date.now()}`;
  const folder = ["assets/cards", slug(sport), slug(`${brand || set || "custom"}-${year || "undated"}`)].join("/");
  return {
    id, sport, year, name, brand, set, cardNumber: number, team, category,
    image: `${folder}/${slug(name || "card")}${number ? `-${slug(number)}` : ""}.png`,
    cardDimensions: { inches: "2.5x3.5", aspectRatio: "5:7", pixels: "750x1050" },
    createdAt: new Date().toISOString(), schemaVersion: 1
  };
}

function drawCard() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // The canvas itself is the finished trading card: 750×1050 px = 5:7,
  // matching the standard 2.5×3.5 inch trading-card proportions.
  ctx.fillStyle = "#20242d";
  ctx.fillRect(0, 0, W, H);

  if (state.image) {
    const img = state.image;
    const cover = Math.max(W / img.width, H / img.height);
    const dw = img.width * cover * state.scale;
    const dh = img.height * cover * state.scale;

    ctx.save();
    ctx.translate(W / 2 + state.x, H / 2 + state.y);
    ctx.rotate(state.rotation);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = "#7d8490";
    ctx.textAlign = "center";
    ctx.font = "700 30px -apple-system, sans-serif";
    ctx.fillText("CHOOSE CARD FROM PHOTOS", W / 2, H / 2);
  }
}

Object.values(inputs).forEach(input => input.addEventListener("input", drawCard));

$("imageInput").addEventListener("change", e => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => { state.image = img; state.imageSrc = reader.result; state.x = 0; state.y = 0; state.scale = 1; drawCard(); };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function localPoint(ev) {
  const r = gestureLayer.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

gestureLayer.addEventListener("pointerdown", e => {
  gestureLayer.setPointerCapture(e.pointerId);
  state.pointers.set(e.pointerId, localPoint(e));
  if (state.pointers.size === 1) state.dragOrigin = { p: localPoint(e), x: state.x, y: state.y };
  if (state.pointers.size === 2) {
    const pts = [...state.pointers.values()];
    state.pinchStart = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), scale: state.scale };
  }
});

gestureLayer.addEventListener("pointermove", e => {
  if (!state.pointers.has(e.pointerId)) return;
  state.pointers.set(e.pointerId, localPoint(e));
  const ratio = canvas.width / gestureLayer.getBoundingClientRect().width;
  if (state.pointers.size === 1 && state.dragOrigin) {
    const p = [...state.pointers.values()][0];
    state.x = state.dragOrigin.x + (p.x - state.dragOrigin.p.x) * ratio;
    state.y = state.dragOrigin.y + (p.y - state.dragOrigin.p.y) * ratio;
  } else if (state.pointers.size === 2 && state.pinchStart) {
    const pts = [...state.pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    state.scale = Math.max(.35, Math.min(5, state.pinchStart.scale * (dist / state.pinchStart.dist)));
  }
  drawCard();
});

function endPointer(e) {
  state.pointers.delete(e.pointerId);
  if (state.pointers.size < 2) state.pinchStart = null;
  if (state.pointers.size === 0) state.dragOrigin = null;
}
gestureLayer.addEventListener("pointerup", endPointer);
gestureLayer.addEventListener("pointercancel", endPointer);

$("fitBtn").addEventListener("click", () => { state.scale = 1; state.x = 0; state.y = 0; drawCard(); });
$("resetBtn").addEventListener("click", () => { state.scale = 1; state.x = 0; state.y = 0; state.rotation = 0; drawCard(); });

async function loadCatalogue() {
  try {
    const res = await fetch(`data/cards.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Catalogue ${res.status}`);
    const parsed = await res.json();
    const cards = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.cards) ? parsed.cards : []);
    localStorage.setItem("tcc-catalogue-cache", JSON.stringify(cards));
    return cards;
  } catch {
    return JSON.parse(localStorage.getItem("tcc-catalogue-cache") || "[]");
  }
}

async function renderLibrary() {
  const cards = await loadCatalogue();
  $("cardGrid").innerHTML = "";
  $("emptyState").style.display = cards.length ? "none" : "block";
  $("cardGrid").style.display = cards.length ? "grid" : "none";
  $("catalogueStats").innerHTML = `<div class="stat"><b>${cards.length}</b><span>Total cards</span></div><div class="stat"><b>${new Set(cards.map(c => c.sport)).size}</b><span>Sports</span></div><div class="stat"><b>${new Set(cards.map(c => `${c.brand}|${c.set}|${c.year}`)).size}</b><span>Sets</span></div>`;

  [...cards].reverse().forEach(card => {
    const el = document.createElement("article");
    el.className = "catalogue-card";
    const image = card.image ? `${card.image}?v=${encodeURIComponent(card.createdAt || "1")}` : "";
    el.innerHTML = `${image ? `<img src="${image}" alt="${card.name}">` : ""}<h3>${card.name || "Untitled Card"}</h3><p>${[card.year, card.brand || card.set, card.cardNumber ? `#${card.cardNumber}` : ""].filter(Boolean).join(" • ")}</p>`;
    $("cardGrid").appendChild(el);
  });
}

function resetEditor() {
  $("cardForm").reset();
  inputs.sport.value = "NBA";
  state.image = null; state.imageSrc = ""; state.x = 0; state.y = 0; state.scale = 1; state.rotation = 0;
  $("imageInput").value = "";
  $("publishMessage").textContent = "";
  $("publishTarget").textContent = window.CardPublisher.getSavedToken() ? "GitHub main • connected" : "GitHub main • first export needs one-time access";
  drawCard();
}

function startNew() {
  resetEditor();
  showView("editor");
  setTimeout(() => inputs.name.focus(), 150);
}

$("addCardBtn").onclick = startNew;
$("heroAddBtn").onclick = startNew;
$("emptyAddBtn").onclick = startNew;
$("backBtn").onclick = () => showView("library");

$("cardForm").addEventListener("submit", async e => {
  e.preventDefault();
  const metadata = getMetadata();
  if (!metadata.name) {
    $("publishMessage").textContent = "Enter a player/card name first.";
    inputs.name.focus();
    return;
  }
  if (!state.image) {
    $("publishMessage").textContent = "Choose a card image from Photos first.";
    return;
  }

  drawCard();
  const imageDataUrl = canvas.toDataURL("image/png");
  $("exportBtn").disabled = true;
  $("publishMessage").textContent = "Publishing card to main…";

  try {
    const result = await window.CardPublisher.publish({
      metadata,
      imageDataUrl,
      target: { branch: "main", imagePath: metadata.image, cataloguePath: "data/cards.json" }
    });

    const cached = JSON.parse(localStorage.getItem("tcc-catalogue-cache") || "[]");
    const at = cached.findIndex(card => card.id === metadata.id);
    if (at >= 0) cached[at] = metadata; else cached.push(metadata);
    localStorage.setItem("tcc-catalogue-cache", JSON.stringify(cached));

    $("publishTarget").textContent = "GitHub main • connected";
    $("publishMessage").textContent = `Published to main • ${String(result.commit).slice(0, 7)}`;
    setTimeout(() => showView("library"), 900);
  } catch (err) {
    $("publishMessage").textContent = err.message || "Export failed.";
  } finally {
    $("exportBtn").disabled = false;
  }
});

drawCard();
renderLibrary();
