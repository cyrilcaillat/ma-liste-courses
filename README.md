# ma-liste-courses

## Liste de courses pour Telegram
Bot Telegram en Node.js (Telegraf v4) qui gère des listes de courses partagées dans des groupes Telegram. Les données sont stockées dans MongoDB.

## Utilisation du bot
1. Créer un groupe afin de gérer votre liste de courses.
2. Ajouter le contact https://t.me/ma_liste_courses_1236548_bot à ce groupe.
3. Vous pouvez partager le groupe avec d'autres personnes.

> Les listes sont hébergées sur une instance OVH. Aucune pérennité des données n'est garantie.

## Commandes

| Commande | Effet |
|---|---|
| `/list` | Affiche la liste active |
| `/list <nom>` | Bascule sur la liste `<nom>` (doit exister) et l'affiche |
| `/add <produit>` | Ajoute un produit à la liste active |
| `/add <a>,<b>,<c>` | Ajout multiple (séparateurs : `,`, `;`, retour ligne) |
| `/add` | Mode interactif : le bot demande le produit et propose des suggestions historiques |
| `/clean` | Supprime de la liste active les produits cochés (panier) |
| `/lists` | Affiche toutes les listes du chat avec boutons pour basculer |
| `/newlist <nom>` | Crée et active une nouvelle liste (ou interactif si sans argument) |
| `/dellist <nom>` | Supprime une liste entière |
| `/rename <ancien> <nouveau>` | Renomme une liste |
| `/delall` | Vide la liste active (avec confirmation `o`/`y`) |

Nom de liste valide : `a-z 0-9 _ -`, max 30 caractères, lowercase auto.

### Cocher / décocher un produit
Cliquer sur un bouton produit le **coche** (✓) au lieu de le supprimer. La liste affiche alors deux sections :
- 🛒 **À acheter** : les produits non cochés
- ✅ **Dans le panier** : les produits cochés

Un nouveau clic décoche. Quand tout est dans le panier : tape `/clean` pour vider le panier (suppression définitive).

### Suggestions historiques
À chaque ajout, le produit est mémorisé dans une collection `histories` par chat. Quand tu tapes `/add` (sans argument), le bot affiche en boutons inline les 12 produits les plus utilisés dans ce chat (en excluant ceux déjà dans la liste active). Cliquer sur un bouton ajoute directement le produit.

## Architecture

```
index.js                       wiring Telegraf + handlers
config/database.js             connexion MongoDB
middleware/
  rateLimit.js                 5 messages / 3s par utilisateur
  sessionStore.js              store mongoose pour les sessions Telegraf
model/
  TodosModel.js                produits ({chatId, listName, text, done, doneAt, ...})
  HistoryModel.js              fréquence des ajouts ({chatId, text, count, lastUsed})
  ChatStateModel.js            liste active + listes connues d'un chat
  SessionModel.js              sessions persistées
locales/
  fr.yaml en.yaml              i18n (telegraf-i18n)
mongodb/
  mongodb.yml.sample           exemple docker-compose
```

### Sessions persistées
Les sessions Telegraf sont stockées dans MongoDB → survivent au redémarrage du service. Clé : `${userId}:${chatId}`.

### Multi-listes
Chaque chat peut avoir plusieurs listes (`courses`, `pharmacie`, `bricolage`, …). Une seule est active à la fois (stockée dans `ChatStateModel.currentList`). Toutes les commandes opèrent sur la liste active. Les listes vides connues (créées mais sans produit) sont conservées dans `knownLists`.

## Héberger son bot

Pré-requis : Node.js 18+, MongoDB.

1. Sur Telegram, parler à [@BotFather](https://t.me/BotFather) pour créer un bot et récupérer son **token**.
2. Cloner le dépôt et installer :
   ```bash
   npm install --legacy-peer-deps
   ```
   (`--legacy-peer-deps` car `telegraf-i18n@6.6` a un peer dep figé sur Telegraf v3 mais fonctionne en v4.)
3. Initialiser MongoDB et créer un utilisateur dédié.
4. Copier `.env.sample` en `.env` et remplir :
   ```
   BOT_TOKEN=xxx
   DB_USER=xxx
   DB_PASSWORD=xxx
   DB_HOST=localhost
   DB_PORT=27017
   DB_DATABASE=todolist
   BUTTONS_BY_ROW=3        # optionnel
   DEBUG=0                 # 1 pour logs verbeux
   ```
5. Démarrer :
   ```bash
   node index.js
   ```
   Pour la prod : `systemd` (voir exemple ci-dessous) ou pm2.

### Exemple unit systemd

```ini
[Unit]
Description=Ma liste de courses Node.js
After=network.target

[Service]
ExecStart=/usr/bin/node /home/debian/ma-liste-courses/index.js
WorkingDirectory=/home/debian/ma-liste-courses
Restart=always
TimeoutStopSec=15s
KillSignal=SIGTERM
User=debian
Environment=NODE_ENV=production
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=malistedecourses

[Install]
WantedBy=multi-user.target
```

### Docker

`mongodb/mongodb.yml.sample` fournit un exemple `docker-compose` pour MongoDB.

## Licence
Voir [LICENSE](LICENSE).
