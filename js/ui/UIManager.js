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

    showVictory(winnerId, winnerFighter = null, loserFighter = null) {
        const overlay = document.getElementById('center-overlay');
        
        // Get character information
        let winnerConfig = null;
        let loserConfig = null;
        let winnerName = winnerId === 'p1' ? 'PLAYER 1' : 'CPU';
        let loserName = winnerId === 'p1' ? 'CPU' : 'PLAYER 1';
        let winnerPlayerSlot = winnerId;
        let loserPlayerSlot = winnerId === 'p1' ? 'p2' : 'p1';
        
        if (winnerFighter && winnerFighter.characterConfig) {
            winnerConfig = winnerFighter.characterConfig;
            winnerName = winnerConfig.name || winnerName;
            winnerPlayerSlot = winnerFighter.id || winnerId;
        }
        
        if (loserFighter && loserFighter.characterConfig) {
            loserConfig = loserFighter.characterConfig;
            loserName = loserConfig.name || loserName;
            loserPlayerSlot = loserFighter.id || (winnerId === 'p1' ? 'p2' : 'p1');
        }
        
        // Build image paths
        const getCharacterImagePath = (characterId, suffix, playerSlot = null) => {
            if (!characterId) return '';
            const folderName = `${characterId.charAt(0).toUpperCase()}${characterId.slice(1)}`;
            const baseId = characterId.toLowerCase();
            
            // For portraits, use player-specific image
            if (suffix === 'P' && playerSlot) {
                return `assets/characters/${folderName}/visuals/${baseId}${playerSlot === 'p1' ? 'P1' : 'P2'}.png`;
            }
            
            return `assets/characters/${folderName}/visuals/${baseId}${suffix}.png`;
        };
        
        const winnerId_str = winnerConfig?.id || '';
        const loserId_str = loserConfig?.id || '';
        
        const winnerVPath = winnerId_str ? getCharacterImagePath(winnerId_str, 'V', null) : '';
        const winnerPPath = winnerId_str ? getCharacterImagePath(winnerId_str, 'P', winnerPlayerSlot) : '';
        const loserDPath = loserId_str ? getCharacterImagePath(loserId_str, 'D', null) : '';
        const loserPPath = loserId_str ? getCharacterImagePath(loserId_str, 'P', loserPlayerSlot) : '';
        
        overlay.innerHTML = `
            <div class="victory-screen">
                <div class="victory-title">${winnerId === 'p1' ? 'PLAYER 1 WINS' : (winnerId === 'p2' ? 'CPU WINS' : 'DRAW')}</div>
                <div class="victory-content">
                    <div class="victory-character winner">
                        <div class="character-label">WINNER</div>
                        <div class="character-name">${winnerName}</div>
                        <div class="character-images">
                            ${winnerVPath ? `<img src="${winnerVPath}" alt="Victory" class="character-victory-img" onerror="this.style.display='none'">` : ''}
                            ${winnerPPath ? `<img src="${winnerPPath}" alt="Portrait" class="character-portrait-img" onerror="this.style.display='none'">` : ''}
                        </div>
                    </div>
                    <div class="victory-character loser">
                        <div class="character-label">DEFEATED</div>
                        <div class="character-name">${loserName}</div>
                        <div class="character-images">
                            ${loserDPath ? `<img src="${loserDPath}" alt="Defeat" class="character-defeat-img" onerror="this.style.display='none'">` : ''}
                            ${loserPPath ? `<img src="${loserPPath}" alt="Portrait" class="character-portrait-img" onerror="this.style.display='none'">` : ''}
                        </div>
                    </div>
                </div>
                <div class="victory-buttons">
                    <button id="btn-restart" class="clickable victory-btn restart-btn">
                        Restart Fight
                    </button>
                    <button id="btn-back-selection" class="clickable victory-btn back-btn">
                        Back to Selection
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        const restartBtn = document.getElementById('btn-restart');
        const backBtn = document.getElementById('btn-back-selection');

        if (restartBtn) {
            restartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onRestartFight) this.onRestartFight();
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
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



