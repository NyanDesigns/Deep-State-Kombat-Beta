# Character Technical Breakdown

Characters in Deep State Kombat are a hybrid of 3D asset data (GLB) and behavioral metadata (JSON). This document explains how these two components interface to create a functional fighter.

## 1. The Character Pipeline (GLB + JSON)

Each character is defined by two primary files:
1.  **`model.glb`**: Contains the 3D mesh, the skeletal rig (Bones), and the embedded animation clips.
2.  **`character.json`**: Acts as the "Configuration Layer" that tells the game engine how to interpret the GLB data.

### How it Works:
When a character is loaded, the `CharacterManager` fetches the GLB. The `Fighter` class then uses the JSON to map logical game states (like "Light Attack") to the specific animation clip name embedded inside the GLB (like "Punch"). This allows the game to support various characters with different internal animation names without changing the core code.

---

## 2. Embedded Animation Data (The Blender View)

In a typical character model (as seen in Blender's NLA Tracks editor), the following animation clips are embedded in the GLB timeline:

| GLB Clip Name | Logical Action | Game Mapping | Description |
| :--- | :--- | :--- | :--- |
| `breath` | **Idle** | `animations.idle` | The default looping stance when no input is provided. Acts as the base layer for locomotion blending. |
| `walk` | **Walk** | `animations.walk` | Looping movement animation; played forward or backward via `timeScale` manipulation. |
| `jump` | **Jump** | `animations.jump` | A single-shot vertical movement animation triggered by W key. |
| `crouch` | **Crouch** | `animations.crouch` | A pose-based animation triggered by downward input (S key). |
| `punchR` | **Right Hand Attack** | Direct mapping to `rightHand` | Fast, low-damage strike with the right hand. Triggered by Up Arrow key. |
| `punchL` | **Left Hand Attack** | Direct mapping to `leftHand` | Fast, low-damage strike with the left hand. Triggered by Left Arrow key. |
| `kickR` | **Right Leg Attack** | Direct mapping to `rightLeg` | Slower, high-damage strike with the right leg. Triggered by Right Arrow key. |
| `kickL` | **Left Leg Attack** | Direct mapping to `leftLeg` | Slower, high-damage strike with the left leg. Triggered by Down Arrow key. |
| `hit` | **Hit Reaction** | `animations.hit` | Reaction animation played when taking damage. Has high priority to interrupt other animations. |

**Note on Attack Variants**: The game's combat system supports four distinct attack types (`leftHand`, `rightHand`, `leftLeg`, `rightLeg`), each with dedicated input keys (Left/Up/Down/Right arrows). The `Fighter` class loads `punchL`, `punchR`, `kickL`, and `kickR` as separate animation actions, allowing for precise limb-specific attacks. The JSON's `atk1` and `atk2` mappings are fallbacks used only if the specific limb animations aren't found in the GLB.

**Additional Animations**: Some characters may also include `Victory` and `Death` clips in their GLB, which are referenced in the JSON as `animations.win` and `animations.die`. These are optional and may not appear in all character models.

**JSON-to-GLB Name Mapping**: The `character.json` file uses generic animation names (e.g., `"idle": "Idle"`, `"atk1": "Punch"`), but the actual GLB contains more specific clip names (e.g., `breath`, `punchR`, `punchL`). The `Fighter` class uses a fallback matching system:

1. **Exact Match**: First tries to find a clip with the exact name specified in JSON (e.g., `"idle": "Idle"` looks for a clip named "Idle").
2. **Partial Match**: If exact match fails, performs a case-insensitive partial match (e.g., "Idle" might match "idle_loop").
3. **Alias Matching**: Checks against common aliases (e.g., "idle" might match "breath", "stand", "rest").
4. **Last Resort**: As a final fallback, searches for any clip whose name contains the logical action name (e.g., searching for "idle" might find "breath" if no better match exists).

**Recommendation**: For best results, update the JSON to reference the exact GLB clip names (e.g., `"idle": "breath"`, `"atk1": "punchR"`). This ensures reliable animation loading without relying on fallback matching.

---

## 3. Configuration Metadata (`character.json`)

The JSON file contains the "DNA" of the character. Key sections include:

### `stats`
Physical attributes that affect the game's physics and balance:
- `hp`: Total health points.
- `stamina`: Resource for attacks.
- `moveSpeed`: Multiplier for the `MotionController`.
- `weight`: Affects how much the character is pushed back on hits.

### `combat`
Defines the "Hit Windows" and damage values.
- `window`: An array `[start, end]` representing the percentage of the animation (0.0 to 1.0) where the attack is "active" and can deal damage.

### `hitboxes`
Configures the size of the detection spheres:
- `head` / `torso`: Sizes of the hurtboxes.
- `attackHands` / `attackLegs`: Array of sizes for the attack hitboxes during punch/kick frames.

---

## 4. Character Registry

| Character | Difficulty | HP | Style | Unique Attribute |
| :--- | :--- | :--- | :--- | :--- |
| **Trump** | Advanced | 130 | Tank | High weight, massive range on `Kick`. |
| **Brandon** | Intermediate | 120 | Speedster | Fast `Punch` recovery, high `moveSpeed`. |
| **Obama** | Intermediate | 110 | Balanced | Highest `jumpHeight` and even stats. |
| **Epstein** | Beginner | 90 | Technical | Fast `staminaRegen`, small hitboxes. |

---

## 5. Conceptual Archetypes

### The "Rowdy" Archetype
While no character named "Rowdy" is currently in the active roster, the term refers to the **Dynamic Physics Archetype** planned for future updates. 
- **Goal**: Characters with higher "bounciness" or more chaotic movement patterns.
- **Implementation**: This will likely involve custom `frictionFactor` overrides in the `character.json` to allow for more "rowdy" and less predictable neutral game interactions.
