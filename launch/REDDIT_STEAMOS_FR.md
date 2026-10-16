# Brouillon SteamOS — à publier après l’ouverture du dépôt et des téléchargements

**Titre :** Des artworks animés SteamGridDB comme screensaver SteamOS — je cherche des testeurs

Après la [mise à jour stable de Steam du 13 octobre](https://www.steamdeck.com/en/news?pubDate=20261013), qui ajoute les screensavers personnalisés, j’ai fait Steam Animated Screensaver pour utiliser les artworks animés de ma bibliothèque dans le mode Jeu.

On choisit ses jeux, leurs animations et leurs jaquettes fixes, on prépare le tout ensemble, puis on installe le screensaver dans Steam. On peut garder l’image entière ou recadrer en 16:9 / 16:10. Une fois préparé, ça tourne hors ligne, app fermée. Pas besoin de Decky ni de service en arrière-plan. Il faut sa propre clé API SteamGridDB.

L’installation se fait en mode Bureau : on extrait la version SteamOS, on lance install.sh, on prépare ses jeux, puis on clique sur Installer dans Steam. De retour en mode Jeu, il faut aller dans Paramètres → Personnalisation → Écrans de veille et sélectionner steam-animated-screensaver. On peut tester avec Aperçu, puis régler le délai dans Alimentation. Cinq minutes est un point de départ raisonnable.

Le mode Jeu dispose déjà des réglages de délai. Steam a un autre souci sur les machines avec batterie **hors Gamescope**, par exemple dans Big Picture en mode Bureau : il renvoie vers Alimentation, mais les réglages y sont masqués. L’app propose aussi de régler le délai pour ce cas, avec une sauvegarde. Il faut quitter complètement Steam avant d’appliquer.

[Code et téléchargements](https://github.com/Alyenax/Steam-Animated-Screensaver)

Je cherche des testeurs sur Steam Deck / Steam Machine, avec différentes résolutions et manettes. L’installation, le lancement automatique, le retour à la manette, la lecture hors ligne et la consommation pendant la lecture m’intéressent particulièrement.

Et si certains veulent contribuer, je suis preneur. Les animations SteamGridDB sont souvent peu fluides à la base et ça se voit en plein écran. Il existe des traitements en 24/30 ips, mais ils peuvent être longs et le résultat varie. Toute aide pour améliorer la fluidité, le décodage, les performances ou la stabilité serait appréciée.

La vidéo jointe montre l’interface de l’app capturée sur Mac ; ce n’est pas une capture du mode Jeu de SteamOS. Il existe aussi des versions Mac, Windows et Linux. Windows/Linux ont surtout besoin de davantage d’essais en réel.

Merci aux artistes de SteamGridDB pour leur travail.
