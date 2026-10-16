/* Standalone offline player. No Steam APIs, network calls or input interception. */
(function (global) {
  'use strict';
  const defaults = {
    sceneDuration: 24,
    shuffle: true,
    transition: 'crossfade',
    showLogos: true,
    showCover: true,
    coverPosition: 'beside-title',
    framing: 'original',
    staticFallback: false,
    reducedMotion: false,
    language: 'en'
  };
  function localMedia(value) {
    if (typeof value !== 'string' || value.length > 240 || /[\\\u0000-\u001f?#]/.test(value))
      return false;
    return (
      /^(?:(?:\/?media\/)|(?:app:\/\/screensaver\/media\/))[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(
        value
      ) && !value.includes('..')
    );
  }
  function settings(input = {}) {
    return {
      sceneDuration: Math.max(8, Math.min(180, Number(input.sceneDuration) || 24)),
      shuffle: input.shuffle !== false,
      transition: ['crossfade', 'fade-black'].includes(input.transition)
        ? input.transition
        : 'crossfade',
      showLogos: input.showLogos !== false,
      showCover: input.showCover !== false,
      coverPosition: ['beside-title', 'bottom-right', 'top-right', 'top-left'].includes(
        input.coverPosition
      )
        ? input.coverPosition
        : 'beside-title',
      framing: ['original', '16:9', '16:10'].includes(input.framing) ? input.framing : 'original',
      staticFallback: input.staticFallback === true,
      reducedMotion: input.reducedMotion === true,
      language: input.language === 'fr' ? 'fr' : 'en'
    };
  }
  function catalogGames(catalog, options) {
    return (Array.isArray(catalog?.games) ? catalog.games : [])
      .filter(
        (g) =>
          g &&
          g.included !== false &&
          g.status === 'ready' &&
          g.media &&
          localMedia(g.media.file) &&
          localMedia(g.media.thumbnail) &&
          (g.media.animated || options.staticFallback)
      )
      .slice(0, 10000);
  }
  function shuffle(items, random = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function framing(game, options) {
    const mode = ['original', '16:9', '16:10'].includes(game.crop?.mode)
      ? game.crop.mode
      : options.framing;
    const coordinate = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50);
    return { mode, x: coordinate(game.crop?.x), y: coordinate(game.crop?.y) };
  }
  function frameBox(width, height, mode) {
    if (mode === 'original') return { width, height };
    const ratio = mode === '16:10' ? 16 / 10 : 16 / 9;
    const fittedWidth = Math.min(width, height * ratio);
    return { width: fittedWidth, height: fittedWidth / ratio };
  }
  const helpers = { localMedia, settings, catalogGames, shuffle, framing, frameBox };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (!global.document) return;
  const doc = global.document,
    stage = doc.getElementById('stage'),
    empty = doc.getElementById('empty');
  let options = settings(),
    catalog = { games: [] },
    games = [],
    order = [],
    position = -1,
    history = [],
    historyPosition = -1,
    current = null,
    retiring = null,
    pending = null,
    timer = null,
    transitionTimer = null,
    loadTimer = null,
    destroyed = false,
    playing = true,
    loading = false,
    generation = 0,
    failures = new Set(),
    hiddenPause = false;
  const french = () => options.language === 'fr';
  function notify(status, game) {
    if (global.parent !== global)
      global.parent.postMessage(
        { type: 'screensaver-player', status, gameId: game?.id || null },
        '*'
      );
  }
  function emptyState(failed = false) {
    empty.hidden = false;
    empty.querySelector('h1').textContent = failed
      ? french()
        ? 'Ces médias sont indisponibles.'
        : 'These artworks are unavailable.'
      : french()
        ? 'Aucune animation préparée.'
        : 'No prepared animations.';
    empty.querySelector('p').textContent = failed
      ? french()
        ? 'Réparez la bibliothèque depuis le gestionnaire.'
        : 'Repair your library in the Manager, then preview again.'
      : french()
        ? 'Préparez les animations dans le gestionnaire.'
        : 'Prepare animations in the Manager.';
  }
  function release(scene) {
    if (!scene) return;
    for (const media of scene.querySelectorAll('video')) {
      media.pause();
      media.removeAttribute('src');
      media.load();
    }
    for (const image of scene.querySelectorAll('img')) {
      image._sasReleased = true;
      image._sasSuspended = true;
      if (image._sasRestore) image.removeEventListener('load', image._sasRestore);
      image.removeAttribute('src');
    }
    for (const canvas of scene.querySelectorAll('canvas')) canvas.width = canvas.height = 0;
    scene.remove();
  }
  function freezeScene(scene) {
    if (!scene) return;
    scene.classList.add('paused');
    const art = scene.querySelector('img.artwork');
    if (!art || !scene.game.media.animated || art._sasReleased) return;
    // Canvas image sources expose the browser's default animation frame. Freeze that
    // local frame and unload the native animation rather than pretending a timer pauses it.
    if (!art._sasSnapshot) {
      if (!art.complete || !art.naturalWidth) return;
      const canvas = doc.createElement('canvas');
      canvas.className = 'artwork frozen-artwork';
      canvas.width = art.naturalWidth;
      canvas.height = art.naturalHeight;
      canvas.setAttribute('aria-hidden', 'true');
      try {
        canvas.getContext('2d').drawImage(art, 0, 0);
      } catch {
        canvas.width = canvas.height = 0;
        return;
      }
      art.insertAdjacentElement('afterend', canvas);
      art._sasSnapshot = canvas;
    }
    if (art._sasRestore) {
      art.removeEventListener('load', art._sasRestore);
      art._sasRestore = null;
    }
    art._sasSuspended = true;
    art.hidden = true;
    art.removeAttribute('src');
  }
  function resumeScene(scene) {
    if (!scene) return;
    scene.classList.remove('paused');
    const art = scene.querySelector('img.artwork');
    if (!art?._sasSnapshot || !art._sasSuspended || art._sasReleased) return;
    art._sasSuspended = false;
    const restored = () => {
      art._sasRestore = null;
      if (art._sasReleased) return;
      if (!playing) {
        freezeScene(scene);
        return;
      }
      const canvas = art._sasSnapshot;
      art._sasSnapshot = null;
      art.hidden = false;
      if (canvas) {
        canvas.width = canvas.height = 0;
        canvas.remove();
      }
    };
    art._sasRestore = restored;
    art.addEventListener('load', restored, { once: true });
    art.src = scene.game.media.file;
  }
  function clearTimer() {
    clearTimeout(timer);
    timer = null;
  }
  function schedule() {
    clearTimer();
    if (playing && !destroyed && games.length > 1 && !loading)
      timer = setTimeout(next, options.sceneDuration * 1000);
  }
  function setPaused(paused) {
    playing = !paused;
    clearTimer();
    if (paused) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
      if (current) current.classList.add('visible');
      if (retiring) {
        release(retiring);
        retiring = null;
      }
    }
    for (const scene of stage.children) {
      if (paused) freezeScene(scene);
      else resumeScene(scene);
    }
    for (const video of stage.querySelectorAll('video')) {
      if (paused) video.pause();
      else video.play().catch(() => {});
    }
    if (!paused) schedule();
    notify(paused ? 'paused' : 'playing', current?.game);
  }
  function newOrder(lastId) {
    order = options.shuffle ? shuffle(games) : games.slice();
    if (order.length > 1 && order[0]?.id === lastId) [order[0], order[1]] = [order[1], order[0]];
    position = -1;
  }
  function placeCover(scene) {
    const cover = scene.querySelector('.caption-cover');
    scene.dataset.coverPosition = options.coverPosition;
    if (!cover) return;
    cover.hidden = !options.showCover || cover.dataset.failed === 'true';
    const caption = scene.querySelector('.caption');
    if (options.coverPosition === 'beside-title') caption.prepend(cover);
    else scene.append(cover);
    scene.classList.toggle('has-cover', !cover.hidden);
    const credit = scene.querySelector('.cover-credit');
    if (credit) credit.hidden = cover.hidden || cover.dataset.fallback === 'true';
  }
  function placeFrame(scene) {
    const crop = framing(scene.game, options),
      frame = scene.querySelector('.art-frame');
    scene.dataset.framing = crop.mode;
    scene.style.setProperty('--crop-x', `${crop.mode === 'original' ? 50 : crop.x}%`);
    scene.style.setProperty('--crop-y', `${crop.mode === 'original' ? 50 : crop.y}%`);
    const box = frameBox(
      stage.clientWidth || global.innerWidth,
      stage.clientHeight || global.innerHeight,
      crop.mode
    );
    frame.style.width = `${box.width}px`;
    frame.style.height = `${box.height}px`;
  }
  function resizeFrames() {
    for (const scene of stage.children) placeFrame(scene);
  }
  function sceneFor(game) {
    const scene = doc.createElement('section');
    scene.className = `scene ${!game.media.animated ? 'static ' : ''}${options.reducedMotion ? 'reduced instant' : ''}`;
    scene.game = game;
    const ambience = doc.createElement('img');
    ambience.className = 'ambience';
    ambience.alt = '';
    ambience.src = game.media.thumbnail;
    scene.append(ambience);
    const isVideo = game.media.format === 'webm',
      art = doc.createElement(isVideo ? 'video' : 'img');
    art.className = 'artwork';
    if (isVideo) {
      art.muted = true;
      art.defaultMuted = true;
      art.loop = true;
      art.playsInline = true;
      art.preload = 'auto';
      art.poster = game.media.thumbnail;
      art.setAttribute('disablepictureinpicture', '');
    } else art.alt = '';
    const frame = doc.createElement('div');
    frame.className = 'art-frame';
    frame.append(art);
    scene.append(frame);
    const shade = doc.createElement('div');
    shade.className = 'shade';
    scene.append(shade);
    const caption = doc.createElement('div');
    caption.className = 'caption';
    const title = doc.createElement('h1');
    title.textContent = String(game.name || '');
    title.hidden = !options.showLogos;
    const credit = doc.createElement('p');
    credit.className = 'credit';
    credit.textContent = `${french() ? 'Artwork de' : 'Artwork by'} ${String(game.media.author?.name || 'Unknown')} · SteamGridDB`;
    const copy = doc.createElement('div');
    copy.className = 'caption-copy';
    copy.append(title, credit);
    const cover = doc.createElement('img');
    cover.className = 'caption-cover';
    cover.alt = french() ? `Jaquette de ${game.name}` : `${game.name} cover`;
    const hasCover = game.cover?.animated === false && localMedia(game.cover.file);
    cover.dataset.fallback = String(!hasCover);
    cover.src = hasCover ? game.cover.file : game.media.thumbnail;
    cover.addEventListener('error', () => {
      if (cover._sasReleased) return;
      if (cover.dataset.fallback !== 'true') {
        cover.dataset.fallback = 'true';
        cover.src = game.media.thumbnail;
      } else cover.dataset.failed = 'true';
      placeCover(scene);
    });
    if (hasCover) {
      const coverCredit = doc.createElement('p');
      coverCredit.className = 'credit cover-credit';
      coverCredit.textContent = `${french() ? 'Jaquette de' : 'Cover by'} ${String(game.cover.author?.name || 'Unknown')} · SteamGridDB`;
      copy.append(coverCredit);
    }
    caption.append(cover, copy);
    if (!game.media.animated) {
      const badge = doc.createElement('p');
      badge.className = 'static-note';
      badge.textContent = french()
        ? 'Illustration statique · Repli optionnel'
        : 'Static artwork · Optional fallback';
      copy.append(badge);
    }
    scene.append(caption);
    placeCover(scene);
    placeFrame(scene);
    return { scene, art, isVideo };
  }
  function display(game, remember = true) {
    if (destroyed || !game) return;
    clearTimer();
    clearTimeout(loadTimer);
    clearTimeout(transitionTimer);
    loading = true;
    if (retiring) {
      release(retiring);
      retiring = null;
    }
    if (pending) {
      release(pending);
      pending = null;
    }
    const token = ++generation,
      { scene, art, isVideo } = sceneFor(game);
    stage.append(scene);
    pending = scene;
    let complete = false;
    function fail() {
      if (complete || token !== generation || destroyed || art._sasSuspended || art._sasReleased)
        return;
      complete = true;
      clearTimeout(loadTimer);
      release(scene);
      pending = null;
      loading = false;
      failures.add(game.id);
      notify('media-error', game);
      if (failures.size >= games.length) {
        release(current);
        current = null;
        emptyState(true);
        clearTimer();
        return;
      }
      next();
    }
    function ready() {
      if (complete || token !== generation || destroyed) return;
      complete = true;
      clearTimeout(loadTimer);
      failures.delete(game.id);
      empty.hidden = true;
      loading = false;
      const old = current;
      current = scene;
      pending = null;
      retiring = old;
      scene.classList.toggle('paused', !playing);
      if (remember) {
        history = history.slice(0, historyPosition + 1);
        history.push(game);
        if (history.length > 1000) history.shift();
        historyPosition = history.length - 1;
      }
      const show = () => {
        if (token !== generation || destroyed) return;
        if (!old && !options.reducedMotion) {
          // The first decoded frame appears directly; later scene changes keep their transitions.
          scene.classList.add('instant');
          global.requestAnimationFrame(() => {
            if (!destroyed && scene.isConnected)
              scene.classList.toggle('instant', options.reducedMotion);
          });
        }
        scene.classList.add('visible');
        if (isVideo && playing) art.play().catch(runtimeFailure);
        if (old) {
          old.classList.remove('visible');
          transitionTimer = setTimeout(
            () => {
              release(old);
              if (retiring === old) retiring = null;
            },
            options.reducedMotion ? 0 : 1250
          );
        }
        schedule();
        notify(playing ? 'playing' : 'paused', game);
      };
      // Fade to black waits for the old scene to disappear before revealing the next.
      if (old && options.transition === 'fade-black' && !options.reducedMotion && playing) {
        old.classList.remove('visible');
        transitionTimer = setTimeout(show, 1200);
      } else global.requestAnimationFrame(show);
      if (!playing) {
        if (isVideo) art.pause();
        else freezeScene(scene);
      }
    }
    art.addEventListener(isVideo ? 'canplay' : 'load', ready, { once: true });
    art.addEventListener('error', fail, { once: true });
    loadTimer = setTimeout(fail, 15000);
    art.src = game.media.file;
    if (isVideo) art.load();
    // Decoder failures after startup also skip the failed scene.
    function runtimeFailure() {
      if (art._sasSuspended || art._sasReleased) return;
      if (current === scene) {
        failures.add(game.id);
        notify('media-error', game);
        release(scene);
        current = null;
        if (failures.size >= games.length) {
          clearTimer();
          emptyState(true);
        } else next();
      }
    }
    art.addEventListener('error', runtimeFailure);
  }
  function next() {
    if (destroyed || !games.length) return;
    if (historyPosition < history.length - 1) {
      display(history[++historyPosition], false);
      return;
    }
    if (position + 1 >= order.length) newOrder(current?.game?.id);
    let tried = 0,
      game;
    do {
      game = order[++position];
      if (position >= order.length) {
        newOrder(current?.game?.id);
        game = order[++position];
      }
    } while (game && failures.has(game.id) && ++tried < games.length);
    if (game && !failures.has(game.id)) display(game);
  }
  function previous() {
    if (historyPosition > 0) display(history[--historyPosition], false);
  }
  function loadCatalog(value, waitingForParent = false) {
    empty.hidden = true;
    ++generation;
    clearTimer();
    clearTimeout(loadTimer);
    clearTimeout(transitionTimer);
    for (const scene of [...stage.children]) release(scene);
    current = retiring = pending = null;
    loading = false;
    failures.clear();
    catalog = value || { games: [] };
    options = settings({ ...defaults, ...catalog.settings });
    games = catalogGames(catalog, options);
    history = [];
    historyPosition = -1;
    newOrder();
    if (games.length) next();
    else if (!waitingForParent) emptyState();
  }
  function setSettings(partial) {
    const nextSettings = settings({ ...options, ...partial });
    const structural =
      nextSettings.staticFallback !== options.staticFallback ||
      nextSettings.shuffle !== options.shuffle;
    options = nextSettings;
    catalog.settings = options;
    if (structural) {
      loadCatalog(catalog);
      return;
    }
    for (const scene of stage.children) {
      scene.classList.toggle('reduced', options.reducedMotion);
      scene.classList.toggle('instant', options.reducedMotion);
      scene.querySelector('h1').hidden = !options.showLogos;
      placeCover(scene);
      placeFrame(scene);
    }
    schedule();
  }
  function message(event) {
    if (
      event.source !== global.parent ||
      event.source === global ||
      event.origin !== global.location.origin
    )
      return;
    const data = event.data;
    if (!data || data.type !== 'screensaver') return;
    if (data.action === 'catalog') loadCatalog(data.catalog);
    else if (data.action === 'settings') setSettings(data.settings || data.partial || {});
    else if (data.action === 'play') setPaused(false);
    else if (data.action === 'pause') setPaused(true);
    else if (data.action === 'next') next();
    else if (data.action === 'previous') previous();
  }
  function visibility() {
    if (doc.hidden) {
      hiddenPause = playing;
      setPaused(true);
    } else if (hiddenPause) {
      hiddenPause = false;
      setPaused(false);
    }
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    ++generation;
    clearTimer();
    clearTimeout(loadTimer);
    clearTimeout(transitionTimer);
    for (const scene of [...stage.children]) release(scene);
    global.removeEventListener('message', message);
    global.removeEventListener('resize', resizeFrames);
    global.removeEventListener('pagehide', destroy);
    doc.removeEventListener('visibilitychange', visibility);
    games = [];
    order = [];
    history = [];
    global.SteamAnimatedScreensaverPlayer = null;
  }
  global.SteamAnimatedScreensaverPlayer = {
    play: () => setPaused(false),
    pause: () => setPaused(true),
    next,
    previous,
    setSettings,
    destroy
  };
  global.addEventListener('message', message);
  global.addEventListener('resize', resizeFrames);
  global.addEventListener('pagehide', destroy, { once: true });
  doc.addEventListener('visibilitychange', visibility);
  loadCatalog(global.SAS_CATALOG, global.parent !== global);
})(typeof window !== 'undefined' ? window : globalThis);
