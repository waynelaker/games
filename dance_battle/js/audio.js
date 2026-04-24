class AudioController {
    constructor() {
        this.ctx = null;
        this.bpm = 120; // 120 beats per minute
        this.beatInterval = 60 / this.bpm; // seconds per beat
        this.isPlaying = false;
        
        // Sequencer state
        this.nextNoteTime = 0;
        this.currentBeat = 0;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.timerID = null;

        this.onBeatListeners = [];
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    start() {
        this.init();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        this.isPlaying = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        window.clearTimeout(this.timerID);
    }

    // Schedule the next beat
    nextNote() {
        this.nextNoteTime += this.beatInterval;
        this.currentBeat++;
    }

    // Play a synth sound for the beat
    scheduleNote(beatNumber, time) {
        // Change up rhythms every 16 beats
        const measure = Math.floor(beatNumber / 16) % 3;
        
        // Pattern 0: Standard 4 on the floor
        // Pattern 1: Breakbeat / syncopated
        // Pattern 2: Sparse build up
        
        // Kicks
        if (measure === 0 && (beatNumber % 4 === 0)) this.playKick(time);
        else if (measure === 1 && (beatNumber % 8 === 0 || beatNumber % 8 === 3 || beatNumber % 8 === 5)) this.playKick(time);
        else if (measure === 2 && (beatNumber % 8 === 0)) this.playKick(time);

        // Hi-hats
        if (measure === 0 && (beatNumber % 2 !== 0)) this.playHihat(time);
        else if (measure === 1 && (beatNumber % 1 === 0)) this.playHihat(time, 0.1); // Fast hats
        else if (measure === 2 && (beatNumber % 4 === 2)) this.playHihat(time, 0.3);

        // Snares (Clap)
        if (measure === 0 && (beatNumber % 4 === 2)) this.playSnare(time);
        else if (measure === 1 && (beatNumber % 8 === 4)) this.playSnare(time);
        else if (measure === 2 && (beatNumber % 8 === 4 || beatNumber % 8 === 7)) this.playSnare(time);

        // Dispatch a custom event to sync visuals and logic
        // We set a slight timeout so the visual triggers exactly when the audio plays
        const timeUntilPlay = time - this.ctx.currentTime;
        const timeMs = Math.max(0, timeUntilPlay * 1000);
        
        setTimeout(() => {
            this.notifyBeat(beatNumber, time);
        }, timeMs);
    }

    scheduler() {
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime ) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            this.nextNote();
        }
        if (this.isPlaying) {
            this.timerID = window.setTimeout(this.scheduler.bind(this), this.lookahead);
        }
    }

    // Synth Instruments
    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    playHihat(time, vol = 0.3) {
        const bufferSize = this.ctx.sampleRate * 0.05; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1; 
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(time);
    }

    playSnare(time) {
        // Noise part
        const bufferSize = this.ctx.sampleRate * 0.2; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1; 
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(time);

        // Tone part (snap)
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(250, time);
        oscGain.gain.setValueAtTime(0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    // Logic timing check
    // Allows the game engine to query if an input is close to the expected beat
    getTimingAccuracy() {
        // Find the absolute distance in seconds to the NEAREST beat (past or future)
        const now = this.ctx.currentTime;
        const timeSinceLastBeat = (now - (this.nextNoteTime - this.beatInterval));
        const timeToNextBeat = this.nextNoteTime - now;

        const distance = Math.min(timeSinceLastBeat, timeToNextBeat);
        
        // Thresholds in seconds:
        // Perfect: < 0.08s
        // Good: < 0.20s
        // Miss: else
        if (distance < 0.08) return "Perfect";
        if (distance < 0.20) return "Good";
        return "Miss";
    }

    notifyBeat(beatNumber, scheduledTime) {
        this.onBeatListeners.forEach(listener => listener(beatNumber, scheduledTime));
    }
    
    onBeat(callback) {
        this.onBeatListeners.push(callback);
    }
}
