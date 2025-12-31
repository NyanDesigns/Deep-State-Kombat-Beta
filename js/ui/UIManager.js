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
        this.endScreenButtonIndex = 0;
        this.endScreenKeyboardHandler = null;
        this.endScreenButtons = [];
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
        // Hide center overlay
        const overlay = document.getElementById('center-overlay');
        if (overlay) {
            overlay.innerHTML = '';
        }
        
        // Check if this is a draw
        const isDraw = winnerId === null || winnerId === undefined;
        
        // Get character information
        let winnerConfig = null;
        let loserConfig = null;
        let p1Config = null;
        let p2Config = null;
        let winnerName = winnerId === 'p1' ? 'PLAYER 1' : 'CPU';
        let loserName = winnerId === 'p1' ? 'CPU' : 'PLAYER 1';
        let p1Name = 'PLAYER 1';
        let p2Name = 'CPU';
        
        if (winnerFighter && winnerFighter.characterConfig) {
            winnerConfig = winnerFighter.characterConfig;
            winnerName = winnerConfig.name || winnerName;
        }
        
        if (loserFighter && loserFighter.characterConfig) {
            loserConfig = loserFighter.characterConfig;
            loserName = loserConfig.name || loserName;
        }
        
        // For draw case, get both fighters from the parameters
        // When it's a draw, loserFighter is p1 and winnerFighter is p2 (both are actually losers)
        if (isDraw) {
            if (loserFighter && loserFighter.characterConfig) {
                p1Config = loserFighter.characterConfig;
                p1Name = p1Config.name || 'PLAYER 1';
            }
            if (winnerFighter && winnerFighter.characterConfig) {
                p2Config = winnerFighter.characterConfig;
                p2Name = p2Config.name || 'CPU';
            }
        }
        
        // Build image paths - only V (victory) for winner, D (defeat) for loser
        const getCharacterImagePath = (characterId, suffix) => {
            if (!characterId) return '';
            const folderName = `${characterId.charAt(0).toUpperCase()}${characterId.slice(1)}`;
            const baseId = characterId.toLowerCase();
            return `assets/characters/${folderName}/visuals/${baseId}${suffix}.png`;
        };
        
        const winnerId_str = winnerConfig?.id || '';
        const loserId_str = loserConfig?.id || '';
        const p1Id_str = p1Config?.id || '';
        const p2Id_str = p2Config?.id || '';
        
        const winnerVPath = winnerId_str ? getCharacterImagePath(winnerId_str, 'V') : '';
        const loserDPath = loserId_str ? getCharacterImagePath(loserId_str, 'D') : '';
        const p1DPath = p1Id_str ? getCharacterImagePath(p1Id_str, 'D') : '';
        const p2DPath = p2Id_str ? getCharacterImagePath(p2Id_str, 'D') : '';
        
        // Get end screen elements
        const endScreen = document.getElementById('end-screen');
        const winnerImg = document.getElementById('winner-background-png-image');
        const loserImg = document.getElementById('loser-background-png-image');
        const winnerNameDisplay = document.querySelector('.character-name-winner');
        const loserNameDisplay = document.querySelector('.character-name-loser');
        const winnerText = document.getElementById('winner-text');
        const loserText = document.getElementById('loser-text');
        const drawText = document.getElementById('draw-text');
        
        // Show end screen
        if (endScreen) {
            endScreen.classList.add('show');
        }
        
        if (isDraw) {
            // Draw case: both are losers, show D PNGs
            // Hide winner/loser text, show DRAW text
            if (winnerText) winnerText.classList.remove('visible');
            if (loserText) loserText.classList.remove('visible');
            if (drawText) drawText.classList.add('visible');
            
            // Show both as losers with D PNGs
            if (winnerImg && p1DPath) {
                winnerImg.src = p1DPath;
                winnerImg.style.display = 'block';
                winnerImg.classList.add('slide-in', 'selected', 'draw-loser');
                winnerImg.onload = () => {
                    winnerImg.style.opacity = '1';
                    winnerImg.style.visibility = 'visible';
                };
                winnerImg.onerror = () => {
                    winnerImg.style.display = 'none';
                };
            }
            
            if (loserImg && p2DPath) {
                loserImg.src = p2DPath;
                loserImg.style.display = 'block';
                loserImg.classList.add('slide-in', 'selected');
                loserImg.onload = () => {
                    loserImg.style.opacity = '1';
                    loserImg.style.visibility = 'visible';
                };
                loserImg.onerror = () => {
                    loserImg.style.display = 'none';
                };
            }
            
            // Update name displays - both use loser styling
            if (winnerNameDisplay) {
                winnerNameDisplay.textContent = p1Name;
                winnerNameDisplay.classList.add('loaded', 'pop-visible');
            }
            
            if (loserNameDisplay) {
                loserNameDisplay.textContent = p2Name;
                loserNameDisplay.classList.add('loaded', 'pop-visible');
            }
        } else {
            // Normal win case: winner and loser
            // Hide DRAW text, show winner/loser text
            if (drawText) drawText.classList.remove('visible');
            if (winnerText) winnerText.classList.add('visible');
            if (loserText) loserText.classList.add('visible');
            
            // Load and show winner V PNG
            if (winnerImg && winnerVPath) {
                winnerImg.src = winnerVPath;
                winnerImg.style.display = 'block';
                winnerImg.classList.remove('draw-loser'); // Remove draw-loser class for normal win
                winnerImg.classList.add('slide-in', 'selected');
                winnerImg.onload = () => {
                    winnerImg.style.opacity = '1';
                    winnerImg.style.visibility = 'visible';
                };
                winnerImg.onerror = () => {
                    winnerImg.style.display = 'none';
                };
            }
            
            // Load and show loser D PNG
            if (loserImg && loserDPath) {
                loserImg.src = loserDPath;
                loserImg.style.display = 'block';
                loserImg.classList.add('slide-in', 'selected');
                loserImg.onload = () => {
                    loserImg.style.opacity = '1';
                    loserImg.style.visibility = 'visible';
                };
                loserImg.onerror = () => {
                    loserImg.style.display = 'none';
                };
            }
            
            // Update name displays
            if (winnerNameDisplay) {
                winnerNameDisplay.textContent = winnerName;
                winnerNameDisplay.classList.add('loaded', 'pop-visible');
            }
            
            if (loserNameDisplay) {
                loserNameDisplay.textContent = loserName;
                loserNameDisplay.classList.add('loaded', 'pop-visible');
            }
        }

        // Setup button event listeners and keyboard navigation
        let restartBtn = document.getElementById('btn-restart-end');
        let backBtn = document.getElementById('btn-back-selection-end');

        // Initialize keyboard navigation state
        this.endScreenButtonIndex = 0;

        // Remove old keyboard listener if it exists
        if (this.endScreenKeyboardHandler) {
            window.removeEventListener('keydown', this.endScreenKeyboardHandler);
        }

        // Setup button click handlers first and get the actual button elements
        if (restartBtn) {
            // Remove old listener by cloning the button
            const newRestartBtn = restartBtn.cloneNode(true);
            restartBtn.parentNode.replaceChild(newRestartBtn, restartBtn);
            restartBtn = newRestartBtn;
            newRestartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onRestartFight) this.onRestartFight();
            });
        }

        if (backBtn) {
            // Remove old listener by cloning the button
            const newBackBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBackBtn, backBtn);
            backBtn = newBackBtn;
            newBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onMainMenu) this.onMainMenu();
            });
        }

        // Create buttons array with actual button elements (after cloning)
        const buttons = [restartBtn, backBtn].filter(btn => btn !== null);

        // Store buttons reference for keyboard handler
        this.endScreenButtons = buttons;

        // Setup keyboard navigation
        this.endScreenKeyboardHandler = (e) => {
            if (!endScreen || !endScreen.classList.contains('show')) {
                return; // End screen not visible, ignore
            }

            const key = e.key.toLowerCase();
            if (key === 'arrowup') {
                e.preventDefault();
                this.endScreenButtonIndex = (this.endScreenButtonIndex - 1 + this.endScreenButtons.length) % this.endScreenButtons.length;
                this.updateEndScreenButtonFocus(this.endScreenButtons);
            } else if (key === 'arrowdown') {
                e.preventDefault();
                this.endScreenButtonIndex = (this.endScreenButtonIndex + 1) % this.endScreenButtons.length;
                this.updateEndScreenButtonFocus(this.endScreenButtons);
            } else if (key === 'enter') {
                e.preventDefault();
                if (this.endScreenButtons[this.endScreenButtonIndex]) {
                    this.endScreenButtons[this.endScreenButtonIndex].click();
                }
            }
        };

        window.addEventListener('keydown', this.endScreenKeyboardHandler);

        // Set initial focus on first button
        this.updateEndScreenButtonFocus(buttons);
    }

    updateEndScreenButtonFocus(buttons) {
        buttons.forEach((btn, index) => {
            if (index === this.endScreenButtonIndex) {
                btn.classList.add('focused');
            } else {
                btn.classList.remove('focused');
            }
        });
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



