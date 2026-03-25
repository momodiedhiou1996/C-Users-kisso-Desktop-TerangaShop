const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");


const PORT = process.env.PORT || 4001;
const JWT_SECRET = process.env.JWT_SECRET || "sunumarket_secret";
const DATA_PATH = path.resolve(__dirname, "data.json");

const app = express();
app.use(cors());
app.use(express.json());

function loadData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      const initial = { users: [] };
      fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load data.json", err);
    return { users: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token manquant" });
  }
  const token = header.replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Token invalide" });
  }
  const data = loadData();
  const user = data.users.find((u) => u.id === payload.id);
  if (!user) return res.status(401).json({ message: "Utilisateur introuvable" });
  req.user = user;
  req.data = data;
  next();
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, now: Date.now() });
});

app.post("/api/auth/register", (req, res) => {
  const { name, phone, email, password, socialLinks = {} } = req.body;
  if (!name || !phone || !email || !password) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  const data = loadData();
  const existing = data.users.find((u) => u.email === email.toLowerCase() || u.phone === phone);
  if (existing) {
    return res.status(400).json({ message: "Un compte existe déjà avec cet email ou téléphone" });
  }

  const user = {
    id: uuid(),
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim().toLowerCase(),
    password: password,
    socialLinks: socialLinks,
    store: {
      name: "Ma boutique",
      description: "",
      slug: name.replace(/\s+/g, "").toLowerCase(),
      products: [],
      orders: [],
      goal: 0,
      sales: 0,
      customers: [],
    },
  };

  // Ensure WhatsApp is connected to phone number
  if (!user.socialLinks.whatsapp) {
    const cleanedPhone = user.phone.replace(/[^0-9]/g, '');
    user.socialLinks.whatsapp = `https://wa.me/${cleanedPhone}`;
  }

  data.users.push(user);
  saveData(data);

  const token = createToken({ id: user.id });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email et mot de passe requis" });
  }

  const data = loadData();
  const user = data.users.find((u) => u.email === email.toLowerCase() && u.password === password);
  if (!user) {
    return res.status(401).json({ message: "Email ou mot de passe incorrect" });
  }

  const token = createToken({ id: user.id });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const { user } = req;
  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, socialLinks: user.socialLinks }, store: user.store });
});

app.put("/api/me", authMiddleware, (req, res) => {
  const { user: updates } = req.body;
  if (!updates) return res.status(400).json({ message: "Mises à jour requises" });

  const data = req.data;
  const user = req.user;

  if (updates.name) user.name = updates.name.trim();
  if (updates.phone) user.phone = updates.phone.trim();
  if (updates.email) {
    const existing = data.users.find((u) => u.email === updates.email.toLowerCase() && u.id !== user.id);
    if (existing) return res.status(400).json({ message: "Email déjà utilisé" });
    user.email = updates.email.trim().toLowerCase();
  }
  if (updates.password) user.password = updates.password;
  if (updates.socialLinks) user.socialLinks = updates.socialLinks;

  // Ensure WhatsApp is connected to phone number
  if (!user.socialLinks.whatsapp) {
    const cleanedPhone = user.phone.replace(/[^0-9]/g, '');
    user.socialLinks.whatsapp = `https://wa.me/${cleanedPhone}`;
  }

  saveData(data);
  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, socialLinks: user.socialLinks }, store: user.store });
});

app.put("/api/me/store", authMiddleware, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "Nom de boutique requis" });

  const data = req.data;
  const user = req.user;
  user.store.name = name;
  user.store.description = description || "";
  user.store.slug = name.replace(/\s+/g, "").toLowerCase();
  saveData(data);

  res.json({ store: user.store });
});

app.get("/api/me/products", authMiddleware, (req, res) => {
  res.json({ products: req.user.store.products });
});

app.post("/api/me/products", authMiddleware, (req, res) => {
  const { name, price, stock, shipping, desc, image } = req.body;
  if (!name || !price) return res.status(400).json({ message: "Nom et prix requis" });

  const product = {
    id: uuid(),
    name: name.trim(),
    price: Number(price) || 0,
    stock: Number(stock) || 0,
    shipping: shipping || "Dakar 24h",
    desc: desc || "",
    image: image || "",
    createdAt: Date.now(),
  };

  const data = req.data;
  req.user.store.products.unshift(product);
  saveData(data);
  res.json({ product });
});

app.put("/api/me/products/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const product = req.user.store.products.find((p) => p.id === id);
  if (!product) return res.status(404).json({ message: "Produit non trouvé" });

  const { name, price, stock, shipping, desc, image } = req.body;
  if (name) product.name = name.trim();
  if (price != null) product.price = Number(price);
  if (stock != null) product.stock = Number(stock);
  if (shipping != null) product.shipping = shipping;
  if (desc != null) product.desc = desc;
  if (image != null) product.image = image;

  saveData(req.data);
  res.json({ product });
});

app.delete("/api/me/products/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const before = req.user.store.products.length;
  req.user.store.products = req.user.store.products.filter((p) => p.id !== id);
  if (req.user.store.products.length === before) return res.status(404).json({ message: "Produit non trouvé" });
  saveData(req.data);
  res.json({ ok: true });
});

app.post("/api/me/orders", authMiddleware, (req, res) => {
  const { productId, quantity, paymentMethod, customer } = req.body;
  const product = req.user.store.products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ message: "Produit introuvable" });
  const qty = Number(quantity) || 1;
  if (product.stock < qty) return res.status(400).json({ message: "Stock insuffisant" });

  if (!customer || !customer.firstName || !customer.lastName || !customer.address || !customer.phone) {
    return res.status(400).json({ message: "Informations client requises" });
  }

  product.stock -= qty;
  const total = product.price * qty;

  const order = {
    id: uuid(),
    productId,
    quantity: qty,
    total,
    paymentMethod: paymentMethod || "cod",
    customer: {
      firstName: customer.firstName.trim(),
      lastName: customer.lastName.trim(),
      address: customer.address.trim(),
      phone: customer.phone.trim(),
    },
    status: "pending",
    createdAt: Date.now(),
  };

  req.user.store.orders.push(order);
  req.user.store.sales += total;
  req.user.store.customers.push({ id: uuid(), date: Date.now(), amount: total });

  saveData(req.data);
  res.json({ order });
});

app.get("/api/me/orders", authMiddleware, (req, res) => {
  res.json({ orders: req.user.store.orders });
});

app.post("/api/payments", authMiddleware, (req, res) => {
  const { method, amount } = req.body;
  if (!method || !amount) return res.status(400).json({ message: "Méthode et montant requis" });

  const valid = ["wave", "orange_money", "card", "cod"];
  if (!valid.includes(method)) return res.status(400).json({ message: "Méthode inconnue" });

  // Simulation simple
  return res.json({ success: true, message: "Paiement simulé", method, amount });
});

app.post("/api/ai/suggest", authMiddleware, (req, res) => {
  const { productName, price, description } = req.body;

  const base = productName || "Votre produit";
  const suggestedPrice = price ? Number(price) * 1.08 : 1000;
  const hashs = [
    `#${base.replace(/\s+/g, "").toLowerCase()}`,
    "#vente",
    "#sunuMarket",
    "#bonneaffaire",
  ];

  const marketing = `Mettez en avant ${base} sur WhatsApp et Facebook. Utilisez le hashtag ${hashs[0]} pour gagner en visibilité.`;

  res.json({
    suggestedPrice: Math.round(suggestedPrice),
    recommendedDescription: description
      ? `Super produit : ${description}`
      : `Découvrez ${base} à prix imbattable !`,
    hashtags: hashs,
    advice: marketing,
  });
});

app.get("/api/store/:slug", (req, res) => {
  const { slug } = req.params;
  const data = loadData();
  const user = data.users.find((u) => u.store.slug === slug);
  if (!user) return res.status(404).json({ message: "Boutique introuvable" });
  res.json({ store: user.store, owner: { name: user.name, phone: user.phone, socialLinks: user.socialLinks } });
});

app.listen(PORT, () => {
  console.log(`SunuMarket API running on http://localhost:${PORT}`);
});
