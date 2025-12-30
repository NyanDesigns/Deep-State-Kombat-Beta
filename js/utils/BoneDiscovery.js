import * as THREE from 'three';

export class BoneDiscovery {
    static discoverBones(skeleton) {
        const bones = {};

        // Common bone name patterns to search for
        const bonePatterns = {
            head: ['head', 'Head', 'HEAD', 'neck', 'Neck', 'NECK'],
            spine: ['spine', 'Spine', 'SPINE', 'chest', 'Chest', 'CHEST', 'torso', 'Torso', 'TORSO', 'spine1', 'Spine1', 'spine2', 'Spine2'],
            handLeft: ['hand_l', 'Hand_L', 'handL', 'HandL', 'leftHand', 'LeftHand', 'hand', 'Hand'],
            handRight: ['hand_r', 'Hand_R', 'handR', 'HandR', 'rightHand', 'RightHand'],
            footLeft: ['foot_l', 'Foot_L', 'footL', 'FootL', 'leftFoot', 'LeftFoot', 'foot', 'Foot'],
            footRight: ['foot_r', 'Foot_R', 'footR', 'FootR', 'rightFoot', 'RightFoot'],
            forearmLeft: ['forearm_l', 'Forearm_L', 'forearmL', 'ForearmL', 'lowerarm_l', 'Lowerarm_L', 'elbow_l', 'Elbow_L'],
            forearmRight: ['forearm_r', 'Forearm_R', 'forearmR', 'ForearmR', 'lowerarm_r', 'Lowerarm_R', 'elbow_r', 'Elbow_R'],
            shinLeft: ['shin_l', 'Shin_L', 'shinL', 'ShinL', 'calf_l', 'Calf_L', 'lowerleg_l', 'Lowerleg_L', 'knee_l', 'Knee_L'],
            shinRight: ['shin_r', 'Shin_R', 'shinR', 'ShinR', 'calf_r', 'Calf_R', 'lowerleg_r', 'Lowerleg_R', 'knee_r', 'Knee_R']
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



