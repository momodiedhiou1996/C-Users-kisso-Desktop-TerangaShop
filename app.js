/*
  SunuMarket - prototype de marketplace (front-only)
  Utilise localStorage pour simuler les comptes, boutiques et produits.
*/

const STORAGE_KEY = "sunumarket_data_v1";

const state = {
  user: null,
  store: null,
  data: loadData(),
};

const API_BASE = "http://localhost:4001/api";
const TOKEN_KEY = "sunumarket_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setToken(null);
    state.user = null;
    state.store = null;
    throw new Error("Non autorisé");
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || "Erreur API");
  }
  return body;
}

const dom = {
  main: document.getElementById("main"),
  navHome: document.getElementById("nav-home"),
  navDashboard: document.getElementById("nav-dashboard"),
  navStore: document.getElementById("nav-store"),
  navProfile: document.getElementById("nav-profile"),
  navChatbot: document.getElementById("nav-chatbot"),
  navLogin: document.getElementById("nav-login"),
  navToggle: document.getElementById("nav-toggle"),
  header: document.querySelector(".app-header"),
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { users: [] };
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Erreur chargement localStorage", err);
    return { users: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function getRoute() {
  const hash = window.location.hash || "#home";
  const [route, param] = hash.slice(1).split("/");
  return { route, param };
}

function setRoute(hash) {
  window.location.hash = hash;
  // Close the mobile navigation menu when navigating
  dom.header?.classList.remove("nav-open");
}

function render() {
  const { route, param } = getRoute();
  updateHeader();

  if (route === "store" && param) {
    renderStoreView(param);
    return;
  }

  switch (route) {
    case "login":
      renderLogin();
      break;
    case "register":
      renderRegister();
      break;
    case "dashboard":
      renderDashboard();
      break;
    case "store":
    case "boutique":
      renderStore();
      break;
    case "profile":
      renderProfile();
      break;
    case "chatbot":
      renderChatbot();
      break;
    default:
      renderHome();
  }
}

function renderHome() {
  const tmpl = document.getElementById("home-template");
  dom.main.innerHTML = "";
  dom.main.appendChild(tmpl.content.cloneNode(true));

  document.getElementById("cta-register").addEventListener("click", () => {
    setRoute("#register");
  });
  document.getElementById("cta-tour").addEventListener("click", () => {
    setRoute("#dashboard");
  });
}

function renderLogin() {
  const tmpl = document.getElementById("login-template");
  dom.main.innerHTML = "";
  dom.main.appendChild(tmpl.content.cloneNode(true));

  const form = document.getElementById("login-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    if (!email || !password) {
      showToast("Email et mot de passe requis", "error");
      return;
    }
    try {
      const { token, user } = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(token);
      state.user = user;
      await refreshMe();
      showToast("Connexion réussie !", "success");
      setRoute("#dashboard");
    } catch (err) {
      showToast(err.message || "Échec de la connexion", "error");
    }
  });
}

function renderRegister() {
  const tmpl = document.getElementById("register-template");
  dom.main.innerHTML = "";
  dom.main.appendChild(tmpl.content.cloneNode(true));

  // Auto-fill WhatsApp with phone number
  document.getElementById("register-phone").addEventListener("input", (e) => {
    const phone = e.target.value.replace(/[^0-9]/g, '');
    if (phone) {
      document.getElementById("register-whatsapp").value = `https://wa.me/${phone}`;
    }
  });

  const form = document.getElementById("register-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("register-name").value.trim();
    const phone = document.getElementById("register-phone").value.trim();
    const email = document.getElementById("register-email").value.trim().toLowerCase();
    const password = document.getElementById("register-password").value;
    const whatsapp = document.getElementById("register-whatsapp").value.trim();
    const facebook = document.getElementById("register-facebook").value.trim();
    const instagram = document.getElementById("register-instagram").value.trim();
    const twitter = document.getElementById("register-twitter").value.trim();
    if (!name || !phone || !email || !password) {
      showToast("Tous les champs sont requis", "error");
      return;
    }

    // Validate social links / phone formats
    const socialFields = [
      { name: "WhatsApp", value: whatsapp },
      { name: "Facebook", value: facebook },
      { name: "Instagram", value: instagram },
      { name: "Twitter", value: twitter },
    ];
    for (const field of socialFields) {
      if (!isValidSocialLink(field.value)) {
        showToast(`Format incorrect pour ${field.name}. Utilisez un lien (ex: facebook.com/votrepage) ou un numéro de téléphone.`, "error");
        return;
      }
    }

    const normalized = {
      whatsapp: normalizeUrl(whatsapp),
      facebook: normalizeUrl(facebook),
      instagram: normalizeUrl(instagram),
      twitter: normalizeUrl(twitter),
    };
    try {
      const { token, user } = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, phone, email, password, socialLinks: normalized }),
      });
      setToken(token);
      state.user = user;
      await refreshMe();
      showToast("Compte créé avec succès ! Vous êtes maintenant connecté.", "success");
      setRoute("#dashboard");
    } catch (err) {
      showToast(err.message || "Erreur lors de l'inscription", "error");
    }
  });
}

function updateHeader() {
  const isConnected = !!state.user;
  const { route } = getRoute();

  // Reset all nav buttons
  dom.navHome.classList.remove('active');
  dom.navDashboard.classList.remove('active');
  dom.navStore.classList.remove('active');
  dom.navProfile.classList.remove('active');
  dom.navChatbot.classList.remove('active');
  dom.navLogin.classList.remove('active');

  // Set active class based on current route
  switch (route) {
    case 'home':
      dom.navHome.classList.add('active');
      break;
    case 'dashboard':
      dom.navDashboard.classList.add('active');
      break;
    case 'store':
      dom.navStore.classList.add('active');
      break;
    case 'profile':
      dom.navProfile.classList.add('active');
      break;
    case 'chatbot':
      dom.navChatbot.classList.add('active');
      break;
    case 'login':
    case 'register':
      dom.navLogin.classList.add('active');
      break;
  }

  dom.navLogin.textContent = isConnected ? "Mon compte" : "Se connecter";
  dom.navLogin.onclick = () => {
    if (isConnected) {
      setRoute("#profile");
      return;
    }
    setRoute("#login");
  };
  dom.navProfile.style.display = isConnected ? "block" : "none";
  if (isConnected) {
    dom.navProfile.onclick = () => setRoute("#profile");
  }
}

async function renderDashboard() {
  if (!ensureAuth()) return;
  const tmpl = document.getElementById("dashboard-template");
  dom.main.innerHTML = "";
  dom.main.appendChild(tmpl.content.cloneNode(true));

  try {
    await refreshMe();
  } catch {
    setRoute("#login");
    return;
  }

  refreshDashboard();
  renderOrdersChart();

  document.getElementById("goal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = Number(document.getElementById("goal-value").value) || 0;
    state.store.goal = value;
    try {
      await apiFetch("/me/store", {
        method: "PUT",
        body: JSON.stringify({ name: state.store.name, description: state.store.description }),
      });
    } catch {
      // ignore
    }
    refreshDashboard();
      showToast("Objectif mis à jour !", "success");
  });

  document.getElementById("share-whatsapp").addEventListener("click", () => shareLink("whatsapp"));
  document.getElementById("share-facebook").addEventListener("click", () => shareLink("facebook"));
  document.getElementById("share-tiktok").addEventListener("click", () => shareLink("tiktok"));
}

function refreshDashboard() {
  const store = state.store;
  document.getElementById("dashboard-sales").textContent = formatCurrency(store.sales);
  document.getElementById("dashboard-products").textContent = store.products.length;
  document.getElementById("dashboard-orders").textContent = (store.orders || []).length;
  document.getElementById("dashboard-clients").textContent = store.customers.length;
  const progress = store.goal > 0 ? Math.min(100, Math.round((store.sales / store.goal) * 100)) : 0;
  document.getElementById("goal-progress").style.width = `${progress}%`;
  document.getElementById("goal-summary").textContent = store.goal > 0 ? `${progress}% de ${formatCurrency(store.goal)}` : "Définir un objectif pour voir la progression";

  document.getElementById("store-link").textContent = `${location.origin}#store/${store.slug}`;

  renderRecentOrders();
}

function renderRecentOrders() {
  const ordersList = document.getElementById("orders-list");
  ordersList.innerHTML = "";
  if (!state.store.orders.length) {
    ordersList.innerHTML = "<p>Aucune commande pour le moment.</p>";
    return;
  }

  const recentOrders = state.store.orders.slice(-5).reverse(); // Dernières 5 commandes
  for (const order of recentOrders) {
    const product = state.store.products.find((p) => p.id === order.productId);
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h4>Commande ${order.id}</h4>
      <p><strong>Produit:</strong> ${product ? product.name : "Inconnu"}</p>
      <p><strong>Quantité:</strong> ${order.quantity}</p>
      <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
      <p><strong>Paiement:</strong> ${order.paymentMethod}</p>
      <p><strong>Client:</strong> ${order.customer.firstName} ${order.customer.lastName}</p>
      <p><strong>Adresse:</strong> ${order.customer.address}</p>
      <p><strong>Téléphone:</strong> ${order.customer.phone}</p>
      <p><strong>Statut:</strong> ${order.status}</p>
    `;
    ordersList.appendChild(card);
  }
}

function renderOrdersChart() {
  const canvas = document.getElementById("orders-chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const orders = state.store.orders || [];

  // Get last 7 days
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split('T')[0]); // YYYY-MM-DD
  }

  // Count orders per day
  const counts = days.map(day => {
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      return orderDate === day;
    }).length;
  });

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Chart dimensions
  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  // Max value
  const maxCount = Math.max(...counts, 1);

  // Draw axes
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // Draw grid
  ctx.strokeStyle = "#f0f0f0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Draw line
  ctx.strokeStyle = "#28a745";
  ctx.lineWidth = 3;
  ctx.beginPath();
  counts.forEach((count, index) => {
    const x = padding + (chartWidth / 6) * index;
    const y = height - padding - (chartHeight * count / maxCount);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Draw points
  ctx.fillStyle = "#28a745";
  counts.forEach((count, index) => {
    const x = padding + (chartWidth / 6) * index;
    const y = height - padding - (chartHeight * count / maxCount);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Draw labels
  ctx.fillStyle = "#666";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  days.forEach((day, index) => {
    const x = padding + (chartWidth / 6) * index;
    const date = new Date(day);
    const label = `${date.getDate()}/${date.getMonth() + 1}`;
    ctx.fillText(label, x, height - 10);
  });

  // Y axis labels
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const value = Math.round((maxCount / 5) * i);
    const y = height - padding - (chartHeight / 5) * i;
    ctx.fillText(value.toString(), padding - 10, y + 4);
  }
}

async function refreshMe() {
  const { user, store } = await apiFetch("/me");
  state.user = user;
  state.store = store;
  return { user, store };
}

function shareLink(platform) {
  const url = `${location.origin}#store/${state.store.slug}`;
  const text = `Visitez ma boutique sur SunuMarket : ${url}`;

  if (navigator.share) {
    navigator.share({ title: "Ma boutique SunuMarket", text, url }).catch(() => {});
    return;
  }

  const encoded = encodeURIComponent(text);
  let shareUrl = "";
  if (platform === "whatsapp") {
    shareUrl = `https://api.whatsapp.com/send?text=${encoded}`;
  } else if (platform === "facebook") {
    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  } else if (platform === "tiktok") {
    shareUrl = `https://www.tiktok.com/`; // TikTok ne propose pas de partage URL simple
  }
  window.open(shareUrl, "_blank");
}

async function renderStore() {
  if (!ensureAuth()) return;
  try {
    await refreshMe();
  } catch {
    // ignore
  }
  const tmpl = document.getElementById("store-template");
  dom.main.innerHTML = "";
  dom.main.appendChild(tmpl.content.cloneNode(true));

  document.getElementById("store-name").value = state.store.name;
  document.getElementById("store-description").value = state.store.description;

  document.getElementById("save-store").addEventListener("click", () => {
    const name = document.getElementById("store-name").value.trim() || state.store.name;
    const description = document.getElementById("store-description").value.trim();
    state.store.name = name;
    state.store.description = description;
    state.store.slug = name.replace(/\s+/g, "").toLowerCase();
    apiFetch("/me/store", {
      method: "PUT",
      body: JSON.stringify({ name, description }),
    }).catch(() => {});
      showToast("Boutique enregistrée !", "success");
    refreshDashboard();
  });

  const productForm = document.getElementById("product-form");
  productForm.addEventListener("submit", (event) => {
    event.preventDefault();
      addProductFromForm(); // Call the modified function
  });

  renderProducts();
}

async function addProductFromForm() {
  const name = document.getElementById("product-name").value.trim();  
  const price = Number(document.getElementById("product-price").value) || 0;
  const stock = Number(document.getElementById("product-stock").value) || 0;
  const shipping = document.getElementById("product-shipping").value;
  const desc = document.getElementById("product-desc").value.trim();
  let image = document.getElementById("product-image").value.trim();
  const imageFile = document.getElementById("product-image-file").files[0];

  if (imageFile) {
    image = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(imageFile);
    });
  }

  if (!name || price <= 0) {
    showToast("Merci de donner un nom et un prix valide.", "error");
    return;
  }

  const product = {
    id: "p_" + Date.now(),
    name,
    price,
    stock,
    shipping,
    desc,
    image,
    createdAt: Date.now(),
  };

  try {
    const { product: created } = await apiFetch("/me/products", {
      method: "POST",
      body: JSON.stringify({ name, price, stock, shipping, desc, image }),
    });
    state.store.products.unshift(created);
    renderProducts();
  } catch (err) {
      showToast(err.message || "Impossible d'ajouter le produit", "error");
    return;
  }

  document.getElementById("product-form").reset();
  document.getElementById("product-shipping").value = "Dakar 24h";
    showToast("Produit ajouté !", "success");
}

function renderProducts() {
  const container = document.getElementById("product-list");
  container.innerHTML = "";
  if (!state.store.products.length) {
    container.innerHTML = "<p class='small'>Aucun produit ajouté. Ajoutez-en un pour commencer.</p>";
    return;
  }

  for (const product of state.store.products) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image || "https://via.placeholder.com/480x320?text=Photo"}" alt="${escapeHtml(product.name)}">
      <div class="card-body">
        <h4>${escapeHtml(product.name)}</h4>
        <div class="meta">${formatCurrency(product.price)} • Stock: ${product.stock} • ${escapeHtml(product.shipping)}</div>
        <div>${escapeHtml(product.desc)}</div>
        <div class="actions">
          <button class="small-button" data-action="view" data-id="${product.id}">👁️ Voir</button>
          <button class="small-button" data-action="sell" data-id="${product.id}">Vendu</button>
          <button class="small-button" data-action="order" data-id="${product.id}">Commander</button>
          <button class="small-button" data-action="delete" data-id="${product.id}">Supprimer</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  }

  container.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = button.dataset.id;
      const action = button.dataset.action;
      if (action === "view") return showProductModal(id);
      if (action === "sell") return markProductSold(id);
      if (action === "order") return createOrder(id);
      if (action === "delete") return deleteProduct(id);
    });
  });
}

function showProductModal(productId) {
  const product = state.store.products.find((p) => p.id === productId);
  if (!product) return;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${escapeHtml(product.name)}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <img src="${product.image || "https://via.placeholder.com/480x320?text=Photo"}" alt="${escapeHtml(product.name)}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;">
        <p><strong>Prix:</strong> ${formatCurrency(product.price)}</p>
        <p><strong>Stock:</strong> ${product.stock}</p>
        <p><strong>Livraison:</strong> ${escapeHtml(product.shipping)}</p>
        <p><strong>Description:</strong> ${escapeHtml(product.desc || "Aucune description")}</p>
        <p><strong>Ajouté le:</strong> ${new Date(product.createdAt).toLocaleDateString('fr-FR')}</p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector(".modal-close").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

async function renderProfile() {
  if (!ensureAuth()) return;
  const tmpl = document.getElementById("profile-template");
  dom.main.innerHTML = "";
  dom.main.appendChild(tmpl.content.cloneNode(true));

  document.getElementById("profile-name").value = state.user.name;
  document.getElementById("profile-phone").value = state.user.phone;
  document.getElementById("profile-email").value = state.user.email;
  if (state.user.socialLinks) {
    document.getElementById("profile-whatsapp").value = state.user.socialLinks.whatsapp || "";
    document.getElementById("profile-facebook").value = state.user.socialLinks.facebook || "";
    document.getElementById("profile-instagram").value = state.user.socialLinks.instagram || "";
    document.getElementById("profile-twitter").value = state.user.socialLinks.twitter || "";
  }

  // Auto-fill WhatsApp with phone number
  document.getElementById("profile-phone").addEventListener("input", (e) => {
    const phone = e.target.value.replace(/[^0-9]/g, '');
    if (phone) {
      document.getElementById("profile-whatsapp").value = `https://wa.me/${phone}`;
    }
  });

  const form = document.getElementById("profile-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("profile-name").value.trim();
    const phone = document.getElementById("profile-phone").value.trim();
    const email = document.getElementById("profile-email").value.trim().toLowerCase();
    const password = document.getElementById("profile-password").value;
    const whatsapp = document.getElementById("profile-whatsapp").value.trim();
    const facebook = document.getElementById("profile-facebook").value.trim();
    const instagram = document.getElementById("profile-instagram").value.trim();
    const twitter = document.getElementById("profile-twitter").value.trim();
    if (!name || !phone || !email) {
      showToast("Nom, téléphone et email sont requis", "error");
      return;
    }

    // Validate social links / phone formats
    const socialFields = [
      { name: "WhatsApp", value: whatsapp },
      { name: "Facebook", value: facebook },
      { name: "Instagram", value: instagram },
      { name: "Twitter", value: twitter },
    ];
    for (const field of socialFields) {
      if (!isValidSocialLink(field.value)) {
        showToast(`Format incorrect pour ${field.name}. Utilisez un lien (ex: facebook.com/votrepage) ou un numéro de téléphone.`, "error");
        return;
      }
    }

    const normalized = {
      whatsapp: normalizeUrl(whatsapp),
      facebook: normalizeUrl(facebook),
      instagram: normalizeUrl(instagram),
      twitter: normalizeUrl(twitter),
    };
    try {
      await apiFetch("/me", {
        method: "PUT",
        body: JSON.stringify({
          user: { name, phone, email, password: password || undefined, socialLinks: normalized }
        })
      });
      await refreshMe();
      showToast("Profil mis à jour !", "success");
    } catch (err) {
      showToast(err.message || "Erreur", "error");
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
      localStorage.removeItem(TOKEN_KEY);
      state.user = null;
      state.store = null;
      setRoute("#home");
      render();
    }
  });
}

async function markProductSold(productId) {
  const product = state.store.products.find((p) => p.id === productId);
  if (!product) return;
  if (product.stock <= 0) {
    showToast("Stock épuisé.", "error");
    return;
  }

  const quantity = Number(prompt("Quantité vendue", "1"));
  if (!quantity || quantity <= 0) return;

  const sold = Math.min(quantity, product.stock);
  try {
    await apiFetch("/me/orders", {
      method: "POST",
      body: JSON.stringify({ productId, quantity: sold, paymentMethod: "cod" }),
    });
    await refreshMe();
    renderProducts();
    showToast(`Vente enregistrée : ${sold} × ${product.name}`, "success");
  } catch (err) {
    showToast(err.message || "Échec de la vente", "error");
  }
}

async function createOrder(productId) {
  const product = state.store.products.find((p) => p.id === productId);
  if (!product) return;

  const quantity = Number(prompt("Quantité à commander", "1")) || 1;
  const paymentMethod = prompt("Méthode de paiement (wave / orange_money / card / cod)", "cod");
  if (!paymentMethod) return;

  const firstName = prompt("Prénom du client", "");
  const lastName = prompt("Nom du client", "");
  const address = prompt("Adresse de livraison", "");
  const phone = prompt("Numéro de téléphone du client", "");

  if (!firstName || !lastName || !address || !phone) {
    showToast("Toutes les informations client sont requises", "error");
    return;
  }

  try {
    await apiFetch("/me/orders", {
      method: "POST",
      body: JSON.stringify({ productId, quantity, paymentMethod, customer: { firstName, lastName, address, phone } }),
    });
    await refreshMe();
    renderProducts();
    showToast("Commande créée (simulation)", "success");
  } catch (err) {
    showToast(err.message || "Erreur lors de la création de la commande", "error");
  }
}

function deleteProduct(productId) {
  apiFetch(`/me/products/${productId}`, { method: "DELETE" })
    .then(() => refreshMe())
    .then(() => renderProducts())
    .catch((err) => showToast(err.message || "Erreur", "error"));
}

async function renderStoreView(slug) {
  let store, owner;
  try {
    const data = await apiFetch(`/store/${slug}`);
    store = data.store;
    owner = data.owner;
  } catch {
    dom.main.innerHTML = `<div class="card"><h2>Boutique introuvable</h2><p>Cette boutique n'existe pas encore.</p></div>`;
    return;
  }

  const tmpl = document.getElementById("store-view-template");
  dom.main.innerHTML = "";
  dom.main.appendChild(tmpl.content.cloneNode(true));

  document.getElementById("store-view-name").textContent = store.name;
  document.getElementById("store-view-description").textContent = store.description || "Découvrez nos produits";
  const linkText = `${location.origin}#store/${store.slug}`;
  const linkEl = document.getElementById("store-view-link");
  linkEl.textContent = linkText;
  linkEl.addEventListener("click", () => {
    navigator.clipboard.writeText(linkText).then(() => {
      showToast("Lien copié dans le presse-papiers", "success");
    });
  });

  const badge = document.getElementById("store-badge");
  badge.textContent = computeBadge(store);

  const socialLinksEl = document.getElementById("social-links");
  socialLinksEl.innerHTML = "";
  if (owner.socialLinks) {
    const links = [];
    if (owner.socialLinks.whatsapp) links.push(`<a href="${normalizeUrl(owner.socialLinks.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>`);
    if (owner.socialLinks.facebook) links.push(`<a href="${normalizeUrl(owner.socialLinks.facebook)}" target="_blank" rel="noopener">Facebook</a>`);
    if (owner.socialLinks.instagram) {
      links.push(`<a href="${normalizeUrl(owner.socialLinks.instagram)}" target="_blank" rel="noopener">Instagram</a>`);
    }
    if (owner.socialLinks.twitter) links.push(`<a href="${normalizeUrl(owner.socialLinks.twitter)}" target="_blank" rel="noopener">Twitter</a>`);
    if (links.length) {
      socialLinksEl.innerHTML = links.join(" • ");
    } else {
      document.getElementById("social-links-section").style.display = "none";
    }
  } else {
    document.getElementById("social-links-section").style.display = "none";
  }

  const list = document.getElementById("store-view-products");
  list.innerHTML = "";

  if (!store.products.length) {
    document.getElementById("store-empty").style.display = "block";
    return;
  }

  document.getElementById("store-empty").style.display = "none";

  for (const product of store.products) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image || "https://via.placeholder.com/480x320?text=Photo"}" alt="${escapeHtml(product.name)}">
      <div class="card-body">
        <h4>${escapeHtml(product.name)}</h4>
        <div class="meta">${formatCurrency(product.price)} • Stock: ${product.stock}</div>
        <div>${escapeHtml(product.desc)}</div>
        <div class="meta">Livraison: ${escapeHtml(product.shipping)}</div>
      </div>
    `;

    list.appendChild(card);
  }
}

function computeBadge(store) {
  if (store.sales >= store.goal && store.goal > 0) return "🥇";
  if (store.sales >= store.goal * 0.5 && store.goal > 0) return "🥈";
  return "🥉";
}

function renderChatbot() {
  const tmpl = document.getElementById("chatbot-template");
  dom.main.innerHTML = "";
  dom.main.appendChild(tmpl.content.cloneNode(true));

  const messagesEl = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  const addMessage = (text, fromUser = false) => {
    const row = document.createElement("div");
    row.className = `chat-message ${fromUser ? "message-user" : "message-bot"}`;
    row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    addMessage(question, true);
    input.value = "";

    setTimeout(() => {
      getBotAnswer(question).then((answer) => addMessage(answer));
    }, 450);
  });

  addMessage("Bonjour ! Je suis votre assistant. Posez une question.");
}

async function getBotAnswer(question) {
  const text = question.toLowerCase();

  // Handle calculations
  const calcMatch = text.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/);
  if (calcMatch) {
    const num1 = parseFloat(calcMatch[1]);
    const op = calcMatch[2];
    const num2 = parseFloat(calcMatch[3]);
    let result;
    try {
      switch (op) {
        case '+': result = num1 + num2; break;
        case '-': result = num1 - num2; break;
        case '*': result = num1 * num2; break;
        case '/': result = num2 !== 0 ? num1 / num2 : 'division par zéro'; break;
      }
      if (typeof result === 'number' && !isNaN(result)) {
        return `Le résultat de ${num1} ${op} ${num2} est ${result.toFixed(2)}`;
      } else {
        return "Calcul invalide.";
      }
    } catch {
      return "Erreur dans le calcul.";
    }
  }

  // Handle buying questions
  if (text.includes("acheter") || text.includes("buy") || text.includes("commander")) {
    return "Pour acheter un produit, visitez la boutique du vendeur, choisissez un produit et contactez-le via WhatsApp ou téléphone pour passer commande. Le paiement se fait généralement en espèces à la livraison.";
  }

  // Handle selling questions
  if (text.includes("vendre") || text.includes("sell") || text.includes("boutique")) {
    return "Pour vendre, créez un compte vendeur, configurez votre boutique, ajoutez des produits avec photos et prix, puis partagez le lien de votre boutique sur les réseaux sociaux.";
  }

  // Handle price questions
  if (text.includes("prix") || text.includes("coût") || text.includes("tarif")) {
    return "Le prix dépend de votre produit et du marché. Utilisez notre outil IA pour obtenir des suggestions de prix basées sur des produits similaires.";
  }

  // Handle delivery questions
  if (text.includes("livraison") || text.includes("livrer") || text.includes("expédition")) {
    return "La livraison dépend du vendeur. La plupart offrent la livraison à Dakar sous 24h. Contactez le vendeur pour les détails.";
  }

  // Handle payment questions
  if (text.includes("paiement") || text.includes("payer") || text.includes("argent")) {
    return "Les paiements se font généralement en espèces à la livraison (COD), ou via Wave, Orange Money. Nous simulons les paiements pour le moment.";
  }

  // Handle product questions
  if (text.includes("produit") || text.includes("article")) {
    return "Vous pouvez ajouter des produits dans 'Ma boutique' avec nom, prix, stock, description et photo. Les clients voient vos produits sur votre page boutique.";
  }

  // Handle order tracking
  if (text.includes("suivre") || text.includes("statut") || text.includes("où")) {
    return "Vous pouvez suivre vos commandes dans le tableau de bord. Pour les clients, contactez le vendeur directement.";
  }

  // Existing AI suggestions
  if (text.includes("génère") || text.includes("description") || text.includes("hashtags")) {
    try {
      const { suggestedPrice, recommendedDescription, hashtags, advice } = await apiFetch("/ai/suggest", {
        method: "POST",
        body: JSON.stringify({
          productName: question,
          price: state.store?.products?.[0]?.price || 0,
          description: state.store?.products?.[0]?.desc || "",
        }),
      });
      return `Suggestion IA : prix ${formatCurrency(suggestedPrice)}\n${recommendedDescription}\n${hashtags.join(" ")}\n${advice}`;
    } catch {
      return "Impossible de générer une suggestion IA pour le moment.";
    }
  }

  // Default response
  return "Je peux vous aider avec des questions sur l'achat, la vente, les calculs simples, ou générer des suggestions IA. Posez-moi une question spécifique !";
}

function ensureAuth() {
  if (state.user) return true;
  const wants = confirm("Vous devez être connecté pour accéder à cette section. Voulez-vous vous connecter maintenant ?");
  if (wants) setRoute("#login");
  else setRoute("#home");
  return false;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(value);
}

function normalizeUrl(url) {
  if (!url) return "";

  const trimmed = String(url).trim();

  // If already a full URL, keep as-is
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // If the user entered a phone number, build a WhatsApp link
  const phoneDigits = trimmed.replace(/[^0-9+]/g, "");
  if (/^[+]?\d{6,}$/.test(phoneDigits)) {
    const clean = phoneDigits.replace(/^\+/, "");
    return `https://wa.me/${clean}`;
  }

  // Fallback: assume https
  return `https://${trimmed}`;
}

function showToast(message, type = "info", duration = 3500) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <div class="toast__icon">${type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️"}</div>
    <div class="toast__message">${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(10px)";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function isValidSocialLink(value) {
  if (!value) return true;
  const trimmed = String(value).trim();
  // Accept URLs with protocol
  if (/^https?:\/\//i.test(trimmed)) return true;
  // Accept plain domains (ex: facebook.com/monprofil)
  if (/^[\w-]+(\.[\w-]+)+[\w\-/]*$/i.test(trimmed)) return true;
  // Accept phone numbers (for WhatsApp)
  if (/^[+]?\d{6,}$/i.test(trimmed.replace(/\s+/g, ""))) return true;
  return false;
}

function escapeHtml(string) {
  return String(string).replace(/[&<>"]+/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[m]);
}

async function init() {
  window.addEventListener("hashchange", render);

  if (dom.navToggle) {
    dom.navToggle.addEventListener("click", () => {
      dom.header?.classList.toggle("nav-open");
      const expanded = dom.header?.classList.contains("nav-open");
      dom.navToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  // Close mobile menu when clicking outside
  document.addEventListener("click", (e) => {
    if (dom.header && !dom.header.contains(e.target) && dom.header.classList.contains("nav-open")) {
      dom.header.classList.remove("nav-open");
      dom.navToggle?.setAttribute("aria-expanded", "false");
    }
  });

  dom.navHome.addEventListener("click", () => setRoute("#home"));
  dom.navDashboard.addEventListener("click", () => setRoute("#dashboard"));
  dom.navStore.addEventListener("click", () => setRoute("#store"));
  dom.navChatbot.addEventListener("click", () => setRoute("#chatbot"));

  const { route } = getRoute();
  const token = getToken();
  if (token) {
    try {
      await refreshMe();
    } catch {
      setToken(null);
    }
  }

  if (route === "login") {
    renderAuth();
  } else {
    render();
  }
}

init();
