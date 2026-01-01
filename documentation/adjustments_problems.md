# Adjustments & Problems

This document provides a comprehensive breakdown of all debugging systems, technical adjustments, solved problems, and known issues in Deep State Kombat.

---

## 1. Debugging Systems

The game features an extensive debug panel (inspired by Tekken-style HUDs) that can be toggled via the Pause Menu. All debug options are persisted to `localStorage` and automatically restored on subsequent sessions.

### Debug Options (Toggleable via Pause Menu)

#### **Show Hitboxes**
- **Visualization**: Displays red circle overlays representing active attack hitboxes during combat.
- **Details Shown**: 
  - Hand attack spheres (fist and elbow positions for both left and right)
  - Leg attack spheres (foot and knee positions for both left and right)
  - Only visible during the active hit window of an attack animation
- **Use Case**: Essential for balancing attack ranges and understanding why certain attacks connect or miss. Helps visualize the precise frames where damage can be dealt.

#### **Show Collision Box**
- **Visualization**: Displays green circle overlays representing the physical collision boundaries.
- **Details Shown**:
  - Fighter collision radius (prevents overlapping)
  - Updated in real-time as fighters move
- **Use Case**: Critical for debugging "sticky" collision issues and understanding why fighters get stuck in corners or during close combat.

#### **Show Parameters**
- **Visualization**: Real-time text overlay displaying internal game state.
- **Details Shown**:
  - **P1/P2 HP & Stamina**: Current health and stamina values (color-coded: green for P1, red for P2)
  - **State**: Current fighter state (IDLE, ATTACK, STUN, JUMP, etc.)
  - **Distance**: Real-time distance between fighters (cyan)
  - **Timer**: Match countdown timer (yellow)
  - **Config Values**: Base light/heavy attack damage and stamina costs
- **Use Case**: Essential for understanding game balance, debugging state machine issues, and verifying combat calculations.

#### **Show Attack Ranges**
- **Visualization**: Displays the effective range circles for light and heavy attacks.
- **Details Shown**:
  - Light attack range (typically 2.2 units)
  - Heavy attack range (typically 2.8 units)
  - Visualized as circles around the fighter
- **Use Case**: Helps players and developers understand spacing and optimal engagement distances.

#### **Show Frame Data**
- **Visualization**: Displays animation timing information in the debug panel.
- **Details Shown**:
  - Current animation clip name
  - Animation progress: `currentTime / totalDuration`
  - Updates in real-time for both fighters
- **Use Case**: Critical for frame-perfect timing, understanding animation windows, and debugging animation state issues. Essential for competitive play analysis.

#### **Show Inputs/Combo**
- **Visualization**: Tracks button inputs and combo system state.
- **Details Shown**:
  - **Last 6 Inputs**: Recent button presses (color-coded per player)
  - **Combo Count**: Current combo hits vs. maximum combo limit
  - **Combo Window**: Whether the combo window is currently open
  - **Queued Attacks**: If an attack is queued for the next combo link
- **Use Case**: Essential for understanding combo system behavior, input buffering, and debugging why certain combos drop or connect.

### Debug Panel Persistence
All debug options are automatically saved to `localStorage` via `StorageManager.saveGameSettings()`. When the game loads, saved debug preferences are restored and applied to both the pause menu checkboxes and the fighter visualizations.

---

## 2. Technical Adjustments & Solutions

### Model Scaling System
**Problem**: Different GLB models have varying base scales, causing characters to appear drastically different sizes in the arena.

**Solution**: Each character's `character.json` includes a `scale` property that normalizes the model to a consistent size. The `Fighter` class applies this scale during model loading.

**Implementation Details**:
- Scale values range from ~1.6 to 1.85 depending on character
- Applied directly to the mesh: `mesh.scale.set(scale, scale, scale)`
- Ensures consistent hitbox and collision calculations regardless of source model size

### Hitbox Registration System
**Problem**: Need a reliable way to detect when attacks connect with opponents, accounting for different bone structures across models.

**Solution**: A simplified circle-based hitbox system (`HitboxSystem.js`) with intelligent bone discovery.

**Implementation Details**:
- **Bone Discovery**: `BoneDiscovery.js` automatically maps standard Mixamo bone names (e.g., `mixamorig:head`, `mixamorig:righthand`) to internal game slots
- **Hurtboxes**: Head and torso spheres that are always active (except during jump invulnerability frames)
- **Attack Hitboxes**: Four spheres per attack type (hands: fist + elbow for left/right, legs: foot + knee for left/right)
- **Active Windows**: Hitboxes only activate during the `window` range defined in combat stats (e.g., `[0.15, 0.6]` means active from 15% to 60% through the animation)
- **Fallback System**: If bones aren't found, the system estimates positions based on mesh orientation and character forward direction

**Key Features**:
- Jump invulnerability: Torso hurtbox disabled during jump frames to prevent anti-air abuse
- Crouch state handling: Head hurtbox disabled when crouched (though crouch is currently disabled)
- Bone world position calculation: Accounts for animation transforms to get accurate real-time positions

### Floor Clipping Prevention
**Problem**: When blending between idle and walk animations, the base layer could drop to zero weight, causing the character's feet to clip through the floor.

**Solution**: `minBaseWeight` configuration (0.1) ensures the base locomotion layer always maintains at least 10% weight.

**Implementation Details**:
- Defined in `CONFIG.animation.locomotion.minBaseWeight`
- Enforced in `LocomotionBlender.getBlendWeights()`
- Prevents visual glitches during movement transitions
- Applied to both idle and walk animation blending

### Animation Completion Polling Removal
**Problem**: Previous implementation polled animation completion every frame, causing animations to be cut short prematurely.

**Solution**: Switched to event-driven animation completion using Three.js `finished` events.

**Implementation Details**:
- `AnimationController` no longer polls `action.time >= action.getClip().duration`
- Instead, listens for the `finished` event on animation actions
- Ensures animations play their full duration without being interrupted
- Critical for accurate hit window timing and combo system reliability

### Collision Friction & Separation
**Problem**: Fighters would feel "sticky" when colliding, especially in corners or during close combat. Overlapping fighters would sometimes get stuck together.

**Solution**: Multi-layered friction system with stronger separation forces.

**Implementation Details**:
- **Collision Correction**: Uses 0.6 multiplier (instead of 0.5) for stronger push-away effect in `CollisionSystem.resolveCharacterCollision()`
- **Friction Factors**: 
  - `frictionFactor: 0.25` - Applied when fighters are too close during normal movement
  - `forwardFrictionFactor: 0.3` - Slightly higher friction for forward movement to prevent rushdown abuse
- **Collision Buffer**: `collisionBuffer: 1.2` multiplier increases the effective collision distance check
- **Movement Damping**: `MotionController` applies exponential damping when no input is detected, preventing momentum carryover

**Fine-Tuning Notes**:
- These values are continuously balanced based on playtesting feedback
- Different characters may benefit from character-specific friction overrides in the future

### Attack State Lock Prevention
**Problem**: Multiple simultaneous calls to `fighter.attack()` could cause state corruption, allowing double attacks or animation glitches.

**Solution**: Immediate state lock before any async operations.

**Implementation Details**:
- `fighter.state = 'ATTACK'` is set **immediately** at the start of the `attack()` method
- Stamina check happens **before** state change to prevent invalid attacks
- Animation existence check happens **after** state lock to prevent race conditions
- This ensures only one attack can be processed at a time per fighter

### Combo Speed Calculation Isolation
**Problem**: Character config `playbackSpeed` settings were interfering with combo system speed multipliers, causing inconsistent attack speeds.

**Solution**: Separated base speed calculation from combo speed calculation.

**Implementation Details**:
- Base attack speed calculated first (3.5x for hands, 3.0x for legs)
- Character config `playbackSpeed` applied as a **multiplier** to base speed (only for non-combo attacks)
- Combo speed multiplier (17.1x) applied **after** base speed, ensuring combos always play at intended speed
- Note in code: "Do NOT pass character config playbackSpeed here - handle all speed calculations in Fighter methods"

### Image Preloading & Caching
**Problem**: Character selection grid would show blank images or loading delays when switching between characters.

**Solution**: `ImagePreloader` system with `localStorage` caching.

**Implementation Details**:
- All character portrait PNGs preloaded during initial loading sequence
- Images cached in `localStorage` with keys like `deepKombat_image_{characterId}_{variant}`
- Variants include: `T` (thumbnail), `P1`/`P2` (player previews), `D` (defeat), `V` (victory), `S` (select screen)
- Cache checked before network request, dramatically reducing load times on subsequent visits
- Cache invalidation handled via versioning or manual clear

### Sequential Character Loading
**Problem**: Loading multiple GLB models simultaneously could cause browser hangs or memory spikes.

**Solution**: Sequential loading with progress callbacks during tutorial/initial setup.

**Implementation Details**:
- Characters loaded one at a time during tutorial screen
- Progress tracked and displayed to user
- Minimum 2-second display time ensures users can read tutorial controls
- Failed loads are logged but don't block the loading sequence

### Jump Invulnerability Frames
**Problem**: Jumping characters were too vulnerable to anti-air attacks, making jumps feel unsafe.

**Solution**: Torso hurtbox disabled during jump animation.

**Implementation Details**:
- `jumpInvulnerabilityTimer` tracks remaining invulnerability frames
- Torso hurtbox radius set to 0 when `jumpInvulnerabilityTimer > 0`
- Head hurtbox remains active (can still be hit in the head)
- Creates risk/reward: jumps avoid low attacks but are vulnerable to high attacks

---

## 3. Temporarily Disabled Features

### Crouch System
**Status**: Currently disabled for both player and AI.

**Reason**: The crouch system was causing animation state conflicts and required significant rebalancing. It's been disabled while other systems are stabilized.

**Code Locations**:
- `Fighter.crouch()` - Returns immediately
- `Fighter.exitCrouch()` - Returns immediately  
- `Fighter.update()` - Crouch input handling disabled
- `AIController` - All crouch reaction logic commented out

**Future Work**: Crouch system will be re-enabled once animation state machine is fully stabilized and tested.

---

## 4. Known Problems & Areas for Improvement

### Animation Blending Edge Cases
**Issue**: Complex transitions between jumps, attacks, and hits can occasionally result in frame "snapping" or brief visual glitches.

**Current State**: The `AnimationController` uses priority-based crossfading with configurable fade times. Most transitions are smooth, but rapid state changes (e.g., attack → hit → attack) can sometimes show brief artifacts.

**Potential Solutions**:
- Increase minimum crossfade times for high-priority transitions
- Implement transition validation to prevent incompatible animation pairs
- Add "transition buffer" state that prevents immediate re-transitions

### Hit-Stop Input Buffering
**Issue**: The `hitStop` effect (freezing the game for a few frames on heavy hits) can sometimes interfere with input buffering, causing queued inputs to be lost.

**Current State**: Hit-stop is implemented in `CombatSystem.js` and pauses the render loop. Inputs are still captured during hit-stop, but the timing window for combo links can feel inconsistent.

**Potential Solutions**:
- Extend input buffer duration during hit-stop
- Apply hit-stop only to visual rendering, not input processing
- Add hit-stop compensation to combo window timing

### Custom Model Loading Limitations
**Issue**: While the infrastructure exists for loading custom GLB files via the setup screen, full validation and bone mapping for arbitrary models remains a challenge.

**Current Limitations**:
- Requires manual bone name matching or Mixamo-standard rigs
- No automatic validation of required animations
- Hitbox sizes may need manual adjustment for non-standard models
- No preview of attack hitboxes before loading

**Future Work**:
- Automatic bone discovery with user confirmation
- Animation validation with fallback suggestions
- Hitbox size estimation based on model scale
- Real-time hitbox preview in setup screen

### Collision Friction Fine-Tuning
**Issue**: While friction factors help, fighters can still feel slightly "sticky" in certain edge cases, particularly when both fighters are moving toward each other simultaneously.

**Current State**: Multiple friction factors and collision buffers are in place, but fine-tuning is ongoing based on playtesting feedback.

**Potential Solutions**:
- Character-specific friction overrides
- Dynamic friction based on movement speed
- Separate friction values for different collision scenarios (corner vs. center, forward vs. backward)

### AI Decision Making Complexity
**Issue**: The AI state machine (`AIController`) has grown complex with multiple behavioral states (Spacing, Aggressive, Defensive, Reaction). Balancing AI difficulty across all character archetypes is challenging.

**Current State**: AI uses resource thresholds and distance-based decision making. Works well for most scenarios but can be predictable in certain situations.

**Potential Solutions**:
- Character-specific AI personality modifiers
- Difficulty scaling that adjusts aggression and reaction times
- Learning system that adapts to player patterns (future enhancement)

---

## 5. Performance Optimizations

### Render Resolution vs. Pixelation
**Current Setting**: Internal render resolution set to 1280x720 to reduce pixelation while maintaining performance.

**Trade-offs**:
- Higher resolution = better visual quality but lower FPS on weaker devices
- Lower resolution = better performance but more visible pixelation
- Current setting balances both concerns for most modern devices

### Animation Mixer Efficiency
**Optimization**: Single `AnimationMixer` per fighter handles all animations, reducing overhead compared to multiple mixers.

**Benefit**: Lower memory usage and better performance, especially with multiple characters loaded.

### Hitbox Update Frequency
**Optimization**: Hitboxes only update when fighters are in `ATTACK` state and during active hit windows.

**Benefit**: Reduces unnecessary calculations during idle/movement states, improving frame rate during combat.

---

## 6. Configuration Tuning Guidelines

When adjusting game balance or feel, consider these key configuration areas:

### Combat Windows (`CONFIG.combat.*.window`)
- Earlier windows (e.g., `[0.1, 0.35]`) = faster, more responsive attacks
- Later windows (e.g., `[0.35, 0.85]`) = slower, more telegraphed attacks
- Window size affects combo linking difficulty

### Friction Factors (`CONFIG.combat.movement.*`)
- Lower values = more slippery, faster movement
- Higher values = more controlled, slower movement
- Balance between responsiveness and control

### Animation Priorities (`CONFIG.animation.priorities`)
- Higher priority = interrupts lower priority animations
- DEAD (100) > HIT (90) > ATK2 (50) > ATK1 (40) > JUMP (30) > LOCOMOTION (10)
- Adjusting priorities affects animation responsiveness and feel

### Crossfade Times (`CONFIG.animation.crossfade.*`)
- Shorter times = snappier transitions but potential for visual glitches
- Longer times = smoother transitions but slower response
- Balance based on animation clip lengths and desired feel
