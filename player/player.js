/* Standalone offline player. No Steam APIs, network calls or input interception. */
(function (global) {
  'use strict';
  const defaults = {
    sceneDuration: 24,
    shuffle: true,
    transition: 'crossfade',
    showLogos: true,
    staticFallback: false,
    reducedMotion: false,
    language: 'en'
  };
  function localMedia(value) {
    if (typeof value !== 'string' || value.length > 240 || /[\\\u0000-\u001f?#]/.test(value))
      return false;
    return (
      /^(?:(?:\/?media\/)|(?:app:\/\/cinema\/media\/))[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(
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
  const helpers = { localMedia, settings, catalogGames, shuffle };
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
      global.parent.postMessage({ type: 'cinema-player', status, gameId: game?.id || null }, '*');
  }
  function emptyState(failed = false) {
    empty.hidden = false;
    empty.querySelector('h1').textContent = failed
      ? french()
        ? 'Ces médias sont indisponibles.'
        : 'These artworks are unavailable.'
      : french()
        ? 'Donnez vie à votre bibliothèque.'
        : 'Bring your library to life.';
    empty.querySelector('p').textContent = failed
      ? french()
        ? 'Réparez la bibliothèque depuis le gestionnaire.'
        : 'Repair your library in the Manager, then preview again.'
      : french()
        ? 'Préparez vos animations favorites dans le gestionnaire.'
        : 'Prepare your favorite game animations in the Manager.';
  }
  function release(scene) {
    if (!scene) return;
    for (const media of scene.querySelectorAll('video')) {
      media.pause();
      media.removeAttribute('src');
      media.load();
    }
    for (const image of scene.querySelectorAll('img')) {
      image._cinemaReleased = true;
      image._cinemaSuspended = true;
      if (image._cinemaRestore) image.removeEventListener('load', image._cinemaRestore);
      image.removeAttribute('src');
    }
    for (const canvas of scene.querySelectorAll('canvas')) canvas.width = canvas.height = 0;
    scene.remove();
  }
  function freezeScene(scene) {
    if (!scene) return;
    scene.classList.add('paused');
    const art = scene.querySelector('img.artwork');
    if (!art || !scene.game.media.animated || art._cinemaReleased) return;
    // Canvas image sources expose the browser's default animation frame. Freeze that
    // local frame and unload the native animation rather than pretending a timer pauses it.
    if (!art._cinemaSnapshot) {
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
      art._cinemaSnapshot = canvas;
    }
    if (art._cinemaRestore) {
      art.removeEventListener('load', art._cinemaRestore);
      art._cinemaRestore = null;
    }
    art._cinemaSuspended = true;
    art.hidden = true;
    art.removeAttribute('src');
  }
  function resumeScene(scene) {
    if (!scene) return;
    scene.classList.remove('paused');
    const art = scene.querySelector('img.artwork');
    if (!art?._cinemaSnapshot || !art._cinemaSuspended || art._cinemaReleased) return;
    art._cinemaSuspended = false;
    const restored = () => {
      art._cinemaRestore = null;
      if (art._cinemaReleased) return;
      if (!playing) {
        freezeScene(scene);
        return;
      }
      const canvas = art._cinemaSnapshot;
      art._cinemaSnapshot = null;
      art.hidden = false;
      if (canvas) {
        canvas.width = canvas.height = 0;
        canvas.remove();
      }
    };
    art._cinemaRestore = restored;
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
    scene.append(art);
    const shade = doc.createElement('div');
    shade.className = 'shade';
    scene.append(shade);
    const caption = doc.createElement('div');
    caption.className = 'caption';
    const eyebrow = doc.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = french()
      ? 'Votre bibliothèque. En mouvement.'
      : 'Your library. Beautifully alive.';
    const title = doc.createElement('h1');
    title.textContent = String(game.name || '');
    title.hidden = !options.showLogos;
    const credit = doc.createElement('p');
    credit.className = 'credit';
    credit.textContent = `${french() ? 'Artwork de' : 'Artwork by'} ${String(game.media.author?.name || 'Unknown')} · SteamGridDB`;
    caption.append(eyebrow, title, credit);
    if (!game.media.animated) {
      const badge = doc.createElement('p');
      badge.className = 'static-note';
      badge.textContent = french()
        ? 'Illustration statique · Repli optionnel'
        : 'Static artwork · Optional fallback';
      caption.append(badge);
    }
    scene.append(caption);
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
      if (
        complete ||
        token !== generation ||
        destroyed ||
        art._cinemaSuspended ||
        art._cinemaReleased
      )
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
      if (art._cinemaSuspended || art._cinemaReleased) return;
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
  function loadCatalog(value) {
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
    else emptyState();
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
    if (!data || data.type !== 'cinema') return;
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
    global.removeEventListener('pagehide', destroy);
    doc.removeEventListener('visibilitychange', visibility);
    games = [];
    order = [];
    history = [];
    global.CinemaPlayer = null;
  }
  global.CinemaPlayer = {
    play: () => setPaused(false),
    pause: () => setPaused(true),
    next,
    previous,
    setSettings,
    destroy
  };
  global.addEventListener('message', message);
  global.addEventListener('pagehide', destroy, { once: true });
  doc.addEventListener('visibilitychange', visibility);
  loadCatalog(global.CINEMA_CATALOG);
})(typeof window !== 'undefined' ? window : globalThis);
