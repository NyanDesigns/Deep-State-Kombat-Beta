import { HUD } from './HUD.js';
import { PauseMenu } from './PauseMenu.js';
import { DebugPanel } from './DebugPanel.js';

export class UIManager {
    constructor() {
        this.hud = new HUD();
        this.pauseMenu = new PauseMenu();
        this.debugPanel = new DebugPanel();
        this.onPauseToggle = null;
        this.onRestartFight = null;
        this.onMainMenu = null;
    }

    init() {
        this.pauseMenu.init(this.handlePauseToggle.bind(this), this.handleRestartFight.bind(this), this.handleMainMenu.bind(this));
        this.debugPanel.init();
    }

    updateHUD(fighters, timer) {
        this.hud.update(fighters, timer);
    }

    showHUD() {
        this.hud.show();
    }

    hideHUD() {
        this.hud.hide();
    }

    showPauseMenu() {
        this.pauseMenu.show();
    }

    hidePauseMenu() {
        this.pauseMenu.hide();
    }

    updateDebugPanel(fighters, gameState, timer) {
        this.debugPanel.update(fighters, gameState, timer);
    }

    showDebugPanel() {
        this.debugPanel.show();
    }

    hideDebugPanel() {
        this.debugPanel.hide();
    }

    showCountdown(count) {
        const overlay = document.getElementById('center-overlay');
        if (count > 0) {
            overlay.innerHTML = `<div class="big-text">${count}</div>`;
        } else {
            overlay.innerHTML = `<div class="big-text" style="color:#ff0044">FIGHT!</div>`;
        }
    }

    hideCountdown() {
        document.getElementById('center-overlay').innerHTML = '';
    }

    showVictory(winnerId) {
        const overlay = document.getElementById('center-overlay');
        const txt = winnerId === 'p1' ? 'PLAYER 1 WINS' :
                   (winnerId === 'p2' ? 'CPU WINS' : 'DRAW');
        overlay.innerHTML = `
            <div class="big-text" style="font-size:6em; color:#ffcc00">${txt}</div>
            <div style="margin-top: 40px; display: flex; gap: 20px; justify-content: center; pointer-events: auto;">
                <button id="btn-restart" class="clickable" style="
                    background: #ffcc00; color: #000; border: none; padding: 15px 30px;
                    font-size: 1.2em; font-weight: 900; cursor: pointer;
                    text-transform: uppercase; clip-path: polygon(0 0, 100% 0, 95% 100%, 5% 100%);
                    z-index: 200; position: relative;
                ">Restart Fight</button>
                <button id="btn-new-models" class="clickable" style="
                    background: #00ccff; color: #000; border: none; padding: 15px 30px;
                    font-size: 1.2em; font-weight: 900; cursor: pointer;
                    text-transform: uppercase; clip-path: polygon(0 0, 100% 0, 95% 100%, 5% 100%);
                    z-index: 200; position: relative;
                ">Load New Models</button>
            </div>
        `;

        // Add event listeners
        const restartBtn = document.getElementById('btn-restart');
        const newModelsBtn = document.getElementById('btn-new-models');

        if (restartBtn) {
            restartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onRestartFight) this.onRestartFight();
            });
        }

        if (newModelsBtn) {
            newModelsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onMainMenu) this.onMainMenu();
            });
        }
    }

    handlePauseToggle() {
        if (this.onPauseToggle) {
            this.onPauseToggle();
        }
    }

    handleRestartFight() {
        if (this.onRestartFight) {
            this.onRestartFight();
        }
    }

    handleMainMenu() {
        if (this.onMainMenu) {
            this.onMainMenu();
        }
    }
}


