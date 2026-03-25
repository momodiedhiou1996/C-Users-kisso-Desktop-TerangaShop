# SunuMarket (Prototype)

Prototype d'une **marketplace intelligente africaine** (front-end uniquement) avec une expérience vendeur simple.

## 🚀 Lancer le site

1. Ouvrez un terminal dans le dossier du projet.
2. (Optionnel) Lancez le backend API si vous souhaitez utiliser les fonctions avancées (auth, commandes, paiement, IA). Vous aurez besoin de Node.js 14+.

```powershell
cd server
npm install
npm start
```

3. Lancez un serveur local pour le frontend (exemple avec Python 3) :

```powershell
python -m http.server 8000
```

3. Ouvrez votre navigateur à : [http://localhost:8000](http://localhost:8000)

## ✨ Fonctionnalités incluses

- Inscription / connexion front-end (stocké dans `localStorage`)
- Création de boutique (slug partagé)
- Ajout de produits (photo, prix, stock, livraison)
- Suivi des ventes (inventaire, chiffres, objectif mensuel)
- Système de badge (active / pro / top)
- Chatbot basique (réponses préprogrammées)
- Pages de boutique partageables (`#store/<slug>`)

> Ce prototype fonctionne entièrement en mode offline.

## 📌 Améliorations possibles

- Intégrer un backend réel (API, base de données, authentification)
- Paiements (Wave, Orange Money, carte bancaire)
- Système de commandes + livraison
- IA avancée pour recommandations et génération automatique
  
*Note : le backend inclus est une simulation qui utilise un fichier `server/data.json`. Il ne fonctionne que si Node.js est installé.*

---

*Ce projet est un MVP de démonstration. Pour de la production, il faut ajouter une API sécurisée et un stockage serveur.*

