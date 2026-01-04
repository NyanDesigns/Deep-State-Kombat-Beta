# UI and Systems Documentation

This document provides comprehensive documentation for all UI components, animation systems, character management, utilities, and shaders.

---

## UI Components

### UIManager (`js/ui/UIManager.js`)

**Purpose**: Master coordinator for all UI elements. Manages HUD, Pause Menu, Setup Screen, End Screen, and Debug Panel.

#### Features
- **Centralized UI Control**: Single entry point for all UI operations
- **State Coordination**: Coordinates UI visibility based on game state
- **Debug Integration**: Manages debug panel visibility and options
- **Victory Screen**: Handles end-game victory/defeat/draw display

#### Key Methods

##### `init()`
- **Purpose**: Initialize all UI components
- **Process**: Creates instances of HUD, PauseMenu, DebugPanel and initializes them
- **Usage**: Called during application initialization

##### `showHUD()` / `hideHUD()`
- **Purpose**: Show/hide gameplay HUD (health bars, timer)
- **Usage**: Called when entering/exiting fight state

##### `updateHUD(fighters, timer)`
- **Purpose**: Update HUD with current fighter stats and timer
- **Parameters**: 
  - `fighters` - Array of two Fighter instances
  - `timer` - Current match timer value
- **Usage**: Called every frame during gameplay

##### `showPauseMenu()` / `hidePauseMenu()`
- **Purpose**: Show/hide pause menu overlay
- **Usage**: Called when game is paused/resumed

##### `showVictory(winnerId, winnerFighter, loserFighter)`
- **Purpose**: Display victory screen
- **Parameters**:
  - `winnerId` - 'p1', 'p2', or null (draw)
  - `winnerFighter` - Winning Fighter instance
  - `loserFighter` - Losing Fighter instance (or second fighter for draw)
- **Process**:
  1. Displays end screen with character previews
  2. Shows winner/loser text
  3. Updates character records
  4. Sets up keyboard handlers for restart/back buttons
- **Usage**: Called when match ends

##### `updateDebugPanel(fighters, gameState, timer)`
- **Purpose**: Update debug panel with current game state
- **Usage**: Called every frame when debug panel is visible

##### `showDebugPanel()` / `hideDebugPanel()`
- **Purpose**: Show/hide debug panel
- **Usage**: Called when debug options are toggled

#### Event Callbacks
- `onPauseToggle` - Called when pause should be toggled
- `onRestartFight` - Called when fight should be restarted
- `onMainMenu` - Called when returning to main menu

#### Debugging
- All UI elements accessible via `uiManager.hud`, `uiManager.pauseMenu`, etc.
- Debug panel state: `uiManager.debugPanel.visible`

---

### SetupScreen (`js/ui/SetupScreen.js`)

**Purpose**: Manages the main menu and character selection screen UI.

#### Features
- **Screen Visibility**: Controls setup screen show/hide
- **Start Button**: Manages "Enter Arena" button state
- **State Coordination**: Works with UIStateController for loading phases

#### Key Methods

##### `init()`
- **Purpose**: Initialize setup screen
- **Process**: Sets up button event listeners
- **Usage**: Called during application initialization

##### `show()` / `hide()`
- **Purpose**: Show/hide setup screen
- **Usage**: Called when transitioning to/from setup screen

#### Event Callbacks
- `onStartGame` - Called when "Enter Arena" button is clicked

---

### HUD (`js/ui/HUD.js`)

**Purpose**: Displays real-time gameplay information (health bars, stamina bars, timer, player names).

#### Features
- **Health Bars**: Visual representation of fighter HP
- **Stamina Bars**: Visual representation of fighter stamina
- **Timer Display**: Match countdown timer
- **Player Names**: Displays "PLAYER 1" and "CPU" labels

#### Key Methods

##### `update(fighters, timer)`
- **Purpose**: Update HUD with current values
- **Parameters**:
  - `fighters` - Array of two Fighter instances
  - `timer` - Current match timer
- **Process**:
  1. Updates P1/P2 HP bar widths (0-100% based on maxHp)
  2. Updates P1/P2 stamina bar widths (0-100% based on maxSt)
  3. Updates timer display
- **Usage**: Called every frame during gameplay

#### DOM Elements
- `#p1-hp` - P1 health bar fill element
- `#p1-st` - P1 stamina bar fill element
- `#p2-hp` - P2 health bar fill element
- `#p2-st` - P2 stamina bar fill element
- `#timer` - Timer display element

---

### PauseMenu (`js/ui/PauseMenu.js`)

**Purpose**: Manages the pause menu overlay with resume, restart, and debug options.

#### Features
- **Menu Buttons**: Resume, Restart Fight, Main Menu
- **Debug Options**: Six toggleable debug options (hitboxes, collision box, params, range, timer, inputs)
- **Option Persistence**: Saves debug options to localStorage

#### Key Methods

##### `init(onResume, onRestart, onMainMenu)`
- **Purpose**: Initialize pause menu with callbacks
- **Parameters**: Callback functions for button actions
- **Usage**: Called during application initialization

##### `setupDebugOptions()`
- **Purpose**: Set up debug option checkboxes
- **Process**:
  1. Finds all debug checkboxes in DOM
  2. Sets up change event listeners
  3. Updates `debugOptions` object on change
  4. Calls `onDebugOptionChange` callback
- **Usage**: Called automatically by `init()`

##### `show()` / `hide()`
- **Purpose**: Show/hide pause menu
- **Usage**: Called when game is paused/resumed

##### `getDebugOptions()` / `setDebugOptions(options)`
- **Purpose**: Get/set debug options
- **Usage**: Used to restore saved debug preferences

#### Debug Options
- `hitboxes` - Show attack/hurt hitboxes
- `collisionBox` - Show collision boundaries
- `params` - Show fighter parameters (HP, ST, state, distance)
- `range` - Show attack range circles
- `timer` - Show frame data (animation timing)
- `inputs` - Show input log and combo state

---

### CharacterSelector (`js/ui/CharacterSelector.js`)

**Purpose**: Manages the 2×3 character selection grid with previews, hover effects, and custom model loading.

#### Features
- **Fixed Grid Layout**: 2 rows × 3 columns layout
  - Row 0: Trump, Random, Brandon
  - Row 1: Epstein, Add New, Obama
- **Character Cards**: Visual cards with thumbnails, names, stats
- **Preview System**: 3D character previews on hover
- **Random Selection**: Random character selection card
- **Custom Model Loading**: File input for custom GLB models
- **Keyboard Navigation**: Arrow key navigation through grid
- **Sequential Loading**: Staggered character card loading for first visit
- **Record Tracking**: Win/loss records per character

#### Key Methods

##### `init(loadingManager, onComplete)`
- **Purpose**: Initialize character selector
- **Parameters**:
  - `loadingManager` - Optional loading manager for sequential loading
  - `onComplete` - Callback when initialization complete
- **Process**:
  1. Sets up custom file inputs
  2. Sets up clear buttons
  3. Sets up keyboard navigation
  4. Loads characters (sequential or immediate)
- **Usage**: Called during loading sequence

##### `loadCharactersSequentially(loadingManager, onComplete)`
- **Purpose**: Load character cards with staggered delays
- **Process**:
  1. Creates skeleton placeholders for all cards
  2. Loads characters one at a time with delays
  3. Updates cards as they load
  4. Calls completion callback when done
- **Usage**: Used for first-visit loading animations

##### `createCharacterGrid()`
- **Purpose**: Create the character selection grid
- **Process**:
  1. Creates grid structure
  2. Creates character cards, random card, and add-new card
  3. Sets up hover and click handlers
  4. Updates start button state
- **Usage**: Called during initialization

##### `selectCharacter(playerSlot, characterId)`
- **Purpose**: Select a character for a player slot
- **Parameters**:
  - `playerSlot` - 'p1' or 'p2'
  - `characterId` - Character ID string
- **Process**:
  1. Updates selected character
  2. Updates card visual state
  3. Updates character preview
  4. Updates start button
  5. Calls `onCharacterSelected` callback
- **Usage**: Called when character card is clicked

##### `clearSelection(playerSlot)`
- **Purpose**: Clear character selection for a player slot
- **Parameters**: `playerSlot` - 'p1' or 'p2'
- **Process**:
  1. Clears selected character
  2. Resets card visual state
  3. Hides character preview
  4. Updates start button
- **Usage**: Called when ESC is pressed or returning to menu

##### `getSelectedCharacters()`
- **Purpose**: Get currently selected characters
- **Returns**: Object with `p1` and `p2` character configs
- **Usage**: Called when starting match

##### `setupKeyboardNavigation()`
- **Purpose**: Set up arrow key navigation
- **Process**:
  1. Binds arrow key handlers
  2. Handles focus movement
  3. Handles Enter key selection
  4. Handles ESC key deselection
- **Usage**: Called during initialization

#### Special Cards

##### Random Selection Card
- **Purpose**: Randomly selects a character when clicked
- **Behavior**: Cycles through available characters randomly

##### Add New Character Card
- **Purpose**: Opens file input for custom GLB model
- **Behavior**: Allows users to load custom character models

#### Character Card Features
- **Thumbnail**: Character portrait image
- **Name Display**: Character name
- **Stats Display**: HP, Stamina, Speed (on hover)
- **Record Display**: Win/loss record (on hover)
- **Difficulty Badge**: Beginner/Intermediate/Advanced
- **Hover Effects**: 3D preview, stat display, glow effect
- **Selection State**: Visual indication when selected

#### Debugging
- **Grid Layout**: `characterSelector.gridLayout` shows current layout
- **Selected Characters**: `characterSelector.selectedCharacters` shows current selections
- **Keyboard Focus**: `characterSelector.keyboardFocusPosition` shows current focus

---

### PreviewScene (`js/ui/PreviewScene.js`)

**Purpose**: Renders 3D character previews for the selection grid and background previews.

#### Features
- **Character Portraits**: 3D rendered character previews for grid cards
- **Background Previews**: Full-screen PNG background previews (not 3D)
- **Camera Setup**: Automatic camera positioning to frame character
- **Render Integration**: Works with RenderSystem for pixelation effects

#### Key Methods

##### `init()`
- **Purpose**: Initialize preview scene
- **Process**: Sets up render system reference
- **Usage**: Called during application initialization

##### `updateCharacterPreview(cellId, characterId, characterConfig)`
- **Purpose**: Update character preview for a grid cell
- **Parameters**:
  - `cellId` - Grid cell identifier
  - `characterId` - Character ID
  - `characterConfig` - Character configuration object
- **Process**:
  1. Loads character model if not already loaded
  2. Sets up camera to frame character (head-focused)
  3. Renders to cell canvas with pixelation
  4. Handles errors gracefully
- **Usage**: Called when character card is created or updated

##### `updateBackgroundPreview(playerSlot, characterId, characterConfig)`
- **Purpose**: Update background PNG preview (not 3D)
- **Parameters**:
  - `playerSlot` - 'p1' or 'p2'
  - `characterId` - Character ID
  - `characterConfig` - Character configuration
- **Process**:
  1. Gets PNG image path from character config
  2. Updates background image element
  3. Applies slide-in animation
- **Usage**: Called when character is selected

##### `update()`
- **Purpose**: Update preview scene (for animated previews)
- **Usage**: Called every frame in main loop

#### Camera Setup
- **Position**: (0, 1.2, 1.8) - Slightly above and in front
- **Look At**: (0, 2.0, 0) - Character head level
- **FOV**: Matches main camera FOV
- **Framing**: Automatically calculates distance to fit character in frame

---

### LoadingScreen (`js/ui/LoadingScreen.js`)

**Purpose**: Displays tutorial controls and loading progress during initial asset loading.

#### Features
- **Tutorial Display**: Shows movement, attack, and navigation controls
- **Progress Bar**: Visual loading progress indicator
- **Enter Key Wait**: Waits for user to press Enter before proceeding

#### Key Methods

##### `init()`
- **Purpose**: Initialize loading screen
- **Usage**: Called during application initialization

##### `show()`
- **Purpose**: Show loading screen
- **Usage**: Called during tutorial sequence

##### `hide()`
- **Purpose**: Hide loading screen
- **Usage**: Called after tutorial completes

##### `updateProgress(percentage)`
- **Purpose**: Update loading progress bar
- **Parameters**: `percentage` - Progress value (0-100)
- **Usage**: Called during character model loading

##### `waitForEnter()`
- **Purpose**: Wait for user to press Enter key
- **Returns**: Promise that resolves when Enter is pressed
- **Usage**: Called after loading completes to wait for user input

---

### UIStateController (`js/ui/UIStateController.js`)

**Purpose**: Centralized UI state management. Controls visibility states, CSS classes, and UI transitions.

#### Features
- **Loading Phases**: Manages loading phase CSS classes
- **Element Caching**: Caches DOM element references for performance
- **Animation Coordination**: Coordinates UI element animations

#### Key Methods

##### `setLoadingPhase(phase)`
- **Purpose**: Set loading phase and update CSS classes
- **Parameters**: `phase` - Phase name (particles, title, grid, characters, complete)
- **Process**: Adds/removes CSS classes on setup screen
- **Usage**: Called by LoadingOrchestrator

##### `setLoadedState()`
- **Purpose**: Set UI to fully loaded state (skip animations)
- **Process**: Instantly shows all elements in final state
- **Usage**: Called by QuickLoadStrategy

##### `showTitle()` / `showGrid()` / `showInfoPanel()` / `showChooseFighterText()` / `showBackgroundPNGs()`
- **Purpose**: Show specific UI elements with animations
- **Usage**: Called by LoadingOrchestrator during first load sequence

#### Loading Phases
- `particles` - Fire particles start
- `title` - Title appears
- `grid` - Character grid becomes visible
- `characters` - Character loading begins
- `complete` - All loading complete

---

### DebugPanel (`js/ui/DebugPanel.js`)

**Purpose**: Renders Tekken-style debug information overlay.

#### Features
- **Fighter Data**: HP, Stamina, State, Distance
- **Animation Data**: Current animation name and timing
- **Input/Combo Data**: Recent inputs and combo state
- **Config Values**: Base combat stats

#### Key Methods

##### `update(fighters, gameState, timer)`
- **Purpose**: Update debug panel content
- **Parameters**:
  - `fighters` - Array of two Fighter instances
  - `gameState` - Current game state
  - `timer` - Match timer
- **Process**: Generates HTML with color-coded information
- **Usage**: Called every frame when visible

##### `setOptions(options)`
- **Purpose**: Set which debug options are enabled
- **Parameters**: `options` - Object with boolean flags (params, timer, inputs)
- **Usage**: Called when debug options change

##### `show()` / `hide()`
- **Purpose**: Show/hide debug panel
- **Usage**: Called automatically based on debug options

#### Color Coding
- **Green (#0f0)**: P1 data
- **Red (#f00)**: P2 data
- **Yellow (#ff0)**: Timer
- **Cyan (#0ff)**: Distance

---

## Animation Systems

### AnimationController (`js/systems/AnimationController.js`)

**Purpose**: Centralized animation management with priority-based layer system.

#### Features
- **Base Locomotion Layer**: Always-running idle/walk blend (prevents floor clipping)
- **Action Layer**: One-shot animations (attacks, hit, jump) with priorities
- **Crossfade Transitions**: Smooth blending between animations
- **Animation Events**: Automatic return to base layer on completion
- **Priority System**: Higher priority animations interrupt lower priority

#### Key Methods

##### `updateLocomotionBlend(speedNormalized, direction)`
- **Purpose**: Update idle/walk blend based on movement speed
- **Parameters**:
  - `speedNormalized` - Normalized speed (0-1)
  - `direction` - Movement direction (1 = forward, -1 = backward)
- **Process**:
  1. Calculates blend weights via LocomotionBlender
  2. Applies weights to idle and walk actions
  3. Sets walk timeScale for direction (forward/backward)
- **Usage**: Called every frame during movement

##### `playOneShot(name, fadeIn, fadeOut, options)`
- **Purpose**: Play a one-shot animation with priority
- **Parameters**:
  - `name` - Animation name
  - `fadeIn` - Fade-in time (seconds)
  - `fadeOut` - Fade-out time (seconds)
  - `options` - Object with priority, timeScale, clamp, loop, etc.
- **Returns**: AnimationAction or null if can't play
- **Process**:
  1. Checks if animation can interrupt current action (priority check)
  2. Fades out current action
  3. Fades in new action
  4. Sets up finished event listener
  5. Returns to base layer when complete
- **Usage**: Called for attacks, hits, jumps, etc.

##### `update(dt)`
- **Purpose**: Update animation controller
- **Parameters**: `dt` - Delta time (seconds)
- **Process**: Updates mixer (handled by Fighter.update())
- **Usage**: Called every frame

##### `getCurrentAnimation()` / `getCurrentPriority()` / `getCurrentAnimationState()`
- **Purpose**: Get current animation information
- **Returns**: AnimationAction, priority number, or state string
- **Usage**: Used for debugging and AI decision making

#### Priority System
- **DEAD**: 100 (highest)
- **HIT**: 90
- **ATK2**: 50
- **ATK1**: 40
- **JUMP**: 30
- **CROUCH**: 30
- **LOCOMOTION**: 10 (lowest)

#### Crossfade Times
- `toAttack`: 0.12s
- `toHit`: 0.08s
- `toBase`: 0.20s
- `withinCombo`: 0.05s
- `toJump`: 0.08s
- `toCrouch`: 0.05s

---

### AnimationStateMachine (`js/systems/AnimationStateMachine.js`)

**Purpose**: Tracks animation state history and validates state transitions.

#### Features
- **State History**: Tracks previous animation states
- **Transition Validation**: Prevents invalid state transitions
- **Debugging Support**: State history for debugging animation issues

#### Key Methods

##### `setCurrentState(state)`
- **Purpose**: Set current animation state
- **Parameters**: `state` - State string
- **Process**: Updates current state and adds to history
- **Usage**: Called by AnimationController

##### `getCurrentState()` / `getPreviousState()`
- **Purpose**: Get current or previous state
- **Returns**: State string
- **Usage**: Used for debugging

---

### AnimationMixer (`js/systems/AnimationMixer.js`)

**Purpose**: Wrapper for Three.js AnimationMixer with additional functionality.

#### Features
- **Mixer Management**: Manages single AnimationMixer per fighter
- **Action Management**: Tracks and manages animation actions

---

### LocomotionBlender (`js/systems/LocomotionBlender.js`)

**Purpose**: Smooth blending between idle and walk animations.

#### Features
- **Weight-Based Blending**: Calculates blend weights based on speed
- **Direction Awareness**: Handles forward/backward via timeScale
- **Floor Clipping Prevention**: Always keeps base layer active (minBaseWeight)

#### Key Methods

##### `blend(idleAction, walkAction, speedNormalized, direction, walkPlaybackSpeed)`
- **Purpose**: Blend idle and walk animations
- **Parameters**:
  - `idleAction` - Idle animation action
  - `walkAction` - Walk animation action
  - `speedNormalized` - Normalized speed (0-1)
  - `direction` - Movement direction (1 = forward, -1 = backward)
  - `walkPlaybackSpeed` - Base playback speed for walk
- **Process**:
  1. Calculates blend weights
  2. Applies weights to actions
  3. Sets walk timeScale for direction
- **Usage**: Called by AnimationController

##### `getBlendWeights(speedNormalized)`
- **Purpose**: Calculate blend weights
- **Returns**: Object with `idle` and `walk` weights
- **Process**: Ensures minBaseWeight (0.1) to prevent floor clipping

---

### MotionController (`js/systems/MotionController.js`)

**Purpose**: Smooth velocity-based movement with acceleration and damping.

#### Features
- **Velocity Accumulation**: Smooth acceleration toward desired velocity
- **Damping**: Exponential decay when no input
- **Rotation Smoothing**: Quaternion slerp for rotation
- **Speed Normalization**: Provides normalized speed for locomotion blending

#### Key Methods

##### `update(dt, desiredVelocity, currentPosition)`
- **Purpose**: Update motion controller
- **Parameters**:
  - `dt` - Delta time (seconds)
  - `desiredVelocity` - Desired velocity vector
  - `currentPosition` - Current position
- **Process**:
  1. Accelerates toward desired velocity (exponential interpolation)
  2. Applies damping if no input
  3. Clamps to max speed
  4. Updates position based on velocity
- **Usage**: Called every frame during movement

##### `updateRotation(currentQuat, targetQuat, dt, turnSpeed)`
- **Purpose**: Smoothly rotate toward target
- **Parameters**:
  - `currentQuat` - Current quaternion
  - `targetQuat` - Target quaternion
  - `dt` - Delta time
  - `turnSpeed` - Turn speed (optional)
- **Process**: Uses quaternion slerp for smooth rotation
- **Usage**: Called every frame to face opponent

##### `getNormalizedSpeed()`
- **Purpose**: Get normalized speed (0-1) for locomotion blending
- **Returns**: Number (0-1)
- **Usage**: Used by LocomotionBlender

#### Configuration
- `acceleration`: 12.0 (how fast to reach desired speed)
- `damping`: 8.0 (how fast to slow down)
- `turnSpeed`: 10.0 (how fast to rotate)
- `maxSpeed`: Character's moveSpeed

---

## Character Management

### CharacterManager (`js/characters/CharacterManager.js`)

**Purpose**: Central registry for characters. Handles loading and management of character data.

#### Features
- **Character Registry**: Map of character ID → config
- **Model Caching**: Caches loaded GLB models to prevent re-loading
- **Config Loading**: Loads character JSON configurations
- **Fallback System**: Falls back to default character if model fails to load

#### Key Methods

##### `initialize()`
- **Purpose**: Initialize character manager by loading all character configs
- **Process**:
  1. Iterates through CHARACTERS registry
  2. Loads each character's JSON config
  3. Registers characters in internal map
- **Usage**: Called during application initialization

##### `registerCharacter(config)`
- **Purpose**: Register a character configuration
- **Parameters**: `config` - Character configuration object
- **Usage**: Called during initialization or for custom characters

##### `getCharacter(id)` / `getAllCharacters()`
- **Purpose**: Get character config by ID or all characters
- **Returns**: Character config object or array
- **Usage**: Used by CharacterSelector to display characters

##### `loadCharacter(id)`
- **Purpose**: Load character model (GLB file)
- **Parameters**: `id` - Character ID
- **Returns**: Promise resolving to `{ config, model }`
- **Process**:
  1. Gets character config from registry
  2. Checks if model already loaded (returns cached)
  3. Loads GLB model via CharacterLoader
  4. Caches model for future use
  5. Falls back to default character if load fails
- **Usage**: Called when spawning fighters

##### `isCharacterLoaded(id)`
- **Purpose**: Check if character model is loaded
- **Returns**: Boolean
- **Usage**: Used to prevent re-loading

---

### CharacterLoader (`js/characters/CharacterLoader.js`)

**Purpose**: Low-level wrapper for GLTFLoader with error handling.

#### Features
- **GLB Loading**: Loads GLB/GLTF files via Three.js GLTFLoader
- **Config Loading**: Loads character JSON configuration files
- **Error Handling**: Graceful error handling with fallbacks

#### Key Methods

##### `loadCharacterModel(modelPath)`
- **Purpose**: Load GLB model file
- **Parameters**: `modelPath` - Path to GLB file
- **Returns**: Promise resolving to GLTF object
- **Usage**: Called by CharacterManager

##### `loadCharacterConfig(configPath)`
- **Purpose**: Load character JSON configuration
- **Parameters**: `configPath` - Path to JSON file
- **Returns**: Promise resolving to config object
- **Usage**: Called by CharacterManager

---

### CharacterConfig (`js/characters/CharacterConfig.js`)

**Purpose**: Character configuration schema and validation.

#### Features
- **Schema Definition**: Defines required and optional fields
- **Validation**: Validates character configs against schema
- **Default Merging**: Merges configs with defaults
- **Type Checking**: Validates field types and ranges

#### Key Methods

##### `validate(config)`
- **Purpose**: Validate character configuration
- **Parameters**: `config` - Character config object
- **Returns**: Object with `valid` (boolean) and `errors` (array)
- **Usage**: Called before registering characters

##### `mergeWithDefaults(config)`
- **Purpose**: Merge config with default values
- **Parameters**: `config` - Character config object
- **Returns**: Merged config object
- **Usage**: Called when loading character configs

##### `createDefault(id, name)`
- **Purpose**: Create default character configuration
- **Parameters**: `id`, `name` - Character identifier and name
- **Returns**: Default config object
- **Usage**: Used for fallback or new character creation

---

### characters.js (`js/characters/characters.js`)

**Purpose**: Static registry of available preset characters.

#### Exports
- `CHARACTERS`: Array of character definitions with paths
- `BRANDON`, `EPSTEIN`, `OBAMA`, `TRUMP`: Individual character exports

#### Character Definition Structure
```javascript
{
    id: 'character-id',
    name: 'Character Name',
    configPath: 'path/to/character.json',
    modelPath: 'path/to/model.glb',
    thumbnail: null // or path to thumbnail
}
```

---

## Utility Systems

### HitboxSystem (`js/utils/HitboxSystem.js`)

**Purpose**: Manages attack hitboxes and hurtboxes using sphere-based collision.

#### Features
- **Hurt Spheres**: Head and torso hurtboxes (always active except during invulnerability)
- **Attack Spheres**: Four spheres per attack type (hands: fist+elbow, legs: foot+knee)
- **Bone-Based Positioning**: Uses bone world positions for accurate hitbox placement
- **Fallback System**: Estimates positions if bones not found
- **Active Windows**: Only activates hitboxes during attack windows

#### Key Methods

##### `updateHurtSpheres(fighter)`
- **Purpose**: Update head and torso hurtbox positions
- **Parameters**: `fighter` - Fighter instance
- **Process**:
  1. Gets bone world positions for head and torso
  2. Applies offsets (head +0.15, torso +0.05)
  3. Disables head hurtbox if crouched
  4. Disables torso hurtbox during jump invulnerability
- **Usage**: Called every frame for each fighter

##### `updateAttackSpheres(fighter)`
- **Purpose**: Update attack hitbox positions
- **Parameters**: `fighter` - Fighter instance
- **Process**:
  1. Checks if fighter is in ATTACK state
  2. Calculates animation progress ratio
  3. Checks if within hit window
  4. Updates active attack spheres (hands or legs)
  5. Disables all spheres if outside window
- **Usage**: Called every frame for each fighter

##### `updateHandSpheres(fighter, activeIndices)` / `updateLegSpheres(fighter, activeIndices)`
- **Purpose**: Update hand or leg attack spheres
- **Parameters**:
  - `fighter` - Fighter instance
  - `activeIndices` - Array of which spheres to update (0-3)
- **Process**:
  1. Gets bone world positions for hands/feet and elbows/knees
  2. Falls back to estimated positions if bones not found
  3. Updates sphere centers
- **Usage**: Called by `updateAttackSpheres()`

##### `disableAttackSpheres(fighter)`
- **Purpose**: Disable all attack spheres
- **Process**: Moves all spheres to Infinity to disable them
- **Usage**: Called when outside hit window or not attacking

#### Sphere Indices
- **Hands**: [0] left fist, [1] left elbow, [2] right fist, [3] right elbow
- **Legs**: [0] left foot, [1] left knee, [2] right foot, [3] right knee

---

### BoneDiscovery (`js/utils/BoneDiscovery.js`)

**Purpose**: Automatically discovers and maps bones from character skeletons.

#### Features
- **Mixamo Support**: Recognizes standard Mixamo bone naming conventions
- **Fallback Patterns**: Multiple name patterns for each bone type
- **World Position Calculation**: Gets bone world positions accounting for animations

#### Key Methods

##### `discoverBones(skeleton)`
- **Purpose**: Discover bones from skeleton
- **Parameters**: `skeleton` - Three.js Skeleton instance
- **Returns**: Object mapping bone type → Bone instance
- **Bone Types**: head, spine, handLeft, handRight, footLeft, footRight, forearmLeft, forearmRight, shinLeft, shinRight
- **Process**:
  1. Searches through all bones
  2. Matches against name patterns (case-insensitive)
  3. Returns first match for each bone type
- **Usage**: Called during Fighter construction

##### `getBoneWorldPosition(bone)`
- **Purpose**: Get bone's world position
- **Parameters**: `bone` - Three.js Bone instance
- **Returns**: THREE.Vector3 world position
- **Process**:
  1. Updates bone's world matrix
  2. Gets world position
  3. Handles errors gracefully
- **Usage**: Called by HitboxSystem

##### `isValidPosition(pos)`
- **Purpose**: Validate position vector
- **Parameters**: `pos` - THREE.Vector3
- **Returns**: Boolean
- **Usage**: Used to check if bone positions are valid

---

## Shader Systems

### CRTShader (`js/shaders/CRTShader.js`)

**Purpose**: Retro CRT monitor effect shader with scanlines, curvature, and chromatic aberration.

#### Features
- **CRT Curvature**: Barrel distortion effect
- **Scanlines**: Horizontal scanline pattern
- **RGB Shift**: Chromatic aberration effect
- **Flicker**: Subtle time-based flicker
- **Brightness/Contrast**: Post-processing adjustments

#### Uniforms
- `tDiffuse`: Input texture (low-res render target)
- `time`: Elapsed time for animated effects
- `resolution`: Screen resolution (for scanline scaling)
- `curvature`: Curvature amount (default: 0.1)
- `scanlineIntensity`: Scanline intensity (default: 0.15)
- `rgbShift`: RGB shift amount (default: 0.002)

#### Shader Effects

##### Curvature
- Applies barrel distortion based on distance from center
- Formula: `coord * (1.0 + curvature * dist * dist)`

##### RGB Shift
- Shifts red channel right, blue channel left
- Creates chromatic aberration effect

##### Scanlines
- Horizontal sine wave pattern
- Power function for sharper lines
- Reduces brightness slightly

##### Flicker
- Subtle time-based brightness variation
- Formula: `1.0 + sin(time * 10.0) * 0.01`

##### Post-Processing
- Brightness boost: `color *= 1.5`
- Gamma correction: `pow(color, vec3(0.92))`
- Contrast adjustment: `color * 1.03 + vec3(0.01)`

---

## Additional Systems

### InputHandler (`js/systems/InputHandler.js`)

**Purpose**: Captures and buffers keyboard events.

#### Features
- **Key State Tracking**: Tracks pressed and just-pressed keys
- **Edge Detection**: Detects key press events (not just held)
- **Callback System**: Provides callbacks for pause and escape actions

#### Key Methods

##### `getKeys()`
- **Purpose**: Get current key states
- **Returns**: Object mapping key names to boolean values
- **Usage**: Called every frame to check inputs

##### `clearJustPressed()`
- **Purpose**: Clear just-pressed flags (called at end of frame)
- **Usage**: Called every frame after input processing

##### `clearKeys()`
- **Purpose**: Clear all key states
- **Usage**: Called when transitioning states

---

### StorageManager (`js/systems/StorageManager.js`)

**Purpose**: Provides localStorage persistence layer.

#### Features
- **Game Settings**: Saves debug options and preferences
- **Character Records**: Tracks win/loss records per character
- **Tutorial Status**: Tracks if tutorial has been seen
- **Session Tracking**: Detects first visit vs subsequent visits

#### Key Methods

##### `saveGameSettings(settings)`
- **Purpose**: Save game settings to localStorage
- **Parameters**: `settings` - Object with settings (debug options, etc.)

##### `loadGameSettings()`
- **Purpose**: Load game settings from localStorage
- **Returns**: Settings object or null

##### `saveCharacterRecord(characterId, wins, losses)`
- **Purpose**: Save character win/loss record
- **Parameters**: Character ID, wins count, losses count

##### `loadCharacterRecord(characterId)`
- **Purpose**: Load character record
- **Returns**: Object with wins and losses

##### `hasSeenTutorial()` / `markTutorialComplete()`
- **Purpose**: Track tutorial completion status

##### `isFirstVisit()`
- **Purpose**: Check if this is first visit
- **Returns**: Boolean

---

### EffectsSystem (`js/systems/EffectsSystem.js`)

**Purpose**: Manages visual effects like damage numbers and hit sparks.

#### Features
- **Damage Numbers**: Floating damage text
- **Hit Effects**: Visual feedback for hits
- **Camera Reference**: Needs camera for positioning

#### Key Methods

##### `spawnDamage(damage, position, isCritical)`
- **Purpose**: Spawn damage number effect
- **Parameters**:
  - `damage` - Damage amount
  - `position` - World position
  - `isCritical` - Boolean for critical hit styling

##### `update(dt)`
- **Purpose**: Update effects system
- **Parameters**: `dt` - Delta time
- **Process**: Updates and removes expired effects

---

### FireParticleSystem (`js/systems/FireParticleSystem.js`)

**Purpose**: CPU-based particle system for fire effects in background.

#### Features
- **Canvas-Based**: Uses HTML5 Canvas (not WebGL)
- **Dual Layers**: Back and front particle layers
- **Performance**: Optimized for many particles

#### Key Methods

##### `start()`
- **Purpose**: Start particle animation
- **Usage**: Called when setup screen is shown

##### `stop()`
- **Purpose**: Stop particle animation
- **Usage**: Called when leaving setup screen

---

### ImagePreloader (`js/systems/ImagePreloader.js`)

**Purpose**: Preloads and caches character portrait images.

#### Features
- **Image Caching**: Caches images in localStorage
- **Variant Support**: Handles multiple image variants (T, P1, P2, D, V, S)
- **Progress Tracking**: Provides progress callbacks

#### Key Methods

##### `preloadAllImages(characters, onProgress)`
- **Purpose**: Preload all character images
- **Parameters**:
  - `characters` - Array of character configs
  - `onProgress` - Optional progress callback
- **Process**: Loads and caches all character portrait variants

##### `getImage(characterId, variant)`
- **Purpose**: Get cached image
- **Parameters**: Character ID and variant string
- **Returns**: Image element or null

---

## System Integration

### UI ↔ Game Systems
- **UIManager** updates HUD based on Fighter stats
- **CharacterSelector** uses CharacterManager to load characters
- **PreviewScene** uses RenderSystem for rendering

### Animation ↔ Fighter
- **AnimationController** manages Fighter's animations
- **MotionController** provides movement for Fighter
- **LocomotionBlender** blends animations based on Fighter velocity

### Character ↔ Game
- **CharacterManager** loads characters for Fighter construction
- **CharacterLoader** loads GLB models and JSON configs
- **CharacterConfig** validates character data

### Utilities ↔ Game
- **HitboxSystem** updates Fighter hitboxes every frame
- **BoneDiscovery** maps bones during Fighter construction
- **StorageManager** persists game state and records

---

## Debugging Guide

### UI Debugging
- **Element Inspection**: All UI elements accessible via UIManager properties
- **State Inspection**: Check UIStateController current phase
- **Character Selection**: Check CharacterSelector.selectedCharacters

### Animation Debugging
- **Current Animation**: `fighter.animationController.getCurrentAnimation()`
- **Animation State**: `fighter.animationController.getCurrentAnimationState()`
- **Priority**: `fighter.animationController.getCurrentPriority()`

### Character Debugging
- **Loaded Characters**: `characterManager.getAllCharacters()`
- **Cached Models**: `characterManager.loadedModels` Map
- **Config Validation**: Use CharacterConfig.validate() to check configs

### Hitbox Debugging
- **Visualization**: Enable via `fighter.setHitboxVisibility(true)`
- **Sphere Positions**: Check `fighter.hurtSpheres` and `fighter.attackSpheres`
- **Bone Positions**: Use BoneDiscovery.getBoneWorldPosition() to verify bone positions

### Shader Debugging
- **Uniform Values**: Check `renderSystem.pixelationQuad.material.uniforms`
- **Effect Intensity**: Adjust CRTShader uniform values
- **Render Target**: Inspect `renderSystem.lowResRenderTarget` for pixelation


