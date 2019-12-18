# ma-liste-courses
## Liste de courses pour telegram

Permet de gérer une liste de courses avec l'application Telegram.
Les listes sont conservées sous mongodb.

## Utilisation du bot

Créer un groupe afin de gérer votre liste de courses.
Puis ajouter le contact https://t.me/ma_liste_courses_1236548_bot à ce groupe.
Vous pouvez partager le groupe avec d'autres personnes.

Pour ajouter un produit, il suffit de faire
* /add sucre
Vous pouvez faire un ajout multimple
* /add sucre,farine,sel,poivre
Pour visualiser la liste
* /list

Un clic sur un produit, le supprime de la liste.
A la prochaine commande /list, il ne sera plus visible.

Les listes sont hébergées sur une instance OVH.
Je ne garantie pas la pérénité des données.

## Herberger son bot

Si vous désirez héberger vous-même votre bot, il vous faut un serveur avec nodejs et mongodb.
Il faut aller dans https://t.me/BotFather, afin de créer votre bot et de récupérer son token.
Il faut initialiser la base de données et créer un utilisateur.

