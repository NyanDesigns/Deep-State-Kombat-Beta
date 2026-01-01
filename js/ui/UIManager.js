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
        if (overlay) overlay.innerHTML = '';
        
        const isDraw = winnerId === null || winnerId === undefined;
        
        // Get p1 and p2 fighters directly
        const p1Fighter = winnerFighter?.id === 'p1' ? winnerFighter : loserFighter?.id === 'p1' ? loserFighter : null;
        const p2Fighter = winnerFighter?.id === 'p2' ? winnerFighter : loserFighter?.id === 'p2' ? loserFighter : null;
        
        if (!p1Fighter || !p2Fighter) {
            console.error('Missing fighter data for end screen');
            return;
        }
        
        const p1Config = p1Fighter.characterConfig;
        const p2Config = p2Fighter.characterConfig;
        
        // Simple path builder
        const getImagePath = (characterId, suffix) => {
            if (!characterId) return '';
            const folderName = characterId.charAt(0).toUpperCase() + characterId.slice(1).toLowerCase();
            return `assets/characters/${folderName}/visuals/${characterId.toLowerCase()}${suffix}.png`;
        };
        
        // Determine what goes on left (winner side) and right (loser side)
        let leftCharacter, rightCharacter, leftSuffix, rightSuffix;
        
        if (isDraw) {
            // Draw: both are losers, p1 left, p2 right
            leftCharacter = p1Config;
            rightCharacter = p2Config;
            leftSuffix = 'D';
            rightSuffix = 'D';
        } else {
            // Winner always left, loser always right
            if (winnerId === 'p1') {
                leftCharacter = p1Config;
                rightCharacter = p2Config;
                leftSuffix = 'V';
                rightSuffix = 'D';
            } else {
                leftCharacter = p2Config;
                rightCharacter = p1Config;
                leftSuffix = 'V';
                rightSuffix = 'D';
            }
        }
        
        // Build paths and names
        const leftPNGPath = leftCharacter?.id ? getImagePath(leftCharacter.id, leftSuffix) : '';
        const rightPNGPath = rightCharacter?.id ? getImagePath(rightCharacter.id, rightSuffix) : '';
        const leftName = leftCharacter?.name || 'PLAYER 1';
        const rightName = rightCharacter?.name || 'CPU';
        
        // Get end screen elements
        const endScreen = document.getElementById('end-screen');
        const winnerImg = document.getElementById('winner-background-png-image');
        const loserImg = document.getElementById('loser-background-png-image');
        const winnerNameDisplay = document.querySelector('.character-name-winner');
        const loserNameDisplay = document.querySelector('.character-name-loser');
        const winnerText = document.getElementById('winner-text');
        const loserText = document.getElementById('loser-text');
        const drawText = document.getElementById('draw-text');
        const player1Label = document.getElementById('player1-label');
        const player2Label = document.getElementById('player2-label');
        
        // Show end screen
        if (endScreen) endScreen.classList.add('show');
        
        if (isDraw) {
            // Draw case: hide winner/loser text, show DRAW text
            if (winnerText) {
                winnerText.classList.remove('visible');
                winnerText.style.left = '';
                winnerText.style.right = '';
                winnerText.className = 'winner-text';
            }
            if (loserText) {
                loserText.classList.remove('visible');
                loserText.style.left = '';
                loserText.style.right = '';
                loserText.className = 'loser-text';
            }
            if (drawText) drawText.classList.add('visible');
            
            // Hide player labels in draw case
            if (player1Label) player1Label.classList.remove('visible');
            if (player2Label) player2Label.classList.remove('visible');
            
            // Both images get loser styling
            this.loadCharacterImage(winnerImg, leftPNGPath, 'p1-png', true);
            this.loadCharacterImage(loserImg, rightPNGPath, 'p2-png', false);
            
            // Show player labels
            if (player1Label) {
                player1Label.textContent = 'PLAYER 1';
                player1Label.classList.add('visible');
            }
            if (player2Label) {
                player2Label.textContent = 'PLAYER 2';
                player2Label.classList.add('visible');
            }
        } else {
            // Win case: show winner/loser text
            if (drawText) drawText.classList.remove('visible');
            
            // Position text based on who won
            if (winnerId === 'p1') {
                if (winnerText) {
                    winnerText.textContent = 'Winner';
                    winnerText.className = 'winner-text visible';
                }
                if (loserText) {
                    loserText.textContent = 'Loser';
                    loserText.className = 'loser-text visible';
                }
            } else {
                if (winnerText) {
                    winnerText.textContent = 'Loser';
                    winnerText.className = 'loser-text loser-left visible';
                }
                if (loserText) {
                    loserText.textContent = 'Winner';
                    loserText.className = 'winner-text winner-right visible';
                }
            }
            
            // Load images - swap when p2 wins to match text positioning
            if (winnerId === 'p1') {
                // P1 wins: winner left (golden), loser right (grayscale)
                this.loadCharacterImage(winnerImg, leftPNGPath, 'p1-png', false);
                this.loadCharacterImage(loserImg, rightPNGPath, 'p2-png', false);
            } else {
                // P2 wins: loser left (grayscale), winner right (golden)
                this.loadCharacterImage(winnerImg, rightPNGPath, 'p1-png', true);
                this.loadCharacterImage(loserImg, leftPNGPath, 'p2-png', false, true);
            }
            
            // Show player labels
            if (player1Label) {
                player1Label.textContent = 'PLAYER 1';
                player1Label.classList.add('visible');
            }
            if (player2Label) {
                player2Label.textContent = 'PLAYER 2';
                player2Label.classList.add('visible');
            }
        }
        
        // Update name displays - swap when p2 wins to match image/text positioning
        if (isDraw || winnerId === 'p1') {
            // Draw or p1 wins: left shows leftName, right shows rightName
            if (winnerNameDisplay) {
                winnerNameDisplay.textContent = leftName;
                winnerNameDisplay.classList.add('loaded', 'pop-visible');
            }
            if (loserNameDisplay) {
                loserNameDisplay.textContent = rightName;
                loserNameDisplay.classList.add('loaded', 'pop-visible');
            }
        } else {
            // P2 wins: left shows rightName (loser), right shows leftName (winner)
            if (winnerNameDisplay) {
                winnerNameDisplay.textContent = rightName;
                winnerNameDisplay.classList.add('loaded', 'pop-visible');
            }
            if (loserNameDisplay) {
                loserNameDisplay.textContent = leftName;
                loserNameDisplay.classList.add('loaded', 'pop-visible');
            }
        }

        // Setup buttons
        this.setupEndScreenButtons();
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

    loadCharacterImage(imgElement, imagePath, baseClass, isDrawLoser, isWinnerOnRight = false) {
        if (!imgElement || !imagePath) return;
        
        // Reset state
        imgElement.style.display = 'none';
        imgElement.style.opacity = '0';
        imgElement.style.visibility = 'hidden';
        
        // Set base classes
        imgElement.className = `background-png ${baseClass}`;
        
        // Add state classes
        const classes = ['slide-in', 'selected'];
        if (isDrawLoser && baseClass === 'p1-png') {
            classes.push('draw-loser');
        }
        if (isWinnerOnRight && baseClass === 'p2-png') {
            classes.push('winner-state');
        }
        
        // Load image
        imgElement.src = imagePath + '?t=' + Date.now();
        imgElement.style.display = 'block';
        imgElement.classList.add(...classes);
        
        imgElement.onload = () => {
            imgElement.style.opacity = '1';
            imgElement.style.visibility = 'visible';
        };
        
        imgElement.onerror = () => {
            console.error('Failed to load character image:', imagePath);
            imgElement.style.display = 'none';
        };
    }

    setupEndScreenButtons() {
        const endScreen = document.getElementById('end-screen');
        let restartBtn = document.getElementById('btn-restart-end');
        let backBtn = document.getElementById('btn-back-selection-end');
        
        this.endScreenButtonIndex = 0;
        
        if (this.endScreenKeyboardHandler) {
            window.removeEventListener('keydown', this.endScreenKeyboardHandler);
        }
        
        if (restartBtn) {
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
            const newBackBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBackBtn, backBtn);
            backBtn = newBackBtn;
            newBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onMainMenu) this.onMainMenu();
            });
        }
        
        const buttons = [restartBtn, backBtn].filter(btn => btn !== null);
        this.endScreenButtons = buttons;
        
        this.endScreenKeyboardHandler = (e) => {
            if (!endScreen || !endScreen.classList.contains('show')) {
                return;
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
        this.updateEndScreenButtonFocus(buttons);
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



