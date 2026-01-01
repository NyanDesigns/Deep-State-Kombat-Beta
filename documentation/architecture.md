# System Architecture Overview

Deep State Kombat follows a modular, system-based architecture organized into distinct layers. This document provides a high-level overview of how these layers interact to create the complete game experience.

## Architecture Layers

The application is structured into four primary architectural layers:

1. **Core Management** (`js/core/`) - Application lifecycle, initialization, and 3D environment setup
2. **Game Systems** (`js/game/`) - Combat logic, physics, and match state management
3. **UI & Systems** (`js/ui/`, `js/systems/`, `js/characters/`, `js/utils/`, `js/shaders/`) - User interface, animation systems, character management, and utilities
4. **Entry Point** (`js/main.js`, `js/config.js`) - Bootstrap and configuration

## System Interaction Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Bootstrap                      │
│  (main.js → AppStateManager → SystemInitializer)            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Core Management Layer                       │
│  • AppStateManager: Lifecycle & state transitions          │
│  • SystemInitializer: Dependency-aware initialization       │
│  • SceneManager: Three.js scene/camera/renderer wrapper    │
│  • RenderSystem: Pixelation & CRT post-processing          │
│  • ArenaBuilder: 3D environment construction                │
│  • CameraController: Dynamic camera & screen shake         │
│  • LoadingOrchestrator: Loading sequence coordination       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Game Systems Layer                        │
│  • Fighter: Core character class (F3 implementation)        │
│  • CombatSystem: Hit detection & visual effects             │
│  • CollisionSystem: Physical collision resolution           │
│  • GameState: Match state machine & timer                   │
│  • AIController: CPU opponent decision making               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  UI & Systems Layer                          │
│  UI Components:                                             │
│    • UIManager: Master UI coordinator                       │
│    • SetupScreen: Main menu & character selection          │
│    • HUD: Health/stamina bars & timer                       │
│    • PauseMenu: Pause overlay & debug options              │
│    • CharacterSelector: 2×3 grid & preview system           │
│    • PreviewScene: Character portrait rendering            │
│                                                              │
│  Systems:                                                   │
│    • AnimationController: Priority-based animation system   │
│    • MotionController: Velocity-based movement              │
│    • LocomotionBlender: Idle/walk blending                  │
│    • InputHandler: Keyboard input capture                   │
│    • StorageManager: localStorage persistence              │
│    • EffectsSystem: Visual effects (damage numbers, etc.)   │
│                                                              │
│  Character Management:                                       │
│    • CharacterManager: Character registry & loading         │
│    • CharacterLoader: GLB model loading                     │
│    • CharacterConfig: JSON validation                      │
│                                                              │
│  Utilities:                                                 │
│    • HitboxSystem: Attack/hurtbox management                │
│    • BoneDiscovery: Automatic bone mapping                 │
│                                                              │
│  Shaders:                                                   │
│    • CRTShader: Retro scanline & vignette effects           │
└─────────────────────────────────────────────────────────────┘
```

## Main Game Loop

The core game loop (`js/main.js`) executes every frame via `requestAnimationFrame`:

1. **Delta Time Calculation** - `SceneManager.getDeltaTime()` provides frame-independent timing
2. **System Updates** - `CombatSystem`, `EffectsSystem`, and `PreviewScene` update their internal state
3. **State Check** - If paused or game over, render frozen frame and return
4. **Fighter Updates** - Process inputs, update AI, apply movement, update animations
5. **Collision Resolution** - `CollisionSystem` ensures fighters don't overlap
6. **Combat Resolution** - `CombatSystem` checks for hits and applies damage
7. **Camera Update** - `CameraController` follows fighters with dynamic zoom
8. **UI Updates** - HUD and debug panel refresh with current values
9. **Victory Check** - Verify if match should end based on health
10. **Rendering** - `RenderSystem` renders through pixelation pipeline with CRT effects

## Key Design Patterns

### Dependency Injection
Systems receive their dependencies through constructor parameters, allowing for easy testing and modularity.

### State Machine Pattern
Both `AppStateManager` (application-level) and `GameState` (match-level) use state machines to manage transitions and prevent invalid states.

### Strategy Pattern
`LoadingOrchestrator` uses `LoadingStrategy` implementations (`FirstLoadStrategy`, `QuickLoadStrategy`) to handle different loading scenarios.

### Observer Pattern
Systems communicate through callback functions (`onStateChange`, `onTimerUpdate`, etc.) rather than direct coupling.

### Component-Based Architecture
`Fighter` class composes multiple systems (`AnimationController`, `MotionController`, `AIController`) rather than inheriting from a base class.

## Data Flow

### Character Loading Flow
```
CharacterSelector → CharacterManager → CharacterLoader → GLB File
                                                      ↓
                                              Fighter Constructor
                                                      ↓
                                              AnimationController
                                                      ↓
                                              HitboxSystem Setup
```

### Combat Flow
```
Input/AI Decision → Fighter.attack() → AnimationController.playOneShot()
                                              ↓
                                    HitboxSystem.updateAttackSpheres()
                                              ↓
                                    CombatSystem.checkCollisions()
                                              ↓
                                    Fighter.takeDamage() → EffectsSystem
```

### Rendering Flow
```
Game Loop → RenderSystem.render() → Low-Res Render Target
                                              ↓
                                    CRT Shader Pass
                                              ↓
                                    Fullscreen Quad Display
```

## Performance Considerations

- **Sequential Loading**: Characters loaded one at a time to prevent browser hangs
- **Image Caching**: Character portraits cached in `localStorage` for instant switching
- **Hitbox Optimization**: Attack hitboxes only update during active attack windows
- **Single Animation Mixer**: One mixer per fighter handles all animations efficiently
- **Render Target Reuse**: Preview scenes reuse render targets to reduce memory allocation

## Extension Points

The architecture is designed for extensibility:

- **New Characters**: Add JSON config and GLB model to `assets/characters/`, register in `characters.js`
- **New Attack Types**: Extend `Fighter.attack()` and add animation mappings
- **New UI Screens**: Create new UI class, register in `UIManager`
- **New Effects**: Add to `EffectsSystem` and trigger from `CombatSystem`
- **Custom Loading**: Implement new `LoadingStrategy` subclass

For detailed documentation of each system, see:
- [Core Management Documentation](./Core_Management.md)
- [Game System Documentation](./Game_System.md)
- [UI and Systems Documentation](./UI_and_Systems.md)
