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
        
        // Identify which fighter is p1 and which is p2 (Player 1 always left, Player 2 always right)
        let p1Fighter = null;
        let p2Fighter = null;
        
        // Determine p1 and p2 from fighter id
        if (winnerFighter && winnerFighter.id === 'p1') {
            p1Fighter = winnerFighter;
        } else if (loserFighter && loserFighter.id === 'p1') {
            p1Fighter = loserFighter;
        }
        
        if (winnerFighter && winnerFighter.id === 'p2') {
            p2Fighter = winnerFighter;
        } else if (loserFighter && loserFighter.id === 'p2') {
            p2Fighter = loserFighter;
        }
        
        // Get character configurations and names
        let p1Config = p1Fighter?.characterConfig || null;
        let p2Config = p2Fighter?.characterConfig || null;
        
        let p1Name = p1Config?.name || 'PLAYER 1';
        let p2Name = p2Config?.name || 'CPU';
        
        // Determine if p1 won, p2 won, or draw
        const p1Won = winnerId === 'p1';
        const p2Won = winnerId === 'p2';
        
        // Build image paths - only V (victory) for winner, D (defeat) for loser
        const getCharacterImagePath = (characterId, suffix) => {
            if (!characterId) return '';
            const folderName = `${characterId.charAt(0).toUpperCase()}${characterId.slice(1)}`;
            const baseId = characterId.toLowerCase();
            return `assets/characters/${folderName}/visuals/${baseId}${suffix}.png`;
        };
        
        const p1Id_str = p1Config?.id || '';
        const p2Id_str = p2Config?.id || '';
        
        // Determine PNG paths - winner always on left, loser always on right
        let winnerPNGPath = '';
        let loserPNGPath = '';
        
        if (isDraw) {
            // Draw: both are losers, p1 on left, p2 on right
            winnerPNGPath = p1Id_str ? getCharacterImagePath(p1Id_str, 'D') : '';
            loserPNGPath = p2Id_str ? getCharacterImagePath(p2Id_str, 'D') : '';
        } else {
            // Winner PNG always goes on left (winnerImg), loser PNG always goes on right (loserImg)
            if (p1Won) {
                winnerPNGPath = p1Id_str ? getCharacterImagePath(p1Id_str, 'V') : '';
                loserPNGPath = p2Id_str ? getCharacterImagePath(p2Id_str, 'D') : '';
            } else if (p2Won) {
                winnerPNGPath = p2Id_str ? getCharacterImagePath(p2Id_str, 'V') : '';
                loserPNGPath = p1Id_str ? getCharacterImagePath(p1Id_str, 'D') : '';
            }
        }
        
        // Get end screen elements
        const endScreen = document.getElementById('end-screen');
        const winnerImg = document.getElementById('winner-background-png-image'); // Left side (always p1)
        const loserImg = document.getElementById('loser-background-png-image'); // Right side (always p2)
        const winnerNameDisplay = document.querySelector('.character-name-winner'); // Left side (always p1)
        const loserNameDisplay = document.querySelector('.character-name-loser'); // Right side (always p2)
        const winnerText = document.getElementById('winner-text'); // Left side text
        const loserText = document.getElementById('loser-text'); // Right side text
        const drawText = document.getElementById('draw-text');
        const player1Label = document.getElementById('player1-label'); // Player 1 label (left, under winner text)
        const player2Label = document.getElementById('player2-label'); // Player 2 label (right, under loser text)
        
        // Show end screen
        if (endScreen) {
            endScreen.classList.add('show');
        }
        
        if (isDraw) {
            // Draw case: both are losers, show D PNGs
            // Hide winner/loser text, show DRAW text
            if (winnerText) {
                winnerText.classList.remove('visible');
                winnerText.style.left = '';
                winnerText.style.right = '';
                winnerText.className = 'winner-text'; // Reset to default class
            }
            if (loserText) {
                loserText.classList.remove('visible');
                loserText.style.left = '';
                loserText.style.right = '';
                loserText.className = 'loser-text'; // Reset to default class
            }
            if (drawText) drawText.classList.add('visible');
            
            // Hide player labels in draw case (since winner/loser text is hidden)
            if (player1Label) {
                player1Label.classList.remove('visible');
            }
            if (player2Label) {
                player2Label.classList.remove('visible');
            }
            
            // Draw case: both are losers, p1 on left (winnerImg), p2 on right (loserImg)
            if (winnerImg && winnerPNGPath) {
                winnerImg.src = winnerPNGPath;
                winnerImg.style.display = 'block';
                // Clear any previous state classes
                winnerImg.classList.remove('draw-loser', 'winner-state');
                winnerImg.classList.add('slide-in', 'selected', 'draw-loser'); // Grayscale styling for draw
                winnerImg.onload = () => {
                    winnerImg.style.opacity = '1';
                    winnerImg.style.visibility = 'visible';
                };
                winnerImg.onerror = () => {
                    winnerImg.style.display = 'none';
                };
            }
            
            if (loserImg && loserPNGPath) {
                loserImg.src = loserPNGPath;
                loserImg.style.display = 'block';
                // Clear any previous state classes
                loserImg.classList.remove('draw-loser', 'winner-state');
                loserImg.classList.add('slide-in', 'selected'); // Default grayscale styling
                loserImg.onload = () => {
                    loserImg.style.opacity = '1';
                    loserImg.style.visibility = 'visible';
                };
                loserImg.onerror = () => {
                    loserImg.style.display = 'none';
                };
            }
            
            // Show player labels under the text (for draw, both are losers so labels show but no winner/loser text)
            if (player1Label) {
                player1Label.textContent = 'PLAYER 1';
                player1Label.classList.add('visible');
            }
            if (player2Label) {
                player2Label.textContent = 'PLAYER 2';
                player2Label.classList.add('visible');
            }
            
            // Update name displays - just character name (no player label)
            if (winnerNameDisplay) {
                winnerNameDisplay.textContent = p1Name;
                winnerNameDisplay.classList.add('loaded', 'pop-visible');
            }
            
            if (loserNameDisplay) {
                loserNameDisplay.textContent = p2Name;
                loserNameDisplay.classList.add('loaded', 'pop-visible');
            }
        } else {
            // Normal win case: show winner/loser text and appropriate PNGs
            // Hide DRAW text
            if (drawText) drawText.classList.remove('visible');
            
            // Show winner/loser text
            // When p1 wins: "Winner" (golden, big) on left, "Loser" (gray, small) on right
            // When p2 wins: "Loser" (gray, small) on left, "Winner" (golden, big) on right
            if (p1Won) {
                // Normal case: winner on left, loser on right
                if (winnerText) {
                    winnerText.textContent = 'Winner';
                    winnerText.className = 'winner-text visible'; // Default positioning (left)
                }
                if (loserText) {
                    loserText.textContent = 'Loser';
                    loserText.className = 'loser-text visible'; // Default positioning (right)
                }
            } else if (p2Won) {
                // Swapped case: loser on left (winnerText element), winner on right (loserText element)
                if (winnerText) {
                    winnerText.textContent = 'Loser';
                    winnerText.className = 'loser-text loser-left visible'; // Gray, small styling, positioned on left
                }
                if (loserText) {
                    loserText.textContent = 'Winner';
                    loserText.className = 'winner-text winner-right visible'; // Golden, big styling, positioned on right
                }
            }
            
            // Winner always on left (winnerImg), Loser always on right (loserImg)
            if (winnerImg && winnerPNGPath) {
                winnerImg.src = winnerPNGPath;
                winnerImg.style.display = 'block';
                // Clear any previous state classes
                winnerImg.classList.remove('draw-loser', 'winner-state');
                winnerImg.classList.add('slide-in', 'selected');
                // Winner always gets winner styling (golden glow, no grayscale) - default .p1-png.selected
                winnerImg.onload = () => {
                    winnerImg.style.opacity = '1';
                    winnerImg.style.visibility = 'visible';
                };
                winnerImg.onerror = () => {
                    winnerImg.style.display = 'none';
                };
            }
            
            if (loserImg && loserPNGPath) {
                loserImg.src = loserPNGPath;
                loserImg.style.display = 'block';
                // Clear any previous state classes
                loserImg.classList.remove('draw-loser', 'winner-state');
                loserImg.classList.add('slide-in', 'selected');
                // Loser always gets loser styling (grayscale) - default .p2-png.selected
                loserImg.onload = () => {
                    loserImg.style.opacity = '1';
                    loserImg.style.visibility = 'visible';
                };
                loserImg.onerror = () => {
                    loserImg.style.display = 'none';
                };
            }
            
            // Show player labels under the winner/loser text
            if (player1Label) {
                player1Label.textContent = 'PLAYER 1';
                player1Label.classList.add('visible');
            }
            if (player2Label) {
                player2Label.textContent = 'PLAYER 2';
                player2Label.classList.add('visible');
            }
            
            // Update name displays - just character name (no player label)
            if (winnerNameDisplay) {
                winnerNameDisplay.textContent = p1Name;
                winnerNameDisplay.classList.add('loaded', 'pop-visible');
            }
            
            if (loserNameDisplay) {
                loserNameDisplay.textContent = p2Name;
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



