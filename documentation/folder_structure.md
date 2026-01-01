# System Map & Architectural Organization

This document provides a comprehensive breakdown of the Deep State Kombat codebase, organized by architectural layer rather than simple directory listing. It includes every script in the system and a description of its role.

## 1. Application Orchestration Layer (Root & Entry)
These files manage the bootstrap process, global configuration, and the main execution loop.

- `index.html`: The primary entry point. Sets up the DOM structure for UI layers (HUD, Setup, Pause, End Screen) and defines the `importmap` for Three.js.
- `js/main.js`: The application's "brain." Orchestrates the bootstrap phase, initializes all systems via the `AppStateManager`, and runs the `requestAnimationFrame` render loop.
- `js/config.js`: Centralized game constants. Defines combat windows, movement physics (friction, acceleration), animation priorities, and default character stats.

## 2. Core Engine & State Management (`js/core/`)
The foundation of the game engine, handling the lifecycle of the application and the 3D environment.

- `AppStateManager.js`: Manages high-level application states (BOOTSTRAP, LOADING, READY) and coordinates the initialization sequence.
- `SystemInitializer.js`: A dependency-aware loader that ensures systems are initialized in the correct order (e.g., rendering before UI).
- `SceneManager.js`: Wraps the Three.js `Scene`, `Camera`, and `WebGLRenderer`. Handles resizing and delta time calculation.
- `RenderSystem.js`: Handles the actual rendering calls, including support for "hit-stop" frame freezing and pixelation effects.
- `ArenaBuilder.js`: Procedurally or statically constructs the 3D fighting arena and environment.
- `CameraController.js`: Manages the dynamic camera that follows both fighters, applying smooth interpolation and screen shake.
- `LoadingOrchestrator.js`: Manages the transition between different loading phases using specific strategies.
- `LoadingStrategy.js`: Defines the interface and logic for different loading behaviors (First Load vs. Quick Load).

## 3. Gameplay & Physics Logic (`js/game/`)
The "Rules of Play." These systems handle how characters interact, fight, and move.

- `Fighter.js`: **The "F3" (Core Fighter) implementation.** This is the primary class for all characters. It manages state (IDLE, ATK, HIT, etc.), processes input/AI commands, and updates the 3D mesh.
- `CombatSystem.js`: Detects hit events, applies damage, and triggers visual feedback like screen shake and hit-stop effects.
- `CollisionSystem.js`: Physical world resolution. Ensures fighters stay in bounds and don't occupy the same space using circle-based collision math.
- `GameState.js`: Tracks match-specific data: the timer, current match state (COUNTDOWN, FIGHT, OVER), and scores.
- `AIController.js`: The "brain" for CPU players. Uses a state machine (Spacing, Aggressive, Defensive) to make tactical decisions based on distance and resources.

## 4. Character & Asset Pipeline (`js/characters/`)
Systems dedicated to loading, validating, and registering character data.

- `CharacterManager.js`: The central registry for characters. Handles async loading of GLB models and JSON configurations.
- `CharacterLoader.js`: Low-level wrapper for `GLTFLoader` with error handling for model and texture assets.
- `CharacterConfig.js`: Defines the schema for `character.json` files and provides validation to ensure required stats/animations are present.
- `characters.js`: A static registry defining the paths to all preset character assets (Trump, Brandon, etc.).

## 5. Animation & Specialized Systems (`js/systems/`)
Sub-systems that handle specific technical aspects of the game's presentation and feel.

- `AnimationController.js`: Manages the `AnimationMixer` for a fighter, handling priority-based crossfades between different states.
- `AnimationStateMachine.js`: Tracks the history and transition logic for animation states to prevent "glitching" between incompatible clips.
- `AnimationMixer.js`: A specialized wrapper for Three.js animation blending.
- `LocomotionBlender.js`: Handles the smooth blending between "Idle" and "Walk" animations based on the fighter's current velocity.
- `MotionController.js`: Implements smooth acceleration, damping, and rotation slerping for realistic character movement.
- `InputHandler.js`: Captures and buffers keyboard events, providing a clean API for checking "just pressed" or "held" keys.
- `StorageManager.js`: Handles `localStorage` persistence for character records, tutorial status, and user settings.
- `EffectsSystem.js`: Manages the spawning of temporary visual effects like damage numbers and hit sparks.
- `FireParticleSystem.js`: A custom CPU/Canvas particle system used for the fiery background effects in the setup screen.
- `ImagePreloader.js`: Ensures character portraits and background PNGs are cached in memory for instant UI switching.

## 6. User Interface Layer (`js/ui/`)
The bridge between the game logic and the player's screen.

- `UIManager.js`: The master UI controller. Coordinates between the HUD, menus, and end screens.
- `UIStateController.js`: Manages the visibility and CSS transitions for the various UI panels (Title, Grid, Info).
- `HUD.js`: Updates the real-time health and stamina bars, names, and the match timer.
- `SetupScreen.js`: Manages the main menu and the "Enter Arena" flow.
- `CharacterSelector.js`: Controls the 2x3 grid, handling hover previews, character selection, and custom GLB file uploads.
- `PreviewScene.js`: A dedicated scene for rendering the character portraits and background previews.
- `PauseMenu.js`: Handles the overlay when the game is paused, including the debug toggle options.
- `LoadingScreen.js`: Displays the tutorial controls and progress bar during the initial asset load.
- `LoadingManager.js`: A utility for tracking multi-asset loading progress.
- `DebugPanel.js`: Renders the Tekken-style real-time frame data, hitboxes, and internal state parameters.

## 7. Utility & Low-Level Helpers (`js/utils/`)
Mathematical and structural helpers used across multiple systems.

- `HitboxSystem.js`: Manages the registration and visualization of attack circles and hurtbox circles.
- `BoneDiscovery.js`: Automatically maps standard Mixamo bone names to internal game slots (Head, Torso, Hands, Legs).

## 8. Visual Shaders (`js/shaders/`)
Custom GPU programs for the game's unique aesthetic.

- `CRTShader.js`: Implements the retro scanline, vignette, and slight curvature effect seen across the entire game.
