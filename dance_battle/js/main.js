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
    const readyOverlay = document.getElementById('ready-overlay');
    const readyPlayerName = document.getElementById('ready-player-name');
    const readyStartBtn = document.getElementById('ready-start-btn');

    startBtn.addEventListener('click', () => {
        startScreen.classList.remove('active');
        gameScreen.classList.add('active');
        gameEngine.startGame();
    });

    gameEngine.onTurnStartRequire = (player) => {
        audioController.stop();
        readyOverlay.classList.add('active');
        readyPlayerName.textContent = player.name;
        
        // Reset combo counts for the new player's turn
        comboData.forEach(c => c.count = 0);
        initComboUI();
    };

    readyStartBtn.addEventListener('click', () => {
        readyOverlay.classList.remove('active');
        audioController.start();
        gameEngine.startTurn();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        gameOverScreen.classList.remove('active');
        startScreen.classList.add('active');
    });

    // --- Input Handling ---
    const holdTimers = {};
    const isHeld = {};
    
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
        if (holdTimers[move]) return; // enforce no-repeat
        
        const pad = document.querySelector('.pad[data-move="' + move + '"]');
        if (pad) pad.classList.add('active-press');

        // Fire tap instantly for rhythm game snappiness!
        emitToken(`TAP_${move.toUpperCase()}`);

        holdTimers[move] = setTimeout(() => {
            isHeld[move] = true;
            emitToken(`HOLD_${move.toUpperCase()}`);
        }, 250); // 250ms = quarter beat hold (allows precise combos)
    }

    function handleKeyUp(move) {
        const pad = document.querySelector('.pad[data-move="' + move + '"]');
        if (pad) pad.classList.remove('active-press');

        if (holdTimers[move]) {
            clearTimeout(holdTimers[move]);
            delete holdTimers[move];
        }
        delete isHeld[move];
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

        // Check for draws
        const topScore = sortedPlayers[0].score;
        const winners = sortedPlayers.filter(p => p.score === topScore);
        
        if (winners.length > 1) {
            document.getElementById('winner-name').textContent = winners.map(w => w.name).join(' & ');
            document.querySelector('#game-over-screen .neon-title').textContent = 'DRAW!';
        } else {
            document.getElementById('winner-name').textContent = sortedPlayers[0].name;
            document.querySelector('#game-over-screen .neon-title').textContent = 'WINNER:';
        }

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
        if (comboText) {
            comboFeedback.textContent = comboText;
            comboFeedback.classList.remove('anim-pop');
            void comboFeedback.offsetWidth;
            comboFeedback.classList.add('anim-pop');
            
            logCombo(comboText);
        }
    }

    const comboData = [
        { id: "AIR SPIN!", display: "Air Spin", keys: "↑, Hold ←", count: 0 },
        { id: "DROP DROP!", display: "Drop Drop", keys: "↑, ↓", count: 0 },
        { id: "BACK FLIP!", display: "Back Flip", keys: "↑, ↑, ←", count: 0 },
        { id: "FRONT FLIP!", display: "Front Flip", keys: "↑, ↑, →", count: 0 },
        { id: "BABY FREEZE!", display: "Baby Freeze", keys: "↓, ↑", count: 0 },
        { id: "FLARE!", display: "Flare", keys: "↓, Hold ←, →", count: 0 },
        { id: "HEAD SPIN!", display: "Head Spin", keys: "↓, Hold ←, ↑, Hold →", count: 0 }
    ];

    function initComboUI() {
        comboListEl.innerHTML = '';
        comboData.forEach(c => {
            const li = document.createElement('li');
            li.id = `combo-ui-${c.id.replace(/\W/g, '')}`;
            li.innerHTML = `<span>${c.display}</span><div class="combo-keys">${c.keys}</div><div class="combo-count cyan">x${c.count}</div>`;
            comboListEl.appendChild(li);
        });
    }

    function logCombo(name) {
        if (!name || name === "WRONG MOVE!" || name === "CRASHED OUT!" || name === "SPUN OUT!" || name === "FELL DOWN!" || name === "MISSED BEAT!") return;
        
        const c = comboData.find(x => x.id === name);
        if (c) {
            c.count++;
            const li = document.getElementById(`combo-ui-${c.id.replace(/\W/g, '')}`);
            if (li) {
                li.querySelector('.combo-count').textContent = `x${c.count}`;
                li.classList.remove('combo-hit');
                void li.offsetWidth; // trigger reflow
                li.classList.add('combo-hit');
            }
        }
    }
    
    initComboUI();
});
