// Main application entry point
import * as THREE from 'three';
import { CONFIG } from './config.js';

// Core systems
import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { RenderSystem } from './core/RenderSystem.js';
import { ArenaBuilder } from './core/ArenaBuilder.js';
import { AppStateManager } from './core/AppStateManager.js';
import { LoadingOrchestrator } from './core/LoadingOrchestrator.js';
import { SystemInitializer } from './core/SystemInitializer.js';

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
import { UIStateController } from './ui/UIStateController.js';
import { LoadingScreen } from './ui/LoadingScreen.js';

// Character systems
import { CharacterManager } from './characters/CharacterManager.js';

// System utilities
import { InputHandler } from './systems/InputHandler.js';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { StorageManager } from './systems/StorageManager.js';
import { FireParticleSystem } from './systems/FireParticleSystem.js';
import { ImagePreloader } from './systems/ImagePreloader.js';

let fighters = [];

// Global system references (will be set during bootstrap)
let sceneManager, cameraController, renderSystem, arenaBuilder;
let gameState, combatSystem, collisionSystem;
let uiManager, setupScreen, previewScene;
let storageManager, characterManager, characterSelector;
let inputHandler, effectsSystem;
let appStateManager, uiStateController;
let fireParticleSystem = null;
let imagePreloader = null;
let loadingScreen = null;

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
        
        // Update fighter visualizations
        if (fighters.length === 2) {
            fighters[0].setHitboxVisibility(options.hitboxes || false);
            fighters[0].setCollisionBoxVisibility(options.collisionBox || false);
            fighters[1].setHitboxVisibility(options.hitboxes || false);
            fighters[1].setCollisionBoxVisibility(options.collisionBox || false);
        }
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

    // Handle Escape key in setup screen to cancel selections
    inputHandler.setEscapeSetupCallback(() => {
        if (gameState.getState() === 'SETUP') {
            const selectedCharacters = characterSelector.getSelectedCharacters();
            
            // If both players are selected, cancel P2 first
            if (selectedCharacters.p1 && selectedCharacters.p2) {
                characterSelector.clearSelection('p2');
            }
            // If only P1 is selected, cancel P1
            else if (selectedCharacters.p1) {
                characterSelector.clearSelection('p1');
            }
            // If only P2 is selected, cancel P2
            else if (selectedCharacters.p2) {
                characterSelector.clearSelection('p2');
            }
        } else {
            // Not in setup, handle pause logic
            if (gameState.getState() === 'FIGHT') {
                gameState.pause();
            } else if (gameState.getState() === 'PAUSED') {
                gameState.resume();
            }
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

/**
 * Bootstrap phase - Create all system instances
 */
function bootstrap() {
    // Note: storageManager and appStateManager are already created in init()
    
    // Core systems
    sceneManager = new SceneManager();
    cameraController = new CameraController(sceneManager);
    renderSystem = new RenderSystem(sceneManager);
    arenaBuilder = new ArenaBuilder(sceneManager);

    // Game systems
    gameState = new GameState();
    combatSystem = new CombatSystem();
    collisionSystem = new CollisionSystem();

    // UI systems
    uiManager = new UIManager();
    setupScreen = new SetupScreen();
    loadingScreen = new LoadingScreen();

    // Character systems
    characterManager = new CharacterManager();

    // Create UIStateController
    uiStateController = new UIStateController();
    
    // Image preloader (for character selection images)
    imagePreloader = new ImagePreloader(storageManager);
    
    // Preview scene (depends on sceneManager and renderSystem)
    // Note: renderSystem will be created in bootstrap, so we pass it after initialization
    previewScene = new PreviewScene(sceneManager, null); // renderSystem will be set after init
    characterSelector = new CharacterSelector(characterManager, previewScene, storageManager, imagePreloader);

    // Utility systems
    inputHandler = new InputHandler();
    effectsSystem = new EffectsSystem();

    return {
        sceneManager,
        cameraController,
        renderSystem,
        arenaBuilder,
        gameState,
        combatSystem,
        collisionSystem,
        uiManager,
        setupScreen,
        previewScene,
        storageManager,
        characterManager,
        characterSelector,
        inputHandler,
        effectsSystem,
        appStateManager,
        uiStateController
    };
}

/**
 * Initialize all systems
 */
async function initializeSystems() {
    // Initialize core rendering systems first
    sceneManager.init();
    renderSystem.init();
    
    // Set renderSystem reference in previewScene now that it's initialized
    previewScene.renderSystem = renderSystem;
    
    arenaBuilder.buildArena();
    effectsSystem.setCamera(sceneManager.camera);

    // Initialize character system (async)
    await characterManager.initialize();

    // Initialize UI systems
    uiManager.init();
    setupScreen.init();
    previewScene.init();
    loadingScreen.init();

    // Restore debug options if saved
    const savedSettings = storageManager.loadGameSettings();
    if (savedSettings?.debug) {
        uiManager.pauseMenu.setDebugOptions(savedSettings.debug);
        uiManager.debugPanel.setOptions(savedSettings.debug);
    }

    // Setup all callbacks
    setupCallbacks();

    // Set game state to SETUP
    // Don't show setup screen here - it will be shown by tutorial completion or loading sequence
    gameState.setState('SETUP');
}

/**
 * Load initial 3D character models during tutorial
 * @param {Function} onProgress - Progress callback (current, total, characterId)
 * @returns {Promise<void>}
 */
async function loadInitialCharacterModels(onProgress = null) {
    const charactersToLoad = ['trump', 'brandon']; // Default characters for tutorial
    const total = charactersToLoad.length;
    let loaded = 0;

    const loadPromises = charactersToLoad.map(async (charId) => {
        try {
            if (!characterManager.isCharacterLoaded(charId)) {
                await characterManager.loadCharacter(charId);
            }
            loaded++;
            if (onProgress) {
                onProgress(loaded, total, charId);
            }
        } catch (error) {
            console.warn(`Failed to load character ${charId} during tutorial:`, error);
            loaded++; // Count as loaded even if failed to prevent hanging
            if (onProgress) {
                onProgress(loaded, total, charId);
            }
        }
    });

    await Promise.all(loadPromises);
}

/**
 * Show tutorial loading screen and wait for models
 * @returns {Promise<void>}
 */
async function showTutorialScreen() {
    if (!loadingScreen) return;

    // Ensure setup screen is hidden during tutorial
    if (setupScreen) {
        setupScreen.hide();
    }
    const setupScreenEl = document.getElementById('setup-screen');
    if (setupScreenEl) {
        setupScreenEl.style.display = 'none';
        setupScreenEl.style.visibility = 'hidden';
    }

    // Show loading screen
    loadingScreen.show();

    // Start both minimum wait time and model loading in parallel
    const minWaitTime = new Promise((resolve) => {
        setTimeout(() => resolve(), 2000); // 2 second minimum
    });

    // Track loading progress
    let loadingProgress = 0;
    const maxProgress = 95; // Leave room for completion

    const modelLoadingPromise = loadInitialCharacterModels((loaded, total, characterId) => {
        // Update progress based on model loading
        const modelProgress = (loaded / total) * maxProgress;
        loadingProgress = Math.max(loadingProgress, modelProgress);
        if (loadingScreen) {
            loadingScreen.updateProgress(loadingProgress);
        }
        console.log(`Tutorial loading: ${characterId} (${loaded}/${total})`);
    });

    // Wait for both minimum time and models to be ready
    await Promise.all([minWaitTime, modelLoadingPromise]);

    // Ensure progress is at max before completion
    loadingProgress = 100;
    if (loadingScreen) {
        loadingScreen.updateProgress(100);
    }

    // Wait for user to press Enter before proceeding
    if (loadingScreen) {
        await loadingScreen.waitForEnter();
    }

    // Mark tutorial as complete
    storageManager.markTutorialComplete();

    // Hide loading screen
    if (loadingScreen) {
        loadingScreen.hide();
    }

    // Wait for fade-out animation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Ensure setup screen is visible after tutorial (it was hidden during tutorial)
    // Set game state to SETUP and show the screen
    if (gameState) {
        gameState.setState('SETUP');
    }
    if (setupScreen) {
        setupScreen.show();
    }
}

/**
 * Start loading sequence (first visit with animations)
 */
async function startFirstLoadSequence() {
    // Import LoadingManager for backward compatibility with CharacterSelector
    const { LoadingManager } = await import('./ui/LoadingManager.js');
    const loadingManager = new LoadingManager();
    
    const orchestrator = LoadingOrchestrator.createFirstLoad(uiStateController);
    
    // Wire up loading callbacks
    orchestrator.onParticlesReady = () => {
        fireParticleSystem = new FireParticleSystem('fire-particles-canvas-back', 'fire-particles-canvas-front');
        fireParticleSystem.start();
    };

    orchestrator.onTitleReady = () => {
        uiStateController.showTitle();
    };

    orchestrator.onGridReady = () => {
        uiStateController.showGrid();
    };

    // Preload character images before characters are ready
    orchestrator.onPhase('characters', async () => {
        // Preload images for all characters
        const allCharacters = characterManager.getAllCharacters();
        if (allCharacters.length > 0) {
            console.log('Preloading character images...');
            await imagePreloader.preloadAllImages(allCharacters, (loaded, total) => {
                console.log(`Image preload progress: ${loaded}/${total}`);
            });
            console.log('Character images preloaded');
        }
    });

    orchestrator.onCharactersReady = () => {
        // Initialize character selector with sequential loading
        characterSelector.init(loadingManager, () => {
            // Loading complete - show remaining UI elements
            uiStateController.showInfoPanel();
            uiStateController.showChooseFighterText();
            uiStateController.showBackgroundPNGs();
            
            // Mark orchestrator complete
            if (orchestrator.onComplete) {
                orchestrator.onComplete();
            }
        });
    };

    orchestrator.onComplete = () => {
        console.log('Loading sequence complete');
        appStateManager.completeFirstLoad();
    };

    await orchestrator.execute();
}

/**
 * Start quick load (subsequent visits, skip animations)
 */
async function startQuickLoad() {
    // Set loading state
    appStateManager.setState(appStateManager.STATES.LOADING);
    
    const orchestrator = LoadingOrchestrator.createQuickLoad(uiStateController);
    
    // Wire up loading callbacks (same as first load, but executed instantly)
    orchestrator.onParticlesReady = () => {
        fireParticleSystem = new FireParticleSystem('fire-particles-canvas-back', 'fire-particles-canvas-front');
        fireParticleSystem.start();
    };

    orchestrator.onTitleReady = () => {
        uiStateController.showTitle();
    };

    orchestrator.onGridReady = () => {
        uiStateController.showGrid();
    };

    // Preload character images before characters are ready (for quick load)
    orchestrator.onPhase('characters', async () => {
        // Preload images for all characters
        const allCharacters = characterManager.getAllCharacters();
        if (allCharacters.length > 0) {
            console.log('Preloading character images (quick load)...');
            await imagePreloader.preloadAllImages(allCharacters);
            console.log('Character images preloaded (quick load)');
        }
    });

    orchestrator.onCharactersReady = () => {
        // Initialize character selector without sequential loading (null = immediate mode)
        characterSelector.init(null, () => {
            // Character selector init complete
            // UIStateController.setLoadedState() is called by QuickLoadStrategy
            if (orchestrator.onComplete) {
                orchestrator.onComplete();
            }
        });
    };

    orchestrator.onComplete = () => {
        console.log('Quick load complete');
        // Mark session as initialized and app as ready
        appStateManager.completeFirstLoad();
    };

    await orchestrator.execute();
}

/**
 * Main initialization function
 */
async function init() {
    try {
        // Create storage and appStateManager first (needed before bootstrap)
        storageManager = new StorageManager();
        appStateManager = new AppStateManager(storageManager);
        
        // Initialize tutorial session tracking (detects hard reload)
        storageManager.initTutorialSession();
        
        // Bootstrap: Create all systems
        await appStateManager.bootstrap(bootstrap);
        
        // Initialize: Initialize systems and run loading sequence
        await appStateManager.initialize(async () => {
            await initializeSystems();
            
            // Check if tutorial needs to be shown (first visit or hard reload)
            const needsTutorial = !storageManager.hasSeenTutorial();
            
            if (needsTutorial) {
                // Show tutorial loading screen and load initial models
                await showTutorialScreen();
                // Setup screen is shown at the end of showTutorialScreen()
            } else {
                // No tutorial needed - show setup screen now so loading sequence can work with it
                if (setupScreen) {
                    setupScreen.show();
                }
            }
            
            // Determine loading strategy based on app state
            const isFirstVisit = storageManager.isFirstVisit();
            const initPreference = storageManager.getInitializationPreference();
            
            if (isFirstVisit || initPreference === 'always-animate') {
                await startFirstLoadSequence();
            } else {
                await startQuickLoad();
            }
        });

        // Start render loop
        animate();
    } catch (error) {
        console.error('Initialization error:', error);
        throw error;
    }
}


async function startCountdown() {
    console.log('startCountdown called');
    
    // Clear any stuck inputs before fight begins
    if (inputHandler) {
        inputHandler.clearKeys();
    }

    // Hide setup screen using the setupScreen method (which also triggers state change)
    setupScreen.hide();
    
    // Also ensure it's hidden via direct manipulation
    const setupScreenEl = document.getElementById('setup-screen');
    if (setupScreenEl) {
        setupScreenEl.style.display = 'none';
        setupScreenEl.style.visibility = 'hidden';
    }
    
    uiManager.showHUD();

    try {
        console.log('Spawning fighters...');
        await spawnFighters();
        console.log('Fighters spawned successfully');
    } catch (error) {
        console.error('Failed to spawn fighters:', error);
        loadNewModels();
        return;
    }
    
    gameState.resetTimer();
    console.log('Starting countdown...');
    
    // Ensure center-overlay is visible and ready
    const overlay = document.getElementById('center-overlay');
    if (overlay) {
        overlay.style.display = 'block';
        overlay.style.visibility = 'visible';
    }
    
    gameState.startCountdown(() => {
        console.log('Countdown completed, game should be in FIGHT state');
    });
}

/**
 * Clean up all existing fighters and dispose of their resources
 * This prevents duplicate characters, hitboxes, and memory leaks
 */
function cleanupFighters() {
    if (fighters && fighters.length > 0) {
        fighters.forEach(fighter => {
            if (fighter && typeof fighter.dispose === 'function') {
                fighter.dispose();
            }
        });
        fighters = [];
    }
}

async function spawnFighters() {
    // Clean up any existing fighters before spawning new ones
    cleanupFighters();

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

    // Apply saved debug options to fighters
    const savedSettings = storageManager.loadGameSettings();
    if (savedSettings?.debug) {
        fighters[0].setHitboxVisibility(savedSettings.debug.hitboxes || false);
        fighters[0].setCollisionBoxVisibility(savedSettings.debug.collisionBox || false);
        fighters[1].setHitboxVisibility(savedSettings.debug.hitboxes || false);
        fighters[1].setCollisionBoxVisibility(savedSettings.debug.collisionBox || false);
    }
}

function restartFight() {
    // Hide end screen and remove keyboard handler
    const endScreen = document.getElementById('end-screen');
    if (endScreen) {
        endScreen.classList.remove('show');
    }
    // Remove keyboard handler
    if (uiManager && uiManager.endScreenKeyboardHandler) {
        window.removeEventListener('keydown', uiManager.endScreenKeyboardHandler);
        uiManager.endScreenKeyboardHandler = null;
    }

    // Safety check: ensure we have exactly 2 valid fighters
    if (fighters.length !== 2) {
        console.warn('restartFight: Invalid fighter count, cannot restart');
        return;
    }

    // Verify fighters are still valid (not disposed)
    if (!fighters[0] || !fighters[0].mesh || !fighters[1] || !fighters[1].mesh) {
        console.warn('restartFight: Fighters are invalid or disposed, cannot restart');
        return;
    }

    if (inputHandler) {
        inputHandler.clearKeys();
    }

    fighters[0].mesh.position.set(-3, 0, 0);
    fighters[1].mesh.position.set(3, 0, 0);

    fighters.forEach(f => {
        f.hp = f.maxHp;
        f.st = f.maxSt;
        // Update state through StateManager
        if (f.stateManager) {
            f.stateManager.setState('IDLE');
        }
        f.state = 'IDLE'; // Keep for backward compatibility
        // Resume animation mixer if it was frozen
        if (f.mixer) {
            f.mixer.timeScale = 1;
        }
        // Start with idle animation via animation system
        if (f.animationSystem) {
            f.animationSystem.updateLocomotionBlend(0, 1);
        }
        f.updateUI();
    });

    document.getElementById('center-overlay').innerHTML = '';
    gameState.resetTimer();
    gameState.startCountdown(() => {});
}

function loadNewModels() {
    // Stop any active random flicker
    if (characterSelector && typeof characterSelector.stopRandomFlicker === 'function') {
        characterSelector.stopRandomFlicker();
    }

    gameState.setState('SETUP');

    // Use cleanupFighters() to properly dispose of all resources
    cleanupFighters();

    // Hide HUD first
    uiManager.hideHUD();
    
    // Hide end screen and remove keyboard handler
    const endScreen = document.getElementById('end-screen');
    if (endScreen) {
        endScreen.classList.remove('show');
    }
    // Remove keyboard handler
    if (uiManager && uiManager.endScreenKeyboardHandler) {
        window.removeEventListener('keydown', uiManager.endScreenKeyboardHandler);
        uiManager.endScreenKeyboardHandler = null;
    }
    
    // Clear the victory overlay
    const overlay = document.getElementById('center-overlay');
    if (overlay) {
        overlay.innerHTML = '';
        overlay.style.display = 'none';
        overlay.style.visibility = 'hidden';
    }

    // Show setup screen BEFORE clearing selections to ensure it's visible
    setupScreen.show();
    
    // Ensure setup screen is visible and on top
    const setupScreenEl = document.getElementById('setup-screen');
    if (setupScreenEl) {
        setupScreenEl.style.display = 'flex';
        setupScreenEl.style.visibility = 'visible';
        setupScreenEl.style.opacity = '1';
        setupScreenEl.style.zIndex = '100'; // Ensure it's on top
    }

    // Clear selections after setup screen is shown
    characterSelector.clearSelection('p1');
    characterSelector.clearSelection('p2');

    gameState.resetTimer();
}

function endGame(winnerId) {
    if (gameState.getState() === 'OVER') return;

    // Freeze the game state - don't play win/die animations, just freeze current state
    gameState.setState('OVER');

    // Stop all animation mixers to freeze the frame
    if (fighters.length === 2) {
        fighters.forEach(fighter => {
            if (fighter.mixer) {
                // Pause the mixer at current time to freeze animation
                fighter.mixer.timeScale = 0;
            }
        });
    }

    let winnerFighter = null;
    let loserFighter = null;

    if (fighters.length === 2) {
        if (winnerId) {
            // Normal win case
            winnerFighter = winnerId === 'p1' ? fighters[0] : fighters[1];
            loserFighter = winnerId === 'p1' ? fighters[1] : fighters[0];
        } else {
            // Draw case - both are losers, pass both fighters
            // For draw, we'll pass fighters[0] as "loserFighter" and fighters[1] as "winnerFighter"
            // (they're both losers, but we need to pass both)
            loserFighter = fighters[0];
            winnerFighter = fighters[1]; // Using winnerFighter param to pass p2
        }
        // Don't change state or play animations - just freeze current state
    }

    uiManager.showVictory(winnerId, winnerFighter, loserFighter);
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
    const state = gameState.getState();

    combatSystem.update(dt);
    effectsSystem.update(dt);
    previewScene.update();

    if (state === 'PAUSED') {
        renderSystem.render(combatSystem.getHitStop());
        return;
    }

    // Freeze frame when game is over - don't update fighters or animations
    if (state === 'OVER') {
        // Still render the frozen scene
        renderSystem.render(combatSystem.getHitStop());
        return;
    }

    if (fighters.length === 2) {
        const keys = inputHandler.getKeys();

        fighters[0].update(dt, fighters[1], state, keys, sceneManager.camera, collisionSystem, inputHandler);
        fighters[1].update(dt, fighters[0], state, keys, sceneManager.camera, collisionSystem, inputHandler);

        collisionSystem.resolveCollisions(fighters);

        const hits = combatSystem.checkCollisions(fighters);
        handleHitEvents(hits);

        cameraController.update(dt, fighters, state);
        uiManager.updateHUD(fighters, gameState.getTimer());
        uiManager.updateDebugPanel(fighters, state, gameState.getTimer());
        checkVictoryByHealth();
        
        // Clear justPressed keys at the end of the frame (edge detection reset for next frame)
        inputHandler.clearJustPressed();
    }

    renderSystem.render(combatSystem.getHitStop());
}

init();
