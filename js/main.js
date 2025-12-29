// Main application entry point
import * as THREE from 'three';
import { CONFIG } from './config.js';

// Core systems
import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { RenderSystem } from './core/RenderSystem.js';
import { ArenaBuilder } from './core/ArenaBuilder.js';

// Game systems
import { GameState } from './game/GameState.js';
import { Fighter } from './game/Fighter.js';
import { CombatSystem } from './game/CombatSystem.js';
import { CollisionSystem } from './game/CollisionSystem.js';

// UI systems
import { UIManager } from './ui/UIManager.js';
import { SetupScreen } from './ui/SetupScreen.js';
import { PreviewScene } from './ui/PreviewScene.js';
import { CharacterSelector } from './ui/CharacterSelector.js';
import { LoadingManager } from './ui/LoadingManager.js';

// Character systems
import { CharacterManager } from './characters/CharacterManager.js';

// System utilities
import { InputHandler } from './systems/InputHandler.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { StorageManager } from './systems/StorageManager.js';
import { FireParticleSystem } from './systems/FireParticleSystem.js';

let fighters = [];

// Initialize all systems
const sceneManager = new SceneManager();
const cameraController = new CameraController(sceneManager);
const renderSystem = new RenderSystem(sceneManager);
const arenaBuilder = new ArenaBuilder(sceneManager);

const gameState = new GameState();
const combatSystem = new CombatSystem();
const collisionSystem = new CollisionSystem();

const uiManager = new UIManager();
const setupScreen = new SetupScreen();
const previewScene = new PreviewScene(sceneManager);

const storageManager = new StorageManager();
const characterManager = new CharacterManager();
const characterSelector = new CharacterSelector(characterManager, previewScene, storageManager);

const inputHandler = new InputHandler();
const effectsSystem = new EffectsSystem();
const loadingManager = new LoadingManager();

// Fire particle system - initialized early for loading sequence
let fireParticleSystem = null;

function setupCallbacks() {
    gameState.onStateChange = (newState, oldState) => {
        handleStateChange(newState);
    };

    gameState.onTimerUpdate = (timer) => {
        uiManager.updateHUD(fighters, timer);
    };

    gameState.onTimerEnd = () => {
        endGame(null);
    };

    combatSystem.onShake = (shake) => {
        cameraController.addShake(shake);
    };

    combatSystem.onHitStop = () => {
        // Rendering loop uses hitStop; no-op here
    };

    combatSystem.onDamage = (damage, position, isCritical) => {
        effectsSystem.spawnDamage(damage, position, isCritical);
    };

    uiManager.onPauseToggle = () => {
        if (gameState.getState() === 'FIGHT') {
            gameState.pause();
        } else if (gameState.getState() === 'PAUSED') {
            gameState.resume();
        }
    };

    uiManager.onRestartFight = () => {
        restartFight();
    };

    uiManager.onMainMenu = () => {
        loadNewModels();
    };

    // Wire debug option changes to debug panel + persistence
    uiManager.pauseMenu.onDebugOptionChange = (options) => {
        uiManager.debugPanel.setOptions(options);
        storageManager.saveGameSettings({ debug: options });
    };

    // Character selector callbacks (for logging/extension)
    characterSelector.onCharacterSelected = (playerSlot, character) => {
        console.log(`Character selected for ${playerSlot}:`, character.name);
    };

    characterSelector.onCustomFileSelected = (playerSlot, config) => {
        console.log(`Custom character loaded for ${playerSlot}:`, config.name);
    };

    setupScreen.onStartGame = () => {
        const selectedCharacters = characterSelector.getSelectedCharacters();
        if (selectedCharacters.p1 && selectedCharacters.p2) {
            startCountdown();
        }
    };

    inputHandler.setPauseCallback(() => {
        if (gameState.getState() === 'FIGHT') {
            gameState.pause();
        } else if (gameState.getState() === 'PAUSED') {
            gameState.resume();
        }
    });
}

function handleStateChange(newState) {
    switch (newState) {
        case 'SETUP':
            uiManager.hideHUD();
            uiManager.hidePauseMenu();
            setupScreen.show();
            break;
        case 'COUNTDOWN':
            setupScreen.hide();
            break;
        case 'FIGHT':
            uiManager.showHUD();
            uiManager.hidePauseMenu();
            break;
        case 'PAUSED':
            uiManager.showPauseMenu();
            break;
        case 'OVER':
            uiManager.hidePauseMenu();
            break;
    }
}

async function init() {
    sceneManager.init();
    renderSystem.init();
    arenaBuilder.buildArena();
    effectsSystem.setCamera(sceneManager.camera);

    await characterManager.initialize();

    // Initialize UI systems (but don't show everything yet)
    uiManager.init();
    setupScreen.init();
    previewScene.init();

    // Restore debug options if saved
    const savedSettings = storageManager.loadGameSettings();
    if (savedSettings?.debug) {
        uiManager.pauseMenu.setDebugOptions(savedSettings.debug);
        uiManager.debugPanel.setOptions(savedSettings.debug);
    }

    setupCallbacks();

    // Show setup screen and set game state before starting loading sequence
    gameState.setState('SETUP');
    setupScreen.show();

    // Start loading sequence: particles → title → grid → characters
    startLoadingSequence();

    animate();
}

function startLoadingSequence() {
    // Phase 1: Start particle system immediately (before other UI)
    loadingManager.start({
        onParticlesReady: () => {
            // Initialize and start fire particle system
            fireParticleSystem = new FireParticleSystem('fire-particles-canvas-back', 'fire-particles-canvas-front');
            fireParticleSystem.start();
        },
        onTitleReady: () => {
            // Trigger title animation by adding class
            const title = document.querySelector('.game-title-logo');
            if (title) {
                title.classList.add('title-visible');
            }
        },
        onGridReady: () => {
            // Trigger pop-in animations for grid and name displays
            const gridContainer = document.getElementById('character-grid-container');
            const nameDisplays = document.querySelectorAll('.character-name-display');
            
            // Grid container pops in first
            if (gridContainer) {
                gridContainer.classList.add('pop-visible');
            }
            
            // Stagger the name displays slightly
            nameDisplays.forEach((display, index) => {
                setTimeout(() => {
                    display.classList.add('pop-visible');
                }, 200 + (index * 100)); // 200ms delay + 100ms between each
            });
        },
        onCharactersReady: () => {
            // Initialize character selector with sequential loading
            characterSelector.init(loadingManager, () => {
                // Loading complete - now show stat grid, then choose fighter text, then background PNGs
                const infoPanel = document.getElementById('character-info-panel');
                const chooseFighterText = document.getElementById('choose-fighter-text');
                
                if (infoPanel) {
                    setTimeout(() => {
                        infoPanel.classList.add('pop-visible');
                    }, 100); // Even faster delay after characters finish loading
                }
                
                // Choose fighter text slides in from top right before PNGs
                if (chooseFighterText) {
                    setTimeout(() => {
                        chooseFighterText.classList.add('slide-in');
                    }, 350); // Faster - appears after stat grid, before PNGs
                }
                
                // Background PNGs slide in last - P1 first, then P2
                const p1PNG = document.getElementById('p1-background-png-image');
                const p2PNG = document.getElementById('p2-background-png-image');
                
                if (p1PNG) {
                    setTimeout(() => {
                        p1PNG.style.display = 'block'; // Make visible
                        p1PNG.classList.add('slide-in');
                    }, 700); // Faster - after choose fighter text starts (350ms + 350ms)
                }
                
                if (p2PNG) {
                    setTimeout(() => {
                        p2PNG.style.display = 'block'; // Make visible
                        p2PNG.classList.add('slide-in');
                    }, 900); // Faster - 200ms delay after P1 starts
                }
                
                loadingManager.complete();
            });
        },
        onComplete: () => {
            // All loading complete - normal interaction enabled
            console.log('Loading sequence complete');
        }
    });
}

async function startCountdown() {
    document.getElementById('setup-screen').style.display = 'none';
    uiManager.showHUD();

    try {
        await spawnFighters();
    } catch (error) {
        console.error('Failed to spawn fighters:', error);
        loadNewModels();
        return;
    }
    gameState.resetTimer();
    gameState.startCountdown(() => {});
}

async function spawnFighters() {
    const selectedCharacters = characterSelector.getSelectedCharacters();
    const p1Config = selectedCharacters.p1;
    const p2Config = selectedCharacters.p2;
    if (!p1Config || !p2Config) return;

    const p1Data = await characterManager.loadCharacter(p1Config.id);
    const p2Data = await characterManager.loadCharacter(p2Config.id);

    fighters = [
        new Fighter('p1', new THREE.Vector3(-3, 0, 0), false, p1Data.model, sceneManager.scene, p1Data.config),
        new Fighter('p2', new THREE.Vector3(3, 0, 0), true, p2Data.model, sceneManager.scene, p2Data.config)
    ];

    fighters[0].loadAnimations(p1Data.model.animations || []);
    fighters[1].loadAnimations(p2Data.model.animations || []);
    fighters[0].updateUI();
    fighters[1].updateUI();
}

function restartFight() {
    if (fighters.length !== 2) return;

    fighters[0].mesh.position.set(-3, 0, 0);
    fighters[1].mesh.position.set(3, 0, 0);

    fighters.forEach(f => {
        f.hp = f.maxHp;
        f.st = f.maxSt;
        f.state = 'IDLE';
        f.play('idle', f.animationFade);
        f.updateUI();
    });

    document.getElementById('center-overlay').innerHTML = '';
    gameState.resetTimer();
    gameState.startCountdown(() => {});
}

function loadNewModels() {
    gameState.setState('SETUP');

    if (fighters.length === 2) {
        sceneManager.scene.remove(fighters[0].mesh);
        sceneManager.scene.remove(fighters[1].mesh);
    }
    fighters = [];

    characterSelector.clearSelection('p1');
    characterSelector.clearSelection('p2');

    document.getElementById('setup-screen').style.display = 'flex';
    uiManager.hideHUD();
    document.getElementById('center-overlay').innerHTML = '';

    gameState.resetTimer();
}

function endGame(winnerId) {
    if (gameState.getState() === 'OVER') return;

    gameState.setState('OVER');

    if (fighters.length === 2 && winnerId) {
        const winner = winnerId === 'p1' ? fighters[0] : fighters[1];
        const loser = winnerId === 'p1' ? fighters[1] : fighters[0];
        winner.state = 'WIN';
        winner.play('win', winner.animationFade);
        if (loser) {
            loser.state = 'DEAD';
            loser.play('die', loser.animationFade);
        }
    }

    uiManager.showVictory(winnerId);
}

function handleHitEvents(events) {
    events.forEach(event => {
        combatSystem.applyHitEffects(event.atkType);
        if (combatSystem.onDamage) {
            combatSystem.onDamage(event.damage, event.position, false);
        }
        if (event.target.state === 'DEAD') {
            endGame(event.attacker.id);
        }
    });
}

function checkVictoryByHealth() {
    if (fighters.length !== 2) return;
    const [p1, p2] = fighters;
    if (p1.hp <= 0 && p2.hp <= 0) {
        endGame(null);
    } else if (p1.hp <= 0) {
        endGame('p2');
    } else if (p2.hp <= 0) {
        endGame('p1');
    }
}

function animate() {
    requestAnimationFrame(animate);

    const dt = sceneManager.getDeltaTime();

    combatSystem.update(dt);
    effectsSystem.update(dt);
    previewScene.update();

    if (gameState.getState() === 'PAUSED') {
        renderSystem.render(combatSystem.getHitStop());
        return;
    }

    if (fighters.length === 2) {
        const keys = inputHandler.getKeys();
        const state = gameState.getState();

        fighters[0].update(dt, fighters[1], state, keys, sceneManager.camera);
        fighters[1].update(dt, fighters[0], state, keys, sceneManager.camera);

        collisionSystem.resolveCollisions(fighters);

        const hits = combatSystem.checkCollisions(fighters);
        handleHitEvents(hits);

        cameraController.update(dt, fighters, state);
        uiManager.updateHUD(fighters, gameState.getTimer());
        uiManager.updateDebugPanel(fighters, state, gameState.getTimer());
        checkVictoryByHealth();
    }

    renderSystem.render(combatSystem.getHitStop());
}

init();
