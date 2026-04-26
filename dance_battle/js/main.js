document.addEventListener('DOMContentLoaded', () => {
    const audioController = new AudioController();
    const gameEngine = new GameEngine();

    // Screens
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameOverScreen = document.getElementById('game-over-screen');

    // Start Screen Elements
    const addPlayerBtn = document.getElementById('add-player-btn');
    const playerInput = document.getElementById('player-input');
    const playersUl = document.getElementById('players-ul');
    const startBtn = document.getElementById('start-btn');

    // Game Screen UI
    const timerBar = document.getElementById('timer-bar');
    const currentPlayerName = document.getElementById('current-player-name');
    const leaderboard = document.getElementById('leaderboard');
    const hypeMeterFill = document.getElementById('hype-meter-fill');
    const multiplierText = document.getElementById('multiplier-text');
    const hypeFire = document.getElementById('hype-fire');
    const hitFeedback = document.getElementById('hit-feedback');
    const comboFeedback = document.getElementById('combo-feedback');
    const comboListEl = document.getElementById('combo-list');
    
    // Beat visuals
    const pulseRing = document.querySelector('.pulse-ring');
    const coreBeat = document.getElementById('core-beat');

    let currentTurnPlayer = null;

    // --- Setup Players ---
    function renderPlayerListSetup() {
        playersUl.innerHTML = '';
        gameEngine.players.forEach((p, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${p.name}</span> <button class="remove-btn" data-idx="${idx}">×</button>`;
            playersUl.appendChild(li);
        });
        startBtn.disabled = gameEngine.players.length === 0;

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                gameEngine.removePlayer(parseInt(e.target.dataset.idx));
                renderPlayerListSetup();
            });
        });
    }

    addPlayerBtn.addEventListener('click', () => {
        const name = playerInput.value;
        if (name) {
            gameEngine.addPlayer(name);
            playerInput.value = '';
            renderPlayerListSetup();
        }
    });

    playerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPlayerBtn.click();
    });

    // --- Game Navigation ---
    startBtn.addEventListener('click', () => {
        startScreen.classList.remove('active');
        gameScreen.classList.add('active');
        
        // Start Audio and Game Loop
        audioController.start();
        gameEngine.startGame();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        gameOverScreen.classList.remove('active');
        startScreen.classList.add('active');
    });

    // --- Input Handling ---
    let currentDownKey = null;
    let holdTimer = null;
    let isHeld = false;
    
    const keyMap = {
        'w': 'Up', 'ArrowUp': 'Up',
        'a': 'Left', 'ArrowLeft': 'Left',
        's': 'Down', 'ArrowDown': 'Down',
        'd': 'Right', 'ArrowRight': 'Right'
    };

    function emitToken(token) {
        if (!gameScreen.classList.contains('active')) return;
        
        const accuracy = audioController.getTimingAccuracy();
        const result = gameEngine.processToken(token, accuracy);

        const animClassName = result.anim;

        // Animate Dancer
        const dancer = document.getElementById('neon-dancer');
        if (dancer && animClassName !== 'Idle') {
            dancer.className = "move-" + animClassName;
            if (dancer.dataset.timeoutId) clearTimeout(parseInt(dancer.dataset.timeoutId));
        } else if (dancer && animClassName === 'Idle') {
            dancer.className = 'idle';
        }

        const msg = result.comboTriggered ? result.comboName : null;
        if (msg) showFeedback("Perfect", msg); // Show combo message
        else showFeedback(result.accuracy, null); // Show timing
    }
    
    function handleKeyDown(move) {
        if (currentDownKey && currentDownKey !== move) return; // enforce one key
        
        currentDownKey = move;
        isHeld = false;
        
        const pad = document.querySelector('.pad[data-move="' + move + '"]');
        if (pad) pad.classList.add('active-press');

        // Fire tap instantly for rhythm game snappiness!
        emitToken(`TAP_${move.toUpperCase()}`);

        holdTimer = setTimeout(() => {
            isHeld = true;
            emitToken(`HOLD_${move.toUpperCase()}`);
            if (pad) pad.classList.remove('active-press');
        }, 500); // 500ms = 1 beat hold
    }

    function handleKeyUp(move) {
        const pad = document.querySelector('.pad[data-move="' + move + '"]');
        if (pad) pad.classList.remove('active-press');

        if (currentDownKey !== move) return;
        
        clearTimeout(holdTimer);
        currentDownKey = null;
    }

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        const move = keyMap[e.key];
        if (move) handleKeyDown(move);
    });

    document.addEventListener('keyup', (e) => {
        const moveName = keyMap[e.key];
        if (moveName) handleKeyUp(moveName);
    });

    // Touch / Mouse
    document.querySelectorAll('.pad').forEach(pad => {
        pad.addEventListener('pointerdown', (e) => {
            e.preventDefault(); 
            const move = pad.dataset.move;
            handleKeyDown(move);
        });
        pad.addEventListener('pointerup', (e) => {
            e.preventDefault();
            const move = pad.dataset.move;
            handleKeyUp(move);
        });
        pad.addEventListener('pointerout', (e) => {
            e.preventDefault();
            const move = pad.dataset.move;
            handleKeyUp(move);
        });
    });
    
    gameEngine.onAnimSync = (state) => {
        const dancer = document.getElementById('neon-dancer');
        if (dancer && state === 'idle') dancer.className = 'idle';
    };


    // --- Engine Callbacks ---
    gameEngine.onStateChange = (state) => {
        // Update Timer
        timerBar.style.width = `${(1 - state.timeProgress) * 100}%`;

        // Update Turn info
        currentTurnPlayer = state.currentPlayer;
        currentPlayerName.textContent = currentTurnPlayer.name;

        // Render Leaderboard
        renderLeaderboard(state.players, state.currentPlayer);

        // Update Hype Meter
        // Math: percentage = (streak / hypeNeeded) OR if multiplier is max, 100%
        let fillPercent = 0;
        if (state.multiplier === gameEngine.maxMultiplier) {
            fillPercent = 100;
        } else {
            fillPercent = (state.hypeStreak / state.hypeNeeded) * 100;
        }
        
        hypeMeterFill.style.height = `${fillPercent}%`;
        multiplierText.textContent = `x${state.multiplier}`;
        
        if (state.multiplier > 1) {
            multiplierText.classList.add('hype-active');
        } else {
            multiplierText.classList.remove('hype-active');
        }
    };

    gameEngine.onGameEnd = (sortedPlayers) => {
        audioController.stop();
        gameScreen.classList.remove('active');
        gameOverScreen.classList.add('active');

        document.getElementById('winner-name').textContent = sortedPlayers[0].name;

        const finalUl = document.getElementById('final-scores');
        finalUl.innerHTML = '';
        sortedPlayers.forEach(p => {
            const div = document.createElement('div');
            div.className = 'player-score';
            div.innerHTML = `<div class="name">${p.name}</div><div class="score">${p.score}</div>`;
            finalUl.appendChild(div);
        });
    };

    // --- Audio callbacks ---
    audioController.onBeat((beatNumber, time) => {
        if (gameScreen.classList.contains('active')) {
            // Visual pulse
            pulseRing.classList.remove('beat-ping');
            coreBeat.classList.remove('core-pulse');
            
            // Force reflow
            void pulseRing.offsetWidth;
            
            pulseRing.classList.add('beat-ping');
            coreBeat.classList.add('core-pulse');
        }
    });

    // --- UI Helpers ---
    function renderLeaderboard(players, currentPlayer) {
        leaderboard.innerHTML = '';
        players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'player-score ' + (p === currentPlayer ? 'active-turn' : '');
            div.innerHTML = `
                <div class="name">${p.name}</div>
                <div class="score">${p.score}</div>
            `;
            leaderboard.appendChild(div);
        });
    }

    function showFeedback(accuracy, comboText) {
        hitFeedback.textContent = accuracy;
        hitFeedback.className = '';
        void hitFeedback.offsetWidth; // reflow
        
        hitFeedback.classList.add(accuracy.toLowerCase());
        hitFeedback.classList.add('anim-pop');

        if (comboText) {
            comboFeedback.textContent = comboText;
            comboFeedback.classList.remove('anim-pop');
            void comboFeedback.offsetWidth;
            comboFeedback.classList.add('anim-pop');
            
            logCombo(comboText);
        } else {
             // Let it fade or remain until next
        }
    }

    function logCombo(name) {
        if (!name || name === "WRONG MOVE!" || name === "CRASHED OUT!" || name === "SPUN OUT!" || name === "FELL DOWN!" || name === "MISSED BEAT!") return;
        
        let keys = "";
        if (name === "AIR SPIN!") keys = "↑ + Hold ←";
        else if (name === "THOMAS FLAIRS STARTED!") keys = "↓ + Hold ← + →";
        else if (name === "HEAD SPIN!") keys = "↓ + Hold ← + ↑ + Hold →";
        else if (name === "BABY FREEZE!") keys = "↓ + ↑";
        else if (name === "DROP DROP!") keys = "↑ + ↓";
        
        const li = document.createElement('li');
        li.innerHTML = `${name}<div class="combo-keys">${keys}</div>`;
        comboListEl.prepend(li);
        
        // Keep list reasonable length
        if (comboListEl.children.length > 5) {
            comboListEl.lastChild.remove();
        }
    }
});
