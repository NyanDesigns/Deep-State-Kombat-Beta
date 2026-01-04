# Game Systems Documentation

This document provides comprehensive documentation for all game systems that handle combat logic, physics, match state, and character behavior.

---

## Fighter (`js/game/Fighter.js`) - The "F3" Core Implementation

**Purpose**: The core class for all characters in the game. Manages character stats, movement logic, animation state, input processing, hitboxes, and AI integration. This is the most complex and critical class in the game system.

### Features

- **Character Stats**: HP, stamina, movement speed, weight
- **Animation System**: Integration with AnimationController, LocomotionBlender, and AnimationStateMachine
- **Movement System**: Velocity-based movement via MotionController with acceleration and damping
- **Combat System**: Attack execution, combo system, hit detection integration
- **Hitbox System**: Dynamic hitbox/hurtbox management via HitboxSystem
- **AI Integration**: Optional AIController for CPU opponents
- **Input Processing**: Keyboard input handling for player-controlled fighters
- **State Machine**: Internal state management (IDLE, WALK, ATTACK, JUMP, STUN, DEAD, etc.)

### Key Properties

#### Character Data
- `id`: Fighter identifier ('p1' or 'p2')
- `isAI`: Boolean indicating if fighter is CPU-controlled
- `characterConfig`: Character JSON configuration object
- `mesh`: Three.js mesh (cloned from GLB model)
- `bones`: Discovered bone references (head, torso, hands, legs, etc.)

#### Stats
- `hp` / `maxHp`: Current and maximum health points
- `st` / `maxSt`: Current and maximum stamina
- `moveSpeed`: Movement speed multiplier
- `collisionRadius`: Physical collision radius
- `collisionHeight`: Physical collision height

#### Animation System
- `mixer`: Three.js AnimationMixer instance
- `actions`: Map of animation name → AnimationAction
- `animationController`: AnimationController instance (priority-based system)
- `animationStateMachine`: AnimationStateMachine instance (state tracking)
- `locomotionBlender`: LocomotionBlender instance (idle/walk blending)
- `currAct`: Current active animation action (for backward compatibility)

#### Movement System
- `motionController`: MotionController instance (velocity-based movement)
- `desiredVelocity`: THREE.Vector3 representing desired movement direction
- `moveDirection`: Movement direction (1 = forward, -1 = backward, 0 = none)

#### Combat System
- `state`: Current fighter state (IDLE, WALK, ATTACK, JUMP, STUN, DEAD, etc.)
- `atkType`: Current attack type ('leftHand', 'rightHand', 'leftLeg', 'rightLeg')
- `atkGroup`: Attack group ('hands' or 'legs')
- `activeAttackIndices`: Array of which attack spheres are active
- `hitRegistered`: Boolean to prevent double-hit registration
- `jumpInvulnerabilityTimer`: Timer for jump invulnerability frames

#### Combo System
- `comboCount`: Current combo hit count
- `maxCombo`: Maximum combo hits allowed
- `comboWindowOpen`: Boolean indicating if combo window is active
- `comboWindowStart` / `comboWindowEnd`: Combo window timing (animation ratio)
- `comboQueuedType`: Queued attack type for combo linking
- `inputLog`: Array of recent inputs for combo tracking

#### Hitboxes
- `hurtSpheres`: Object with `head` and `torso` THREE.Sphere instances
- `attackSpheres`: Object with `hands` and `legs` arrays of THREE.Sphere instances
- `baseHurtRadii`: Base radii for hurtboxes (before state modifications)
- `hitboxVisualization`: Three.js Group for debug visualization
- `collisionBoxVisualization`: Three.js Group for collision debug visualization

#### AI System
- `aiController`: AIController instance (only for AI fighters)

### Key Methods

#### Constructor
```javascript
constructor(id, pos, isAI, gltf, scene, characterConfig = null)
```
- **Purpose**: Initialize fighter with model, stats, and systems
- **Process**:
  1. Sets up character stats from config or defaults
  2. Clones GLB model using SkeletonUtils
  3. Normalizes scale based on character config
  4. Discovers bones via BoneDiscovery
  5. Initializes hitbox system
  6. Sets up animation mixer
  7. Initializes motion controller
  8. Creates debug visualizations
- **Usage**: Called when spawning fighters in `main.js`

#### `loadAnimations(clips = [])`
- **Purpose**: Load and register all animation clips from GLB
- **Parameters**: `clips` - Array of THREE.AnimationClip instances
- **Process**:
  1. Loads animations with fallback name matching
  2. Registers idle, walk, attacks (punchL/R, kickL/R), jump, crouch, hit, win, die
  3. Initializes animation system components
  4. Starts with idle animation
- **Usage**: Called after GLB model loads

#### `initializeAnimationSystem()`
- **Purpose**: Set up animation controller, state machine, and locomotion blender
- **Process**:
  1. Creates AnimationController with config priorities
  2. Creates AnimationStateMachine for state tracking
  3. Creates LocomotionBlender for idle/walk blending
- **Note**: Character config playbackSpeed NOT passed here (handled in Fighter methods)

#### `update(dt, opp, gameState, keys, camera, collisionSystem, inputHandler)`
- **Purpose**: Main update method called every frame
- **Parameters**:
  - `dt` - Delta time (seconds)
  - `opp` - Opponent Fighter instance
  - `gameState` - Current game state string
  - `keys` - Keyboard input object
  - `camera` - Camera reference (optional)
  - `collisionSystem` - CollisionSystem instance
  - `inputHandler` - InputHandler instance
- **Process**:
  1. Updates animation controller and mixer
  2. Updates jump invulnerability timer
  3. Processes combo queuing for player fighters
  4. Updates motion controller for movement
  5. Updates locomotion blend based on velocity
  6. Smoothly rotates toward opponent
  7. Updates world matrices
  8. Updates collision capsule
  9. Updates hitboxes
  10. Updates debug visualizations
  11. Processes AI decisions (if AI fighter)
  12. Processes player input (if player fighter)
- **Usage**: Called every frame in main game loop

#### `attack(type)`
- **Purpose**: Execute an attack
- **Parameters**: `type` - Attack type ('leftHand', 'rightHand', 'leftLeg', 'rightLeg', 'light', 'heavy')
- **Process**:
  1. **Immediately** sets state to 'ATTACK' (prevents double attacks)
  2. Checks stamina cost
  3. Determines animation to play (with fallback logic)
  4. Sets attack type and group
  5. Determines active attack indices
  6. Plays animation via AnimationController
  7. Applies movement pushback/forward based on attack type
  8. Consumes stamina
  9. Logs input for combo tracking
- **Returns**: Boolean indicating if attack was executed
- **Usage**: Called by input handler or AI controller

#### `takeDamage(damage, attacker)`
- **Purpose**: Apply damage to fighter
- **Parameters**:
  - `damage` - Damage amount
  - `attacker` - Attacking Fighter instance
- **Process**:
  1. Reduces HP
  2. Sets state to 'STUN'
  3. Plays hit animation via AnimationController
  4. Applies knockback based on attack type
  5. Triggers flash effect
  6. Updates UI
- **Returns**: Boolean indicating if fighter died
- **Usage**: Called by CombatSystem when hit detected

#### `jump()`
- **Purpose**: Execute jump
- **Process**:
  1. Checks if can jump (state, stamina)
  2. Sets state to 'JUMP'
  3. Sets jump invulnerability timer
  4. Plays jump animation via AnimationController
  5. Consumes stamina
- **Usage**: Called by input handler (W key) or AI

#### `crouch()` / `exitCrouch()`
- **Purpose**: Execute crouch (currently disabled)
- **Status**: Returns immediately (feature disabled)
- **Future**: Will handle crouch state and animation

#### `checkHit(opponent)`
- **Purpose**: Check if this fighter's attack hits opponent
- **Parameters**: `opponent` - Target Fighter instance
- **Returns**: Hit event object or null
- **Process**:
  1. Checks if in ATTACK state
  2. Gets active attack spheres from HitboxSystem
  3. Checks overlap with opponent's hurt spheres
  4. Validates hit window timing
  5. Calculates damage based on attack type
  6. Returns hit event with damage, position, and attack type
- **Usage**: Called by CombatSystem every frame

#### `updateHitboxes()`
- **Purpose**: Update hitbox and hurtbox positions
- **Process**:
  1. Calls HitboxSystem.updateHurtSpheres() for head/torso
  2. Calls HitboxSystem.updateAttackSpheres() for attack hitboxes
  3. Updates debug visualizations if enabled
- **Usage**: Called every frame in update()

#### `updateCollisionCapsule()`
- **Purpose**: Update collision capsule for physical collision
- **Process**: Updates collision start/end points based on mesh position and height
- **Usage**: Called after movement updates

#### `getCombatStats(type)`
- **Purpose**: Get combat stats for attack type
- **Parameters**: `type` - Attack type string
- **Returns**: Object with `dmg`, `cost`, `range`, `window` properties
- **Process**: Returns character config stats or falls back to CONFIG defaults
- **Usage**: Used by combat system and AI for range/damage calculations

#### `setHitboxVisibility(visible)` / `setCollisionBoxVisibility(visible)`
- **Purpose**: Toggle debug visualizations
- **Parameters**: `visible` - Boolean
- **Usage**: Called by debug panel when options change

### State Machine

Fighter uses internal state machine with these states:
- **IDLE**: Default state, can move and attack
- **WALK**: Moving state, can attack
- **ATTACK**: Attacking state, locked until animation completes
- **JUMP**: Jumping state, has invulnerability frames
- **CROUCH**: Crouching state (currently disabled)
- **STUN**: Hit reaction state, locked briefly
- **DEAD**: Dead state, no actions possible
- **WIN**: Victory state, plays win animation

### Combo System

- **Combo Window**: Opens at 35% through attack animation, closes at 80%
- **Max Combo**: 3 hits per combo
- **Combo Speed**: Subsequent hits play at 17.1x speed multiplier
- **Input Queuing**: Attacks can be queued during combo window
- **Combo Types**: Hand attacks can combo into leg attacks and vice versa

### Debugging

- **Hitbox Visualization**: Toggle via `setHitboxVisibility(true)`
- **Collision Visualization**: Toggle via `setCollisionBoxVisibility(true)`
- **State Inspection**: Check `fighter.state` for current state
- **Animation Inspection**: `fighter.animationController.getCurrentAnimation()` for current anim
- **Hitbox Inspection**: `fighter.hurtSpheres` and `fighter.attackSpheres` for sphere data
- **Input Log**: `fighter.inputLog` shows recent inputs for combo debugging

---

## CombatSystem (`js/game/CombatSystem.js`)

**Purpose**: Handles hit detection, damage application, and visual feedback effects (screen shake, hit-stop).

### Features

- **Hit Detection**: Checks collisions between fighters' attack and hurt spheres
- **Screen Shake**: Applies camera shake on hits
- **Hit-Stop**: Freezes frame briefly on heavy hits for impact feedback
- **Damage Callbacks**: Triggers damage number effects

### Key Methods

#### `checkCollisions(fighters)`
- **Purpose**: Check for hits between fighters
- **Parameters**: `fighters` - Array of two Fighter instances
- **Returns**: Array of hit event objects
- **Process**:
  1. Returns empty array if not two fighters or hit-stop active
  2. Calls `fighter1.checkHit(fighter2)` and `fighter2.checkHit(fighter1)`
  3. Returns array of hit events (can be 0, 1, or 2 events for simultaneous hits)
- **Usage**: Called every frame in main game loop

#### `applyHitEffects(atkType)`
- **Purpose**: Apply visual feedback for hits
- **Parameters**: `atkType` - Attack type string
- **Process**:
  1. Determines if heavy attack (leg attacks)
  2. Sets shake intensity (0.5 for heavy, 0.2 for light)
  3. Sets hit-stop duration (0.15s for heavy, 0 for light)
  4. Triggers `onShake` and `onHitStop` callbacks
- **Usage**: Called by main loop when hit detected

#### `update(dt)`
- **Purpose**: Update shake and hit-stop timers
- **Parameters**: `dt` - Delta time (seconds)
- **Process**:
  1. Decays shake by `dt * 2` per second
  2. Decays hit-stop by `dt` per second
- **Usage**: Called every frame in main game loop

#### `getShake()` / `getHitStop()`
- **Purpose**: Get current shake/hit-stop values
- **Returns**: Number (0 if inactive)
- **Usage**: Called by CameraController and RenderSystem

### Callbacks

- `onShake(amount)` - Called when shake should be applied
- `onHitStop(duration)` - Called when hit-stop should be applied
- `onDamage(damage, position, isCritical)` - Called when damage should be displayed

### Debugging

- **Shake Amount**: Check `combatSystem.shake` for current shake intensity
- **Hit-Stop**: Check `combatSystem.hitStop` for current hit-stop duration
- **Hit Events**: Log hit events in main loop to see hit detection frequency

---

## CollisionSystem (`js/game/CollisionSystem.js`)

**Purpose**: Resolves physical collisions between fighters to prevent overlapping and ensure proper spacing.

### Features

- **Circle-Based Collision**: Uses collision radius for each fighter
- **Separation Force**: Pushes fighters apart when overlapping
- **Distance Calculation**: Provides distance between fighters for AI
- **Attack Range Checking**: Validates if fighters can attack each other

### Key Methods

#### `resolveCollisions(fighters)`
- **Purpose**: Main collision resolution method
- **Parameters**: `fighters` - Array of two Fighter instances
- **Process**: Calls `resolveCharacterCollision()` for the two fighters
- **Usage**: Called every frame in main game loop

#### `resolveCharacterCollision(p1, p2)`
- **Purpose**: Resolve collision between two fighters
- **Parameters**: `p1`, `p2` - Fighter instances
- **Process**:
  1. Calculates direction vector between fighters (Y = 0)
  2. Calculates distance and minimum required distance (sum of radii)
  3. If overlapping, applies correction with 0.6 multiplier (stronger separation)
  4. Moves both fighters apart proportionally
  5. Updates collision capsules
- **Separation Multiplier**: 0.6 (instead of 0.5) for stronger push-away effect
- **Usage**: Internal method called by `resolveCollisions()`

#### `getDistance(fighter1, fighter2)`
- **Purpose**: Get distance between two fighters
- **Parameters**: Two Fighter instances
- **Returns**: Number (distance in units)
- **Usage**: Called by AI for decision making

#### `canAttack(attacker, target)`
- **Purpose**: Check if attacker can hit target
- **Parameters**: `attacker`, `target` - Fighter instances
- **Returns**: Boolean
- **Process**:
  1. Calculates distance between fighters
  2. Gets maximum attack range from attacker's combat stats
  3. Checks if distance is within range
  4. Checks if attacker is facing target (dot product check)
  5. Returns true if both conditions met
- **Facing Check**: Uses `CONFIG.combat.hitAngle * 0.5` for lenient AI facing
- **Usage**: Called by AI to determine attack opportunities

### Debugging

- **Collision Visualization**: Enable via `fighter.setCollisionBoxVisibility(true)`
- **Collision Radius**: Check `fighter.collisionRadius` for radius value
- **Overlap Detection**: Log overlap amount in `resolveCharacterCollision()` to debug sticky collisions

---

## GameState (`js/game/GameState.js`)

**Purpose**: Manages match-level state machine and timer. Coordinates transitions between setup, countdown, fight, pause, and game over states.

### Features

- **State Machine**: Manages match states (SETUP, COUNTDOWN, FIGHT, PAUSED, OVER)
- **Timer System**: Countdown timer with automatic end-game on timeout
- **Countdown Display**: Visual countdown (3, 2, 1, FIGHT!)
- **Event Callbacks**: Provides hooks for state changes and timer updates

### State Definitions

- **SETUP**: Character selection screen
- **COUNTDOWN**: Pre-fight countdown (3, 2, 1, FIGHT!)
- **FIGHT**: Active gameplay
- **PAUSED**: Game paused (can resume)
- **OVER**: Match ended (victory/defeat/draw)

### Key Methods

#### `setState(newState)`
- **Purpose**: Transition to new state
- **Parameters**: `newState` - State string
- **Process**:
  1. Updates state
  2. Calls `onStateChange` callback
  3. Handles state-specific logic (starts/stops timer)
- **Usage**: Called throughout application for state transitions

#### `startTimer()`
- **Purpose**: Start match countdown timer
- **Process**:
  1. Clears any existing timer
  2. Sets up interval that decrements timer every second
  3. Calls `onTimerUpdate` callback each second
  4. Calls `onTimerEnd` or `endGame(null)` when timer reaches 0
- **Usage**: Called automatically when entering FIGHT state

#### `stopTimer()`
- **Purpose**: Stop match timer
- **Usage**: Called when pausing or ending match

#### `resetTimer()`
- **Purpose**: Reset timer to initial value
- **Process**: Sets timer to `CONFIG.combat.timer` (default 99)
- **Usage**: Called when starting new match

#### `startCountdown(callback)`
- **Purpose**: Start pre-fight countdown sequence
- **Parameters**: `callback` - Function called when countdown completes
- **Process**:
  1. Sets state to COUNTDOWN
  2. Displays countdown overlay (3, 2, 1, FIGHT!)
  3. Transitions to FIGHT state after countdown
  4. Calls callback when complete
- **Usage**: Called when both players are selected and match starts

#### `pause()` / `resume()`
- **Purpose**: Pause/resume match
- **Process**: Transitions between FIGHT and PAUSED states
- **Usage**: Called by pause menu or ESC key

#### `endGame(winnerId)`
- **Purpose**: End match with winner
- **Parameters**: `winnerId` - 'p1', 'p2', or null (draw)
- **Process**: Sets state to OVER
- **Usage**: Called when fighter dies or timer expires

### Event Callbacks

- `onStateChange(newState, oldState)` - Called on state transition
- `onTimerUpdate(timer)` - Called every second with current timer value
- `onTimerEnd()` - Called when timer reaches 0

### Configuration

- `CONFIG.combat.timer` - Initial timer value (default: 99 seconds)

### Debugging

- **Current State**: Check `gameState.getState()` for current state
- **Timer Value**: Check `gameState.getTimer()` for current timer
- **State Transitions**: All transitions logged via `onStateChange` callback

---

## AIController (`js/game/AIController.js`)

**Purpose**: AI decision-making system for CPU-controlled fighters. Uses state machine with multiple behavioral states and tactical decision making.

### Features

- **State Machine**: Four behavioral states (SPACING, AGGRESSIVE, DEFENSIVE, REACTION)
- **Tactical Decision Making**: Evaluates distance, resources, and opponent state
- **Attack Opportunity Detection**: Identifies optimal moments to attack
- **Reaction System**: Responds to opponent attacks with dodges or counters
- **Cooldown System**: Prevents attack/jump/crouch spamming

### State Definitions

- **SPACING**: Maintains optimal distance, baits attacks, looks for openings
- **AGGRESSIVE**: Pursues opponent, attacks frequently
- **DEFENSIVE**: Maintains distance, avoids attacks, waits for opportunities
- **REACTION**: High-priority state for responding to opponent attacks

### Key Methods

#### `updateAI(fighter, dt, opponent, collisionSystem)`
- **Purpose**: Main AI update method called every frame
- **Parameters**:
  - `fighter` - AI-controlled Fighter instance
  - `dt` - Delta time (seconds)
  - `opponent` - Opponent Fighter instance
  - `collisionSystem` - CollisionSystem instance
- **Process**:
  1. Skips if fighter in locked state (ATTACK, STUN, DEAD, WIN)
  2. Updates all timers and cooldowns
  3. Gathers environment data (distance, HP%, stamina%, opponent state)
  4. Detects opponent attack state changes
  5. Handles reaction state if opponent attacking
  6. Evaluates and updates behavioral state
  7. Checks for attack opportunities (priority)
  8. Executes behavior based on current state
- **Usage**: Called every frame for AI fighters in Fighter.update()

#### `checkAttackOpportunity(fighter, opponent, distance, collisionSystem, fighterStPercent, opponentState)`
- **Purpose**: Determine if fighter should attack
- **Returns**: Object with `shouldAttack` (boolean), `attackType` (string), `cooldown` (number)
- **Process**:
  1. Validates fighter can attack (state, stamina, cooldown)
  2. Checks if in attack range and facing opponent
  3. Analyzes opponent state and animation timing
  4. Calculates attack chance based on:
     - Opponent state (STUN = 95%, ATTACK recovery = 90%, IDLE = 75%)
     - Distance (closer = higher chance)
     - Current AI state (AGGRESSIVE = +20%, SPACING = +10%)
  5. Randomly decides based on attack chance
  6. Selects attack type (heavy if preferHeavy, light otherwise)
- **Usage**: Called every frame before movement decisions

#### `evaluateState(fighter, opponent, distance, fighterHpPercent, fighterStPercent, opponentHpPercent, opponentStPercent, opponentState)`
- **Purpose**: Evaluate and update behavioral state
- **Process**:
  1. Checks if should be DEFENSIVE (low HP or stamina < 20%)
  2. Checks if should be AGGRESSIVE:
     - Opponent vulnerable (STUN, low HP/ST < 50%)
     - OR fighter has good resources (HP > 50%, ST > 50%) and opponent not attacking
  3. Defaults to SPACING if neither condition met
- **Decision Timer**: Re-evaluates every 0.15-0.35 seconds (randomized)
- **Usage**: Called periodically to update AI behavior

#### `handleReaction(fighter, dt, opponent, distance, collisionSystem, opponentAnimState)`
- **Purpose**: Handle reaction to opponent attack
- **Process**:
  1. Determines if opponent attack is heavy (legs) or light (hands)
  2. Gets attack timing (early/mid/late in animation)
  3. **Early (< 30%)**: Can dodge
     - Heavy attack: Jump to avoid (low attack)
     - Light attack: Retreat (crouch disabled)
  4. **Late (> 70%)**: Can counter-attack
  5. **Mid (30-70%)**: Retreat
- **Reaction Window**: 0.3 seconds to react
- **Usage**: Called when opponent attack detected

#### `executeSpacing(fighter, dt, opponent, distance, collisionSystem, fighterStPercent)`
- **Purpose**: Execute spacing behavior
- **Process**:
  1. Maintains distance between 2.0 and 3.5 units
  2. Has idle zone (2.2-3.0) where fighter stops and observes
  3. Periodically changes spacing direction
  4. Adjusts target distance slightly for variation
- **Usage**: Default behavior when no special conditions

#### `executeAggressive(fighter, dt, opponent, distance, collisionSystem, fighterStPercent)`
- **Purpose**: Execute aggressive behavior
- **Process**:
  1. Chases opponent if beyond attack range (2.8 units)
  2. Slight retreat if too close (< 1.8 units)
  3. Brief idle in optimal range (1.8-2.5) to wait for attack opportunity
- **Usage**: When opponent is vulnerable or fighter has good resources

#### `executeDefensive(fighter, dt, opponent, distance, collisionSystem, fighterHpPercent, fighterStPercent)`
- **Purpose**: Execute defensive behavior
- **Process**:
  1. Maintains larger distance (3.0-3.8 units)
  2. Retreats if too close
  3. Approaches cautiously if too far
  4. Idles in safe zone to observe
- **Usage**: When fighter has low HP or stamina

#### `moveToward(fighter, opponent, dt, speedMultiplier)` / `moveAway(fighter, opponent, dt, speedMultiplier)`
- **Purpose**: Move fighter toward or away from opponent
- **Parameters**: `speedMultiplier` - Movement speed multiplier (default 1.0)
- **Process**: Sets `fighter.desiredVelocity` based on direction to opponent
- **Usage**: Called by behavior execution methods

### Configuration

- `lowStaminaThreshold`: 0.2 (20% - triggers defensive)
- `lowHealthThreshold`: 0.2 (20% - triggers defensive)
- `opponentWeakThreshold`: 0.5 (50% - triggers aggressive)
- `reactionWindow`: 0.3 seconds
- `targetDistance`: 2.5 units (preferred spacing distance)

### Cooldowns

- `attackCooldown`: Prevents attack spamming (0.15-0.25s depending on situation)
- `jumpCooldown`: Prevents jump spamming (0.5s)
- `crouchCooldown`: Prevents crouch spamming (0.5s, currently unused)

### Debugging

- **Current State**: Check `aiController.currentState` for behavioral state
- **Decision Timer**: Check `aiController.decisionTimer` to see when next evaluation
- **Attack Chance**: Log attack chance in `checkAttackOpportunity()` to see AI decision making
- **Distance Tracking**: Log distance in behavior methods to see spacing behavior

---

## System Integration

### Fighter ↔ CombatSystem
- `CombatSystem.checkCollisions()` calls `Fighter.checkHit()` for each fighter
- `CombatSystem.applyHitEffects()` triggers visual feedback
- Hit events trigger `Fighter.takeDamage()`

### Fighter ↔ CollisionSystem
- `CollisionSystem.resolveCollisions()` prevents fighter overlap
- `CollisionSystem.getDistance()` used by AI for decision making
- `CollisionSystem.canAttack()` used by AI to validate attack opportunities

### Fighter ↔ GameState
- `GameState` manages match-level state
- `Fighter` manages character-level state
- `GameState` timer triggers end-game when expires

### Fighter ↔ AIController
- `AIController.updateAI()` called every frame for AI fighters
- AI sets `fighter.desiredVelocity` for movement
- AI calls `fighter.attack()` when attack opportunity detected

---

## Debugging Guide

### Common Issues

1. **Fighters Not Moving**: Check `fighter.desiredVelocity` and `motionController`
2. **Attacks Not Connecting**: Enable hitbox visualization, check hit windows
3. **Collision Sticking**: Check `collisionRadius` and separation multiplier
4. **AI Not Attacking**: Check attack opportunity chance and cooldowns
5. **State Machine Issues**: Log state transitions, check state validation

### Debug Tools

- **Hitbox Visualization**: `fighter.setHitboxVisibility(true)`
- **Collision Visualization**: `fighter.setCollisionBoxVisibility(true)`
- **State Inspection**: `fighter.state`, `gameState.getState()`
- **Animation Inspection**: `fighter.animationController.getCurrentAnimation()`
- **Input Logging**: `fighter.inputLog` for combo debugging
- **AI State**: `fighter.aiController.currentState` for AI behavior


