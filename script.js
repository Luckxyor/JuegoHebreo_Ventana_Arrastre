(function () {
  'use strict';

  // ─── CONSTANTS ──────────────────────────────────────────────────────────────
  const CLIMATES = ['sol', 'lluvia', 'nubes', 'viento'];

  // ─── STATE ───────────────────────────────────────────────────────────────────
  // 'idle'     → waiting for start
  // 'playing'  → window open, audio playing, drag enabled
  // 'checking' → evaluating drop, animations running
  let gameState = 'idle';
  let currentClimate = null;
  let draggedType = null;

  // ─── AUDIO OBJECTS ──────────────────────────────────────────────────────────
  const audioInicio     = new Audio('audios/AudioInicio.mp3');
  const audioCorrecta   = new Audio('audios/Correcta.mp3');
  const audioIncorrecto = new Audio('audios/Incorrecto.mp3');
  const climateAudios = {
    sol:    new Audio('audios/sol.mp3'),
    lluvia: new Audio('audios/lluvia.mp3'),
    nubes:  new Audio('audios/nubes.mp3'),
    viento: new Audio('audios/viento.mp3'),
  };

  // ─── DOM REFERENCES ─────────────────────────────────────────────────────────
  const startBtn       = document.getElementById('start-btn');
  const windowWrapper  = document.getElementById('window-wrapper');
  const dropZone       = document.getElementById('drop-zone');
  const feedback       = document.getElementById('feedback');
  const feedbackIcon   = document.getElementById('feedback-icon');
  const answerInWindow = document.getElementById('answer-in-window');
  const climateCards   = document.querySelectorAll('.climate-card');

  // ─── HELPERS ────────────────────────────────────────────────────────────────
  function stopAllAudio() {
    audioInicio.pause();
    audioInicio.currentTime = 0;
    audioInicio.onended = null;
    audioCorrecta.pause();
    audioCorrecta.currentTime = 0;
    audioIncorrecto.pause();
    audioIncorrecto.currentTime = 0;
    CLIMATES.forEach(function (key) {
      climateAudios[key].pause();
      climateAudios[key].currentTime = 0;
    });
  }

  function setDraggable(enabled) {
    climateCards.forEach(function (card) {
      if (enabled) {
        card.setAttribute('draggable', 'true');
        card.querySelector('img').setAttribute('draggable', 'false');
        card.classList.add('draggable');
      } else {
        card.setAttribute('draggable', 'false');
        card.querySelector('img').setAttribute('draggable', 'false');
        card.classList.remove('draggable');
        card.classList.remove('dragging');
      }
    });
  }

  function showFeedback(type) {
    // type: 'correct' | 'incorrect'
    feedbackIcon.textContent = type === 'correct' ? '✓' : '✗';
    feedback.className = type + ' show';
  }

  function hideFeedback() {
    feedback.className = 'hidden';
  }

  function openWindow() {
    windowWrapper.classList.add('window-opened');
  }

  function closeWindow() {
    windowWrapper.classList.remove('window-opened');
  }

  function pickRandomClimate() {
    const index = Math.floor(Math.random() * CLIMATES.length);
    return CLIMATES[index];
  }

  // ─── RESET / RETURN TO IDLE ──────────────────────────────────────────────────
  function hideAnswerInWindow() {
    answerInWindow.classList.remove('pop-in');
    answerInWindow.classList.remove('pop-out');
    answerInWindow.src = '';
    answerInWindow.style.opacity = '0';
  }

  function resetToIdle() {
    stopAllAudio();
    setDraggable(false);
    closeWindow();
    hideFeedback();
    hideAnswerInWindow();
    currentClimate = null;
    draggedType    = null;
    startBtn.classList.remove('hidden');
    gameState = 'idle';
  }

  // ─── START GAME ─────────────────────────────────────────────────────────────
  function startGame() {
    if (gameState !== 'idle') return;
    gameState = 'playing';

    startBtn.classList.add('hidden');
    hideFeedback();

    stopAllAudio();
    openWindow();

    audioInicio.currentTime = 0;
    audioInicio.onended = function () {
      if (gameState !== 'playing') return;
      currentClimate = pickRandomClimate();
      var aud = climateAudios[currentClimate];
      aud.currentTime = 0;
      aud.play().catch(function () {});
    };

    audioInicio.play().catch(function () {
      // If autoplay blocked, still pick climate immediately
      if (gameState !== 'playing') return;
      currentClimate = pickRandomClimate();
      var aud = climateAudios[currentClimate];
      aud.currentTime = 0;
      aud.play().catch(function () {});
    });

    setDraggable(true);
  }

  // ─── CHECK ANSWER ───────────────────────────────────────────────────────────
  function checkAnswer(droppedType) {
    if (gameState !== 'playing') return;
    if (!currentClimate) return;

    gameState = 'checking';
    draggedType = null;

    if (droppedType === currentClimate) {
      // ── CORRECT ──────────────────────────────────────────────────────────────
      stopAllAudio();
      audioCorrecta.play().catch(function () {});

      // Mostrar imagen del clima dentro de la ventana
      answerInWindow.src = 'images/' + droppedType + '.png';
      answerInWindow.style.opacity = '1';
      answerInWindow.classList.remove('pop-in');
      answerInWindow.classList.remove('pop-out');
      void answerInWindow.offsetWidth; // reflow para reiniciar animación
      answerInWindow.classList.add('pop-in');

      showFeedback('correct');

      setTimeout(function () {
        hideFeedback();
        // Animación de salida de la imagen antes de cerrar
        answerInWindow.classList.remove('pop-in');
        void answerInWindow.offsetWidth;
        answerInWindow.classList.add('pop-out');
        setTimeout(function () {
          resetToIdle();
        }, 380);
      }, 2200);

    } else {
      // ── INCORRECT ────────────────────────────────────────────────────────────
      stopAllAudio();
      audioIncorrecto.play().catch(function () {});
      showFeedback('incorrect');

      setTimeout(function () {
        hideFeedback();
        // Retomar el audio del clima para que el niño vuelva a intentarlo
        var aud = climateAudios[currentClimate];
        aud.currentTime = 0;
        aud.play().catch(function () {});
        gameState = 'playing';
      }, 1800);
    }
  }

  // ─── START BUTTON ───────────────────────────────────────────────────────────
  startBtn.addEventListener('click', startGame);

  // ─── DRAG GHOST STATE ────────────────────────────────────────────────────────
  var dragGhost = null;   // elemento DOM del ghost
  var rafId     = null;   // requestAnimationFrame id
  var gx = 0, gy = 0;    // posición interpolada actual
  var tx = 0, ty = 0;    // posición objetivo (cursor)
  var pvx = 0, pvy = 0;  // velocidad previa (para rotación)

  // ─── GHOST: CREAR / MOVER / DESTRUIR ────────────────────────────────────────
  function createGhost(card, clientX, clientY) {
    removeGhost();
    var imgSrc = card.querySelector('img').src;
    dragGhost = document.createElement('div');
    dragGhost.className = 'drag-ghost';
    var img = document.createElement('img');
    img.src = imgSrc;
    img.draggable = false;
    dragGhost.appendChild(img);
    document.body.appendChild(dragGhost);
    // Inicializar posición directamente bajo el cursor
    var hw = dragGhost.offsetWidth  / 2 || 100;
    var hh = dragGhost.offsetHeight / 2 || 100;
    gx = clientX;  gy = clientY;
    tx = clientX;  ty = clientY;
    pvx = 0;       pvy = 0;
    applyGhostTransform(hw, hh, 0);
    startRaf();
  }

  function applyGhostTransform(hw, hh, rot) {
    if (!dragGhost) return;
    dragGhost.style.transform =
      'translate(' + (gx - hw) + 'px, ' + (gy - hh) + 'px)' +
      ' rotate('   + rot       + 'deg)' +
      ' scale(1.22)';
  }

  function startRaf() {
    if (rafId) return;
    var LERP = 0.18;          // factor de suavizado (0 = estático, 1 = instantáneo)
    var ROT_FACTOR = 0.55;    // cuánto influye la velocidad en la rotación
    var MAX_ROT = 20;         // grados máximos
    function loop() {
      if (!dragGhost) return;
      var dx  = tx - gx;
      var dy  = ty - gy;
      gx += dx * LERP;
      gy += dy * LERP;
      // Velocidad suavizada para rotación
      pvx += (dx - pvx) * 0.18;
      var rot = Math.max(-MAX_ROT, Math.min(MAX_ROT, pvx * ROT_FACTOR));
      var hw  = dragGhost.offsetWidth  / 2;
      var hh  = dragGhost.offsetHeight / 2;
      applyGhostTransform(hw, hh, rot);
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopRaf() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function removeGhost() {
    stopRaf();
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
  }

  // ─── mousemove global: actualiza objetivo del ghost en cada frame del ratón───
  document.addEventListener('mousemove', function (e) {
    tx = e.clientX;
    ty = e.clientY;
  });

  // ─── DRAG EVENTS ON CLIMATE CARDS ───────────────────────────────────────────
  climateCards.forEach(function (card) {
    card.addEventListener('dragstart', function (e) {
      if (gameState !== 'playing') {
        e.preventDefault();
        return;
      }
      draggedType = card.dataset.type;
      card.classList.add('dragging');

      // Suprimir imagen nativa del navegador
      var pixel = document.createElement('div');
      pixel.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(pixel);
      e.dataTransfer.setDragImage(pixel, 0, 0);
      setTimeout(function () { pixel.remove(); }, 0);

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.type);

      createGhost(card, e.clientX, e.clientY);
    });

    // drag event como respaldo de posición (menor frecuencia que mousemove)
    card.addEventListener('drag', function (e) {
      if (e.clientX !== 0 || e.clientY !== 0) {
        tx = e.clientX;
        ty = e.clientY;
      }
    });

    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      removeGhost();
    });
  });

  // ─── DROP ZONE EVENTS ───────────────────────────────────────────────────────
  dropZone.addEventListener('dragenter', function (e) {
    if (gameState !== 'playing') return;
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragover', function (e) {
    if (gameState !== 'playing') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dropZone.classList.add('drag-over');
    tx = e.clientX;
    ty = e.clientY;
  });

  dropZone.addEventListener('dragleave', function (e) {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('drag-over');
    }
  });

  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    removeGhost();
    if (gameState !== 'playing') return;

    var type = e.dataTransfer.getData('text/plain') || draggedType;
    if (!type) return;

    checkAnswer(type);
  });

  // ─── PREVENT DEFAULT BROWSER DROP BEHAVIOR ──────────────────────────────────
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop',     function (e) { e.preventDefault(); });

  // ─── TOUCH DRAG ON CLIMATE CARDS (móvil / tablet) ───────────────────────────
  function isTouchOverDropZone(clientX, clientY) {
    var rect = dropZone.getBoundingClientRect();
    return (
      clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top  && clientY <= rect.bottom
    );
  }

  climateCards.forEach(function (card) {
    card.addEventListener('touchstart', function (e) {
      if (gameState !== 'playing') return;
      e.preventDefault();
      var touch = e.changedTouches[0];
      draggedType = card.dataset.type;
      card.classList.add('dragging');
      // Inicializar posiciones para el RAF
      gx = touch.clientX;  gy = touch.clientY;
      tx = touch.clientX;  ty = touch.clientY;
      pvx = 0;
      createGhost(card, touch.clientX, touch.clientY);
    }, { passive: false });

    card.addEventListener('touchmove', function (e) {
      if (!dragGhost) return;
      e.preventDefault();
      var touch = e.changedTouches[0];
      tx = touch.clientX;
      ty = touch.clientY;
      // Resaltar drop zone si el dedo está sobre ella
      if (isTouchOverDropZone(touch.clientX, touch.clientY)) {
        dropZone.classList.add('drag-over');
      } else {
        dropZone.classList.remove('drag-over');
      }
    }, { passive: false });

    card.addEventListener('touchend', function (e) {
      e.preventDefault();
      card.classList.remove('dragging');
      dropZone.classList.remove('drag-over');
      var hadGhost = !!dragGhost;
      removeGhost();
      if (!hadGhost || gameState !== 'playing') return;
      var touch = e.changedTouches[0];
      if (isTouchOverDropZone(touch.clientX, touch.clientY) && draggedType) {
        checkAnswer(draggedType);
      }
      draggedType = null;
    }, { passive: false });

    card.addEventListener('touchcancel', function () {
      card.classList.remove('dragging');
      dropZone.classList.remove('drag-over');
      removeGhost();
      draggedType = null;
    });
  });

})();
