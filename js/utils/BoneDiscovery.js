import * as THREE from 'three';

export class BoneDiscovery {
    static discoverBones(skeleton) {
        const bones = {};

        // Mixamo-first bone name patterns to search for (with a few fallbacks)
        const bonePatterns = {
            head: ['mixamorig:head', 'head', 'neck'],
            spine: ['mixamorig:spine2', 'mixamorig:spine1', 'mixamorig:spine', 'spine2', 'spine1', 'spine', 'chest', 'torso'],
            handLeft: ['mixamorig:lefthand', 'lefthand', 'hand_l', 'hand.l', 'handleft'],
            handRight: ['mixamorig:righthand', 'righthand', 'hand_r', 'hand.r', 'handright'],
            footLeft: ['mixamorig:leftfoot', 'leftfoot', 'foot_l', 'foot.l', 'footleft'],
            footRight: ['mixamorig:rightfoot', 'rightfoot', 'foot_r', 'foot.r', 'footright'],
            forearmLeft: ['mixamorig:leftforearm', 'leftforearm', 'forearm_l', 'forearm.l', 'lowerarm_l', 'lowerarm.l', 'elbow_l', 'elbow.l'],
            forearmRight: ['mixamorig:rightforearm', 'rightforearm', 'forearm_r', 'forearm.r', 'lowerarm_r', 'lowerarm.r', 'elbow_r', 'elbow.r'],
            shinLeft: ['mixamorig:leftleg', 'leftleg', 'shin_l', 'shin.l', 'calf_l', 'lowerleg_l', 'knee_l', 'knee.l'],
            shinRight: ['mixamorig:rightleg', 'rightleg', 'shin_r', 'shin.r', 'calf_r', 'lowerleg_r', 'knee_r', 'knee.r']
        };

        // Search through all bones
        skeleton.bones.forEach(bone => {
            const name = bone.name.toLowerCase();

            // Check each pattern
            for (const [key, patterns] of Object.entries(bonePatterns)) {
                if (patterns.some(pattern => name.includes(pattern.toLowerCase()))) {
                    if (!bones[key]) {
                        bones[key] = bone;
                    }
                }
            }
        });

        // If we found a hand but not left/right specific, use it for both
        if (bones.handLeft && !bones.handRight) {
            bones.handRight = bones.handLeft;
        }
        if (bones.handRight && !bones.handLeft) {
            bones.handLeft = bones.handRight;
        }
        if (bones.footLeft && !bones.footRight) {
            bones.footRight = bones.footLeft;
        }
        if (bones.footRight && !bones.footLeft) {
            bones.footLeft = bones.footRight;
        }

        return bones;
    }

    static getBoneWorldPosition(bone) {
        const pos = new THREE.Vector3();
        if (bone && bone.getWorldPosition) {
            try {
                // Ensure bone's world matrix is up to date
                if (bone.matrixWorldNeedsUpdate !== undefined) {
                    bone.updateMatrixWorld(true);
                }
                bone.getWorldPosition(pos);
            } catch (e) {
                // Bone might not be ready yet
            }
        }
        return pos;
    }

    static isValidPosition(pos) {
        return pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
               (Math.abs(pos.x) > 0.001 || Math.abs(pos.y) > 0.001 || Math.abs(pos.z) > 0.001);
    }
}



