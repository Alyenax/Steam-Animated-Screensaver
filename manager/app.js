const icons = {
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4"/>',
  home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
  library:
    '<rect x="3" y="5" width="5" height="15" rx="1"/><rect x="11" y="5" width="5" height="15" rx="1"/><path d="m18 5 3 14"/>',
  prepare: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  preview:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 3-5 3zM8 21h8m-4-4v4"/>',
  settings:
    '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  scan: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path d="M7 12h10"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  previous: '<path d="M5 5v14m14-14L7 12l12 7z"/>',
  next: '<path d="M19 5v14M5 5l12 7-12 7z"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  key: '<circle cx="8" cy="9" r="5"/><path d="m12 13 8 8m-4-4 3-3m-6 0 3-3"/>',
  drive: '<path d="M5 4h14l3 12v4H2v-4zM2 16h20M17 18h2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M11 5H4v15h15v-7"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="1"/>'
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.film}</svg>`;
const translations = {
  en: {
    home: 'Home',
    library: 'Library',
    preparation: 'Preparation',
    preview: 'Preview',
    settings: 'Settings',
    tagline: 'Steam Animated Screensaver',
    connected: 'Steam library detected',
    notDetected: 'Steam not detected',
    collection: 'STEAM SCREENSAVER',
    homeTitle: 'Steam Animated Screensaver',
    homeSub: 'Select games, prepare animations, and install the screensaver in Steam.',
    addGame: 'Add a game',
    heroEyebrow: 'SETUP',
    heroTitle: 'Prepare your screensaver',
    heroBody:
      'Choose games from your library or add them manually. Download their artwork, preview the rotation, then install it in Steam.',
    discover: 'Choose games',
    openPreview: 'Open preview',
    libraryGames: 'Games in your library',
    readyScenes: 'Scenes ready to play',
    includedGames: 'Included games',
    storageUsed: 'Local storage used',
    collectionTitle: 'Your collection',
    viewAll: 'View library',
    emptyTitle: 'No games added',
    emptyBody:
      'We look for games installed on this device. You can also add any title from SteamGridDB, whether you own it here or elsewhere.',
    scan: 'Scan Steam library',
    scanAgain: 'Scan again',
    scanning: 'Scanning Steam libraries…',
    step1: 'Add games',
    step1Body: 'Scan your installed Steam library or search for a title to add it yourself.',
    step2: 'Prepare animations',
    step2Body: 'Connect SteamGridDB, choose artwork, and prepare your scenes locally.',
    step3: 'Preview and install',
    step3Body: 'Preview the same player, then install into your Steam screensavers folder.',
    libraryEyebrow: 'GAMES',
    libraryTitle: 'Your library',
    librarySub: 'Select the games to include in the screensaver.',
    prepareScreensaver: 'Prepare My Screensaver',
    updateScreensaver: 'Update My Screensaver',
    installedFilter: 'Installed',
    manualFilter: 'Manually added',
    animatedFilter: 'Animated available',
    missingFilter: 'Missing animation',
    excludedFilter: 'Excluded',
    previous: 'Previous scene',
    next: 'Next scene',
    repairLibrary: 'Repair library',
    automaticChoice: 'Use automatic matching',
    stageDownloading: 'Downloading artwork',
    stageValidating: 'Checking local media',
    stageOptimizing: 'Optimizing for playback',
    stageSaving: 'Saving your scene',
    shuffleShort: 'Shuffle',
    titlesShort: 'Titles',
    transitionShort: 'Transition',
    fadeBlack: 'Fade to black',
    prepareScenes: 'Prepare scenes',
    all: 'All games',
    included: 'Included',
    ready: 'Ready',
    needsAttention: 'To prepare',
    filterPlaceholder: 'Filter your games…',
    noFilter: 'No games match this view.',
    noFilterBody: 'Try a different filter or search term.',
    noKey: 'Connect SteamGridDB to find artwork and prepare your scenes.',
    connect: 'Connect SteamGridDB',
    gameReady: 'Ready',
    gameNew: 'To prepare',
    gameMissing: 'No artwork',
    gameError: 'Needs attention',
    installed: 'Installed',
    manual: 'Added manually',
    include: 'Include in rotation',
    details: 'View artwork',
    animated: 'Animated',
    still: 'Still image',
    noMedia: 'No local scene yet',
    prepareEyebrow: 'ANIMATIONS',
    prepareTitle: 'Prepare your scenes',
    prepareSub: 'Artwork is downloaded and checked locally. Your player stays offline.',
    queueTitle: 'Preparation queue',
    queueEmpty: 'Your queue is clear.',
    queueEmptyBody:
      'Include games in your library, then prepare them to create your offline rotation.',
    jobIdle: 'No preparation in progress',
    jobRunning: 'Preparation in progress',
    jobPaused: 'Preparation paused',
    duration: 'Duration',
    durationUnknown: 'Not provided',
    jobPartialTitle: 'Preparation finished. Some scenes need attention.',
    jobPartialBody:
      '{ready} playable scenes ready. {pending} included games still need preparation.',
    jobCompleted: 'Your scenes are ready.',
    jobCancelled: 'Preparation stopped.',
    jobIdleBody:
      'Included games will be matched with artwork, downloaded, and checked for playback.',
    jobCompletedBody: 'Prepared scenes are available in your library and preview.',
    processed: 'processed',
    pause: 'Pause',
    resume: 'Resume',
    cancel: 'Cancel',
    retry: 'Retry failed',
    start: 'Start preparation',
    preparing: 'Preparing',
    waiting: 'Waiting',
    excluded: 'Excluded',
    current: 'Current game',
    bytesDownloaded: 'downloaded',
    errors: 'Some scenes need attention',
    previewEyebrow: 'PLAYER',
    previewTitle: 'Screensaver preview',
    previewSub: 'Play the prepared animations with your current settings.',
    previewEmpty: 'No prepared animations',
    previewEmptyBody: 'Prepare at least one included scene to start your local preview.',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    playing: 'Playing your local collection',
    paused: 'Preview paused',
    previewMediaError: 'A prepared scene could not be played. Repair the library in Settings.',
    previewNote:
      'Space to pause · ← / → to change scene · F for fullscreen · Escape to exit fullscreen. The installed player uses the same prepared files.',
    settingsEyebrow: 'CONFIGURATION',
    settingsTitle: 'Settings',
    settingsSub: 'Manage API keys, playback, Steam installation and local files.',
    steamGridDb: 'SteamGridDB connection',
    keyBody:
      'Use your personal SteamGridDB API key to discover artwork. It stays on this device and is never sent to the player.',
    keyPlaceholder: 'Paste your SteamGridDB API key',
    replaceKey: 'Replace your saved key',
    saveKey: 'Save key',
    validateKey: 'Validate connection',
    getKey: 'Get a free SteamGridDB API key',
    keySaved: 'A personal key is saved on this device.',
    keyMissing: 'No API key saved yet.',
    playback: 'Playback',
    language: 'Language',
    sceneDuration: 'Time per scene',
    durationHint: 'Seconds before the next artwork.',
    shuffle: 'Shuffle rotation',
    shuffleHint: 'Randomize the animation order.',
    transition: 'Transition',
    crossfade: 'Crossfade',
    cut: 'Cut',
    showLogos: 'Show game titles',
    logosHint: 'Display the game name over the animation.',
    showCover: 'Show a still cover',
    coverHint:
      'Prepare your library to download covers. A local still frame is used when unavailable.',
    coverPosition: 'Cover position',
    framing: 'Animation framing',
    framingHint:
      'Original preserves the full image. Crop trims edges to a true 16:9 or 16:10 window without stretching. Prepare again only when changing the animation; Update / Repair applies framing to Steam.',
    frameOriginal: 'Original · full image',
    frame169: 'Crop · 16:9',
    frame1610: 'Crop · 16:10',
    frameInherit: 'Use general setting',
    cropTitle: 'Crop this animation',
    cropHint:
      'Choose the visible area. This changes display only and keeps the original file. Saved automatically; Update / Repair applies it to Steam. An axis is disabled when there is nothing to crop on it.',
    cropHorizontal: 'Horizontal position',
    cropVertical: 'Vertical position',
    centerCrop: 'Center crop',
    besideTitle: 'Beside the title',
    bottomRight: 'Bottom right',
    topRight: 'Top right',
    topLeft: 'Top left',
    smoothMotion: 'Smooth animations · 30 fps',
    smoothHint:
      'Optional offline interpolation, up to 1080p. Can take several minutes and create visual artifacts. Prepare again, then Update / Repair to apply. Originals are kept.',
    stageSmoothing: 'Interpolating animation · 30 fps',
    maxSmoothingMB: 'Maximum size per processed video (MB)',
    smoothingSizeHint:
      '0 = no per-video limit. The total library storage limit and free disk space still apply.',
    fixedArtwork: 'Fixed artwork',
    fixedArtworkBody:
      'Choose a still SteamGridDB cover independently of the animation. Update the Steam export afterward.',
    chooseCover: 'Choose / change fixed artwork',
    automaticCover: 'Use automatic artwork',
    coverSelected: 'Fixed artwork saved. The animation is unchanged.',
    applyingCover: 'Preparing fixed artwork…',
    previewUnavailable: 'Preview unavailable',
    staticFallback: 'Allow still artwork',
    staticHint: 'Use still images when no animation is available.',
    reducedMotion: 'Reduce motion',
    motionHint: 'Reduce transitions and interface motion.',
    pauseOnGame: 'Pause preparation during games',
    pauseHint: 'Pause background preparation when a Steam game is detected on Linux.',
    storage: 'Local storage',
    storageLimit: 'Storage limit',
    storageHint: 'Maximum space reserved for prepared media.',
    clearUnused: 'Remove unused media',
    purgeMedia: 'Purge all media',
    purgeMediaHint:
      'Delete originals, processed animations, still artwork, previews and unfinished media. The installed Steam screensaver is removed too. Games, artwork choices, settings and API keys are kept.',
    confirmPurgeMedia:
      'Permanently delete ALL downloaded and processed images/animations, previews and temporary media?\n\nThe current preparation will stop and the installed Steam screensaver will be removed. Your games, artwork choices, settings and API keys will be kept.\n\nPrepare again and reinstall the screensaver to use it afterward.',
    purgeMediaSuccess: 'All media purged. Prepare again, then install the screensaver.',
    purgingMedia: 'Purging media…',
    previewsPaused:
      'Media was purged. Prepare your library or search for artwork to download again.',
    mediaPurgedPlaceholder: 'Media purged',
    lastMediaPurge: 'Last media purge',
    steamIntegration: 'Steam integration',
    steamInstallBody:
      'Copy the standalone player and prepared scenes into the Steam screensavers folder. Select steam-animated-screensaver in Steam settings afterward.',
    install: 'Install screensaver',
    repair: 'Update / repair',
    uninstall: 'Uninstall',
    integrationInstalled: 'Steam Animated Screensaver is installed',
    integrationNotInstalled: 'Steam Animated Screensaver is not installed',
    integrationNoSteam: 'Steam installation not found. Install and launch Steam, then scan again.',
    runtimeNote:
      'Installation copies the player files. Playback inside Steam must be verified on your device.',
    privacyTitle: 'Offline playback',
    privacyBody:
      'Library imports, Steam rankings and artwork downloads need internet access. Prepared playback uses local files without contacting those services.',
    credit:
      'Artwork belongs to its respective artists and rights holders. Artist credit is kept with each prepared scene.',
    saveSuccess: 'Settings saved.',
    keySuccess: 'API key saved.',
    keyValid: 'SteamGridDB connection verified.',
    keyInvalid: 'The key could not be verified.',
    scanSuccess: 'Steam library scan complete.',
    prepareSuccess: 'Preparation started.',
    removeSuccess: 'Game removed from your library.',
    includeSuccess: 'Rotation updated.',
    assetSuccess: 'Artwork selected. Prepare the game to use it in your rotation.',
    clearSuccess: 'Unused media removed.',
    installSuccess:
      'Screensaver installed. Select steam-animated-screensaver in Steam, then verify playback on your device.',
    repairSuccess: 'Screensaver files updated.',
    uninstallSuccess: 'Screensaver uninstalled.',
    operationError: 'Something went wrong.',
    connectionError:
      'Cannot connect to the local service. Start the Steam Animated Screensaver app or development server, then retry.',
    retryConnection: 'Reconnect',
    addTitle: 'Add a game',
    addBody: 'Search SteamGridDB and choose the exact game or edition you want.',
    searchPlaceholder: 'Game title, Steam AppID, or Steam Store URL…',
    search: 'Search',
    searchHint:
      'Search by title, numeric Steam AppID, or a Steam Store URL. Check names and app IDs to distinguish editions.',
    searchStart: 'Enter a game title, Steam AppID or Steam Store URL.',
    searching: 'Searching SteamGridDB…',
    noResults: 'No games found. Try a shorter title or a different spelling.',
    alreadyAdded: 'In library',
    add: 'Add',
    addedSuccess: 'Game added to your library.',
    searchKeyNeeded: 'Add a SteamGridDB API key in Settings to search for games.',
    close: 'Close',
    artworkTitle: 'Choose the scene.',
    artworkBody:
      'Automatic matching picks suitable artwork. Select an alternative to make the choice yours.',
    loadArtworks: 'Find artwork alternatives',
    artworksLoading: 'Finding artwork…',
    noArtworks: 'No compatible artwork found. Try enabling still artwork in Settings.',
    artworkCredit: 'Artwork by',
    selected: 'Selected',
    choose: 'Choose artwork',
    automatic: 'Automatic match',
    manualChoice: 'Your selection',
    source: 'View original artwork',
    removeGame: 'Remove game',
    noArtworkYet:
      'Prepare this game to find and download its artwork, or browse alternatives below.',
    steamId: 'Steam app',
    sgdbId: 'SGDB',
    size: 'Size',
    scene: 'scene',
    scenes: 'scenes',
    noGamesFound: 'No installed Steam games found. Add a game by title to begin.',
    scanDetected: 'Your Steam library is ready to explore.',
    sourceUnknown: 'Community artist',
    searchError: 'Search could not complete.',
    offlineOnly: 'Local playback',
    loading: 'Opening your collection…',
    seconds: 's',
    of: 'of',
    confirmRemove: 'Remove this game from your library? Its Steam installation is unchanged.',
    confirmUninstall: 'Remove only the Steam Animated Screensaver screensaver files from Steam?',
    confirmCancel: 'Stop preparation? Completed scenes will be kept.',
    unknownStage: 'Preparing local media',
    notIncluded: 'This game is excluded from rotation.',
    connectionLost: 'The local service is unavailable. Reconnecting…',
    notReady: 'No prepared scene',
    emptyReady: 'No prepared scenes yet.',
    emptyReadyBody: 'Prepare your included games to see them here.',
    returnLibrary: 'Go to library'
  },
  fr: {
    home: 'Accueil',
    library: 'Bibliothèque',
    preparation: 'Préparation',
    preview: 'Aperçu',
    settings: 'Réglages',
    tagline: 'Steam Animated Screensaver',
    connected: 'Bibliothèque Steam détectée',
    notDetected: 'Steam non détecté',
    collection: 'ÉCRAN DE VEILLE STEAM',
    homeTitle: 'Steam Animated Screensaver',
    homeSub:
      'Choisissez les jeux, préparez les animations et installez l’écran de veille dans Steam.',
    addGame: 'Ajouter un jeu',
    heroEyebrow: 'CONFIGURATION',
    heroTitle: 'Préparer l’écran de veille',
    heroBody:
      'Choisissez des jeux dans votre bibliothèque ou ajoutez-les manuellement. Téléchargez leurs illustrations, vérifiez l’aperçu, puis installez le lecteur dans Steam.',
    discover: 'Choisir les jeux',
    openPreview: 'Ouvrir l’aperçu',
    libraryGames: 'Jeux dans la bibliothèque',
    readyScenes: 'Scènes prêtes à lire',
    includedGames: 'Jeux inclus',
    storageUsed: 'Stockage local utilisé',
    collectionTitle: 'Votre collection',
    viewAll: 'Voir la bibliothèque',
    emptyTitle: 'Aucun jeu ajouté',
    emptyBody:
      'Nous recherchons les jeux installés sur cet appareil. Vous pouvez aussi ajouter un titre SteamGridDB, que vous y jouiez ici ou ailleurs.',
    scan: 'Analyser la bibliothèque Steam',
    scanAgain: 'Relancer l’analyse',
    scanning: 'Analyse des bibliothèques Steam…',
    step1: 'Ajouter des jeux',
    step1Body: 'Analysez votre bibliothèque Steam ou recherchez un titre pour l’ajouter vous-même.',
    step2: 'Préparer les animations',
    step2Body:
      'Connectez SteamGridDB, choisissez les illustrations et préparez vos scènes en local.',
    step3: 'Prévisualiser et installer',
    step3Body:
      'Découvrez le lecteur, puis installez-le dans le dossier des écrans de veille Steam.',
    libraryEyebrow: 'JEUX',
    libraryTitle: 'Votre bibliothèque',
    librarySub: 'Sélectionnez les jeux à inclure dans l’écran de veille.',
    prepareScreensaver: 'Préparer mon écran de veille',
    updateScreensaver: 'Actualiser mon écran de veille',
    installedFilter: 'Installés',
    manualFilter: 'Ajouts manuels',
    animatedFilter: 'Animations disponibles',
    missingFilter: 'Animation manquante',
    excludedFilter: 'Exclus',
    previous: 'Scène précédente',
    next: 'Scène suivante',
    repairLibrary: 'Réparer la bibliothèque',
    automaticChoice: 'Revenir à la sélection automatique',
    stageDownloading: 'Téléchargement de l’illustration',
    stageValidating: 'Vérification des médias locaux',
    stageOptimizing: 'Optimisation pour la lecture',
    stageSaving: 'Enregistrement de votre scène',
    shuffleShort: 'Aléatoire',
    titlesShort: 'Titres',
    transitionShort: 'Transition',
    fadeBlack: 'Fondu au noir',
    prepareScenes: 'Préparer les scènes',
    all: 'Tous les jeux',
    included: 'Inclus',
    ready: 'Prêts',
    needsAttention: 'À préparer',
    filterPlaceholder: 'Filtrer vos jeux…',
    noFilter: 'Aucun jeu dans cette vue.',
    noFilterBody: 'Essayez un autre filtre ou un autre terme.',
    noKey: 'Connectez SteamGridDB pour trouver les illustrations et préparer vos scènes.',
    connect: 'Connecter SteamGridDB',
    gameReady: 'Prêt',
    gameNew: 'À préparer',
    gameMissing: 'Sans illustration',
    gameError: 'À vérifier',
    installed: 'Installé',
    manual: 'Ajout manuel',
    include: 'Inclure dans la rotation',
    details: 'Voir les illustrations',
    animated: 'Animée',
    still: 'Image fixe',
    noMedia: 'Aucune scène locale',
    prepareEyebrow: 'ANIMATIONS',
    prepareTitle: 'Préparez vos scènes',
    prepareSub:
      'Les illustrations sont téléchargées et vérifiées en local. Le lecteur reste hors ligne.',
    queueTitle: 'File de préparation',
    queueEmpty: 'Votre file est vide.',
    queueEmptyBody:
      'Incluez des jeux dans la bibliothèque, puis préparez votre rotation hors ligne.',
    jobIdle: 'Aucune préparation en cours',
    jobRunning: 'Préparation en cours',
    jobPaused: 'Préparation en pause',
    duration: 'Durée',
    durationUnknown: 'Non fournie',
    jobPartialTitle: 'Préparation terminée. Certaines scènes restent à vérifier.',
    jobPartialBody: '{ready} scènes prêtes à lire. {pending} jeux inclus restent à préparer.',
    jobCompleted: 'Vos scènes sont prêtes.',
    jobCancelled: 'Préparation arrêtée.',
    jobIdleBody:
      'Les jeux inclus seront associés à une illustration, téléchargés et vérifiés pour la lecture.',
    jobCompletedBody: 'Retrouvez vos scènes préparées dans la bibliothèque et l’aperçu.',
    processed: 'traités',
    pause: 'Pause',
    resume: 'Reprendre',
    cancel: 'Arrêter',
    retry: 'Réessayer les échecs',
    start: 'Lancer la préparation',
    preparing: 'Préparation',
    waiting: 'En attente',
    excluded: 'Exclu',
    current: 'Jeu en cours',
    bytesDownloaded: 'téléchargés',
    errors: 'Certaines scènes nécessitent votre attention',
    previewEyebrow: 'LECTEUR',
    previewTitle: 'Aperçu de l’écran de veille',
    previewSub: 'Lisez les animations préparées avec les réglages actuels.',
    previewEmpty: 'Aucune animation préparée',
    previewEmptyBody: 'Préparez au moins une scène incluse pour lancer votre aperçu local.',
    fullscreen: 'Plein écran',
    exitFullscreen: 'Quitter le plein écran',
    playing: 'Lecture de votre collection locale',
    paused: 'Aperçu en pause',
    previewMediaError:
      'Une scène préparée est illisible. Réparez la bibliothèque dans les réglages.',
    previewNote:
      'Espace pour mettre en pause · ← / → pour changer de scène · F pour le plein écran · Échap pour quitter. Le lecteur installé utilise les mêmes fichiers préparés.',
    settingsEyebrow: 'CONFIGURATION',
    settingsTitle: 'Réglages',
    settingsSub: 'Gérez les clés API, la lecture, l’installation Steam et les fichiers locaux.',
    steamGridDb: 'Connexion SteamGridDB',
    keyBody:
      'Utilisez votre clé API personnelle SteamGridDB pour découvrir des illustrations. Elle reste sur cet appareil et n’est jamais transmise au lecteur.',
    keyPlaceholder: 'Collez votre clé API SteamGridDB',
    replaceKey: 'Remplacer la clé enregistrée',
    saveKey: 'Enregistrer la clé',
    validateKey: 'Vérifier la connexion',
    getKey: 'Obtenir une clé API SteamGridDB gratuite',
    keySaved: 'Une clé est enregistrée sur cet appareil.',
    keyMissing: 'Aucune clé API enregistrée.',
    playback: 'Lecture',
    language: 'Langue',
    sceneDuration: 'Durée de chaque scène',
    durationHint: 'Secondes avant l’illustration suivante.',
    shuffle: 'Lecture aléatoire',
    shuffleHint: 'Lire les animations dans un ordre aléatoire.',
    transition: 'Transition',
    crossfade: 'Fondu enchaîné',
    cut: 'Coupe directe',
    showLogos: 'Afficher les titres des jeux',
    logosHint: 'Afficher le nom du jeu sur l’animation.',
    showCover: 'Afficher une jaquette fixe',
    coverHint:
      'Préparez la bibliothèque pour télécharger les jaquettes. Une image locale sert de repli si aucune n’est disponible.',
    coverPosition: 'Emplacement de la jaquette',
    framing: 'Cadrage de l’animation',
    framingHint:
      'Original conserve toute l’image. Le recadrage retire les bords pour obtenir un vrai cadre 16:9 ou 16:10, sans déformation. Mettre à jour / Réparer applique le cadrage à Steam, sans nouvelle préparation.',
    frameOriginal: 'Original · image entière',
    frame169: 'Recadrer · 16:9',
    frame1610: 'Recadrer · 16:10',
    frameInherit: 'Suivre le réglage général',
    cropTitle: 'Recadrer cette animation',
    cropHint:
      'Choisissez la zone visible. Seul l’affichage change, le fichier original est conservé. Enregistrement automatique ; Mettre à jour / Réparer applique le cadrage à Steam. Un axe est désactivé lorsqu’aucun rognage n’est nécessaire sur cet axe.',
    cropHorizontal: 'Position horizontale',
    cropVertical: 'Position verticale',
    centerCrop: 'Centrer le cadrage',
    besideTitle: 'À côté du titre',
    bottomRight: 'En bas à droite',
    topRight: 'En haut à droite',
    topLeft: 'En haut à gauche',
    smoothMotion: 'Fluidifier les animations · 30 i/s',
    smoothHint:
      'Interpolation optionnelle hors ligne, jusqu’à 1080p. Peut prendre plusieurs minutes et créer des déformations. Préparez à nouveau, puis Mettre à jour / Réparer pour appliquer. Les originaux sont conservés.',
    stageSmoothing: 'Interpolation de l’animation · 30 i/s',
    maxSmoothingMB: 'Poids maximal par vidéo traitée (Mo)',
    smoothingSizeHint:
      '0 = aucune limite par vidéo. La limite de stockage de la bibliothèque et l’espace disque disponible restent applicables.',
    fixedArtwork: 'Artwork fixe',
    fixedArtworkBody:
      'Choisissez une jaquette SteamGridDB indépendamment de l’animation. Mettez ensuite à jour l’export Steam.',
    chooseCover: 'Choisir / modifier l’artwork fixe',
    automaticCover: 'Revenir au choix automatique',
    coverSelected: 'Artwork fixe enregistré. L’animation est conservée.',
    applyingCover: 'Préparation de l’artwork fixe…',
    previewUnavailable: 'Aperçu indisponible',
    staticFallback: 'Autoriser les images fixes',
    staticHint: 'Utiliser une image fixe lorsqu’aucune animation n’est disponible.',
    reducedMotion: 'Réduire les animations',
    motionHint: 'Réduire les transitions et les animations de l’interface.',
    pauseOnGame: 'Suspendre la préparation pendant les jeux',
    pauseHint: 'Suspendre la préparation lorsqu’un jeu Steam est détecté sous Linux.',
    storage: 'Stockage local',
    storageLimit: 'Limite de stockage',
    storageHint: 'Espace maximal réservé aux médias préparés.',
    clearUnused: 'Supprimer les médias inutilisés',
    purgeMedia: 'Purger tous les médias',
    purgeMediaHint:
      'Supprime les originaux, animations traitées, artworks fixes, aperçus et fichiers temporaires. La copie de l’économiseur installée dans Steam est aussi supprimée. Les jeux, choix d’artworks, réglages et clés API sont conservés.',
    confirmPurgeMedia:
      'Supprimer définitivement TOUTES les images et animations téléchargées ou traitées, les aperçus et fichiers temporaires ?\n\nLa préparation en cours sera arrêtée et l’économiseur installé dans Steam sera désinstallé. Vos jeux, choix d’artworks, réglages et clés API seront conservés.\n\nIl faudra préparer à nouveau puis réinstaller l’économiseur.',
    purgeMediaSuccess:
      'Tous les médias ont été purgés. Préparez à nouveau, puis installez l’économiseur.',
    purgingMedia: 'Purge des médias…',
    previewsPaused:
      'Les médias ont été purgés. Préparez la bibliothèque ou recherchez des artworks pour les télécharger à nouveau.',
    mediaPurgedPlaceholder: 'Médias purgés',
    lastMediaPurge: 'Dernière purge des médias',
    steamIntegration: 'Intégration Steam',
    steamInstallBody:
      'Copiez le lecteur autonome et ses scènes dans le dossier des écrans de veille Steam. Sélectionnez ensuite steam-animated-screensaver dans les réglages Steam.',
    install: 'Installer l’écran de veille',
    repair: 'Mettre à jour / réparer',
    uninstall: 'Désinstaller',
    integrationInstalled: 'Steam Animated Screensaver est installé',
    integrationNotInstalled: 'Steam Animated Screensaver n’est pas installé',
    integrationNoSteam:
      'Installation Steam introuvable. Installez et lancez Steam, puis relancez l’analyse.',
    runtimeNote:
      'L’installation copie les fichiers du lecteur. La lecture dans Steam doit être vérifiée sur votre appareil.',
    privacyTitle: 'Lecture hors ligne',
    privacyBody:
      'Les imports de bibliothèque, classements Steam et téléchargements nécessitent Internet. La lecture préparée utilise les fichiers locaux.',
    credit:
      'Les illustrations appartiennent à leurs artistes et ayants droit. Chaque scène conserve le crédit de son artiste.',
    saveSuccess: 'Réglages enregistrés.',
    keySuccess: 'Clé API enregistrée.',
    keyValid: 'Connexion SteamGridDB vérifiée.',
    keyInvalid: 'La clé n’a pas pu être vérifiée.',
    scanSuccess: 'Analyse de la bibliothèque terminée.',
    prepareSuccess: 'Préparation lancée.',
    removeSuccess: 'Jeu retiré de votre bibliothèque.',
    includeSuccess: 'Rotation mise à jour.',
    assetSuccess: 'Illustration choisie. Préparez le jeu pour l’utiliser dans votre rotation.',
    clearSuccess: 'Médias inutilisés supprimés.',
    installSuccess:
      'Écran de veille installé. Sélectionnez steam-animated-screensaver dans Steam, puis vérifiez la lecture sur votre appareil.',
    repairSuccess: 'Fichiers de l’écran de veille mis à jour.',
    uninstallSuccess: 'Écran de veille désinstallé.',
    operationError: 'Une erreur est survenue.',
    connectionError:
      'Connexion au service local impossible. Lancez Steam Animated Screensaver ou le serveur de développement, puis réessayez.',
    retryConnection: 'Reconnecter',
    addTitle: 'Ajouter un jeu',
    addBody: 'Recherchez sur SteamGridDB et choisissez le jeu ou l’édition souhaitée.',
    searchPlaceholder: 'Titre, AppID Steam ou URL du magasin Steam…',
    search: 'Rechercher',
    searchHint:
      'Recherchez un titre, un AppID numérique ou une URL du magasin Steam. Vérifiez le nom et l’identifiant pour distinguer les éditions.',
    searchStart: 'Saisissez un titre, un AppID Steam ou une URL du magasin Steam.',
    searching: 'Recherche sur SteamGridDB…',
    noResults: 'Aucun jeu trouvé. Essayez un titre plus court ou une autre orthographe.',
    alreadyAdded: 'Déjà ajouté',
    add: 'Ajouter',
    addedSuccess: 'Jeu ajouté à votre bibliothèque.',
    searchKeyNeeded: 'Ajoutez une clé API SteamGridDB dans les réglages pour rechercher des jeux.',
    close: 'Fermer',
    artworkTitle: 'Choisir une illustration',
    artworkBody:
      'La sélection automatique trouve une illustration adaptée. Choisissez une alternative pour personnaliser votre collection.',
    loadArtworks: 'Trouver d’autres illustrations',
    artworksLoading: 'Recherche d’illustrations…',
    noArtworks:
      'Aucune illustration compatible. Essayez d’autoriser les images fixes dans les réglages.',
    artworkCredit: 'Illustration de',
    selected: 'Sélectionnée',
    choose: 'Choisir l’illustration',
    automatic: 'Sélection automatique',
    manualChoice: 'Votre sélection',
    source: 'Voir l’illustration originale',
    removeGame: 'Retirer le jeu',
    noArtworkYet:
      'Préparez ce jeu pour télécharger son illustration, ou explorez les alternatives ci-dessous.',
    steamId: 'Application Steam',
    sgdbId: 'SGDB',
    size: 'Taille',
    scene: 'scène',
    scenes: 'scènes',
    noGamesFound: 'Aucun jeu Steam installé trouvé. Ajoutez un jeu par son titre pour commencer.',
    scanDetected: 'Votre bibliothèque Steam est prête à être explorée.',
    sourceUnknown: 'Artiste communautaire',
    searchError: 'La recherche n’a pas abouti.',
    offlineOnly: 'Lecture locale',
    loading: 'Ouverture de votre collection…',
    seconds: 's',
    of: 'sur',
    confirmRemove: 'Retirer ce jeu de votre bibliothèque ? Son installation Steam est conservée.',
    confirmUninstall:
      'Supprimer uniquement les fichiers Steam Animated Screensaver des écrans de veille Steam ?',
    confirmCancel: 'Arrêter la préparation ? Les scènes terminées seront conservées.',
    unknownStage: 'Préparation des médias locaux',
    notIncluded: 'Ce jeu est exclu de la rotation.',
    connectionLost: 'Service local indisponible. Reconnexion en cours…',
    notReady: 'Aucune scène préparée',
    emptyReady: 'Aucune scène prête pour le moment.',
    emptyReadyBody: 'Préparez les jeux inclus pour les retrouver ici.',
    returnLibrary: 'Voir la bibliothèque'
  }
};
Object.assign(translations.en, {
  diagnosticsTitle: 'Diagnostic logs',
  logsHint:
    'Errors, preparation steps and crash details are saved locally as JSON. API keys are redacted. Nothing is uploaded. Up to five 4 MB log files are retained.',
  openLogs: 'Show JSON log file',
  logsUnavailable: 'Diagnostic logs are unavailable.',
  smoothMotion: 'Smooth animations',
  smoothHint:
    'Prepare once, then Update / Repair to apply. Originals are kept. Already fluid animations keep their original frame rate.',
  smoothingMode: 'Processing method',
  smoothingFps: 'Target frame rate',
  modeFast: 'Fast · motion interpolation · 720p · VP8',
  modeQuality: 'Quality · motion interpolation · 1080p · VP9',
  modeBlend: 'Very light · frame blending · 720p · VP8',
  smoothingModeHint:
    'Fast reduces processing resolution and encoding cost. Very light avoids motion estimation but can produce double edges. Quality is slower. No upscaling.',
  phaseCoverCheck: 'Checking the fixed artwork',
  phaseCoverPrepare: 'Downloading and preparing the fixed artwork',
  phasePausedGame: 'Paused while a Steam game is running',
  liveHistory: 'Live activity',
  phaseProgress: 'Current step',
  overallProgress: 'Overall library',
  elapsed: 'Elapsed',
  remainingTime: 'Remaining (estimate)',
  frames: 'frames',
  phaseChecking: 'Checking existing local files',
  phaseFinding: 'Finding artwork on SteamGridDB',
  phaseInspect: 'Checking the source animation',
  phaseDecode: 'Reconstructing WebP frames (alpha and disposal)',
  phaseSmoothing: 'Creating intermediate frames and encoding WebM',
  phaseVerify: 'Decoding the result to check duration and integrity',
  phaseSave: 'Saving the verified animation',
  phaseDone: 'Smoothed animation saved',
  phaseReady: 'Scene ready',
  phaseMissing: 'No suitable animation found',
  phaseError: 'Processing failed',
  phaseSmoothError: 'Smoothing failed; original kept',
  phaseCompleted: 'Library preparation complete',
  historyEmpty: 'Start preparing to see each operation here.',
  steamAccountTitle: 'Steam library import',
  steamAccountBody:
    'Optional. Import owned games, including those not installed. Uses your personal Steam Web API key, saved only on this device. No hosted service.',
  steamProfile: 'SteamID64 or Steam profile URL',
  steamApiKey: 'Steam Web API key (separate from SteamGridDB)',
  saveSteamAccount: 'Save Steam account',
  importSteam: 'Import my Steam library',
  steamAccountSaved: 'Steam account saved locally',
  steamImportSuccess: 'Steam library imported',
  steamImportHint:
    'New imported games start excluded. Include the games you want in My Library. Game details must be accessible to the API. A failed import keeps the previous library.',
  steamGetKey: 'Create my Steam Web API key',
  steamForgetKey: 'Remove Steam API key',
  steamImported: 'Last import',
  notInstalledFilter: 'Not installed',
  ownedFilter: 'Steam account',
  steamImportedCount: 'owned games',
  importingSteam: 'Importing Steam library…'
});
Object.assign(translations.fr, {
  diagnosticsTitle: 'Journaux de diagnostic',
  logsHint:
    'Les erreurs, étapes de préparation et détails des crashs sont enregistrés localement en JSON. Les clés API sont masquées. Aucun envoi automatique. Conservation de cinq fichiers de 4 Mo maximum.',
  openLogs: 'Afficher le fichier JSON',
  logsUnavailable: 'Les journaux de diagnostic sont indisponibles.',
  smoothMotion: 'Fluidifier les animations',
  smoothHint:
    'Préparez une fois, puis Mettre à jour / Réparer pour appliquer. Les originaux sont conservés. Les animations déjà fluides gardent leur cadence d’origine.',
  smoothingMode: 'Méthode de traitement',
  smoothingFps: 'Cadence cible',
  modeFast: 'Rapide · interpolation de mouvement · 720p · VP8',
  modeQuality: 'Qualité · interpolation de mouvement · 1080p · VP9',
  modeBlend: 'Très léger · mélange d’images · 720p · VP8',
  smoothingModeHint:
    'Rapide réduit la résolution de calcul et le coût de l’encodage. Très léger évite le calcul du mouvement, mais peut dédoubler les contours. Qualité est plus lent. Aucun agrandissement.',
  phaseCoverCheck: 'Vérification de l’artwork fixe',
  phaseCoverPrepare: 'Téléchargement et préparation de l’artwork fixe',
  phasePausedGame: 'En pause pendant une partie Steam',
  liveHistory: 'Historique en direct',
  phaseProgress: 'Étape en cours',
  overallProgress: 'Bibliothèque complète',
  elapsed: 'Écoulé',
  remainingTime: 'Restant estimé',
  frames: 'images',
  phaseChecking: 'Vérification des fichiers locaux existants',
  phaseFinding: 'Recherche des illustrations sur SteamGridDB',
  phaseInspect: 'Analyse de l’animation source',
  phaseDecode: 'Reconstruction des images WebP (transparence et effacement)',
  phaseSmoothing: 'Création des images intermédiaires et encodage WebM',
  phaseVerify: 'Décodage du résultat pour vérifier sa durée et son intégrité',
  phaseSave: 'Enregistrement de l’animation vérifiée',
  phaseDone: 'Animation fluidifiée enregistrée',
  phaseReady: 'Scène prête',
  phaseMissing: 'Aucune animation adaptée',
  phaseError: 'Échec du traitement',
  phaseSmoothError: 'Échec de la fluidification ; original conservé',
  phaseCompleted: 'Préparation de la bibliothèque terminée',
  historyEmpty: 'Lancez la préparation pour suivre chaque opération ici.',
  steamAccountTitle: 'Importer la bibliothèque Steam',
  steamAccountBody:
    'Facultatif. Retrouvez vos jeux possédés, même non installés. Utilise votre clé API Steam personnelle, enregistrée uniquement sur cet appareil. Aucun service à héberger.',
  steamProfile: 'SteamID64 ou lien du profil Steam',
  steamApiKey: 'Clé API Steam (distincte de SteamGridDB)',
  saveSteamAccount: 'Enregistrer le compte Steam',
  importSteam: 'Importer ma bibliothèque Steam',
  steamAccountSaved: 'Compte Steam enregistré localement',
  steamImportSuccess: 'Bibliothèque Steam importée',
  steamImportHint:
    'Les nouveaux jeux importés sont exclus au départ. Incluez ceux souhaités dans Ma bibliothèque. Les détails des jeux doivent être accessibles à l’API. Un échec conserve la bibliothèque précédente.',
  steamGetKey: 'Créer ma clé API Steam',
  steamForgetKey: 'Supprimer la clé API Steam',
  steamImported: 'Dernier import',
  notInstalledFilter: 'Non installés',
  ownedFilter: 'Compte Steam',
  steamImportedCount: 'jeux possédés',
  importingSteam: 'Import de la bibliothèque Steam…'
});
Object.assign(translations.en, {
  quickSelection: 'Quick selection',
  selectShown: 'Select all shown',
  deselectShown: 'Deselect all shown',
  selectionScope:
    '{shown} games shown · {included} included. Group actions affect this filtered list only.',
  popularOwned: 'My 100 most popular on Steam',
  personalTop: 'My 100 most played',
  steamTop: 'Import Steam’s current top 100',
  selectionHint:
    'Your two top-100 selections replace inclusion only among your owned games shown here. Popularity uses concurrent Steam players (cached for 30 minutes). Personal ranking uses total playtime from your Steam account import.',
  globalTopHint:
    'The Steam import is independent of filters and ownership. Up to 100 entries from the live ranking; software and Steam components are removed. New entries start excluded. Artwork still requires your SteamGridDB key.',
  popularFilter: 'Steam top 100',
  selectionRunning: 'Reading Steam popularity',
  selectionCancel: 'Cancel selection',
  selectionCancelled: 'Cancelled. Previous choices preserved.',
  selectionDone: 'Top selection completed: {count} games.',
  globalTopDone: '{count} games from Steam’s top 100 · {added} new. Existing choices preserved.',
  selectionPreparation: 'Finish or cancel the preparation queue to change a group of games.',
  selectionPlaytimeHint: 'Import your Steam library again to retrieve the missing playtimes.'
});
Object.assign(translations.fr, {
  quickSelection: 'Sélection rapide',
  selectShown: 'Tout sélectionner',
  deselectShown: 'Tout désélectionner',
  selectionScope:
    '{shown} jeux affichés · {included} inclus. Les actions groupées concernent uniquement cette liste filtrée.',
  popularOwned: 'Mes 100 plus populaires sur Steam',
  personalTop: 'Mes 100 les plus joués',
  steamTop: 'Importer le top 100 Steam actuel',
  selectionHint:
    'Les deux sélections de 100 remplacent les inclusions uniquement parmi vos jeux possédés affichés ici. La popularité utilise les joueurs simultanés Steam (cache de 30 min). Le classement personnel utilise le temps de jeu total de l’import du compte Steam.',
  globalTopHint:
    'L’import Steam est indépendant des filtres et de vos achats. Jusqu’à 100 entrées du classement actuel ; logiciels et composants Steam sont retirés. Les nouveaux jeux sont exclus au départ. Les images nécessitent toujours votre clé SteamGridDB.',
  popularFilter: 'Top 100 Steam',
  selectionRunning: 'Lecture de la popularité Steam',
  selectionCancel: 'Annuler la sélection',
  selectionCancelled: 'Annulé. Vos choix précédents sont conservés.',
  selectionDone: 'Sélection effectuée : {count} jeux.',
  globalTopDone:
    '{count} jeux du top 100 Steam · {added} nouveaux. Vos choix existants sont conservés.',
  selectionPreparation:
    'Terminez ou annulez la file de préparation pour modifier un groupe de jeux.',
  selectionPlaytimeHint:
    'Importez à nouveau votre bibliothèque Steam pour récupérer les temps de jeu manquants.'
});
function durationText(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const n = Math.max(0, Math.round(seconds));
  return n >= 60 ? `${Math.floor(n / 60)} min ${n % 60} s` : `${n} s`;
}
function phaseLabel(stage, detail = {}) {
  const key = {
    downloading: 'stageDownloading',
    validating: 'stageValidating',
    optimizing: 'stageOptimizing',
    saving: 'stageSaving',
    'checking-local': 'phaseChecking',
    'finding-artwork': 'phaseFinding',
    'smoothing-inspect': 'phaseInspect',
    'smoothing-decode': 'phaseDecode',
    smoothing: 'phaseSmoothing',
    'smoothing-verify': 'phaseVerify',
    'smoothing-save': 'phaseSave',
    'smoothing-done': 'phaseDone',
    'game-ready': 'phaseReady',
    'game-missing': 'phaseMissing',
    'game-error': 'phaseError',
    'smoothing-error': 'phaseSmoothError',
    'cover-check': 'phaseCoverCheck',
    'cover-prepare': 'phaseCoverPrepare',
    'paused-game': 'phasePausedGame',
    completed: 'phaseCompleted',
    paused: 'paused',
    cancelled: 'jobCancelled'
  }[stage];
  return (
    (key ? t(key) : stage || t('unknownStage')) +
    (detail.targetFps
      ? ` · ${detail.targetFps} ${lang() === 'fr' ? 'i/s' : 'fps'} · ${String(detail.codec || '').toUpperCase()}`
      : '')
  );
}
function jobActivity(job) {
  const d = job.detail || {},
    stage = job.stage;
  const explanation =
    stage === 'smoothing'
      ? t(d.mode === 'blend' ? 'modeBlend' : d.mode === 'quality' ? 'modeQuality' : 'modeFast')
      : '';
  const elapsed = job.stageElapsed ?? null;
  return `<div class="job-detail"><p>${esc(explanation)}</p><div class="job-metrics">${Number.isFinite(d.frames) ? `<span>${Number(d.frames)} / ${Number(d.totalFrames) || '—'} ${esc(t('frames'))}</span>` : ''}${Number.isFinite(d.seconds) ? `<span>${d.seconds.toFixed(1)} / ${Number(d.duration).toFixed(1)} s</span>` : ''}${elapsed !== null && job.current ? `<span>${esc(t('elapsed'))} : ${durationText(elapsed)}</span>` : ''}${Number.isFinite(d.speed) ? `<span>×${d.speed.toFixed(2)}</span>` : ''}${Number.isFinite(d.eta) ? `<span>${esc(t('remainingTime'))} : ${durationText(d.eta)}</span>` : ''}</div></div><section class="job-history" aria-label="${esc(t('liveHistory'))}"><h3>${esc(t('liveHistory'))}</h3>${
    job.history?.length
      ? `<ol>${job.history
          .slice(-100)
          .reverse()
          .map(
            (e) =>
              `<li><time datetime="${new Date(e.at).toISOString()}">${new Date(e.at).toLocaleTimeString(lang())}</time><div>${e.game ? `<strong>${esc(e.game)}</strong> · ` : ''}${esc(phaseLabel(e.stage, e))}${Number.isFinite(e.progress) ? ` <b>${Math.round(e.progress * 100)} %</b>` : ''}${e.frames ? ` · ${e.frames}/${e.totalFrames} ${esc(t('frames'))}` : ''}${e.message ? `<small>${esc(e.message)}</small>` : ''}</div></li>`
          )
          .join('')}</ol>`
      : `<p>${esc(t('historyEmpty'))}</p>`
  }</section>`;
}
function steamAccountPanel() {
  const account = state.steamAccount || {};
  return panel(
    'steamAccountTitle',
    'steam',
    `<div id="steam-account-settings"><p>${esc(t('steamAccountBody'))}</p><form id="steam-account-form"><label class="account-field">${esc(t('steamProfile'))}<input class="field" id="steam-profile" value="${attr(account.profile || '')}" placeholder="https://steamcommunity.com/id/…" required></label><label class="account-field">${esc(t('steamApiKey'))}<input class="field" id="steam-api-key" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(t(account.hasKey ? 'replaceKey' : 'keyPlaceholder'))}"></label>${button(t('saveSteamAccount'), 'save-steam-account', 'check', true, 'type="submit"')}</form><div class="button-row" style="margin-top:16px">${button(t(importingSteam ? 'importingSteam' : 'importSteam'), 'import-steam', 'scan', false, !account.hasKey || !account.profile || importingSteam ? 'disabled' : '')}${account.hasKey ? button(t('steamForgetKey'), 'forget-steam-key', 'trash') : ''}</div><p>${esc(t('steamImportHint'))}</p>${account.lastImport ? `<p>${esc(t('steamImported'))} : ${esc(new Date(account.lastImport).toLocaleString(lang()))} · ${Number(account.count)} ${esc(t('steamImportedCount'))}</p>` : ''}<a class="key-link" href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer">${esc(t('steamGetKey'))} ↗</a></div>`
  );
}
const app = document.querySelector('#app'),
  addDialog = document.querySelector('#add-dialog'),
  detailDialog = document.querySelector('#detail-dialog');
const defaultState = {
  games: [],
  settings: {
    language: 'en',
    sceneDuration: 24,
    shuffle: true,
    transition: 'crossfade',
    showLogos: true,
    showCover: true,
    coverPosition: 'beside-title',
    framing: 'original',
    smoothMotion: false,
    smoothingFps: 30,
    smoothingMode: 'fast',
    maxSmoothingMB: 0,
    staticFallback: false,
    reducedMotion: false,
    maxStorageGB: 10,
    pauseOnGame: true
  },
  job: { status: 'idle', total: 0, processed: 0, errors: [], bytes: 0 },
  steam: { detected: false, installed: false, roots: [] },
  storage: { used: 0 },
  hasKey: false
};
let state = structuredClone(defaultState),
  route = 'home',
  filter = 'all',
  query = '',
  loaded = false,
  connectionError = false,
  scanning = false,
  pending = false,
  lastSnapshot = '',
  previewPlaying = true,
  previewSignature = '',
  polling = false,
  detailId = null,
  assets = null,
  coverAssets = null,
  coverChoosing = false,
  searchResults = null,
  searchTerm = '',
  searchPending = false,
  importingSteam = false,
  purgingMedia = false,
  previewGeneration = 0,
  toastTimer;
const lang = () => (state.settings.language === 'fr' ? 'fr' : 'en');
const t = (key) => translations[lang()][key] || translations.en[key] || key;
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const attr = esc;
const bytes = (value) => {
  const n = Number(value) || 0;
  return n >= 1073741824
    ? `${(n / 1073741824).toLocaleString(lang(), { maximumFractionDigits: 1 })} GB`
    : n >= 1048576
      ? `${(n / 1048576).toLocaleString(lang(), { maximumFractionDigits: 1 })} MB`
      : `${Math.round(n / 1024)} KB`;
};
window.addEventListener('message', (event) => {
  if (
    event.source !== document.querySelector('#player-frame')?.contentWindow ||
    event.origin !== location.origin ||
    event.data?.type !== 'screensaver-player'
  )
    return;
  if (event.data.status === 'media-error') toast(t('previewMediaError'));
});
const readyGames = () =>
  state.games.filter(
    (g) =>
      g.included &&
      g.status === 'ready' &&
      g.media?.file &&
      (g.media.animated || state.settings.staticFallback)
  );
const button = (label, action, ic = '', primary = false, extra = '') =>
  `<button class="button ${primary ? 'primary' : ''} ${['uninstall', 'remove-game', 'purge-media'].includes(action) ? 'danger' : ''}" data-action="${action}" ${extra}>${ic ? icon(ic) : ''}${esc(label)}</button>`;
const statusName = (g) =>
  t(
    { ready: 'gameReady', new: 'gameNew', missing: 'gameMissing', error: 'gameError' }[g.status] ||
      'gameNew'
  );
const empty = (title, body, actions = '', ic = 'film') =>
  `<div class="empty"><div class="empty-symbol">${icon(ic)}</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${actions ? `<div class="button-row">${actions}</div>` : ''}</div>`;
const safeRemote = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      ['cdn2.steamgriddb.com', 'cdn.steamgriddb.com', 'www.steamgriddb.com'].includes(u.hostname)
      ? u.href
      : '';
  } catch {
    return '';
  }
};
const localMedia = (value) => {
  if (!value) return '';
  const file = String(value).split('/').pop();
  return new URL(`/media/${encodeURIComponent(file)}`, location.href).href;
};
const thumbnail = (g) =>
  g.media?.thumbnail
    ? localMedia(g.media.thumbnail)
    : safeRemote(g.selectedAsset?.thumb) || safeRemote(g.thumb);
function previewImage(values, shape = 'asset', alt = '', sgdbId = null, steamAppId = null) {
  const candidates = [...new Set((state.previewsPaused ? [] : values).filter(Boolean))]
    .map((value) => {
      try {
        const u = new URL(value, location.href);
        if (
          u.protocol === location.protocol &&
          u.host === location.host &&
          u.pathname.startsWith('/media/')
        )
          return { file: decodeURIComponent(u.pathname.split('/').pop()) };
        return safeRemote(value) ? { url: value } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (!state.previewsPaused && !candidates.length && state.hasKey && (sgdbId || steamAppId))
    candidates.push(sgdbId ? { sgdbId } : { steamAppId });
  const direct =
    candidates[0]?.file && /\.(?:jpe?g|png|webp|gif)$/i.test(candidates[0].file)
      ? localMedia(candidates[0].file)
      : '';
  return `<span class="managed-image image-${shape}"><img data-preview-candidates="${attr(JSON.stringify(candidates))}" ${direct ? `src="${attr(direct)}"` : ''} alt="${esc(alt)}" decoding="async"><span class="preview-placeholder" aria-hidden="true">${icon('image')}<span class="preview-unavailable-label">${esc(t(state.previewsPaused ? 'mediaPurgedPlaceholder' : 'previewUnavailable'))}</span></span></span>`;
}
const normalizedPreviews = new Map();
async function normalizedPreview(candidate, force = false) {
  if (purgingMedia) throw new Error('Media purge in progress.');
  const generation = previewGeneration;
  const key = JSON.stringify(candidate);
  if (force) normalizedPreviews.delete(key);
  if (!normalizedPreviews.has(key)) {
    if (normalizedPreviews.size > 256)
      normalizedPreviews.delete(normalizedPreviews.keys().next().value);
    normalizedPreviews.set(
      key,
      invoke('previewImage', { ...candidate, force }).catch((error) => {
        if (generation === previewGeneration) normalizedPreviews.delete(key);
        throw error;
      })
    );
  }
  return normalizedPreviews.get(key);
}
async function hydratePreview(img, force = false) {
  if (purgingMedia || img._previewBusy || !img.isConnected) return;
  const generation = previewGeneration;
  img._previewBusy = true;
  const wrapper = img.closest('.managed-image');
  try {
    if (img.hasAttribute('src') && !force) {
      try {
        await img.decode();
        wrapper?.classList.add('loaded');
        return;
      } catch {}
    }
    const candidates = JSON.parse(img.dataset.previewCandidates || '[]');
    for (const candidate of candidates) {
      if (purgingMedia || generation !== previewGeneration || !img.isConnected) return;
      try {
        const result = await normalizedPreview(candidate, force);
        if (purgingMedia || generation !== previewGeneration || !img.isConnected) return;
        img.src = localMedia(result.file);
        await img.decode();
        wrapper?.classList.add('loaded');
        wrapper?.classList.remove('failed');
        return;
      } catch {
        img.removeAttribute('src');
      }
    }
    wrapper?.classList.remove('loaded');
    wrapper?.classList.add('failed');
  } finally {
    img._previewBusy = false;
  }
}
const previewObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        previewObserver.unobserve(entry.target);
        hydratePreview(entry.target);
      }
  },
  { rootMargin: '160px' }
);
const previewMutations = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.removedNodes)
      if (node.nodeType === 1) {
        if (node.matches('img[data-preview-candidates]')) previewObserver.unobserve(node);
        node
          .querySelectorAll('img[data-preview-candidates]')
          .forEach((img) => previewObserver.unobserve(img));
      }
    for (const node of record.addedNodes)
      if (node.nodeType === 1) {
        if (node.matches('img[data-preview-candidates]')) previewObserver.observe(node);
        node
          .querySelectorAll('img[data-preview-candidates]')
          .forEach((img) => previewObserver.observe(img));
      }
  }
});
previewMutations.observe(document.body, { childList: true, subtree: true });
document.addEventListener(
  'error',
  (event) => {
    const image = event.target;
    if (image.matches?.('img[data-preview-candidates]') && !image._previewBusy)
      hydratePreview(image, true);
    else if (
      image.matches?.('img.hero-media, img.detail-cover, video.hero-media, video.detail-cover') &&
      !image.dataset.repaired
    ) {
      image.dataset.repaired = 'true';
      const values = JSON.parse(image.dataset.previewFallback || '[]');
      const replacement = document.createElement('template');
      replacement.innerHTML = previewImage(
        values,
        image.classList.contains('hero-media') ? 'hero' : 'detail'
      );
      if (image.tagName === 'VIDEO') {
        image.pause();
        image.removeAttribute('src');
        image.load();
      }
      image.replaceWith(replacement.content.firstElementChild);
    }
  },
  true
);
const authorName = (value) =>
  typeof value === 'string' ? value : value?.name || t('sourceUnknown');
async function invoke(action, payload = {}) {
  if (window.screensaver?.invoke) return window.screensaver.invoke(action, payload);
  const response = await fetch('/api/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(t('connectionError'));
  }
  if (!response.ok || data.error) throw Error(data.error || t('operationError'));
  return Object.hasOwn(data, 'result') ? data.result : data;
}
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 4800);
}
async function refresh(force = false) {
  if (polling) return;
  polling = true;
  try {
    const previousLanguage = lang();
    const next = await invoke('state');
    if (!next || !Array.isArray(next.games)) throw Error(t('connectionError'));
    state = {
      ...defaultState,
      ...next,
      settings: { ...defaultState.settings, ...next.settings },
      job: { ...defaultState.job, ...next.job },
      steam: { ...defaultState.steam, ...next.steam },
      storage: { ...defaultState.storage, ...next.storage }
    };
    const snapshot = JSON.stringify(route === 'preparation' ? state : { ...state, job: null });
    const changed = snapshot !== lastSnapshot || connectionError;
    connectionError = false;
    loaded = true;
    lastSnapshot = snapshot;
    if (force || changed) {
      if (
        (!['INPUT', 'SELECT'].includes(document.activeElement?.tagName) || force) &&
        !(
          route === 'preview' &&
          document.querySelector('#player-frame') &&
          readyGames().length &&
          lang() === previousLanguage
        )
      )
        render();
      if (route === 'preview') sendCatalog();
    }
  } catch (error) {
    connectionError = true;
    if (!loaded) {
      loaded = true;
      render();
    } else if (!document.querySelector('.connection-error')) render();
  } finally {
    polling = false;
  }
}
let mutationQueue = Promise.resolve();
async function run(action, payload = {}, message, options = {}) {
  const previous = mutationQueue;
  let release;
  mutationQueue = new Promise((resolve) => (release = resolve));
  await previous;
  pending = true;
  document.body.setAttribute('aria-busy', 'true');
  document.querySelectorAll(`[data-action="${action}"]`).forEach((el) => (el.disabled = true));
  try {
    const result = await invoke(action, payload);
    await refresh(true);
    if (message) toast(t(message));
    return result;
  } catch (error) {
    if (['updateGame', 'settings'].includes(action)) await refresh(true);
    toast(error.message || t('operationError'));
    return undefined;
  } finally {
    pending = false;
    document.body.removeAttribute('aria-busy');
    document.querySelectorAll(`[data-action="${action}"]`).forEach((el) => (el.disabled = false));
    release();
  }
}
function shell() {
  return `<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">${icon('film')}</span><div><div class="brand-name">Steam <span>Animated Screensaver</span></div></div></div><nav class="nav" aria-label="${esc(t('tagline'))}">${['home', 'library', 'preparation', 'preview', 'settings'].map((r) => `<button data-route="${r}" class="${route === r ? 'active' : ''}" ${route === r ? 'aria-current="page"' : ''}>${icon(r === 'preparation' ? 'prepare' : r)}<span>${esc(t(r))}</span>${r === 'library' && state.games.length ? `<span class="nav-count">${state.games.length}</span>` : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="steam-status"><span class="status-dot ${state.steam.detected ? 'on' : ''}"></span>${esc(t(state.steam.detected ? 'connected' : 'notDetected'))}</div><div class="sidebar-foot">VERSION 0.1.8</div></div></aside><main class="main"><header class="topbar"><div class="breadcrumbs">Steam Animated Screensaver ${icon('arrow')}<span>${esc(t(route))}</span></div><div class="mobile-brand">${icon('film')} Steam Animated Screensaver</div><div class="top-actions"><button class="top-lang" data-action="language" aria-label="${lang() === 'en' ? 'Passer en français' : 'Switch to English'}">${lang() === 'en' ? 'EN / FR' : 'FR / EN'}</button></div></header><div class="content">${[...(state.warnings || []), ...(state.steam.warnings || [])].length ? `<div class="banner" role="status">${icon('info')}<span>${[...(state.warnings || []), ...(state.steam.warnings || [])].map(esc).join('<br>')}</span></div>` : ''}${connectionError ? `<div class="connection-error" role="alert">${esc(t('connectionError'))} ${button(t('retryConnection'), 'reconnect', 'refresh')}</div>` : ''}${{ home: homeView, library: libraryView, preparation: preparationView, preview: previewView, settings: settingsView }[route]()}</div></main></div>`;
}
function heading(eyebrow, title, sub, actions = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${esc(t(eyebrow))}</div><h1>${esc(t(title))}</h1><p>${esc(t(sub))}</p></div>${actions ? `<div class="button-row">${actions}</div>` : ''}</div>`;
}
function noLibrary() {
  return empty(
    t('emptyTitle'),
    t('emptyBody'),
    button(t(scanning ? 'scanning' : 'scan'), 'scan', 'scan', false, scanning ? 'disabled' : '') +
      button(t('addGame'), 'add-game', 'plus', true),
    'library'
  );
}
function keyBanner() {
  return !state.hasKey
    ? `<div class="banner">${icon('key')}<span>${esc(t('noKey'))}</span>${button(t('connect'), 'open-settings', 'arrow')}</div>`
    : '';
}
function homeView() {
  const count = state.games.length,
    ready = readyGames().length,
    featured = readyGames()[0],
    reduced =
      state.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroMedia = featured
    ? !reduced && featured.media.animated && /\.(mp4|webm)$/i.test(featured.media.file)
      ? `<video class="hero-media" data-preview-fallback="${attr(JSON.stringify([thumbnail(featured), localMedia(featured.media.file), featured.selectedAsset?.thumb]))}" src="${attr(localMedia(featured.media.file))}" poster="${attr(thumbnail(featured))}" autoplay muted loop playsinline aria-hidden="true"></video>`
      : `<img class="hero-media" data-preview-fallback="${attr(JSON.stringify([thumbnail(featured), localMedia(featured.media.file), featured.selectedAsset?.thumb]))}" src="${attr(!reduced && featured.media.animated ? localMedia(featured.media.file) : thumbnail(featured) || localMedia(featured.media.file))}" alt="">`
    : '';
  return `${heading('collection', 'homeTitle', 'homeSub', button(t('addGame'), 'add-game', 'plus'))}<section class="hero ${featured ? 'has-media' : ''}">${heroMedia}<div class="hero-copy"><div class="eyebrow">${esc(t('heroEyebrow'))}</div><h2>${esc(t('heroTitle')).replace('\n', '<br>')}</h2><p>${esc(t('heroBody'))}</p>${button(t(ready ? 'updateScreensaver' : 'prepareScreensaver'), 'prepare-home', 'prepare', true) + ` <button class="button ghost" data-action="${ready ? 'open-preview' : 'open-library'}">${icon(ready ? 'preview' : 'library')}${esc(t(ready ? 'openPreview' : 'discover'))}</button>`}</div>${!featured ? `<div class="hero-orbit" aria-hidden="true"></div><div class="screensaver-window" aria-hidden="true">${icon('film')}</div>` : `<div class="hero-credit">${esc(featured.name)}<span>${esc(t('artworkCredit'))} ${esc(authorName(featured.media.author))}</span></div>`}</section><div class="stats"><div class="stat"><div class="stat-number">${count.toString().padStart(2, '0')}</div><div class="stat-label">${esc(t('libraryGames'))}</div></div><div class="stat"><div class="stat-number">${ready.toString().padStart(2, '0')}</div><div class="stat-label">${esc(t('readyScenes'))}</div></div><div class="stat"><div class="stat-number">${state.games
    .filter((g) => g.included)
    .length.toString()
    .padStart(
      2,
      '0'
    )}</div><div class="stat-label">${esc(t('includedGames'))}</div></div><div class="stat"><div class="stat-number">${esc(bytes(state.storage.used))}</div><div class="stat-label">${esc(t('storageUsed'))}</div></div></div><section><div class="section-heading"><h2>${esc(t('collectionTitle'))}</h2><button class="text-button" data-route="library">${esc(t('viewAll'))}${icon('arrow')}</button></div>${count ? `<div class="game-grid">${state.games.slice(0, 6).map(gameCard).join('')}</div>` : noLibrary()}</section>${!count ? `<section class="guide-grid">${[1, 2, 3].map((i) => `<div class="guide-card"><div class="guide-number">0${i}</div><h3>${esc(t('step' + i))}</h3><p>${esc(t('step' + i + 'Body'))}</p></div>`).join('')}</section>` : ''}`;
}
function gameCard(g) {
  const image = thumbnail(g);
  return `<article class="game-card"><label class="include-switch" title="${esc(t('include'))}"><input type="checkbox" data-include="${attr(g.id)}" ${g.included ? 'checked' : ''} ${state.selectionJob?.status === 'running' ? 'disabled' : ''} aria-label="${esc(t('include') + ': ' + g.name)}">${icon('check')}</label><button class="game-visual" data-detail="${attr(g.id)}" aria-label="${esc(t('details') + ': ' + g.name)}">${previewImage([image, g.media?.file && localMedia(g.media.file), g.selectedAsset?.url], 'game', g.name, g.sgdbId, g.steamAppId)}<span class="game-status ${attr(g.status)}">${esc(statusName(g))}</span><span class="game-source">${esc(g.media ? (g.media.animated ? t('animated') : t('still')) : g.installed ? t('installed') : g.sources?.includes('account') ? t('ownedFilter') : g.sources?.includes('popular') ? t('popularFilter') : t('manual'))}</span></button><div class="game-info"><h3 class="game-name">${esc(g.name)}</h3><div class="game-meta"><span>${esc(g.media ? authorName(g.media.author) : t('noMedia'))}</span><button class="text-button" data-detail="${attr(g.id)}" aria-label="${esc(t('details') + ': ' + g.name)}">${icon('arrow')}</button></div></div></article>`;
}
function filteredLibrary() {
  const games = state.games.filter((g) =>
    window.ScreensaverSelection.matches(g, { filter, query })
  );
  return filter === 'popularFilter'
    ? games.sort((a, b) => (a.popularRank || 1000) - (b.popularRank || 1000))
    : games;
}
function quickSelection(games) {
  const job = state.selectionJob || { status: 'idle' },
    active = job.status === 'running';
  const queueActive =
    state.job.status === 'running' || (state.job.status === 'paused' && state.job.pending > 0);
  const blocked = active || queueActive;
  const owned = games.filter(window.ScreensaverSelection.ownedGame);
  const playtimes = owned.length && owned.every((g) => Number.isSafeInteger(g.playtimeMinutes));
  let status = '';
  if (active) {
    const percent = job.total ? Math.floor((job.processed / job.total) * 100) : 0;
    status = `<div class="selection-progress" data-selection-status="running" role="status"><strong>${esc(t('selectionRunning'))} · ${percent}%</strong><progress max="100" value="${percent}" aria-label="${esc(t('selectionRunning'))}"></progress><span>${Number(job.processed) || 0} / ${Number(job.total) || 0}${job.current ? ' · ' + esc(job.current) : ''}</span>${button(t('selectionCancel'), 'cancel-selection', 'close')}</div>`;
  } else if (job.status !== 'idle') {
    const message =
      job.status === 'error'
        ? job.error
        : job.status === 'cancelled'
          ? t('selectionCancelled')
          : t(job.kind === 'steam' ? 'globalTopDone' : 'selectionDone')
              .replace('{count}', job.selected || 0)
              .replace('{added}', job.added || 0);
    status = `<p class="selection-result ${job.status === 'error' ? 'error' : ''}" role="status" data-selection-status="${attr(job.status)}">${esc(message)}${job.rankedAt ? ' · ' + esc(new Date(job.rankedAt).toLocaleString(lang())) : ''}</p>`;
  }
  return `<section class="selection-panel" aria-label="${esc(t('quickSelection'))}"><h2>${esc(t('quickSelection'))}</h2><p>${esc(
    t('selectionScope')
      .replace('{shown}', games.length)
      .replace('{included}', games.filter((g) => g.included).length)
  )}</p><div class="button-row">${button(t('selectShown'), 'select-shown', 'check', false, blocked || !games.length ? 'disabled' : '')}${button(t('deselectShown'), 'deselect-shown', 'close', false, blocked || !games.length ? 'disabled' : '')}${button(t('popularOwned'), 'select-popular-owned', 'steam', false, blocked || !owned.length ? 'disabled' : '')}${button(t('personalTop'), 'select-personal-top', 'play', false, blocked || !playtimes ? 'disabled' : '')}</div><p>${esc(t('selectionHint'))}</p>${owned.length && !playtimes ? `<p>${esc(t('selectionPlaytimeHint'))}</p>` : ''}<div class="selection-global">${button(t('steamTop'), 'import-popular', 'plus', false, blocked ? 'disabled' : '')}<p>${esc(t('globalTopHint'))}</p><a class="key-link" href="https://store.steampowered.com/charts/mostplayed" target="_blank" rel="noopener noreferrer">Steam Charts ↗</a></div>${queueActive ? `<p>${esc(t('selectionPreparation'))}</p>` : ''}${status}</section>`;
}
function libraryView() {
  const games = filteredLibrary();
  return `${heading('libraryEyebrow', 'libraryTitle', 'librarySub', button(t('scanAgain'), 'scan', 'scan', false, scanning ? 'disabled' : '') + button(t('importSteam'), 'open-steam-account', 'steam') + button(t('addGame'), 'add-game', 'plus', true))}${state.games.length ? keyBanner() : ''}${state.previewsPaused ? `<div class="banner" role="status">${icon('info')}<span>${esc(t('previewsPaused'))}</span></div>` : ''}<div class="toolbar"><div class="filter-pills" role="group" aria-label="${esc(t('library'))}">${['all', 'installedFilter', 'notInstalledFilter', 'ownedFilter', 'manualFilter', 'popularFilter', 'ready', 'animatedFilter', 'missingFilter', 'excludedFilter'].map((f) => `<button data-filter="${f}" class="${filter === f ? 'active' : ''}">${esc(t(f))}${f === 'all' ? ` <span>(${state.games.length})</span>` : ''}</button>`).join('')}</div><label class="search-field">${icon('search')}<span class="visually-hidden">${esc(t('filterPlaceholder'))}</span><input class="field" id="library-filter" placeholder="${esc(t('filterPlaceholder'))}" value="${attr(query)}"></label></div>${quickSelection(games)}${!state.games.length ? noLibrary() : games.length ? `<div class="game-grid">${games.map(gameCard).join('')}</div>` : empty(t('noFilter'), t('noFilterBody'), '', 'search')}${state.games.length ? `<div class="button-row" style="margin-top:24px">${button(t('prepareScenes'), 'prepare-all', 'prepare', true, !state.hasKey || !state.games.some((g) => g.included) ? 'disabled' : '')}</div>` : ''}`;
}
function preparationView() {
  const job = state.job,
    status = job.status || 'idle',
    included = state.games.filter((g) => g.included),
    overall = job.total ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0,
    percent = Number.isFinite(job.progress) ? Math.round(job.progress * 100) : null,
    active = status === 'running' || status === 'paused',
    playable = readyGames().length,
    remaining = included.length - playable,
    partial = status === 'completed' && (remaining > 0 || job.errors?.length),
    optionalIssues = included.flatMap((g) =>
      [state.settings.showCover && g.coverError, state.settings.smoothMotion && g.smoothingError]
        .filter(Boolean)
        .map((error) => `${g.name}: ${error}`)
    );
  let controls = active
    ? button(
        t(status === 'paused' ? 'resume' : 'pause'),
        status === 'paused' ? 'resume' : 'pause',
        status === 'paused' ? 'play' : 'pause',
        true
      ) + button(t('cancel'), 'cancel', 'stop')
    : button(
        t('start'),
        'prepare-all',
        'prepare',
        true,
        !included.length || !state.hasKey ? 'disabled' : ''
      );
  if (job.errors?.length) controls += button(t('retry'), 'retry', 'refresh');
  const current =
    typeof job.current === 'object'
      ? job.current?.name
      : state.games.find((g) => g.id === job.current)?.name || job.current;
  return `${heading('prepareEyebrow', 'prepareTitle', 'prepareSub')}${keyBanner()}<section class="progress-panel" aria-live="polite"><div class="progress-title"><div><h2>${esc(t(partial ? 'jobPartialTitle' : { idle: 'jobIdle', running: 'jobRunning', paused: 'jobPaused', completed: 'jobCompleted', cancelled: 'jobCancelled' }[status] || 'jobIdle'))}</h2><p>${active ? `${current ? esc(current) + ' · ' : ''}${esc(phaseLabel(job.stage, job.detail))}` : esc(partial ? t('jobPartialBody').replace('{ready}', playable).replace('{pending}', remaining) : t(status === 'completed' ? 'jobCompletedBody' : 'jobIdleBody'))}</p></div><div class="progress-percent" aria-label="${esc(t('phaseProgress'))}">${percent === null ? '…' : percent}<span style="font-size:15px">${percent === null ? '' : '%'}</span><small>${esc(t('phaseProgress'))}</small></div></div><div class="progress-track" role="progressbar" aria-label="${esc(t('preparation'))}" aria-valuemin="0" aria-valuemax="100" ${percent === null ? 'aria-valuetext="' + esc(phaseLabel(job.stage)) + '"' : 'aria-valuenow="' + percent + '"'}><div class="progress-fill ${percent === null ? 'indeterminate' : ''}" style="width:${percent === null ? 35 : percent}%"></div></div><div class="progress-foot"><span>${esc(t('overallProgress'))} : ${overall}% · ${Number(job.processed) || 0} / ${Number(job.total) || 0} ${esc(t('processed'))} &nbsp;·&nbsp; ${esc(bytes(job.bytes))} ${esc(t('bytesDownloaded'))}</span><div class="button-row">${controls}</div></div>${jobActivity(job)}</section>${playable && !active ? `<div class="banner">${icon('check')}<span>${playable} ${esc(t('readyScenes'))}</span><div class="button-row">${button(t('openPreview'), 'open-preview', 'preview')}${state.steam.detected ? button(t(state.steam.installed ? 'repair' : 'install'), state.steam.installed ? 'update-install' : 'install', 'prepare', true) : button(t('settings'), 'open-settings', 'settings')}</div></div>` : ''}${job.errors?.length ? `<div class="banner error">${icon('info')}<div>${esc(t('errors'))}<br>${job.errors.map((e) => esc(typeof e === 'string' ? e : e.message || e.error || JSON.stringify(e))).join('<br>')}</div></div>` : ''}${optionalIssues.length ? `<div class="banner" role="status">${icon('info')}<div>${optionalIssues.map(esc).join('<br>')}</div></div>` : ''}<div class="section-heading"><h2>${esc(t('queueTitle'))}</h2><span class="text-button">${included.length} ${esc(t('scenes'))}</span></div>${
    included.length
      ? `<div class="queue-list">${included
          .map((g) => {
            const im = thumbnail(g),
              isCurrent = active && (g.id === job.current || g.name === current),
              label = isCurrent
                ? t('preparing')
                : g.status === 'ready'
                  ? t('ready')
                  : g.status === 'error'
                    ? t('gameError')
                    : g.status === 'missing'
                      ? t('gameMissing')
                      : t('waiting');
            return `<div class="queue-row">${previewImage([im, g.media?.file && localMedia(g.media.file), g.selectedAsset?.url], 'queue', g.name, g.sgdbId, g.steamAppId)}<div><div class="queue-title">${esc(g.name)}</div><div class="queue-sub">${esc(g.error || (state.settings.smoothMotion && g.smoothingError) || g.media?.format || t(g.manualSelection ? 'manualChoice' : 'automatic'))}</div></div><span class="queue-status ${g.status === 'ready' ? 'ready' : ''}">${isCurrent ? '<span class="spinner"></span>' : g.status === 'ready' ? icon('check') : ''}${esc(label)}</span></div>`;
          })
          .join('')}</div>`
      : empty(
          t('queueEmpty'),
          t('queueEmptyBody'),
          button(t('returnLibrary'), 'open-library', 'library'),
          'prepare'
        )
  }`;
}
function coverPositionOptions() {
  return [
    ['beside-title', 'besideTitle'],
    ['bottom-right', 'bottomRight'],
    ['top-right', 'topRight'],
    ['top-left', 'topLeft']
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${state.settings.coverPosition === value ? 'selected' : ''}>${esc(t(label))}</option>`
    )
    .join('');
}
function previewView() {
  const games = readyGames();
  return `${heading('previewEyebrow', 'previewTitle', 'previewSub')}${games.length ? `<div id="preview-shell" class="preview-shell"><iframe id="player-frame" src="../player/index.html" title="Steam Animated Screensaver ${esc(t('preview'))}" allow="autoplay; fullscreen" tabindex="-1"></iframe><button class="button ghost fullscreen-exit" data-action="exit-fullscreen">${icon('close')}${esc(t('exitFullscreen'))}</button></div><div class="preview-controls"><div class="playback-buttons"><button class="icon-button" data-action="previous" aria-label="${esc(t('previous') || 'Previous')}">${icon('previous')}</button><button class="icon-button" data-action="toggle-play" aria-label="${esc(t(previewPlaying ? 'pause' : 'resume'))}">${icon(previewPlaying ? 'pause' : 'play')}</button><button class="icon-button" data-action="next" aria-label="${esc(t('next') || 'Next')}">${icon('next')}</button><span class="playback-note">${esc(t(previewPlaying ? 'playing' : 'paused'))} · ${games.length} ${esc(t(games.length === 1 ? 'scene' : 'scenes'))}</span></div>${button(t('fullscreen'), 'fullscreen', 'fullscreen')}</div><div class="preview-options"><label class="preview-option"><input type="checkbox" data-setting="showCover" ${state.settings.showCover ? 'checked' : ''}>${esc(t('showCover'))}</label><label class="preview-option"><span>${esc(t('coverPosition'))}</span><select class="field" data-setting="coverPosition">${coverPositionOptions()}</select></label><label class="preview-option"><span>${esc(t('framing'))}</span><select class="field" data-setting="framing">${framingOptions(state.settings.framing)}</select></label><label class="preview-option"><input type="checkbox" data-setting="shuffle" ${state.settings.shuffle ? 'checked' : ''}>${esc(t('shuffleShort'))}</label><label class="preview-option"><input type="checkbox" data-setting="showLogos" ${state.settings.showLogos ? 'checked' : ''}>${esc(t('titlesShort'))}</label><label class="preview-option"><span>${esc(t('transitionShort'))}</span><select class="field" data-setting="transition"><option value="crossfade" ${state.settings.transition !== 'fade-black' ? 'selected' : ''}>${esc(t('crossfade'))}</option><option value="fade-black" ${state.settings.transition === 'fade-black' ? 'selected' : ''}>${esc(t('fadeBlack'))}</option></select></label></div><p class="preview-caption">${esc(t('previewNote'))}</p>` : empty(t('previewEmpty'), t('previewEmptyBody'), button(t('prepareScenes'), 'open-preparation', 'prepare', true), 'preview')}`;
}
const toggle = (key, label, hint) =>
  `<label class="setting-row"><span><span class="setting-row-label">${esc(t(label))}</span>${hint ? `<small>${esc(t(hint))}</small>` : ''}</span><span class="switch"><input type="checkbox" data-setting="${key}" ${state.settings[key] ? 'checked' : ''}><span></span></span></label>`;
const panel = (title, ic, body) =>
  `<section class="settings-panel"><div class="panel-title">${icon(ic)}<h2>${esc(t(title))}</h2></div><div class="panel-body">${body}</div></section>`;
function settingsView() {
  const used = Number(state.storage.used) || 0,
    max = Number(state.settings.maxStorageGB) || 10;
  return `${heading('settingsEyebrow', 'settingsTitle', 'settingsSub')}<div class="settings-layout"><div class="settings-stack">${panel('steamGridDb', 'key', `<p>${esc(t('keyBody'))}</p><form id="key-form"><div class="key-input"><input class="field" id="api-key" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(t(state.hasKey ? 'replaceKey' : 'keyPlaceholder'))}" aria-label="${esc(t('keyPlaceholder'))}" required>${button(t('saveKey'), 'save-key', 'key', true, 'type="submit"')}</div></form><div class="button-row" style="align-items:center;margin:13px 0"><span style="font-size:10px;color:var(--muted)">${state.hasKey ? '✓ ' : ''}${esc(t(state.hasKey ? 'keySaved' : 'keyMissing'))}</span>${state.hasKey ? button(t('validateKey'), 'validateKey', 'check') : ''}</div><a class="key-link" href="https://www.steamgriddb.com/profile/preferences/api" target="_blank" rel="noopener noreferrer">${esc(t('getKey'))} ↗</a>`)}${steamAccountPanel()}${panel(
    'playback',
    'play',
    `<label class="setting-row"><span class="setting-row-label">${esc(t('language'))}</span><select class="field" data-setting="language"><option value="en" ${lang() === 'en' ? 'selected' : ''}>English</option><option value="fr" ${lang() === 'fr' ? 'selected' : ''}>Français</option></select></label><label class="setting-row"><span><span class="setting-row-label">${esc(t('sceneDuration'))}</span><small>${esc(t('durationHint'))}</small></span><input class="field" data-setting="sceneDuration" type="number" min="8" max="180" step="1" value="${Number(state.settings.sceneDuration)}" aria-label="${esc(t('sceneDuration'))}"></label>${toggle('shuffle', 'shuffle', 'shuffleHint')}<label class="setting-row"><span class="setting-row-label">${esc(t('transition'))}</span><select class="field" data-setting="transition"><option value="crossfade" ${state.settings.transition === 'crossfade' || state.settings.transition === 'fade' ? 'selected' : ''}>${esc(t('crossfade'))}</option><option value="fade-black" ${state.settings.transition === 'fade-black' ? 'selected' : ''}>${esc(t('fadeBlack'))}</option></select></label>${toggle('showLogos', 'showLogos', 'logosHint')}${toggle('showCover', 'showCover', 'coverHint')}<label class="setting-row"><span class="setting-row-label">${esc(t('coverPosition'))}</span><select class="field" data-setting="coverPosition">${coverPositionOptions()}</select></label><label class="setting-row"><span><span class="setting-row-label">${esc(t('framing'))}</span><small>${esc(t('framingHint'))}</small></span><select class="field" data-setting="framing">${framingOptions(state.settings.framing)}</select></label>${toggle('smoothMotion', 'smoothMotion', 'smoothHint')}<label class="setting-row"><span><span class="setting-row-label">${esc(t('smoothingMode'))}</span><small>${esc(t('smoothingModeHint'))}</small></span><select class="field" data-setting="smoothingMode">${[
      ['fast', 'modeFast'],
      ['quality', 'modeQuality'],
      ['blend', 'modeBlend']
    ]
      .map(
        ([v, k]) =>
          `<option value="${v}" ${state.settings.smoothingMode === v ? 'selected' : ''}>${esc(t(k))}</option>`
      )
      .join(
        ''
      )}</select></label><label class="setting-row"><span class="setting-row-label">${esc(t('smoothingFps'))}</span><select class="field" data-setting="smoothingFps">${[24, 30].map((n) => `<option value="${n}" ${state.settings.smoothingFps === n ? 'selected' : ''}>${n} ${lang() === 'fr' ? 'i/s' : 'fps'}</option>`).join('')}</select></label><label class="setting-row"><span><span class="setting-row-label">${esc(t('maxSmoothingMB'))}</span><small>${esc(t('smoothingSizeHint'))}</small></span><input class="field" data-setting="maxSmoothingMB" type="number" min="0" max="1000000" step="1" value="${Number(state.settings.maxSmoothingMB) || 0}" aria-label="${esc(t('maxSmoothingMB'))}"></label>${toggle('staticFallback', 'staticFallback', 'staticHint')}${toggle('reducedMotion', 'reducedMotion', 'motionHint')}${toggle('pauseOnGame', 'pauseOnGame', 'pauseHint')}`
  )}${panel('storage', 'drive', `<div class="storage-label"><span>${esc(bytes(used))}</span><span>${max} GB</span></div><div class="storage-meter"><span style="width:${Math.min(100, (used / (max * 1073741824)) * 100)}%"></span></div><label class="setting-row"><span><span class="setting-row-label">${esc(t('storageLimit'))}</span><small>${esc(t('storageHint'))}</small></span><input class="field" data-setting="maxStorageGB" type="number" min="0.1" max="1000" step="0.1" value="${max}" aria-label="${esc(t('storageLimit'))}"></label><div style="margin-top:20px">${button(t('clearUnused'), 'clearUnused', 'trash') + button(t('repairLibrary'), 'repair', 'refresh')}</div><div class="purge-section"><p>${esc(t('purgeMediaHint'))}</p>${button(t(purgingMedia ? 'purgingMedia' : 'purgeMedia'), 'purge-media', 'trash', false, purgingMedia ? 'disabled' : '')}${state.lastMediaPurge ? `<p class="purge-result">${esc(t('lastMediaPurge'))} : ${esc(new Date(state.lastMediaPurge.at).toLocaleString(lang()))} · ${esc(bytes(state.lastMediaPurge.bytes))}</p>` : ''}</div>`)}${panel('steamIntegration', 'film', `<p>${esc(t('steamInstallBody'))}</p><div class="steam-status" style="margin:0 0 17px"><span class="status-dot ${state.steam.installed ? 'on' : ''}"></span>${esc(t(state.steam.installed ? 'integrationInstalled' : 'integrationNotInstalled'))}</div>${!state.steam.detected ? `<p>${esc(t('integrationNoSteam'))}</p>` : ''}<div class="button-row">${state.steam.installed ? button(t('repair'), 'update-install', 'refresh', true) + button(t('uninstall'), 'uninstall', 'trash', false) : button(t('install'), 'install', 'prepare', true, !state.steam.detected || !readyGames().length ? 'disabled' : '')}${button(t('scanAgain'), 'scan', 'scan')}</div><p style="margin:16px 0 0;font-size:9px">${esc(t('runtimeNote'))}</p>`)}${panel('diagnosticsTitle', 'info', `<p>${esc(t('logsHint'))}</p>${state.diagnostics?.available ? `<p class="log-path">${esc(state.diagnostics.file)}</p>${button(t('openLogs'), 'open-logs', 'drive')}${state.diagnostics.error ? `<p role="alert">${esc(state.diagnostics.error)}</p>` : ''}` : `<p>${esc(t('logsUnavailable'))}</p>`}`)}</div><aside class="settings-note">${icon('shield')}<strong>${esc(t('privacyTitle'))}</strong>${esc(t('privacyBody'))}</aside></div><p class="footnote">${esc(t('credit'))}</p>`;
}
function render() {
  const active = document.activeElement;
  const focusAttribute = [
    'data-route',
    'data-action',
    'data-setting',
    'data-include',
    'data-detail',
    'data-filter'
  ].find((k) => active?.hasAttribute?.(k));
  const focusSelector = active?.id
    ? `#${CSS.escape(active.id)}`
    : focusAttribute
      ? `[${focusAttribute}="${CSS.escape(active.getAttribute(focusAttribute))}"]`
      : null;
  document.documentElement.lang = lang();
  document.body.classList.toggle('reduced-motion', !!state.settings.reducedMotion);
  const focused = document.activeElement?.id;
  const selection = focused === 'library-filter' ? document.activeElement.selectionStart : null;
  const scrollY = window.scrollY;
  app.innerHTML = shell();
  if (route === 'preview') {
    previewSignature = '';
    document.querySelector('#player-frame')?.addEventListener('load', () => sendCatalog(true));
  }
  if (focused === 'library-filter') {
    const field = document.querySelector('#library-filter');
    field?.focus();
    field?.setSelectionRange(selection, selection);
  }
  if (focusSelector && focused !== 'library-filter')
    app.querySelector(focusSelector)?.focus({ preventScroll: true });
  window.scrollTo(0, scrollY);
}
function navigate(next) {
  if (!['home', 'library', 'preparation', 'preview', 'settings'].includes(next)) return;
  route = next;
  previewPlaying = true;
  render();
  window.scrollTo(0, 0);
}
function postPlayer(action, extra = {}) {
  document
    .querySelector('#player-frame')
    ?.contentWindow?.postMessage(
      { type: 'screensaver', action, ...extra },
      location.origin === 'null' ? '*' : location.origin
    );
}
const playerMedia = (file) =>
  location.protocol === 'app:'
    ? localMedia(file)
    : `/media/${encodeURIComponent(
        String(file || '')
          .split('/')
          .pop()
      )}`;
function sendCatalog(force = false) {
  const catalog = {
    version: 1,
    games: readyGames().map((g) => {
      const media =
        state.settings.smoothMotion &&
        g.smoothed &&
        g.smoothed.sha256 === g.media.sha256 &&
        ((g.smoothed.smoothingConfig?.fps === state.settings.smoothingFps &&
          g.smoothed.smoothingConfig?.mode === state.settings.smoothingMode) ||
          (!g.smoothed.smoothingConfig &&
            state.settings.smoothingMode === 'quality' &&
            state.settings.smoothingFps === 30))
          ? g.smoothed
          : g.media;
      return {
        ...g,
        cover: g.cover ? { ...g.cover, file: playerMedia(g.cover.file) } : null,
        media: { ...media, file: playerMedia(media.file), thumbnail: playerMedia(media.thumbnail) }
      };
    }),
    settings: state.settings
  };
  const signature = JSON.stringify(catalog);
  if (force || previewSignature !== signature) {
    postPlayer('catalog', { catalog });
    previewSignature = signature;
    if (!previewPlaying) postPlayer('pause');
  }
}
function showAdd() {
  searchResults = null;
  searchTerm = '';
  searchPending = false;
  renderAdd();
  addDialog.showModal();
  setTimeout(() => document.querySelector('#game-search')?.focus(), 30);
}
function renderAdd() {
  const wasOpen = addDialog.open,
    scrollTop = addDialog.scrollTop;
  addDialog.innerHTML = `<div class="dialog-head"><div><div class="eyebrow">STEAMGRIDDB</div><h2 id="add-title">${esc(t('addTitle'))}</h2><p>${esc(t('addBody'))}</p></div><button class="icon-button" data-action="close-add" aria-label="${esc(t('close'))}">${icon('close')}</button></div><div class="dialog-body">${!state.hasKey ? `<div class="banner">${icon('key')}<span>${esc(t('searchKeyNeeded'))}</span>${button(t('settings'), 'modal-settings', 'arrow')}</div>` : ''}<form id="search-form"><div class="modal-search"><input class="field" id="game-search" aria-label="${esc(t('searchPlaceholder'))}" placeholder="${esc(t('searchPlaceholder'))}" value="${attr(searchTerm)}" ${!state.hasKey ? 'disabled' : ''} minlength="2" maxlength="150" required><button class="button primary" type="submit" ${!state.hasKey || searchPending ? 'disabled' : ''}>${searchPending ? '<span class="spinner"></span>' : icon('search')}${esc(t('search'))}</button></div></form><div class="modal-hint">${esc(t('searchHint'))}</div><div class="search-results" aria-live="polite">${
    searchPending
      ? `<div class="dialog-empty"><span class="spinner"></span> ${esc(t('searching'))}</div>`
      : searchResults === null
        ? `<div class="dialog-empty">${esc(t('searchStart')).replace('\n', '<br>')}</div>`
        : searchResults.length
          ? searchResults
              .map((g, i) => {
                const im = safeRemote(g.thumb),
                  present = g.present || state.games.some((x) => x.sgdbId === g.sgdbId);
                return `<div class="result">${previewImage([im], 'result', g.name, g.sgdbId)}<div><div class="result-name">${esc(g.name)}</div><div class="result-meta">SGDB #${esc(g.sgdbId)}${g.steamAppId ? ` · Steam #${esc(g.steamAppId)}` : ''}</div></div><button class="button ${present ? '' : 'primary'}" data-add-result="${i}" ${present ? 'disabled' : ''}>${icon(present ? 'check' : 'plus')}${esc(t(present ? 'alreadyAdded' : 'add'))}</button></div>`;
              })
              .join('')
          : `<div class="dialog-empty">${esc(t('noResults'))}</div>`
  }</div></div>`;
  if (wasOpen) {
    const target =
      !searchPending && searchResults?.length
        ? addDialog.querySelector('[data-add-result]:not([disabled])')
        : null;
    (target || addDialog.querySelector('#game-search'))?.focus({ preventScroll: true });
    addDialog.scrollTop = scrollTop;
  }
}
async function searchGames() {
  if (searchPending) return;
  const input = document.querySelector('#game-search');
  searchTerm = input.value.trim();
  if (searchTerm.length < 2) return;
  searchPending = true;
  renderAdd();
  try {
    const result = await invoke('search', { query: searchTerm });
    state.previewsPaused = false;
    searchResults = Array.isArray(result) ? result : result?.results || result?.games || [];
  } catch (error) {
    toast(error.message || t('searchError'));
    searchResults = [];
  }
  searchPending = false;
  renderAdd();
}
async function showDetail(id) {
  detailId = id;
  assets = null;
  coverAssets = null;
  renderDetail();
  detailDialog.showModal();
}
function renderDetail(preferArtwork = false) {
  const wasOpen = detailDialog.open,
    scrollTop = detailDialog.scrollTop,
    active = document.activeElement;
  const focusedChoice = active?.dataset?.selectAsset;
  const focusedAction = active?.dataset?.action;
  const g = state.games.find((x) => x.id === detailId);
  if (!g) {
    detailDialog.close();
    return;
  }
  const im = thumbnail(g),
    reduced =
      state.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches,
    animated = g.media?.animated && !reduced,
    detailMedia =
      animated && /\.(mp4|webm)$/i.test(g.media.file)
        ? `<video class="detail-cover" data-preview-fallback="${attr(JSON.stringify([im, localMedia(g.media.file), g.selectedAsset?.thumb]))}" src="${attr(localMedia(g.media.file))}" poster="${attr(im)}" autoplay muted loop playsinline preload="metadata"></video>`
        : animated
          ? `<img class="detail-cover" data-preview-fallback="${attr(JSON.stringify([im, localMedia(g.media.file), g.selectedAsset?.thumb]))}" src="${attr(localMedia(g.media.file))}" alt="${esc(g.name)}">`
          : previewImage(
              [im, g.media?.file && localMedia(g.media.file), g.selectedAsset?.url],
              'detail',
              g.name
            );
  detailDialog.innerHTML = `<div class="dialog-head"><div><div class="eyebrow">${esc(t(g.manualSelection ? 'manualChoice' : 'automatic'))}</div><h2 id="detail-title">${esc(g.name)}</h2><p>${esc(statusName(g))}${!g.included ? ' · ' + esc(t('notIncluded')) : ''}</p></div><button class="icon-button" data-action="close-detail" aria-label="${esc(t('close'))}">${icon('close')}</button></div><div class="dialog-body">${`<div class="detail-framing">${detailMedia}</div>`}${cropEditor(g)}<div class="detail-meta">${g.steamAppId ? `<span>Steam #${esc(g.steamAppId)}</span>` : ''}${g.sgdbId ? `<span>SGDB #${esc(g.sgdbId)}</span>` : ''}${g.media ? `<span>${g.media.width} × ${g.media.height} · ${esc(g.media.format)}${g.media.animated ? ` · ${esc(t('duration'))}: ${Number(g.media.duration) > 0 ? Number(g.media.duration).toLocaleString(lang(), { maximumFractionDigits: 1 }) + ' s' : esc(t('durationUnknown'))}` : ''}</span><span>${esc(t('artworkCredit'))} ${esc(authorName(g.media.author))}</span>` : ''}</div>${g.error ? `<div class="banner error">${esc(g.error)}</div>` : ''}<div class="detail-actions"><div class="button-row">${button(t('prepareScenes'), 'prepare-game', 'prepare', true, !state.hasKey ? 'disabled' : '')}${safeRemote(g.media?.sourceUrl || g.selectedAsset?.url) ? `<a class="button ghost" href="${attr(safeRemote(g.media?.sourceUrl || g.selectedAsset?.url))}" target="_blank" rel="noopener noreferrer">${icon('external')}${esc(t('source'))}</a>` : ''}</div>${button(t('removeGame'), 'remove-game', 'trash')}</div>${coverPicker(g)}${g.manualSelection ? `<div style="margin-bottom:20px">${button(t('automaticChoice'), 'automatic-choice', 'refresh')}</div>` : ''}<div class="section-heading"><div><h2>${esc(t('artworkTitle'))}</h2><p>${esc(t('artworkBody'))}</p></div></div>${
    assets === null
      ? `<p class="modal-hint">${esc(t('noArtworkYet'))}</p>${button(t('loadArtworks'), 'load-artworks', 'image', false, !state.hasKey ? 'disabled' : '')}`
      : assets === 'loading'
        ? `<div class="dialog-empty"><span class="spinner"></span> ${esc(t('artworksLoading'))}</div>`
        : assets.length
          ? `<div class="asset-grid">${assets
              .map((a, i) => {
                const image = safeRemote(a.thumb) || safeRemote(a.url),
                  selected = g.selectedAsset?.id === a.id;
                return `<button class="asset-choice ${selected ? 'selected' : ''}" data-select-asset="${i}" aria-label="${esc(t('choose') + ' ' + (i + 1))}" aria-pressed="${selected}">${previewImage([a.thumb, a.url], 'asset', g.name + ' ' + (i + 1))}<span class="asset-badge">${esc(t(selected ? 'selected' : a.animated ? 'animated' : 'still'))}</span><div class="asset-caption"><strong>${esc(authorName(a.author))}</strong><br>${Number(a.width) || '?'} × ${Number(a.height) || '?'} · ${esc(a.kind || 'hero')}${a.reasons?.length ? `<br>${esc(a.reasons.join(' · '))}` : ''}</div></button>`;
              })
              .join('')}</div>`
          : `<div class="dialog-empty">${esc(t('noArtworks'))}</div>`
  }</div>`;
  updateCropPreview();
  if (wasOpen) {
    let target = preferArtwork
      ? detailDialog.querySelector('[data-select-asset]')
      : focusedChoice !== undefined
        ? detailDialog.querySelector(`[data-select-asset="${CSS.escape(focusedChoice)}"]`)
        : focusedAction
          ? detailDialog.querySelector(`[data-action="${CSS.escape(focusedAction)}"]`)
          : null;
    (
      target ||
      detailDialog.querySelector('[data-select-asset].selected') ||
      detailDialog.querySelector('[data-select-asset]') ||
      detailDialog.querySelector('[data-action="close-detail"]')
    )?.focus({ preventScroll: true });
    detailDialog.scrollTop = scrollTop;
  }
}
function framingOptions(value, inherit = false) {
  return [
    ...(inherit ? [['inherit', 'frameInherit']] : []),
    ['original', 'frameOriginal'],
    ['16:9', 'frame169'],
    ['16:10', 'frame1610']
  ]
    .map(
      ([mode, key]) =>
        `<option value="${mode}" ${value === mode ? 'selected' : ''}>${esc(t(key))}</option>`
    )
    .join('');
}
function cropEditor(g) {
  const crop = g.crop || { mode: 'inherit', x: 50, y: 50 };
  return `<section class="crop-controls" data-crop-id="${attr(g.id)}"><h3>${esc(t('cropTitle'))}</h3><p>${esc(t('cropHint'))}</p><label class="account-field">${esc(t('framing'))}<select class="field" data-crop-setting="mode">${framingOptions(crop.mode, true)}</select></label>${[
    ['x', 'cropHorizontal'],
    ['y', 'cropVertical']
  ]
    .map(
      ([axis, label]) =>
        `<label class="crop-axis">${esc(t(label))}<input type="range" min="0" max="100" step="1" value="${Number(crop[axis])}" data-crop-setting="${axis}"><output data-crop-value="${axis}">${Number(crop[axis])}%</output></label>`
    )
    .join('')}${button(t('centerCrop'), 'center-crop', 'refresh')}</section>`;
}
function updateCropPreview() {
  const controls = detailDialog.querySelector('.crop-controls'),
    frame = detailDialog.querySelector('.detail-framing');
  if (!controls || !frame) return;
  const selected = controls.querySelector('[data-crop-setting="mode"]').value;
  const mode = selected === 'inherit' ? state.settings.framing || 'original' : selected;
  const ratio = mode === '16:10' ? 16 / 10 : 16 / 9;
  frame.dataset.framing = mode;
  frame.style.setProperty('--frame-ratio', String(ratio));
  const game = state.games.find((g) => g.id === controls.dataset.cropId);
  const width = game?.media?.width || game?.selectedAsset?.width;
  const height = game?.media?.height || game?.selectedAsset?.height;
  for (const axis of ['x', 'y']) {
    const input = controls.querySelector(`[data-crop-setting="${axis}"]`);
    frame.style.setProperty(`--crop-${axis}`, `${mode === 'original' ? 50 : Number(input.value)}%`);
    controls.querySelector(`[data-crop-value="${axis}"]`).textContent = `${input.value}%`;
    input.disabled =
      mode === 'original' ||
      (width && height
        ? axis === 'x'
          ? width / height <= ratio + 0.001
          : width / height >= ratio - 0.001
        : false);
  }
}
async function saveCrop() {
  const controls = detailDialog.querySelector('.crop-controls');
  if (!controls) return;
  const id = controls.dataset.cropId;
  const crop = {
    mode: controls.querySelector('[data-crop-setting="mode"]').value,
    x: Number(controls.querySelector('[data-crop-setting="x"]').value),
    y: Number(controls.querySelector('[data-crop-setting="y"]').value)
  };
  const result = await run('updateGame', { id, crop }, 'saveSuccess');
  if (result === undefined && detailId === id) renderDetail();
}
function coverPicker(g) {
  return `<section class="fixed-artwork"><div class="section-heading"><div><h2>${esc(t('fixedArtwork'))}</h2><p>${esc(t('fixedArtworkBody'))}</p></div></div><div class="fixed-artwork-current">${previewImage([g.cover?.file && localMedia(g.cover.file), g.selectedCover?.thumb, g.selectedCover?.url], 'cover', g.name)}<div><p>${esc(authorName(g.cover?.author || g.selectedCover?.author))}</p><div class="button-row">${button(t(coverChoosing ? 'applyingCover' : 'chooseCover'), 'load-covers', 'image', false, !state.hasKey || coverChoosing ? 'disabled' : '')}${g.coverManualSelection ? button(t('automaticCover'), 'automatic-cover', 'refresh', false, coverChoosing ? 'disabled' : '') : ''}</div></div></div>${coverAssets === 'loading' ? `<p class="modal-hint">${esc(t('artworksLoading'))}</p>` : Array.isArray(coverAssets) ? (coverAssets.length ? `<div class="asset-grid cover-grid">${coverAssets.map((a, i) => `<button class="asset-choice ${g.selectedCover?.id === a.id || g.cover?.sourceUrl === a.url ? 'selected' : ''}" data-select-cover="${i}" aria-label="${esc(t('choose') + ' ' + t('fixedArtwork') + ' ' + (i + 1))}" ${coverChoosing ? 'disabled' : ''}>${previewImage([a.thumb, a.url], 'cover-choice', g.name)}<div class="asset-caption"><strong>${esc(authorName(a.author))}</strong><br>${a.width} × ${a.height}</div></button>`).join('')}</div>` : `<p class="modal-hint">${esc(t('noArtworks'))}</p>`) : ''}</section>`;
}
async function loadCovers() {
  const id = detailId;
  coverAssets = 'loading';
  renderDetail();
  try {
    const result = await invoke('covers', { id });
    state.previewsPaused = false;
    if (detailId === id) coverAssets = result;
  } catch (error) {
    toast(error.message);
    if (detailId === id) coverAssets = [];
  }
  if (detailId === id) renderDetail();
}
async function selectCover(selectedCover) {
  const id = detailId;
  coverChoosing = true;
  renderDetail();
  try {
    await invoke('setCover', { id, selectedCover });
    await refresh(true);
    toast(t('coverSelected'));
  } catch (error) {
    toast(error.message);
  } finally {
    coverChoosing = false;
    if (detailId === id) renderDetail();
  }
}
async function loadArtworks() {
  const id = detailId;
  assets = 'loading';
  renderDetail();
  try {
    const result = await invoke('artworks', { id });
    state.previewsPaused = false;
    if (detailId !== id) return;
    assets = Array.isArray(result) ? result : result?.assets || result?.artworks || [];
  } catch (error) {
    toast(error.message);
    if (detailId !== id) return;
    assets = [];
  }
  renderDetail(true);
}
async function scan() {
  if (scanning) return;
  scanning = true;
  render();
  try {
    await invoke('scan');
    await refresh(true);
    toast(t(state.games.length ? 'scanSuccess' : 'noGamesFound'));
  } catch (error) {
    toast(error.message);
  } finally {
    scanning = false;
    render();
  }
}
async function fullscreen() {
  const shell = document.querySelector('#preview-shell');
  if (!shell) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shell.requestFullscreen();
  } catch (error) {
    toast(error.message);
  }
}
async function handleAction(action) {
  switch (action) {
    case 'add-game':
      showAdd();
      break;
    case 'close-add':
      addDialog.close();
      break;
    case 'close-detail':
      detailDialog.close();
      break;
    case 'modal-settings':
      addDialog.close();
      navigate('settings');
      break;
    case 'open-settings':
      navigate('settings');
      break;
    case 'open-library':
      navigate('library');
      break;
    case 'open-preparation':
      navigate('preparation');
      break;
    case 'open-preview':
      navigate('preview');
      break;
    case 'reconnect':
      await refresh(true);
      break;
    case 'scan':
      await scan();
      break;
    case 'language':
      await run('settings', { language: lang() === 'en' ? 'fr' : 'en' });
      break;
    case 'select-shown':
    case 'deselect-shown':
      await run(
        'setIncluded',
        { filter, query, included: action === 'select-shown' },
        'saveSuccess'
      );
      break;
    case 'select-popular-owned':
    case 'select-personal-top':
      await run('selectLibraryTop', {
        filter,
        query,
        criterion: action === 'select-personal-top' ? 'playtime' : 'steam'
      });
      break;
    case 'import-popular': {
      const result = await run('importPopular');
      if (result) {
        filter = 'popularFilter';
        query = '';
        navigate('library');
      }
      break;
    }
    case 'open-logs':
      if (window.screensaver) await window.screensaver.invoke('openLogs');
      else toast(t('logsHint'));
      break;
    case 'cancel-selection':
      await run('cancelSelection');
      break;
    case 'prepare-home':
      if (!state.games.some((g) => g.included)) {
        navigate('library');
        break;
      }
      if (!state.hasKey) {
        navigate('settings');
        break;
      }
      navigate('preparation');
      await run('prepare', {}, 'prepareSuccess');
      break;
    case 'prepare-all':
      navigate('preparation');
      await run('prepare', {}, 'prepareSuccess');
      break;
    case 'prepare-game': {
      const id = detailId;
      detailDialog.close();
      navigate('preparation');
      await run('prepare', { ids: [id] }, 'prepareSuccess');
      break;
    }
    case 'pause':
    case 'resume':
    case 'retry':
      await run(action);
      break;
    case 'cancel':
      if (confirm(t('confirmCancel'))) await run('cancel');
      break;
    case 'open-steam-account':
      navigate('settings');
      document
        .querySelector('#steam-account-settings')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
    case 'import-steam': {
      if (pending || importingSteam) break;
      importingSteam = true;
      render();
      const result = await run('importSteamLibrary', {}, 'steamImportSuccess');
      importingSteam = false;
      if (result) {
        filter = 'ownedFilter';
        navigate('library');
      } else render();
      break;
    }
    case 'forget-steam-key':
      await run('setSteamAccount', { key: '' }, 'steamAccountSaved');
      break;
    case 'save-key':
      break;
    case 'validateKey': {
      const result = await run('validateKey');
      if (result !== undefined)
        toast(t(result === false || result?.valid === false ? 'keyInvalid' : 'keyValid'));
      break;
    }
    case 'purge-media': {
      if (pending || purgingMedia || !confirm(t('confirmPurgeMedia'))) break;
      purgingMedia = true;
      previewGeneration++;
      normalizedPreviews.clear();
      clearHover();
      document.querySelector('#player-frame')?.remove();
      detailDialog.close();
      addDialog.close();
      render();
      try {
        await run('purgeMedia', { confirm: true }, 'purgeMediaSuccess');
      } finally {
        purgingMedia = false;
        render();
      }
      break;
    }
    case 'clearUnused':
      await run(action, {}, 'clearSuccess');
      break;
    case 'install':
      await run(action, {}, 'installSuccess');
      break;
    case 'repair':
      await run(action, {}, 'repairSuccess');
      break;
    case 'update-install':
      await run('install', {}, 'repairSuccess');
      break;
    case 'uninstall':
      if (confirm(t('confirmUninstall'))) await run(action, {}, 'uninstallSuccess');
      break;
    case 'toggle-play':
      previewPlaying = !previewPlaying;
      postPlayer(previewPlaying ? 'play' : 'pause');
      {
        const b = document.querySelector('[data-action="toggle-play"]');
        if (b) {
          b.innerHTML = icon(previewPlaying ? 'pause' : 'play');
          b.setAttribute('aria-label', t(previewPlaying ? 'pause' : 'resume'));
        }
        const note = document.querySelector('.playback-note');
        if (note)
          note.textContent = `${t(previewPlaying ? 'playing' : 'paused')} · ${readyGames().length} ${t('scenes')}`;
      }
      break;
    case 'next':
    case 'previous':
      postPlayer(action);
      break;
    case 'fullscreen':
      await fullscreen();
      break;
    case 'exit-fullscreen':
      if (document.fullscreenElement) await document.exitFullscreen();
      break;
    case 'center-crop':
      for (const axis of ['x', 'y']) {
        const input = detailDialog.querySelector(`[data-crop-setting="${axis}"]`);
        if (input) input.value = '50';
      }
      updateCropPreview();
      await saveCrop();
      break;
    case 'automatic-choice':
      await run('updateGame', { id: detailId, selectedAsset: null }, 'includeSuccess');
      renderDetail();
      break;
    case 'load-covers':
      await loadCovers();
      break;
    case 'automatic-cover':
      await selectCover(null);
      break;
    case 'load-artworks':
      await loadArtworks();
      break;
    case 'remove-game':
      if (confirm(t('confirmRemove'))) {
        const id = detailId;
        detailDialog.close();
        await run('remove', { id }, 'removeSuccess');
      }
      break;
  }
}
document.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-route]');
  if (nav) {
    navigate(nav.dataset.route);
    return;
  }
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.type === 'submit' && action.form) return;
    await handleAction(action.dataset.action);
    return;
  }
  const f = event.target.closest('[data-filter]');
  if (f) {
    filter = f.dataset.filter;
    render();
    return;
  }
  const detail = event.target.closest('[data-detail]');
  if (detail) {
    showDetail(detail.dataset.detail);
    return;
  }
  const add = event.target.closest('[data-add-result]');
  if (add) {
    const g = searchResults[Number(add.dataset.addResult)];
    add.disabled = true;
    try {
      await invoke('add', { sgdbId: g.sgdbId, steamAppId: g.steamAppId, name: g.name });
      await refresh(true);
      toast(t('addedSuccess'));
      renderAdd();
    } catch (error) {
      toast(error.message);
      add.disabled = false;
    }
    return;
  }
  const coverChoice = event.target.closest('[data-select-cover]');
  if (coverChoice && Array.isArray(coverAssets)) {
    await selectCover(coverAssets[Number(coverChoice.dataset.selectCover)]);
    return;
  }
  const choice = event.target.closest('[data-select-asset]');
  if (choice && Array.isArray(assets)) {
    const asset = assets[Number(choice.dataset.selectAsset)];
    await run('updateGame', { id: detailId, selectedAsset: asset }, 'assetSuccess');
    renderDetail();
  }
});
document.addEventListener('submit', async (event) => {
  if (event.target.id === 'search-form') {
    event.preventDefault();
    await searchGames();
  }
  if (event.target.id === 'steam-account-form') {
    event.preventDefault();
    const profile = document.querySelector('#steam-profile').value.trim();
    const input = document.querySelector('#steam-api-key'),
      key = input.value.trim();
    const result = await run(
      'setSteamAccount',
      { profile, ...(key ? { key } : {}) },
      'steamAccountSaved'
    );
    if (result !== undefined && document.querySelector('#steam-api-key'))
      document.querySelector('#steam-api-key').value = '';
  }
  if (event.target.id === 'key-form') {
    event.preventDefault();
    const input = document.querySelector('#api-key'),
      key = input.value.trim();
    if (!key) return;
    const result = await run('setKey', { key }, 'keySuccess');
    if (result !== undefined && document.querySelector('#api-key'))
      document.querySelector('#api-key').value = '';
  }
});
document.addEventListener('input', (event) => {
  if (event.target.dataset.cropSetting) {
    updateCropPreview();
    return;
  }
  if (event.target.id === 'library-filter') {
    query = event.target.value;
    render();
  }
});
document.addEventListener('change', async (event) => {
  const el = event.target;
  if (el.dataset.cropSetting) {
    updateCropPreview();
    await saveCrop();
    return;
  }
  if (el.dataset.include) {
    await run('updateGame', { id: el.dataset.include, included: el.checked });
    return;
  }
  if (el.dataset.setting) {
    let value =
      el.type === 'checkbox'
        ? el.checked
        : el.type === 'number' || el.dataset.setting === 'smoothingFps'
          ? Number(el.value)
          : el.value;
    if (el.type === 'number' && (!el.checkValidity() || !Number.isFinite(value))) {
      el.reportValidity();
      return;
    }
    await run('settings', { [el.dataset.setting]: value }, 'saveSuccess');
  }
});
document.addEventListener('keydown', (event) => {
  if (
    route !== 'preview' ||
    addDialog.open ||
    detailDialog.open ||
    /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  if (event.code === 'Space') {
    event.preventDefault();
    handleAction('toggle-play');
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    postPlayer('next');
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    postPlayer('previous');
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    fullscreen();
  } else if (event.key === 'Escape' && document.fullscreenElement) {
    document.exitFullscreen();
  }
});
for (const dialog of [addDialog, detailDialog])
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  });
let hoveredVideo = null,
  hoveredImage = null;
function clearHover() {
  hoveredVideo?.pause();
  hoveredVideo?.remove();
  hoveredVideo = null;
  if (hoveredImage) {
    hoveredImage.el.src = hoveredImage.original;
    hoveredImage = null;
  }
}
detailDialog.addEventListener('close', () => {
  for (const v of detailDialog.querySelectorAll('video')) {
    v.pause();
    v.removeAttribute('src');
    v.load();
  }
  for (const im of detailDialog.querySelectorAll('.detail-cover')) im.removeAttribute('src');
});
app.addEventListener('pointerover', (event) => {
  const card = event.target.closest('[data-detail].game-visual');
  if (
    !card ||
    card.contains(event.relatedTarget) ||
    state.settings.reducedMotion ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  const game = state.games.find((g) => g.id === card.dataset.detail);
  if (!game?.media?.animated) return;
  clearHover();
  if (/\.(mp4|webm)$/i.test(game.media.file)) {
    const v = document.createElement('video');
    v.src = localMedia(game.media.file);
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'none';
    v.setAttribute('aria-hidden', 'true');
    card.append(v);
    hoveredVideo = v;
    v.play()
      .then(() => v.classList.add('active'))
      .catch(() => v.remove());
  } else {
    const im = card.querySelector('img');
    if (im) {
      hoveredImage = { el: im, original: im.src };
      im.src = localMedia(game.media.file);
    }
  }
});
app.addEventListener('pointerout', (event) => {
  const card = event.target.closest('[data-detail].game-visual');
  if (card && !card.contains(event.relatedTarget)) clearHover();
});
function diagnostic(event, detail) {
  invoke('diagnosticsEvent', { event, ...detail }).catch(() => {});
}
window.addEventListener(
  'error',
  (event) =>
    diagnostic('renderer.error', {
      message: String(event.message || 'Resource load error'),
      stack: event.error?.stack || '',
      source: event.filename || event.target?.src || '',
      line: event.lineno
    }),
  true
);
window.addEventListener('unhandledrejection', (event) =>
  diagnostic('renderer.rejection', {
    message: String(event.reason?.message || event.reason),
    stack: event.reason?.stack || ''
  })
);
window.addEventListener('message', (event) => {
  if (
    event.source !== document.querySelector('#player-frame')?.contentWindow ||
    event.data?.type !== 'screensaver-player' ||
    event.data.status !== 'media-error'
  )
    return;
  diagnostic('player.media_error', {
    message: 'Prepared media could not be played.',
    gameId: event.data.gameId
  });
});
app.innerHTML = `<div class="loading-screen"><span><span class="spinner"></span>${esc(t('loading'))}</span></div>`;
await refresh(true);
if (!connectionError) {
  scan();
}
setInterval(() => {
  if (!document.hidden && !document.querySelector('dialog[open]') && !pending && !scanning)
    refresh();
}, 800);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});
