# Brouillon - à publier après l’ouverture du dépôt et la disponibilité de la 1.0.0

**Titre :** J’ai fait une app de screensaver Steam avec les artworks animés de SteamGridDB - je cherche des testeurs

Après la [mise à jour stable de Steam du 13 octobre](https://www.steamdeck.com/en/news?pubDate=20261013), qui ajoute les screensavers personnalisés sur SteamOS et dans Big Picture sur ordinateur, j’ai eu envie d’en faire un avec les artworks animés de ma bibliothèque.

L’app s’appelle Steam Animated Screensaver. On choisit ses jeux, leurs animations et leurs jaquettes fixes, on les prépare ensemble, puis on installe le screensaver dans Steam. On peut garder l’image entière ou la recadrer en 16:9 / 16:10. Une fois préparé, ça tourne hors ligne, app fermée. Il faut sa propre clé API SteamGridDB.

La vidéo commence par le rendu, puis montre la préparation de plusieurs jeux et les réglages. Il y a une version SteamOS, Linux, Windows et macOS.

Un souci rencontré dans Steam : sur les machines avec batterie, hors Gamescope, Big Picture renvoie vers Alimentation pour régler le délai, mais les réglages n’y sont pas. La même condition existe dans les clients Mac, Windows et Linux actuels. L’app permet donc d’enregistrer le délai après avoir quitté Steam, avec une sauvegarde. Elle propose cinq minutes. Ça reste indépendant de l’économiseur d’écran du système.

Après l’installation, il faut sélectionner steam-animated-screensaver dans Steam Big Picture → Paramètres → Personnalisation → Écrans de veille. Le README explique l’activation et le réglage du délai.

[Code et téléchargements](https://github.com/Alyenax/Steam-Animated-Screensaver)

Je cherche des testeurs sur toutes les plateformes, surtout Linux et Windows. J’ai davantage testé SteamOS et Mac en réel. Windows/Linux ont eu des tests automatisés et des contrôles des paquets, mais il manque encore des essais attentifs dans Steam sur ces machines. En cas de souci, pensez à préciser votre OS et votre version de Steam.

Et si certains veulent contribuer, je suis preneur. J’aimerais surtout améliorer la fluidité : les animations SteamGridDB sont souvent peu fluides à la base, et ça se voit en plein écran. Il y a des traitements optionnels en 24/30 ips, mais c’est parfois long et le résultat varie. Pour faire mieux, corriger des crashs, améliorer le support des plateformes ou ajouter des choses utiles, toute aide serait appréciée.

Merci aussi aux artistes de SteamGridDB pour leur travail.

Music in the video: [Song Of The Forge by Scott Buckley](https://www.scottbuckley.com.au/library/song-of-the-forge/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
