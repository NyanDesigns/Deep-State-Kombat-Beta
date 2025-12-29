import { CONFIG } from '../config.js';

export class GameState {
    constructor() {
        this.state = 'SETUP'; // SETUP, COUNTDOWN, FIGHT, OVER, PAUSED
        this.timer = CONFIG.combat.timer || 99;
        this.timerInterval = null;
        this.onStateChange = null; // Callback for state changes
        this.onTimerUpdate = null; // Callback for timer updates
        this.onTimerEnd = null;
    }

    setState(newState) {
        const oldState = this.state;
        this.state = newState;

        if (this.onStateChange) {
            this.onStateChange(newState, oldState);
        }

        // Handle state-specific logic
        switch (newState) {
            case 'COUNTDOWN':
                this.stopTimer();
                break;
            case 'FIGHT':
                this.startTimer();
                break;
            case 'OVER':
            case 'PAUSED':
                this.stopTimer();
                break;
        }
    }

    startTimer() {
        this.stopTimer(); // Clear any existing timer
        this.timerInterval = setInterval(() => {
            this.timer--;
            if (this.onTimerUpdate) {
                this.onTimerUpdate(this.timer);
            }
            if (this.timer <= 0) {
                if (this.onTimerEnd) {
                    this.onTimerEnd();
                } else {
                    this.endGame(null); // Draw
                }
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        this.timer = CONFIG.combat.timer || 99;
        if (this.onTimerUpdate) {
            this.onTimerUpdate(this.timer);
        }
    }

    endGame(winnerId) {
        this.setState('OVER');
        // Note: UI updates will be handled by UIManager
    }

    pause() {
        if (this.state === 'FIGHT') {
            this.setState('PAUSED');
        }
    }

    resume() {
        if (this.state === 'PAUSED') {
            this.setState('FIGHT');
        }
    }

    startCountdown(callback) {
        this.setState('COUNTDOWN');

        const overlay = document.getElementById('center-overlay');
        let count = 3;

        const tick = () => {
            if (count > 0) {
                overlay.innerHTML = `<div class="big-text">${count}</div>`;
                count--;
                setTimeout(tick, 1000);
            } else {
                overlay.innerHTML = `<div class="big-text" style="color:#ff0044">FIGHT!</div>`;
                setTimeout(() => {
                    overlay.innerHTML = '';
                    this.setState('FIGHT');
                    if (callback) callback();
                }, 1000);
            }
        };
        tick();
    }

    resetForNewFight() {
        this.resetTimer();
        this.setState('SETUP');
    }

    getState() {
        return this.state;
    }

    getTimer() {
        return this.timer;
    }

    destroy() {
        this.stopTimer();
    }
}

