# Brouillon — à publier après l’ouverture du dépôt et la disponibilité de la 1.0.0

**Titre :** J’ai fait une app pour utiliser les artworks animés de SteamGridDB comme screensaver Steam — je cherche des testeurs

La [mise à jour stable de Steam du 13 octobre](https://www.steamdeck.com/en/news?pubDate=20261013) ajoute les screensavers personnalisés sur SteamOS et dans Big Picture sur ordinateur. Ça m’a donné envie d’en faire un avec les artworks animés des jeux de ma bibliothèque.

J’ai donc préparé Steam Animated Screensaver. On choisit ses jeux, leurs animations sur SteamGridDB, on vérifie le rendu et on installe le screensaver dans Steam. On peut régler le cadrage, ajouter une jaquette fixe et choisir son emplacement. Une fois les médias téléchargés, ça fonctionne hors ligne, app fermée. Il faut sa propre clé API SteamGridDB pour récupérer les images.

La vidéo commence par le rendu, puis montre la préparation de plusieurs jeux et quelques réglages.

Je suis aussi tombé sur un souci dans Steam : sur les machines avec batterie, hors Gamescope, Big Picture renvoie vers Alimentation pour régler le délai, mais les réglages n’y sont pas. La même condition existe dans les clients Mac, Windows et Linux actuels. J’ai ajouté le réglage dans l’app : on quitte Steam, on applique le délai, avec une sauvegarde du fichier de configuration. L’app propose cinq minutes pour commencer. Ça reste indépendant de l’économiseur d’écran du système.

Après la préparation, il faut cliquer sur Installer dans Steam, puis sélectionner steam-animated-screensaver dans Big Picture → Paramètres → Personnalisation → Écrans de veille. On peut tester avec Aperçu. Pour appliquer un délai dans l’app, il faut quitter complètement Steam, puis rouvrir Big Picture après.

[Code et téléchargements](https://github.com/Alyenax/Steam-Animated-Screensaver)

Je cherche des testeurs sur SteamOS, macOS, Linux et Windows. J’ai surtout passé du temps dessus sur SteamOS et Mac. Linux et Windows ont eu des vérifications automatisées et des contrôles des paquets, mais beaucoup moins de tests attentifs en réel. Les retours sur ces deux plateformes m’aideraient donc particulièrement. En cas de souci, pensez à préciser votre OS et votre version de Steam.

Et si certains veulent contribuer, ce serait vraiment apprécié. J’aimerais notamment améliorer la fluidité : les animations SteamGridDB sont souvent peu fluides à la base et ça se voit vite en plein écran. Il y a des traitements optionnels en 24/30 ips, mais c’est parfois long et le résultat est variable. Si vous avez des idées pour faire mieux, ou simplement pour rendre l’app plus fiable et ajouter des choses utiles, je suis preneur.

Merci aussi aux artistes de SteamGridDB pour leur travail.
