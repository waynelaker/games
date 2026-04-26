const STATES = {
   NEUTRAL: 0,
   AIR: 1,
   CROUCH: 2,
   PRE_FLAIR: 3,
   FLAIRING: 4,
   HEAD_SPIN_START: 5,
   HEAD_SPIN: 6,
   FALLEN: 7
};

class GameEngine {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        
        this.maxTurnTime = 30; // seconds per turn
        this.turnStartTime = 0;
        this.turnTimerId = null;

        this.multiplier = 1;

        this.dancerState = STATES.NEUTRAL;
        this.stateTimeout = null;
        this.flairPhase = 1;
        this.spinPhase = 1;
        this.missCount = 0; // Tracks penalty strikes for fall

        this.onStateChange = null; 
        this.onGameEnd = null;
        this.onAnimSync = null; // Forces visual to reset if state drops
    }

    addPlayer(name) {
        if (name.trim() !== '') {
            this.players.push({ name: name, score: 0 });
        }
    }

    removePlayer(index) {
        this.players.splice(index, 1);
    }

    startGame() {
        if (this.players.length === 0) return false;
        
        this.players.forEach(p => p.score = 0);
        this.currentPlayerIndex = 0;
        
        this.startTurn();
        return true;
    }

    startTurn() {
        this.multiplier = 1;
        this.missCount = 0;
        this.setState(STATES.NEUTRAL, 0); // Drop any open state
        this.turnStartTime = Date.now();
        
        this.updateState();

        if (this.turnTimerId) clearInterval(this.turnTimerId);
        this.turnTimerId = setInterval(() => {
            const elapsed = (Date.now() - this.turnStartTime) / 1000;
            if (elapsed >= this.maxTurnTime) {
                this.endTurn();
            } else {
                this.updateState(); 
            }
        }, 100); 
    }

    endTurn() {
        clearInterval(this.turnTimerId);
        this.currentPlayerIndex++;
        
        if (this.currentPlayerIndex >= this.players.length) {
            this.endGame();
        } else {
            this.startTurn();
        }
    }

    endGame() {
        if (this.onGameEnd) {
            const sortedPlayers = [...this.players].sort((a,b) => b.score - a.score);
            this.onGameEnd(sortedPlayers);
        }
    }

    processToken(token, accuracy) {
        if (this.players.length === 0) return null;

        let points = 0;
        let isHit = accuracy !== "Miss";
        
        if (accuracy === "Perfect") points += 100 * this.multiplier;
        if (accuracy === "Good") points += 50 * this.multiplier;

        let anim = "Idle";
        let comboTriggered = false;
        let comboName = null;

        const previousState = this.dancerState;

        // "Misses" break active combo sustains
        if (!isHit && (this.dancerState === STATES.FLAIRING || this.dancerState === STATES.HEAD_SPIN)) {
            this.missCount++;
            if (this.missCount >= 3) {
                this.setState(STATES.FALLEN, 1500); // Penalty window where they can't act
                comboName = "FELL DOWN!";
                anim = "Fall";
                this.missCount = 0;
            } else {
                this.setState(STATES.NEUTRAL);
                comboName = "MISSED BEAT!";
                anim = "Idle";
            }
            comboTriggered = true;
            this.updateState();
            return { accuracy, points: 0, comboTriggered, comboName, anim };
        }

        switch (this.dancerState) {
            case STATES.FALLEN:
                // Ignore all inputs while fallen!
                break;
                
            case STATES.NEUTRAL:
                if (token === "TAP_UP") {
                    this.setState(STATES.AIR, 400); 
                    anim = "Jump";
                } else if (token === "TAP_DOWN") {
                    this.setState(STATES.CROUCH, 500);
                    anim = "Crouch";
                } else if (token === "TAP_LEFT" || token === "TAP_RIGHT") {
                    anim = token === "TAP_LEFT" ? "Left" : "Right";
                }
                break;
                
            case STATES.AIR:
                if (token === "HOLD_LEFT") {
                    anim = "AirSpin";
                    points += 200;
                    comboTriggered = true;
                    comboName = "AIR SPIN!";
                    this.setState(STATES.NEUTRAL, 600); 
                } else if (token === "TAP_DOWN") {
                    anim = "Crouch";
                    points += 250;
                    comboTriggered = true;
                    comboName = "DROP DROP!";
                    this.setState(STATES.CROUCH, 500); 
                } else if (token !== "TAP_LEFT") {
                    // We ignore TAP_LEFT since that implies they pressed Left intending to Hold it.
                    this.setState(STATES.NEUTRAL);
                }
                break;

            case STATES.CROUCH:
                if (token === "HOLD_LEFT") {
                    this.setState(STATES.PRE_FLAIR, 800); 
                    anim = "PrepFlair"; 
                } else if (token === "TAP_UP") {
                    this.setState(STATES.NEUTRAL, 800);
                    anim = "Headstand";
                    points += 300;
                    comboTriggered = true;
                    comboName = "BABY FREEZE!";
                } else if (token !== "TAP_LEFT") {
                    this.setState(STATES.NEUTRAL);
                }
                break;

            case STATES.PRE_FLAIR:
                if (token === "TAP_RIGHT") {
                    this.setState(STATES.FLAIRING, 600); 
                    anim = "Flair1"; 
                    this.flairPhase = 1;
                    comboName = "THOMAS FLAIRS STARTED!";
                    comboTriggered = true;
                }
                else if (token === "TAP_UP") {
                    this.setState(STATES.HEAD_SPIN_START, 800);
                    anim = "Headstand";
                } else {
                    this.setState(STATES.NEUTRAL);
                }
                break;
                
            case STATES.FLAIRING:
                if (this.flairPhase === 1 && token === "TAP_LEFT") {
                    this.flairPhase = 2;
                    anim = "Flair2";
                    this.setState(STATES.FLAIRING, 600); 
                    points += 300;
                } else if (this.flairPhase === 2 && token === "TAP_RIGHT") {
                    this.flairPhase = 1;
                    anim = "Flair1";
                    this.setState(STATES.FLAIRING, 600);
                    points += 300;
                } else {
                    this.missCount++;
                    if (this.missCount >= 3) {
                        this.setState(STATES.FALLEN, 1500); 
                        comboName = "CRASHED OUT!";
                        anim = "Fall";
                        this.missCount = 0;
                    } else {
                        this.setState(STATES.NEUTRAL);
                        comboName = "WRONG MOVE!";
                        anim = "Idle";
                    }
                    comboTriggered = true;
                }
                break;

            case STATES.HEAD_SPIN_START:
                 if (token === "HOLD_RIGHT") {
                     this.setState(STATES.HEAD_SPIN, 800);
                     anim = "HeadSpin";
                     this.spinPhase = 1;
                     comboName = "HEAD SPIN!";
                     comboTriggered = true;
                 } else if (token !== "TAP_RIGHT") {
                     this.setState(STATES.NEUTRAL);
                 }
                 break;

            case STATES.HEAD_SPIN:
                if (this.spinPhase === 1 && token === "TAP_LEFT") {
                    this.spinPhase = 2;
                    anim = "HeadSpin1";
                    this.setState(STATES.HEAD_SPIN, 600); 
                    points += 500;
                } else if (this.spinPhase === 2 && token === "TAP_RIGHT") {
                    this.spinPhase = 1;
                    anim = "HeadSpin2";
                    this.setState(STATES.HEAD_SPIN, 600);
                    points += 500;
                } else {
                    this.missCount++;
                    if (this.missCount >= 3) {
                        this.setState(STATES.FALLEN, 1500); 
                        comboName = "SPUN OUT!";
                        anim = "Fall";
                        this.missCount = 0;
                    } else {
                        this.setState(STATES.NEUTRAL);
                        comboName = "WRONG MOVE!";
                        anim = "Idle";
                    }
                    comboTriggered = true;
                }
                break;
        }
        
        this.players[this.currentPlayerIndex].score += points;
        this.updateState();

        return { 
            accuracy, 
            points, 
            comboTriggered, 
            comboName: comboName,
            anim: anim
        };
    }
    
    setState(newState, autoNeutralTimeoutMs = 0) {
        this.dancerState = newState;
        if (this.stateTimeout) clearTimeout(this.stateTimeout);
        if (autoNeutralTimeoutMs > 0) {
            this.stateTimeout = setTimeout(() => {
                this.dancerState = STATES.NEUTRAL;
                if (this.onAnimSync) this.onAnimSync('idle');
            }, autoNeutralTimeoutMs);
        }
    }

    updateState() {
        if (this.onStateChange) {
            const elapsed = (Date.now() - this.turnStartTime) / 1000;
            const progress = Math.min(1, Math.max(0, elapsed / this.maxTurnTime));
            
            this.onStateChange({
                currentPlayer: this.players[this.currentPlayerIndex],
                players: this.players,
                timeProgress: progress,
                multiplier: 1, // disabled
                hypeStreak: 0,
                hypeNeeded: 4
            });
        }
    }
}
