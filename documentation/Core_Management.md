# Core Management Systems

This document provides comprehensive documentation for all core management systems that handle application lifecycle, initialization, and the 3D environment setup.

---

## AppStateManager (`js/core/AppStateManager.js`)

**Purpose**: Centralized application state machine and lifecycle management. Coordinates the entire application initialization flow from bootstrap to ready state.

### Features

- **State Machine**: Manages five application-level states (BOOTSTRAP, INITIALIZING, LOADING, READY, ACTIVE)
- **Lifecycle Coordination**: Orchestrates the transition between initialization phases
- **Session Detection**: Tracks whether this is a first visit or subsequent visit
- **Event Callbacks**: Provides hooks for state change notifications

### State Definitions

```javascript
STATES = {
    BOOTSTRAP: 'bootstrap',       // Creating system instances
    INITIALIZING: 'initializing', // Async initialization of systems
    LOADING: 'loading',           // UI loading sequence (first visit)
    READY: 'ready',               // All systems ready, at setup screen
    ACTIVE: 'active'              // Game in progress
}
```

### Key Methods

#### `bootstrap(bootstrapCallback)`
- **Purpose**: Bootstrap phase - create all system instances
- **Parameters**: `bootstrapCallback` - Function that creates and returns all system instances
- **Returns**: Promise resolving to object containing all created systems
- **Usage**: Called from `main.js` to instantiate all game systems before initialization

#### `initialize(initializeCallback)`
- **Purpose**: Initialize phase - initialize all systems and run loading sequence
- **Parameters**: `initializeCallback` - Function that initializes systems and determines loading strategy
- **Returns**: Promise that resolves when initialization is complete
- **Usage**: Called after bootstrap to set up systems and determine first-load vs quick-load

#### `completeFirstLoad()`
- **Purpose**: Mark first load sequence as complete
- **Side Effects**: 
  - Marks session as initialized in storage
  - Resolves first load promise
  - Transitions state to READY
  - Triggers `onReady` callback
- **Usage**: Called by `LoadingOrchestrator` when loading sequence finishes

#### `setState(newState)`
- **Purpose**: Set current state and notify listeners
- **Parameters**: `newState` - State name from STATES enum
- **Side Effects**: 
  - Updates `currentState` and `previousState`
  - Logs state transition to console
  - Calls `onStateChange` callback if registered
- **Usage**: Internal method used by all state transition methods

### Event Callbacks

- `onStateChange(newState, oldState)` - Called when state changes
- `onBootstrapComplete(systems)` - Called after bootstrap phase
- `onInitializeComplete()` - Called after initialization phase
- `onLoadingComplete()` - Called when loading sequence completes
- `onReady()` - Called when application is ready for user interaction

### Debugging

- State transitions are logged to console: `AppState: {oldState} → {newState}`
- Use `getState()` to check current state
- Use `isReady()` or `isLoading()` for conditional logic

---

## SystemInitializer (`js/core/SystemInitializer.js`)

**Purpose**: Dependency-aware system initialization that ensures all game components are initialized in the correct order, preventing errors during startup.

### Features

- **Dependency Resolution**: Automatically resolves and initializes dependencies before dependent systems
- **Parallel Initialization**: Systems without dependencies can initialize in parallel
- **Error Handling**: Throws descriptive errors if dependencies are missing
- **Initialization Tracking**: Tracks which systems have been initialized to prevent double-initialization

### Key Methods

#### `register(name, initFn, dependencies = [])`
- **Purpose**: Register a system to be initialized
- **Parameters**:
  - `name` - Unique system identifier
  - `initFn` - Async function that returns the initialized system instance
  - `dependencies` - Array of system names this system depends on
- **Usage**: Register all systems before calling `initializeAll()`

#### `initializeAll()`
- **Purpose**: Initialize all registered systems in dependency order
- **Returns**: Promise resolving to Map of initialized systems (name → instance)
- **Process**:
  1. Creates promises for all systems
  2. Each system waits for its dependencies
  3. Systems initialize in parallel when dependencies are ready
  4. Returns map of all initialized systems

#### `initializeSystem(name)`
- **Purpose**: Initialize a specific system by name (with all dependencies)
- **Parameters**: `name` - System name
- **Returns**: Promise resolving to initialized system instance
- **Usage**: Useful for lazy initialization of optional systems

#### `_getAllDependencies(name)`
- **Purpose**: Recursively get all dependencies for a system
- **Parameters**: `name` - System name
- **Returns**: Array of all dependency names (including transitive dependencies)
- **Usage**: Internal method used to ensure all dependencies are initialized

### Example Usage

```javascript
const initializer = new SystemInitializer();

// Register systems with dependencies
initializer.register('renderer', async () => new Renderer(), []);
initializer.register('scene', async () => new Scene(), ['renderer']);
initializer.register('ui', async () => new UI(), ['scene', 'renderer']);

// Initialize all (scene waits for renderer, ui waits for both)
const systems = await initializer.initializeAll();
```

### Debugging

- Initialization order is logged: `Initializing system: {name}`
- Missing dependencies throw errors: `Dependency '{name}' not found for system '{name}'`
- Use `isInitialized(name)` to check if a system is ready

---

## SceneManager (`js/core/SceneManager.js`)

**Purpose**: Wraps the Three.js Scene, Camera, and Renderer. Provides a simplified interface for managing the 3D environment and calculating delta time.

### Features

- **Three.js Abstraction**: Encapsulates scene, camera, and renderer setup
- **Delta Time Calculation**: Provides frame-independent timing via `THREE.Clock`
- **Lighting Setup**: Configures comprehensive lighting system (ambient, directional, spot, point lights)
- **Window Resize Handling**: Automatically adjusts camera and renderer on window resize
- **Fog & Atmosphere**: Sets up scene fog for depth perception

### Key Methods

#### `init()`
- **Purpose**: Initialize renderer, scene, camera, lights, and clock
- **Side Effects**:
  - Creates WebGL renderer with antialiasing and shadow maps
  - Creates scene with dark background and fog
  - Creates perspective camera with config-based FOV and aspect ratio
  - Sets up comprehensive lighting system
  - Initializes clock for delta time
  - Registers window resize handler
- **Usage**: Called once during application initialization

#### `setupLights()`
- **Purpose**: Configure all scene lighting
- **Light Types**:
  - **Hemisphere Light**: Balanced sky/ground lighting (intensity 2.5)
  - **Ambient Light**: General fill light (intensity 1.2)
  - **Directional Lights**: Main shadow-casting light + secondary directional
  - **Fill Lights**: Four colored directional lights for balanced illumination
  - **Rim Lights**: Four spot lights positioned around arena for dramatic rim lighting
- **Usage**: Called automatically by `init()`

#### `getDeltaTime()`
- **Purpose**: Get time elapsed since last frame (in seconds)
- **Returns**: Number (delta time in seconds)
- **Usage**: Called every frame in game loop for frame-independent updates
- **Note**: Uses `THREE.Clock.getDelta()` internally

#### `getElapsedTime()`
- **Purpose**: Get total time elapsed since clock started
- **Returns**: Number (elapsed time in seconds)
- **Usage**: Used for time-based effects (shader animations, etc.)

#### `addObject(object)` / `removeObject(object)`
- **Purpose**: Add or remove objects from the scene
- **Parameters**: `object` - Three.js Object3D (Mesh, Group, Light, etc.)
- **Usage**: Simplified interface for scene manipulation

#### `onResize()`
- **Purpose**: Handle window resize events
- **Side Effects**:
  - Updates camera aspect ratio to match pixelation config
  - Updates renderer size to match window
  - Maintains pixelation resolution regardless of window size
- **Usage**: Automatically called by window resize event listener

### Configuration Dependencies

- `CONFIG.cam.fov` - Camera field of view (default: 45)
- `CONFIG.cam.height` - Camera Y position (default: 2.0)
- `CONFIG.cam.dist` - Camera Z distance (default: 7.5)
- `CONFIG.pixelation.width/height` - Internal render resolution (default: 1280x720)

### Debugging

- Scene, camera, and renderer are accessible via `sceneManager.scene`, `sceneManager.camera`, `sceneManager.renderer`
- Delta time can be logged to verify frame rate: `console.log(sceneManager.getDeltaTime())`
- Lighting can be adjusted by modifying `setupLights()` method

---

## RenderSystem (`js/core/RenderSystem.js`)

**Purpose**: Handles all rendering operations including pixelation effects, CRT shader post-processing, and preview scene rendering.

### Features

- **Pixelation Pipeline**: Renders main scene to low-resolution render target, then upscales with CRT effects
- **CRT Shader Integration**: Applies retro scanline, vignette, and curvature effects via `CRTShader`
- **Hit-Stop Support**: Freezes frame rendering during hit-stop effects
- **Preview Scene Rendering**: Renders character previews to separate canvases with pixelation
- **Resource Management**: Manages render targets and disposes of preview canvas resources

### Key Methods

#### `init()`
- **Purpose**: Initialize render system and pixelation pipeline
- **Side Effects**:
  - Creates or uses existing renderer from SceneManager
  - Creates low-resolution render target (1280x720 by default)
  - Creates fullscreen quad with CRT shader material
  - Sets up post-processing composer
  - Registers window resize handler
- **Usage**: Called once during application initialization

#### `render(hitStop = 0)`
- **Purpose**: Render the main gameplay scene through pixelation pipeline
- **Parameters**: `hitStop` - Duration of hit-stop effect (freezes frame if > 0)
- **Process**:
  1. If hit-stop active, render frozen frame and return
  2. Render main scene to low-res render target
  3. Update CRT shader time uniform
  4. Render fullscreen quad with CRT effects via composer
- **Usage**: Called every frame in main game loop

#### `renderSceneToPixelated(scene, camera)`
- **Purpose**: Render any scene through pixelation and CRT pipeline to main canvas
- **Parameters**:
  - `scene` - Three.js Scene to render
  - `camera` - Three.js Camera to use
- **Process**:
  1. Render scene to low-resolution render target
  2. Update CRT shader time uniform for animated effects
  3. Render fullscreen quad with post-processing
- **Usage**: Internal method used by `render()` and preview scenes

#### `renderSceneToCanvas(scene, camera, targetCanvas, width, height)`
- **Purpose**: Render a scene to a specific canvas (for character previews)
- **Parameters**:
  - `scene` - Three.js Scene to render
  - `camera` - Three.js Camera to use
  - `targetCanvas` - HTMLCanvasElement to render to
  - `width` - Canvas width
  - `height` - Canvas height
- **Process**:
  1. Creates or reuses render target for canvas (50% resolution for more aggressive pixelation)
  2. Creates temporary renderer for canvas if needed
  3. Renders scene to low-res target
  4. Creates pixelation scene with CRT shader for canvas
  5. Renders pixelated result to canvas
- **Usage**: Called by `PreviewScene` to render character portraits

#### `disposePreviewCanvas(canvas)`
- **Purpose**: Clean up resources for a preview canvas
- **Parameters**: `canvas` - HTMLCanvasElement to dispose
- **Side Effects**:
  - Disposes render target
  - Disposes renderer
  - Disposes pixelation scene geometry and materials
- **Usage**: Called when character preview is no longer needed

#### `onResize()`
- **Purpose**: Handle window resize for render system
- **Side Effects**:
  - Updates composer size
  - Updates CRT shader resolution uniform (for scanlines)
  - Maintains internal render target at configured resolution
  - Updates all preview canvas renderers
- **Usage**: Automatically called by window resize event listener

### Render Target Management

- **Main Scene**: Single render target at `CONFIG.pixelation.width × height`
- **Preview Scenes**: Separate render targets per canvas (cached in `previewComposers` Map)
- **Resolution**: Preview scenes use 50% resolution for more aggressive pixelation effect

### CRT Shader Integration

- Uses `CRTShader.uniforms` for shader parameters
- Time uniform updated every frame for animated scanlines
- Resolution uniform updated on resize for proper scanline scaling
- Supports curvature, scanline intensity, and RGB shift effects

### Debugging

- Render targets can be inspected: `renderSystem.lowResRenderTarget`
- Preview composers map: `renderSystem.previewComposers` (canvas → render target)
- CRT shader uniforms accessible via: `renderSystem.pixelationQuad.material.uniforms`
- Hit-stop can be tested by passing non-zero value to `render(hitStop)`

---

## ArenaBuilder (`js/core/ArenaBuilder.js`)

**Purpose**: Procedurally constructs the 3D fighting arena environment including floor, walls, lighting, and visual effects.

### Features

- **Modular Construction**: Each arena element created in separate method
- **Canvas-Based Textures**: Generates grid pattern texture programmatically
- **Emissive Materials**: Uses emissive properties for glowing effects
- **Comprehensive Lighting**: Adds corner lights, overhead lights, and light strips
- **Visual Hierarchy**: Multiple boundary rings and glow planes for depth

### Key Methods

#### `buildArena()`
- **Purpose**: Main method that constructs entire arena
- **Process**: Calls all construction methods in order:
  1. `createFloor()` - Ground plane with grid texture
  2. `createBoundaryRings()` - Arena boundary indicators
  3. `createCornerLights()` - Four colored point lights at corners
  4. `createOverheadLights()` - Multiple overhead point lights
  5. `createWalls()` - Transparent arena walls
  6. `createLightStrips()` - Emissive strips on walls
- **Usage**: Called once during scene initialization

#### `createFloor()`
- **Purpose**: Create the arena floor with grid texture
- **Components**:
  - **Main Floor**: 50×50 plane with grid texture (10×10 repeat), receives shadows
  - **Glow Plane**: Subtle white glow plane slightly above floor (5% opacity)
- **Materials**: MeshStandardMaterial with roughness 0.3, metalness 0.4, subtle emissive
- **Usage**: Creates the fighting surface

#### `createBoundaryRings()`
- **Purpose**: Create visual boundary indicators
- **Rings**:
  - **Ring 1**: 15-unit radius, orange/yellow emissive
  - **Ring 2**: 22-unit radius, orange emissive
  - **Ring 3**: 10-unit radius, yellow emissive (subtle)
- **Materials**: All rings use emissive materials with high intensity (0.5-0.8)
- **Usage**: Visual indicators for arena boundaries

#### `createCornerLights()`
- **Purpose**: Add colored point lights at arena corners
- **Lights**: Four point lights (red, green, blue, yellow) positioned at corners
- **Properties**: Intensity 4, range 30 units
- **Usage**: Adds dramatic corner lighting

#### `createOverheadLights()`
- **Purpose**: Add overhead illumination
- **Lights**: Five point lights positioned above arena center and edges
- **Colors**: White, light blue, light pink, light green, light purple
- **Properties**: Intensity 2.5-3.0, range 20 units
- **Usage**: Provides balanced overhead lighting

#### `createWalls()`
- **Purpose**: Create transparent arena walls
- **Walls**: Four walls forming arena perimeter (50×8×1 boxes)
- **Material**: Transparent (40% opacity), dark gray with subtle emissive
- **Usage**: Visual boundaries without blocking camera

#### `createLightStrips()`
- **Purpose**: Add emissive light strips on walls
- **Strips**: Four strips positioned on each wall at height 6
- **Material**: White emissive material (80% intensity)
- **Usage**: Adds ambient lighting and visual interest

#### `createGridCanvas()`
- **Purpose**: Generate grid pattern texture programmatically
- **Process**:
  1. Creates 512×512 canvas
  2. Fills with dark background (#111)
  - Draws grid lines every 64 pixels (#222)
- **Returns**: Canvas element used as texture
- **Usage**: Called by `createFloor()` to generate floor texture

### Material Properties

- **Floor**: Roughness 0.3, metalness 0.4, emissive intensity 0.2
- **Rings**: Emissive intensity 0.5-0.8 (high glow)
- **Walls**: Transparency 0.4, subtle emissive
- **Light Strips**: Emissive intensity 0.8 (bright)

### Debugging

- Arena elements can be inspected in scene: `sceneManager.scene.children`
- Grid texture can be modified by changing `createGridCanvas()` parameters
- Light positions and intensities can be adjusted in respective create methods
- Emissive materials can be toggled for debugging lighting

---

## CameraController (`js/core/CameraController.js`)

**Purpose**: Manages dynamic camera positioning, following both fighters with smooth interpolation and screen shake effects.

### Features

- **Dynamic Following**: Camera follows midpoint between fighters with dynamic zoom
- **Screen Shake**: Applies random offset during combat for impact feedback
- **Cinematic Mode**: Special camera behavior for victory screen
- **Smooth Interpolation**: Uses lerp for smooth camera movement

### Key Methods

#### `update(dt, fighters, gameState)`
- **Purpose**: Update camera position and apply effects every frame
- **Parameters**:
  - `dt` - Delta time (seconds)
  - `fighters` - Array of two Fighter instances
  - `gameState` - Current game state string
- **Process**:
  1. Applies screen shake if active
  2. Decays shake over time
  3. Updates camera position based on game state
- **Usage**: Called every frame in main game loop

#### `updateCameraPosition(dt, fighters, gameState)`
- **Purpose**: Calculate and update camera position based on fighters
- **Gameplay Mode**:
  - Calculates midpoint between fighters
  - Dynamic zoom: base distance + (fighter distance × 0.35)
  - Dynamic height: base height + (fighter distance × 0.08)
  - Looks at chest height (midpoint + 1.5 units up)
  - Uses lerp with speed 5 for smooth following
- **Victory Mode** (gameState === 'OVER'):
  - Zooms in on winner
  - Position: winner position + (0, 1.5, 3.5)
  - Looks at: winner position + (0, 1.5, 0)
- **Usage**: Internal method called by `update()`

#### `addShake(amount)`
- **Purpose**: Add screen shake effect
- **Parameters**: `amount` - Shake intensity (higher = more shake)
- **Side Effects**: Sets shake to maximum of current and new amount
- **Usage**: Called by `CombatSystem` when hits occur
- **Decay**: Shake decreases by `dt * 2` per frame

### Configuration Dependencies

- `CONFIG.cam.dist` - Base camera distance (default: 7.5)
- `CONFIG.cam.height` - Base camera height (default: 2.0)

### Screen Shake Details

- **Heavy Hits**: 0.5 intensity (from `CombatSystem`)
- **Light Hits**: 0.2 intensity
- **Decay Rate**: 2.0 per second (shake -= dt * 2)
- **Application**: Random offset applied to camera X and Y position

### Debugging

- Camera position logged during updates (if debug enabled)
- Shake amount can be inspected: `cameraController.shake`
- Camera position can be manually set for testing: `cameraController.camera.position.set(x, y, z)`
- Lerp speed can be adjusted in `updateCameraPosition()` (currently 5)

---

## LoadingOrchestrator (`js/core/LoadingOrchestrator.js`)

**Purpose**: Orchestrates the loading sequence using the Strategy pattern. Separates loading logic from UI animation concerns.

### Features

- **Strategy Pattern**: Uses `LoadingStrategy` implementations (FirstLoadStrategy, QuickLoadStrategy)
- **Phase Management**: Manages loading phases (particles, title, grid, characters, complete)
- **Callback System**: Provides hooks for phase completion
- **Cancellation Support**: Can cancel loading sequence if needed

### Key Methods

#### `execute()`
- **Purpose**: Execute the loading sequence using configured strategy
- **Returns**: Promise that resolves when loading is complete
- **Process**:
  1. Validates strategy is set
  2. Calls strategy's `execute()` method with orchestrator as parameter
  3. Handles errors (unless cancelled)
- **Usage**: Called from `main.js` after strategy is configured

#### `phase(phaseName, phaseFn)`
- **Purpose**: Execute a loading phase
- **Parameters**:
  - `phaseName` - Phase identifier (particles, title, grid, characters, complete)
  - `phaseFn` - Optional async function to execute for this phase
- **Process**:
  1. Updates current phase
  2. Updates UI state controller if available
  3. Notifies phase change callbacks
  4. Executes phase-specific callbacks
  5. Executes phase function if provided
- **Usage**: Called by strategy implementations

#### `onPhase(phaseName, callback)`
- **Purpose**: Register callback for specific phase
- **Parameters**:
  - `phaseName` - Phase name
  - `callback` - Async function to execute during phase
- **Usage**: Allows external systems to hook into loading phases

#### `createFirstLoad(uiController)` / `createQuickLoad(uiController)`
- **Purpose**: Static factory methods to create orchestrator with specific strategy
- **Parameters**: `uiController` - Optional UIStateController instance
- **Returns**: LoadingOrchestrator instance with strategy configured
- **Usage**: Convenience methods for creating orchestrators

### Phase Callbacks

- `onParticlesReady` - Called when particles phase starts
- `onTitleReady` - Called when title should appear
- `onGridReady` - Called when grid should appear
- `onCharactersReady` - Called when character loading should start
- `onComplete` - Called when loading sequence completes

### Debugging

- Current phase tracked: `orchestrator.currentPhase`
- Phase callbacks can be registered: `orchestrator.onPhase('characters', async () => {...})`
- Cancellation status: `orchestrator.isCancelled()`

---

## LoadingStrategy (`js/core/LoadingStrategy.js`)

**Purpose**: Base class and implementations for different loading approaches. Uses Strategy pattern to separate first-visit animations from quick loads.

### Base Class: `LoadingStrategy`

- **Abstract Method**: `execute(orchestrator)` - Must be implemented by subclasses
- **Purpose**: Defines interface for loading strategies

### FirstLoadStrategy

**Purpose**: Full cinematic loading sequence with animations for first-time visitors.

#### `execute(orchestrator)`
- **Phase 1 (Particles)**: Starts immediately
- **Phase 2 (Title)**: 150ms delay, then title appears
- **Phase 3 (Grid)**: 2650ms delay (2800ms total from start), grid becomes visible
- **Phase 4 (Characters)**: 150ms delay (2950ms total), character loading begins
- **Phase 5 (Complete)**: Loading sequence complete
- **Total Time**: ~3 seconds of animated sequence

### QuickLoadStrategy

**Purpose**: Instant setup without animations for subsequent visits.

#### `execute(orchestrator)`
- **Process**:
  1. Starts particles immediately (no animation wait)
  2. Shows title immediately
  3. Shows grid immediately
  4. Initializes character selector without sequential loading
  5. Sets UI to loaded state immediately
  6. Marks complete immediately
- **Total Time**: Near-instant (50ms delay for UI readiness)

### Strategy Selection

- **First Load**: Used when `storageManager.isFirstVisit()` returns true
- **Quick Load**: Used for subsequent visits or when user preference is set
- **Decision**: Made in `main.js` based on storage state

### Debugging

- Strategy type can be checked: `orchestrator.strategy instanceof FirstLoadStrategy`
- Phase timings can be adjusted in `FirstLoadStrategy.execute()`
- Quick load can be forced for testing by always using `QuickLoadStrategy`

---

## Integration & Dependencies

### Initialization Order

1. **AppStateManager** - Created first (needs StorageManager)
2. **SystemInitializer** - Used to coordinate system initialization
3. **SceneManager** - Initialized early (needed by other systems)
4. **RenderSystem** - Initialized after SceneManager (uses its renderer)
5. **ArenaBuilder** - Initialized after SceneManager (needs scene)
6. **CameraController** - Initialized after SceneManager (needs camera)
7. **LoadingOrchestrator** - Created when loading sequence begins

### Cross-System Communication

- **AppStateManager** → **LoadingOrchestrator**: State transitions
- **LoadingOrchestrator** → **UIStateController**: Phase updates
- **CombatSystem** → **CameraController**: Screen shake requests
- **SceneManager** → **RenderSystem**: Provides renderer, scene, camera
- **RenderSystem** → **PreviewScene**: Renders character previews

### Configuration Dependencies

All core systems depend on `CONFIG` object:
- `CONFIG.cam.*` - Camera settings
- `CONFIG.pixelation.*` - Render resolution
- `CONFIG.animation.*` - Animation timing (used by systems that integrate with Fighter)

---

## Debugging Guide

### Common Issues

1. **Systems Not Initializing**: Check `SystemInitializer` dependency order
2. **Camera Not Following**: Verify `CameraController.update()` is called in game loop
3. **Rendering Issues**: Check `RenderSystem` render target initialization
4. **Loading Hangs**: Verify `LoadingOrchestrator` callbacks are properly set
5. **State Transitions**: Use `AppStateManager.getState()` to debug state machine

### Debug Tools

- **Console Logging**: All state transitions logged to console
- **State Inspection**: `appStateManager.getState()` returns current state
- **System Access**: All systems accessible via bootstrap return value
- **Render Target Inspection**: `renderSystem.lowResRenderTarget` for pixelation debugging


