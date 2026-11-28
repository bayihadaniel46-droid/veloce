const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { user: null, config: null, listings: [], snippets: [], selected: null, category: "", query: "", authMode: "register", accountTab: "library", pendingPizCode: null, orderKeys: new Map(), page: "home", preferences: { theme: "emerald", compact: false, reduceMotion: false } };
const preferencesKey = "forgemarket.preferences.v1";
const categoryNames = { "3d": "Templates 3D", code: "Scripts & code", assets: "Game assets", licenses: "Licences", projects: "Projets", audio: "Audio", other: "Autre" };
const currency = (value) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(Number(value) || 0);
const dateText = (value) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
const entriesToObject = (entries) => {
  const result = {};
  for (const [key, value] of entries) result[key] = value;
  return result;
};

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("visible");
  setTimeout(() => node.classList.remove("visible"), 3600);
}
async function api(url, options = {}) {
  const apiUrl = url.startsWith("/api/") ? `/api/forge-market${url.slice(4)}` : url;
  const response = await fetch(apiUrl, { credentials: "same-origin", ...options,
    headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) } });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Une erreur est survenue.");
  return data;
}
function setUser(user) {
  state.user = user || null;
  $("#loginTop").classList.toggle("hidden", Boolean(user));
  $("#accountTop").classList.toggle("hidden", !user);
  $("#sellTop").textContent = user ? "Vendre une création ↗" : "Vendre une création ↗";
  $("#settingsAccountState").textContent = user ? `${user.displayName} · ${user.email}` : "Connecte-toi pour gérer tes achats et annonces.";
  if (user) {
    $("#avatarInitial").textContent = user.displayName.slice(0, 1).toUpperCase();
    $("#accountAvatar").textContent = user.displayName.slice(0, 1).toUpperCase();
    $("#accountName").textContent = user.displayName;
    $("#accountEmail").textContent = user.email;
  }
}

function pageFromLocation() {
  return window.location.pathname.replace(/\/+$/, "") === "/forge-market/vitrine" ? "vitrine" : "home";
}
function navigatePage(page, { push = true, scroll = true } = {}) {
  const nextPage = page === "vitrine" ? "vitrine" : "home";
  const nextPath = nextPage === "vitrine" ? "/forge-market/vitrine" : "/forge-market/";
  state.page = nextPage;
  document.body.dataset.page = nextPage;
  $$('[data-view]').forEach((section) => section.classList.toggle("hidden", section.dataset.view !== nextPage));
  $$('[data-route]').forEach((link) => {
    const active = link.dataset.route === nextPage;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  $(".main-nav").classList.remove("mobile-open");
  if (push && window.location.pathname !== nextPath) history.pushState({ page: nextPage }, "", nextPath);
  document.title = nextPage === "vitrine"
    ? "La Vitrine — ForgeMarket"
    : "ForgeMarket — créations numériques, sans compromis";
  if (scroll) window.scrollTo({ top: 0, behavior: state.preferences.reduceMotion ? "auto" : "smooth" });
}

function applyPreferences() {
  document.body.dataset.theme = state.preferences.theme === "amethyst" ? "amethyst" : "emerald";
  document.body.classList.toggle("compact-mode", Boolean(state.preferences.compact));
  document.body.classList.toggle("reduce-motion", Boolean(state.preferences.reduceMotion));
  $$('[data-theme-choice]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.themeChoice === document.body.dataset.theme)));
  $("#compactSetting").checked = Boolean(state.preferences.compact);
  $("#motionSetting").checked = Boolean(state.preferences.reduceMotion);
}
function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey) || "{}");
    state.preferences = {
      theme: saved.theme === "amethyst" ? "amethyst" : "emerald",
      compact: saved.compact === true,
      reduceMotion: saved.reduceMotion === true,
    };
  } catch { /* Utiliser les réglages par défaut si le stockage est indisponible. */ }
  applyPreferences();
}
function savePreferences() {
  try { localStorage.setItem(preferencesKey, JSON.stringify(state.preferences)); }
  catch { $("#settingsSaved").textContent = "Le navigateur n’a pas pu enregistrer ces préférences."; return; }
  $("#settingsSaved").textContent = "Préférences enregistrées automatiquement";
  applyPreferences();
}
function openSettings() {
  applyPreferences();
  $("#settingsDialog").showModal();
}
async function loadSession() {
  try {
    const { user } = await api("/api/auth/me");
    setUser(user);
    await updateLibraryCount();
  } catch { setUser(null); }
}

function createProductCard(item, index) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.style.setProperty("--card-order", index);
  const visualButton = document.createElement("button");
  visualButton.type = "button";
  visualButton.className = `product-visual visual-${item.category}`;
  visualButton.setAttribute("aria-label", `Voir l’aperçu de ${item.title}`);
  if (item.previewUrl) {
    const image = document.createElement("img");
    image.src = item.previewUrl; image.alt = `Aperçu de ${item.title}`; image.loading = "lazy";
    visualButton.append(image);
  } else {
    visualButton.innerHTML = `<span class="visual-orbit"></span><span class="visual-glyph">${item.category === "code" ? "⌘" : item.category === "audio" ? "≋" : "✳"}</span>`;
  }
  const badge = document.createElement("span"); badge.className = "preview-badge"; badge.textContent = "APERÇU · SOURCE PRIVÉE";
  visualButton.append(badge);
  const view = document.createElement("span"); view.className = "view-mark"; view.textContent = "↗"; visualButton.append(view);
  visualButton.addEventListener("click", () => openProduct(item.id));
  const content = document.createElement("div"); content.className = "product-content";
  const meta = document.createElement("div"); meta.className = "product-meta";
  const category = document.createElement("span"); category.className = "category-label"; category.textContent = categoryNames[item.category] || "Ressource";
  const sales = document.createElement("span"); sales.className = "sales-label"; sales.textContent = `${item.salesCount || 0} vente${item.salesCount === 1 ? "" : "s"}`;
  meta.append(category, sales);
  const title = document.createElement("h3"); title.textContent = item.title;
  const summary = document.createElement("p"); summary.className = "product-summary"; summary.textContent = item.summary;
  const foot = document.createElement("div"); foot.className = "product-foot";
  const seller = document.createElement("span"); seller.className = "seller-name"; seller.innerHTML = `<span class="seller-dot"></span>`; seller.append(document.createTextNode(item.seller));
  const price = document.createElement("strong"); price.className = "product-price"; price.innerHTML = `${currency(item.pricePiz)} <i>PIZ</i>`;
  foot.append(seller, price); content.append(meta, title, summary, foot); card.append(visualButton, content);
  return card;
}

async function loadCatalog() {
  const grid = $("#catalogGrid");
  grid.innerHTML = '<div class="catalog-loading"><span class="loader"></span> Recherche dans les vitrines…</div>';
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.category) params.set("category", state.category);
  try {
    const data = await api(`/api/listings?${params}`);
    state.listings = data.listings || [];
    grid.replaceChildren(...state.listings.map(createProductCard));
    $("#resultCount").textContent = `${String(state.listings.length).padStart(2, "0")} RESSOURCE${state.listings.length === 1 ? "" : "S"}`;
    $("#emptyCatalog").classList.toggle("hidden", state.listings.length > 0);
  } catch (error) {
    grid.innerHTML = `<div class="catalog-error">${escapeHtml(error.message)} <button id="retryCatalog" class="text-button" type="button">Réessayer ↻</button></div>`;
    $("#retryCatalog").addEventListener("click", loadCatalog);
    $("#emptyCatalog").classList.add("hidden");
  }
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]); }

function createSnippetCard(snippet) {
  const card = document.createElement("article");
  card.className = "snippet-card";
  const head = document.createElement("div"); head.className = "snippet-card-head";
  const titleWrap = document.createElement("div"); titleWrap.className = "snippet-card-title";
  const title = document.createElement("strong"); title.textContent = snippet.title;
  const author = document.createElement("small"); author.textContent = `${snippet.creator} · ${dateText(snippet.createdAt)}`;
  titleWrap.append(title, author);
  const language = document.createElement("span"); language.className = "snippet-language"; language.textContent = snippet.language;
  head.append(titleWrap, language);
  const pre = document.createElement("pre"); pre.className = "snippet-code";
  const code = document.createElement("code"); code.textContent = snippet.code; pre.append(code);
  const foot = document.createElement("div"); foot.className = "snippet-card-foot";
  const note = document.createElement("span"); note.textContent = "EXTRAIT PUBLIC · GRATUIT";
  const copy = document.createElement("button"); copy.className = "snippet-copy"; copy.type = "button"; copy.textContent = "Copier le code";
  copy.addEventListener("click", async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(snippet.code);
      else {
        const temporary = document.createElement("textarea"); temporary.value = snippet.code;
        temporary.setAttribute("readonly", ""); temporary.style.position = "fixed"; temporary.style.opacity = "0";
        document.body.append(temporary); temporary.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
        temporary.remove();
      }
      toast("Code copié dans le presse-papiers.");
    } catch { toast("La copie a échoué. Sélectionne le code pour le copier."); }
  });
  foot.append(note, copy); card.append(head, pre, foot);
  return card;
}
async function loadSnippets() {
  const grid = $("#snippetGrid");
  grid.innerHTML = '<div class="catalog-loading"><span class="loader"></span> Chargement des extraits…</div>';
  try {
    const data = await api("/api/snippets");
    state.snippets = data.snippets || [];
    grid.replaceChildren(...state.snippets.map(createSnippetCard));
    $("#emptySnippets").classList.toggle("hidden", state.snippets.length > 0);
  } catch (error) {
    grid.innerHTML = `<div class="catalog-error">${escapeHtml(error.message)} <button id="retrySnippets" class="text-button" type="button">Réessayer ↻</button></div>`;
    $("#retrySnippets").addEventListener("click", loadSnippets);
    $("#emptySnippets").classList.add("hidden");
  }
}
function openSnippetComposer() {
  if (!state.user) { openAuth("register"); toast("Crée ton compte pour publier un extrait."); return; }
  $("#snippetError").textContent = "";
  $("#snippetForm").reset();
  $("#snippetCharCount").textContent = "0 / 8 000";
  $("#snippetDialog").showModal();
}

function openAuth(mode = "register") {
  state.authMode = mode;
  updateAuthMode();
  $("#authError").textContent = "";
  $("#authDialog").showModal();
}
function updateAuthMode() {
  const register = state.authMode === "register";
  $("#nameField").classList.toggle("hidden", !register);
  $("#authForm [name=displayName]").required = register;
  $("#authForm [name=password]").autocomplete = register ? "new-password" : "current-password";
  $("#authTitle").innerHTML = register ? "Entre dans<br><em>le marché.</em>" : "Ravi de te<br><em>revoir.</em>";
  $("#authIntro").textContent = register ? "Crée ton espace pour acheter, vendre et garder tes projets numériques." : "Connecte-toi à ton espace Piston.";
  $("#authSubmit").innerHTML = register ? "Créer mon compte <span>→</span>" : "Me connecter <span>→</span>";
  $$(".auth-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.mode === state.authMode));
}

async function openProduct(id) {
  try {
    const data = await api(`/api/listings/${encodeURIComponent(id)}`);
    state.selected = data.listing;
    renderProductDetail(data.listing);
    $("#productDialog").showModal();
  } catch (error) { toast(error.message); }
}
function renderProductDetail(item) {
  const root = $("#productDetail");
  root.replaceChildren();
  const visual = document.createElement("div"); visual.className = `detail-visual visual-${item.category}`;
  if (item.previewUrl) { const image = document.createElement("img"); image.src = item.previewUrl; image.alt = `Aperçu visuel de ${item.title}`; visual.append(image); }
  const protectedMark = document.createElement("span"); protectedMark.className = "detail-protected"; protectedMark.innerHTML = "◈ APERÇU PROTÉGÉ <b>FICHIERS SOURCE MASQUÉS</b>"; visual.append(protectedMark);
  const body = document.createElement("div"); body.className = "detail-body";
  const label = document.createElement("div"); label.className = "eyebrow"; label.innerHTML = `<span class="eyebrow-mark">${escapeHtml(categoryNames[item.category] || "RESSOURCE")}</span> CRÉATION NUMÉRIQUE`;
  const title = document.createElement("h2"); title.textContent = item.title;
  const seller = document.createElement("p"); seller.className = "detail-byline"; seller.textContent = `Créé par ${item.seller} · ${item.salesCount || 0} vente${item.salesCount === 1 ? "" : "s"}`;
  const description = document.createElement("p"); description.className = "detail-description"; description.textContent = item.description;
  const specs = document.createElement("div"); specs.className = "detail-specs";
  [["LOGICIEL",item.software || "Non précisé"],["VERSION",item.version || "—"],["LIVRAISON","Archive ZIP privée"],["TAILLE",`${(item.fileSize/1024/1024).toFixed(1)} Mo`]].forEach(([name,value]) => { const cell=document.createElement("div");cell.innerHTML=`<small>${escapeHtml(name)}</small><strong>${escapeHtml(value)}</strong>`;specs.append(cell); });
  if (item.tags?.length) { const tags=document.createElement("div");tags.className="detail-tags";item.tags.forEach(tag=>{const chip=document.createElement("span");chip.textContent=tag;tags.append(chip);}); body.append(tags); }
  const note = document.createElement("div"); note.className = "source-seal"; note.innerHTML = '<span>▣</span><p><strong>Le contenu source reste privé.</strong><small>Tu vois les rendus et les informations du projet. Le fichier ZIP n’est livré qu’après le paiement en PIZ.</small></p>';
  if (item.isDrop) { const drop = document.createElement("div"); drop.className = "drop-seal"; drop.textContent = `✦ DROP COLLECTOR · ${item.dropRemaining} exemplaire${item.dropRemaining === 1 ? "" : "s"} · PIZ uniquement`; body.append(drop); }
  const checkout = document.createElement("div"); checkout.className = "detail-checkout";
  const price = document.createElement("div"); price.innerHTML = `<small>PRIX FIXE${item.isDrop ? " · DROP PIZ" : ""}</small><strong>${currency(item.pricePiz)} <i>PIZ</i></strong>${!item.isDrop ? `<small class="cash-equivalent">≈ ${currency(item.priceXaf)} FCFA</small>` : ""}`;
  const buy = document.createElement("button"); buy.className = "button button-primary"; buy.type = "button"; buy.innerHTML = "Acheter en PIZ <span>→</span>"; buy.addEventListener("click", () => buyListing(item));
  checkout.append(price,buy);
  if (!item.isDrop && state.config?.cashPaymentsAvailable) { const cash=document.createElement("button");cash.className="button button-outline cash-buy";cash.type="button";cash.textContent=`Payer en FCFA · ${currency(item.priceXaf)}`;cash.addEventListener("click",()=>openCashCheckout(item));checkout.append(cash); }
  body.append(label,title,seller,description,specs,note,checkout); root.append(visual,body);
}

async function openCashCheckout(item) {
  if (!state.user) { openAuth("register"); toast("Crée ton compte marketplace pour poursuivre."); return; }
  try {
    const payment = await api("/api/purchases/cash", { method: "POST", body: JSON.stringify({ listingId: item.id }) });
    let dialog = $("#cashPaymentDialog");
    if (!dialog) {
      dialog = document.createElement("dialog"); dialog.id = "cashPaymentDialog"; dialog.className = "modal cash-modal";
      dialog.innerHTML = '<form method="dialog" class="modal-close"><button aria-label="Fermer">×</button></form><div class="modal-kicker">PAIEMENT XAF · MTN MOMO</div><h2>Confirme ton<br><em>transfert.</em></h2><p class="modal-intro" id="cashInstructions"></p><div class="cash-summary"><small>À ENVOYER</small><strong id="cashAmount"></strong><span id="cashRecipient"></span><p id="cashFee"></p></div><form id="cashReferenceForm" class="form-stack"><label>RÉFÉRENCE DE TRANSACTION MTN<input name="reference" required minlength="6" maxlength="80" autocomplete="off" placeholder="Ex. 123456789ABC"></label><p id="cashError" class="form-error" role="alert"></p><button class="button button-primary full-button" type="submit">Envoyer la référence <span>→</span></button></form><p class="modal-footnote">Commission monnaie : 5 %. Le fichier reste verrouillé jusqu’à validation manuelle du paiement par l’administrateur.</p>';
      document.body.append(dialog);
    }
    $("#cashInstructions", dialog).textContent = payment.instructions;
    $("#cashAmount", dialog).textContent = `${currency(payment.amountXaf)} FCFA`;
    $("#cashRecipient", dialog).textContent = `Destinataire MTN : ${payment.recipient}`;
    $("#cashFee", dialog).textContent = `Commission 5 % : ${currency(payment.feeXaf)} FCFA · vendeur : ${currency(payment.sellerNetXaf)} FCFA`;
    const form = $("#cashReferenceForm", dialog); form.reset(); $("#cashError", dialog).textContent = "";
    form.onsubmit = async (event) => {
      event.preventDefault(); const button = $("button[type=submit]", form); button.disabled = true;
      try { const result = await api(`/api/purchases/cash/${encodeURIComponent(payment.orderId)}/reference`, { method: "POST", body: JSON.stringify({ reference: new FormData(form).get("reference") }) }); dialog.close(); $("#productDialog").close(); toast(result.message); }
      catch (error) { $("#cashError", dialog).textContent = error.message; }
      finally { button.disabled = false; }
    };
    dialog.showModal();
  } catch (error) { toast(error.message); }
}

async function buyListing(item) {
  if (!state.user) { $("#productDialog").close(); openAuth("register"); toast("Crée ton compte pour poursuivre l’achat."); return; }
  if (!state.user.pizLinked) { toast("Relie ton compte PIZ pour régler cet achat."); await startPizLink(); return; }
  const button = $(".detail-checkout .button", $("#productDetail"));
  button.disabled = true; button.textContent = "Paiement PIZ sécurisé…";
  const requestId = state.orderKeys.get(item.id) || crypto.randomUUID(); state.orderKeys.set(item.id, requestId);
  try {
    const data = await api("/api/purchases", { method: "POST", body: JSON.stringify({ listingId: item.id, requestId }) });
    state.orderKeys.delete(item.id); $("#productDialog").close(); toast(data.message || "Ressource ajoutée à ton coffre.");
    await updateLibraryCount(); openAccount("library");
  } catch (error) {
    button.disabled = false; button.innerHTML = "Acheter en PIZ <span>→</span>"; toast(error.message);
  }
}

async function startPizLink() {
  if (!state.user) { openAuth("register"); return; }
  try {
    const userId = window.prompt("Entre l’ID personnel affiché dans ton compte PIZ :");
    if (!userId) return;
    const password = window.prompt("Confirme le mot de passe de ce compte PIZ. Il est vérifié par PIZ et n’est pas enregistré dans ForgeMarket :");
    if (!password) return;
    const data = await api("/api/auth/piz/link-id", { method: "POST", body: JSON.stringify({ userId: userId.trim(), password }) });
    setUser(data.user); await loadAccountWallet();
    toast(`Portefeuille PIZ ${data.username} relié à ForgeMarket.`);
  } catch (error) { toast(error.message); }
}
async function completePizCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("pizCode"); const stateToken = params.get("state");
  if (!code || !stateToken) return;
  state.pendingPizCode = { code, state: stateToken };
  if (!state.user) { openAuth("login"); toast("Connecte-toi pour terminer la liaison sécurisée avec PIZ."); return; }
  try {
    const data = await api("/api/auth/piz/complete", { method: "POST", body: JSON.stringify(state.pendingPizCode) });
    setUser(data.user); state.pendingPizCode = null;
    history.replaceState({}, "", window.location.pathname);
    toast("Portefeuille PIZ relié. Les achats et ventes sont maintenant disponibles.");
    await updateLibraryCount();
  } catch (error) { toast(error.message); }
}

async function updateLibraryCount() {
  if (!state.user) { $("#libraryCount").textContent = "0"; return; }
  try { const data = await api("/api/library"); $("#libraryCount").textContent = String(data.orders.length); }
  catch { $("#libraryCount").textContent = "·"; }
}

async function openAccount(tab = "library") {
  if (!state.user) { openAuth("login"); return; }
  state.accountTab = tab;
  $("#accountHeading").innerHTML = tab === "seller" ? "Ta vitrine<br><em>créateur.</em>" : "Ton coffre<br><em>et ta vitrine.</em>";
  $("#accountContent").innerHTML = '<div class="account-loading"><span class="loader"></span> Chargement de ton espace…</div>';
  $("#accountDialog").showModal();
  await Promise.all([loadAccountWallet(), renderAccountTab()]);
}
async function loadAccountWallet() {
  try {
    const data = await api("/api/account");
    $("#walletBalance").innerHTML = data.wallet ? `${currency(data.wallet.availableBalance)} <i>PIZ</i>` : "— <i>PIZ</i>";
    $("#pizStatus").textContent = data.user.pizLinked ? "PIZ relié" : "PIZ non relié";
    $("#pizStatus").classList.toggle("linked", data.user.pizLinked);
    $("#linkPizButton").textContent = data.user.pizLinked ? "Actualiser PIZ ↻" : "Relier PIZ ↗";
    let buyPiz = $("#buyPizLink");
    if (!buyPiz) { buyPiz = document.createElement("a"); buyPiz.id = "buyPizLink"; buyPiz.className = "button button-outline"; buyPiz.target = "_blank"; buyPiz.rel = "noopener noreferrer"; buyPiz.textContent = "Acheter des PIZ ↗"; $(".wallet-card").append(buyPiz); }
    buyPiz.href = state.config?.pizPublicUrl || "#";
    buyPiz.classList.toggle("hidden", !state.config?.pizPublicUrl);
  } catch (error) { $("#walletBalance").innerHTML = "Indisponible <i>PIZ</i>"; $("#pizStatus").textContent = state.user?.pizLinked ? "PIZ relié" : "PIZ non relié"; }
}
async function renderAccountTab() {
  const root = $("#accountContent");
  if (!root.dataset.downloadLinkBound) {
    root.dataset.downloadLinkBound = "1";
    root.addEventListener("click", async (event) => {
      const link = event.target.closest(".download-button");
      if (!link) return;
      event.preventDefault();
      const match = link.getAttribute("href")?.match(/^\/api\/library\/([^/]+)\/download$/);
      const orderId = link.dataset.orderId || match?.[1];
      if (!orderId) return toast("Achat introuvable.");
      link.setAttribute("aria-disabled", "true");
      try {
        const grant = await api(`/api/library/${encodeURIComponent(orderId)}/link`, { method: "POST", body: "{}" });
        window.location.assign(grant.downloadUrl);
      } catch (error) { toast(error.message); }
      finally { link.removeAttribute("aria-disabled"); }
    });
  }
  root.innerHTML = '<div class="account-loading"><span class="loader"></span> Chargement…</div>';
  try {
    if (state.accountTab === "library") {
      const { orders } = await api("/api/library");
      if (!orders.length) { root.innerHTML = '<div class="account-empty"><span>▧</span><strong>Ton coffre est prêt.</strong><p>Les créations achetées en PIZ apparaîtront ici avec leur archive téléchargeable.</p></div>'; return; }
      root.innerHTML = `<div class="library-list">${orders.map((order) => `<article class="library-item">${order.previewUrl ? `<img src="${escapeHtml(order.previewUrl)}" alt="" loading="lazy">` : '<span class="library-icon">✳</span>'}<div><strong>${escapeHtml(order.title)}</strong><small>${escapeHtml(order.seller)} · ${dateText(order.createdAt)}</small></div><a class="download-button" href="${escapeHtml(order.downloadUrl)}" title="Télécharger l’archive">↓</a></article>`).join("")}</div>`;
    } else {
      const { listings } = await api("/api/seller/listings");
      if (!listings.length) { root.innerHTML = '<div class="account-empty"><span>✳</span><strong>Ta vitrine commence ici.</strong><p>Publie un rendu et une archive. Les lignes de code et fichiers source resteront privés.</p><button id="accountCreateListing" class="button button-primary" type="button">Créer une annonce <span>→</span></button></div>'; $("#accountCreateListing").addEventListener("click",openSeller); return; }
      root.innerHTML = `<div class="seller-list">${listings.map((item) => `<article class="seller-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(categoryNames[item.category] || "Ressource")} · ${currency(item.pricePiz)} PIZ · ${item.salesCount || 0} vente(s)</small></div><span class="status-chip ${item.status}">${item.status === "published" ? "En ligne" : "Archivée"}</span><button class="archive-button" data-id="${escapeHtml(item.id)}" data-status="${item.status === "published" ? "archived" : "published"}" type="button">${item.status === "published" ? "Archiver" : "Republier"}</button></article>`).join("")}</div><button id="accountCreateListing" class="button button-outline add-listing-button" type="button">＋ Nouvelle annonce</button>`;
      $("#accountCreateListing").addEventListener("click",openSeller);
      $$(".archive-button",root).forEach((button) => button.addEventListener("click", async () => {
        try { await api(`/api/listings/${button.dataset.id}/status`, { method: "PATCH", body: JSON.stringify({ status: button.dataset.status }) }); await renderAccountTab(); await loadCatalog(); }
        catch (error) { toast(error.message); }
      }));
    }
  } catch (error) { root.innerHTML = `<div class="account-empty"><strong>${escapeHtml(error.message)}</strong></div>`; }
}

function openSeller() {
  navigatePage("vitrine");
  if (!state.user) { openAuth("register"); return; }
  if (!state.user.pizLinked) { toast("Relie d’abord ton portefeuille PIZ pour ouvrir ta vitrine."); startPizLink(); return; }
  $("#sellerError").textContent = "";
  $("#sellerDialog").showModal();
}
function bindUploadPreview(inputName, selector, placeholder) {
  const input = $(`#listingForm [name=${inputName}]`);
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    const label = $(`.upload-field:has([name=${inputName}]) .file-name`);
    label.textContent = file ? file.name : placeholder;
    if (inputName === "preview" && file) {
      const stage = $("#sellerPreviewStage");
      const image = $("img", stage); image.src = URL.createObjectURL(file); image.alt = "Prévisualisation privée de ton annonce";
      stage.classList.add("has-image");
    }
  });
}

function bindEvents() {
  const previewStage = document.createElement("button");
  previewStage.type = "button"; previewStage.id = "sellerPreviewStage"; previewStage.className = "seller-preview-stage";
  previewStage.setAttribute("aria-label", "Choisir et visualiser l’image publique du projet");
  previewStage.innerHTML = '<span class="preview-prompt"><b>APERÇU PUBLIC DU PROJET</b><small>Choisis une capture, un rendu ou une image de démonstration.<br>Le code source et l’archive restent masqués.</small></span><img alt="Aperçu public de la création">';
  const privateUpload = $("#listingForm .private-upload");
  if (privateUpload) privateUpload.before(previewStage);
  const dropOptions = document.createElement("div"); dropOptions.className = "drop-options";
  dropOptions.innerHTML = '<label class="drop-check"><input name="isDrop" type="checkbox" value="true"><span><b>Drop collector limité</b><small>Disponible uniquement en PIZ.</small></span></label><label class="drop-stock hidden">NOMBRE D’EXEMPLAIRES<input name="dropLimit" type="number" min="1" max="100000" step="1" placeholder="100"></label>';
  if (privateUpload) privateUpload.before(dropOptions);
  $("[name=isDrop]", dropOptions).addEventListener("change", (event) => {
    const stock = $(".drop-stock", dropOptions); stock.classList.toggle("hidden", !event.target.checked);
    $("[name=dropLimit]", stock).required = event.target.checked;
  });
  $$('[data-route]').forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault(); navigatePage(link.dataset.route);
  }));
  window.addEventListener("popstate", () => navigatePage(pageFromLocation(), { push: false }));
  $("#loginTop").addEventListener("click", () => openAuth("login"));
  ["#sellTop", "#heroSell", "#ctaSell", "#emptySell"].forEach((selector) => $(selector).addEventListener("click", openSeller));
  $("#sellMarket").addEventListener("click", openSeller);
  ["#shareCode", "#shareCodeBottom", "#emptyShareCode"].forEach((selector) => $(selector).addEventListener("click", openSnippetComposer));
  $("#settingsTop").addEventListener("click", openSettings);
  $$('[data-theme-choice]').forEach((button) => button.addEventListener("click", () => {
    state.preferences.theme = button.dataset.themeChoice === "amethyst" ? "amethyst" : "emerald";
    savePreferences();
  }));
  $("#compactSetting").addEventListener("change", (event) => { state.preferences.compact = event.target.checked; savePreferences(); });
  $("#motionSetting").addEventListener("change", (event) => { state.preferences.reduceMotion = event.target.checked; savePreferences(); });
  $("#settingsAccountButton").addEventListener("click", () => { $("#settingsDialog").close(); openAccount("library"); });
  $("#accountTop").addEventListener("click", () => openAccount("library"));
  $("#libraryNav").addEventListener("click", () => openAccount("library"));
  $("#linkPizButton").addEventListener("click", startPizLink);
  $("#logoutButton").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); setUser(null); $("#accountDialog").close(); toast("Tu es déconnecté."); });
  $$(".auth-tabs button").forEach((button) => button.addEventListener("click", () => { state.authMode = button.dataset.mode; updateAuthMode(); }));
  $$(".account-tabs button").forEach((button) => button.addEventListener("click", async () => {
    state.accountTab = button.dataset.accountTab;
    $$(".account-tabs button").forEach((item) => item.classList.toggle("active", item === button));
    $("#accountHeading").innerHTML = state.accountTab === "seller" ? "Ta vitrine<br><em>créateur.</em>" : "Ton coffre<br><em>et ta vitrine.</em>";
    await renderAccountTab();
  }));
  $("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault(); $("#authError").textContent = "";
    const form = new FormData(event.currentTarget);
    const body = entriesToObject(form.entries());
    const submit = $("#authSubmit"); submit.disabled = true; submit.textContent = "Connexion…";
    try {
      const { user } = await api(`/api/auth/${state.authMode}`, { method: "POST", body: JSON.stringify(body) });
      setUser(user); $("#authDialog").close(); event.currentTarget.reset(); await updateLibraryCount();
      if (state.pendingPizCode) await completePizCallback();
      else toast(state.authMode === "register" ? "Ton compte créateur est prêt." : "Bienvenue dans ForgeMarket.");
    } catch (error) { $("#authError").textContent = error.message; }
    finally { submit.disabled = false; updateAuthMode(); }
  });
  let searchTimer;
  $("#searchInput").addEventListener("input", (event) => { state.query = event.target.value.trim(); clearTimeout(searchTimer); searchTimer = setTimeout(loadCatalog, 250); });
  $$(".category-pill").forEach((button) => button.addEventListener("click", () => {
    state.category = button.dataset.category;
    $$(".category-pill").forEach((item) => item.classList.toggle("selected", item === button));
    loadCatalog();
  }));
  $("#sortButton").addEventListener("click", () => toast("Les annonces les plus récentes sont affichées en premier."));
  $$("[data-account-tab]").forEach((button) => button.classList.toggle("active", button.dataset.accountTab === state.accountTab));
  $("#listingForm").addEventListener("submit", async (event) => {
    event.preventDefault(); $("#sellerError").textContent = "";
    const form = event.currentTarget;
    const source = form.elements.source.files?.[0]; const preview = form.elements.preview.files?.[0];
    if (!source || !preview) { $("#sellerError").textContent = "Ajoute l’archive ZIP et son aperçu visuel."; return; }
    const body = new FormData(form); const button = $("#listingSubmit"); button.disabled = true; button.textContent = "Publication sécurisée…";
    try { await api("/api/listings", { method: "POST", body }); $("#sellerDialog").close(); form.reset(); $("#sellerPreviewStage").classList.remove("has-image"); toast("Ta vitrine est publiée. Le fichier source reste privé."); await loadCatalog(); await openAccount("seller"); }
    catch (error) { $("#sellerError").textContent = error.message; }
    finally { button.disabled = false; button.innerHTML = "Publier ma vitrine <span>→</span>"; }
  });
  $$("#listingForm input[type=file]").forEach((input) => input.addEventListener("change", () => {
    const file = input.files?.[0]; const label = input.closest(".upload-field").querySelector(".file-name");
    label.textContent = file ? file.name : input.name === "preview" ? "Choisir une capture ou un rendu" : "Choisir l’archive source .zip";
    if (input.name === "preview" && file) { const image=$("#sellerPreviewStage img"); image.src=URL.createObjectURL(file); $("#sellerPreviewStage").classList.add("has-image"); }
  }));
  $("#sellerPreviewStage").addEventListener("click", () => $("#listingForm [name=preview]").click());
  $("#mobileMenu").addEventListener("click", () => $(".main-nav").classList.toggle("mobile-open"));
  $("#snippetForm [name=code]").addEventListener("input", (event) => {
    $("#snippetCharCount").textContent = `${event.currentTarget.value.length.toLocaleString("fr-FR")} / 8 000`;
  });
  $("#snippetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $("#snippetSubmit");
    $("#snippetError").textContent = "";
    const fields = entriesToObject(new FormData(form).entries());
    button.disabled = true; button.textContent = "Publication…";
    try {
      await api("/api/snippets", { method: "POST", body: JSON.stringify(fields) });
      $("#snippetDialog").close(); form.reset(); $("#snippetCharCount").textContent = "0 / 8 000";
      toast("Ton extrait est publié dans la vitrine.");
      await loadSnippets();
    } catch (error) { $("#snippetError").textContent = error.message; }
    finally { button.disabled = false; button.innerHTML = "Publier l’extrait <span>→</span>"; }
  });
}

async function init() {
  loadPreferences();
  navigatePage(pageFromLocation(), { push: false, scroll: false });
  bindEvents();
  try { state.config = await api("/api/config"); $("#commissionLabel").textContent = "0 % en PIZ · 5 % en FCFA"; }
  catch { state.config = { commissionPercent: 0, cashCommissionPercent: 5, cashPaymentsAvailable: false, purchasesAvailable: false }; }
  await loadSession();
  await Promise.all([loadCatalog(), loadSnippets()]);
  await completePizCallback();
}
init();
