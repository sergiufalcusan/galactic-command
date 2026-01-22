/**
 * Unit Rendering - Workers and Combat Units using GLTF Models
 */

import * as THREE from 'three';
import { modelLoader } from './ModelLoader.js';
import { getUnitConfig } from '../game/UnitConfig.js';

// Faction-specific colors
const FACTION_COLORS = {
    zerg: { primary: 0x8b00ff, secondary: 0x4a0080, emissive: 0x440088 },
    human: { primary: 0x00aaff, secondary: 0x004488, emissive: 0x003366 },
    protoss: { primary: 0xffcc00, secondary: 0x886600, emissive: 0x664400 }
};

// Model paths for each faction's worker
const WORKER_MODELS = {
    zerg: '/models/units/worker_zerg.glb',
    human: '/models/units/worker_human.glb',
    protoss: '/models/units/worker_protoss.glb'
};

// Combat unit models
const COMBAT_MODELS = {
    marine: '/models/units/marine.glb',        // astronautA from kenney_space
    marauder: '/models/units/marauder.glb',    // turret_double from kenney_space
    hellion: '/models/units/hellion.glb',      // rover from kenney_space
    zergling: '/models/units/zergling.glb',
    zealot: '/models/units/zealot.glb',
    overlord: '/models/units/overlord.glb'
};

// Model scales are now managed in UnitConfig.js

export class UnitRenderer {
    constructor(scene, faction) {
        this.scene = scene;
        this.faction = faction;
        this.units = new Map();
        this.colors = FACTION_COLORS[faction.id] || FACTION_COLORS.human;
        this.modelsLoaded = false;
        this.debugMode = false;

        // Preload models
        this.preloadModels();
    }

    async preloadModels() {
        const modelsToLoad = [
            WORKER_MODELS[this.faction.id] || WORKER_MODELS.human,
            ...Object.values(COMBAT_MODELS)
        ];

        await modelLoader.preloadModels(modelsToLoad);
        this.modelsLoaded = true;
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.units.forEach(group => {
            if (group.userData.debugCollisionBox) {
                group.userData.debugCollisionBox.visible = enabled;
            }
        });
    }

    async createWorker(unitData) {
        const config = getUnitConfig('worker');
        const group = new THREE.Group();

        const modelPath = WORKER_MODELS[this.faction.id] || WORKER_MODELS.human;

        try {
            const model = await modelLoader.load(modelPath);
            model.scale.setScalar(config.visualScale);
            modelLoader.applyFactionColor(model, this.colors.primary);

            // Center the model within the group to align with ring and hitbox
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.x -= center.x;
            model.position.z -= center.z;

            group.add(model);
        } catch (error) {
            console.error('[UnitRenderer] Failed to load worker model, using fallback');
            group.add(this.createFallbackWorker());
        }

        // Add cargo visual (hidden by default)
        const cargoGroup = this.createCargoVisual();
        cargoGroup.visible = false;
        cargoGroup.position.set(0, 1.5, 0.5); // Position above and slightly in front of worker
        group.add(cargoGroup);
        group.userData.cargoVisual = cargoGroup;

        // Add invisible selection hitbox (larger than model to make selection easier)
        const hitboxGeometry = new THREE.CylinderGeometry(config.radius * 1.5, config.radius * 1.5, config.height, 8);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            transparent: true,
            opacity: 0
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.y = config.height / 2;
        hitbox.userData.unitData = unitData; // Essential for selection
        group.add(hitbox);

        // Add selection ring (hidden by default)
        const selectionRing = this.createSelectionRing();
        selectionRing.scale.setScalar(config.radius / 0.8); // Scale relative to default ring size
        selectionRing.visible = false;
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

        // Add debug collision box
        this.createDebugCollisionBox(group, config.radius, config.height);

        // Set position
        group.position.set(unitData.x, 0.5, unitData.z);
        group.userData.unitData = unitData;

        this.scene.addObject(unitData.id, group);
        this.units.set(unitData.id, group);

        return group;
    }

    createCargoVisual() {
        const group = new THREE.Group();

        // Mineral crystal cargo (blue glowing crystal)
        const crystalGeometry = new THREE.OctahedronGeometry(0.35, 0);
        const crystalMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ccff,
            emissive: 0x0066ff,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 0.6,
            transparent: true,
            opacity: 0.9
        });
        const mineralCrystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
        mineralCrystal.name = 'mineralCargo';
        mineralCrystal.rotation.x = Math.PI / 4;
        group.add(mineralCrystal);

        // Gas container cargo (green glowing sphere)
        const gasGeometry = new THREE.SphereGeometry(0.3, 8, 6);
        const gasMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff66,
            emissive: 0x00aa44,
            emissiveIntensity: 0.8,
            roughness: 0.3,
            metalness: 0.4,
            transparent: true,
            opacity: 0.9
        });
        const gasContainer = new THREE.Mesh(gasGeometry, gasMaterial);
        gasContainer.name = 'gasCargo';
        gasContainer.visible = false; // Hidden by default, shown for gas
        group.add(gasContainer);

        return group;
    }

    createFallbackWorker() {
        // Simple procedural fallback if model fails to load
        const group = new THREE.Group();
        const bodyGeometry = new THREE.SphereGeometry(0.6, 12, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.primary,
            roughness: 0.4,
            metalness: 0.5,
            emissive: this.colors.emissive,
            emissiveIntensity: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.6;
        body.castShadow = true;
        group.add(body);
        return group;
    }

    // Create a larva (worm) visual
    createLarva(unitData) {
        const config = getUnitConfig('larva');
        const scale = config.visualScale;
        const group = new THREE.Group();

        // Worm body - segmented appearance
        const segments = 5;
        const segmentMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.primary,
            roughness: 0.5,
            metalness: 0.2,
            emissive: this.colors.emissive,
            emissiveIntensity: 0.4
        });

        // Create body segments
        for (let i = 0; i < segments; i++) {
            const segmentSize = scale * (1 - i * 0.15); // Taper towards tail
            const geometry = new THREE.SphereGeometry(segmentSize, 8, 6);
            const segment = new THREE.Mesh(geometry, segmentMaterial);
            segment.position.z = i * scale * 0.8; // Space segments
            segment.position.y = 0.3;
            segment.castShadow = true;
            segment.name = `segment_${i}`;
            group.add(segment);
        }

        // Add eyes (two small spheres on front segment)
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffaa00,
            emissiveIntensity: 0.8
        });
        const eyeGeometry = new THREE.SphereGeometry(scale * 0.15, 6, 4);

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-scale * 0.3, 0.4, -scale * 0.2);
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(scale * 0.3, 0.4, -scale * 0.2);
        group.add(rightEye);

        const hitboxGeometry = new THREE.CylinderGeometry(config.radius * 1.2, config.radius * 1.2, config.height, 8);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            transparent: true,
            opacity: 0
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.y = config.height / 2;
        hitbox.userData.unitData = unitData;
        group.add(hitbox);

        // Selection ring
        const selectionRing = this.createSelectionRing();
        selectionRing.scale.setScalar(config.radius / 0.8);
        selectionRing.visible = false;
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

        // Add debug collision box
        this.createDebugCollisionBox(group, config.radius, config.height);

        // Position
        group.position.set(unitData.x, 0, unitData.z);
        group.userData.unitData = unitData;
        group.userData.isLarva = true;
        group.userData.wiggleOffset = Math.random() * Math.PI * 2; // Random start phase

        // Autonomous movement properties
        group.userData.targetAngle = Math.random() * Math.PI * 2;
        group.userData.movementTimer = 0;
        group.userData.nextMoveTime = 2 + Math.random() * 3;

        this.scene.addObject(unitData.id, group);
        this.units.set(unitData.id, group);

        return group;
    }

    // Create an evolution egg (when larva is evolving into a unit)
    createEvolutionEgg(eggData) {
        const group = new THREE.Group();

        // Main egg shell - translucent purple
        const eggGeometry = new THREE.SphereGeometry(1.2, 16, 12);
        const eggMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.primary,
            roughness: 0.3,
            metalness: 0.4,
            emissive: this.colors.emissive,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.7
        });
        const egg = new THREE.Mesh(eggGeometry, eggMaterial);
        egg.position.y = 1.2;
        egg.scale.set(1, 1.3, 1); // Elongate vertically
        egg.castShadow = true;
        egg.name = 'eggShell';
        group.add(egg);

        // Inner glow core
        const coreGeometry = new THREE.SphereGeometry(0.6, 12, 8);
        const coreMaterial = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff6600,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.8
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.position.y = 1.2;
        core.name = 'eggCore';
        group.add(core);

        // Veins/texture on egg surface
        const veinMaterial = new THREE.MeshBasicMaterial({
            color: this.colors.secondary,
            transparent: true,
            opacity: 0.5
        });
        for (let i = 0; i < 5; i++) {
            const veinGeometry = new THREE.TorusGeometry(0.8 + i * 0.1, 0.02, 4, 16);
            const vein = new THREE.Mesh(veinGeometry, veinMaterial);
            vein.position.y = 0.8 + i * 0.3;
            vein.rotation.x = Math.random() * 0.5;
            vein.rotation.z = Math.random() * Math.PI;
            group.add(vein);
        }

        // Add invisible selection hitbox
        const config = getUnitConfig('evolutionEgg');
        const hitboxGeometry = new THREE.CylinderGeometry(config.radius * 1.2, config.radius * 1.2, config.height, 8);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            transparent: true,
            opacity: 0
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.y = config.height / 2;
        hitbox.userData.unitData = eggData;
        group.add(hitbox);

        // Selection ring
        const selectionRing = this.createSelectionRing();
        selectionRing.scale.setScalar(config.radius / 0.8);
        selectionRing.visible = false;
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

        // Add debug collision box
        this.createDebugCollisionBox(group, config.radius, config.height);

        // Position
        group.position.set(eggData.x, 0, eggData.z);
        group.userData.unitData = eggData;
        group.userData.isEvolutionEgg = true;
        group.userData.pulseOffset = Math.random() * Math.PI * 2;

        this.scene.addObject(eggData.id, group);
        this.units.set(eggData.id, group);

        return group;
    }

    async createCombatUnit(unitData) {
        const group = new THREE.Group();

        const unitType = unitData.type || 'marine';
        const modelPath = COMBAT_MODELS[unitType] || COMBAT_MODELS.marine;
        const config = getUnitConfig(unitType);
        const scale = config.visualScale;

        try {
            const model = await modelLoader.load(modelPath);
            model.scale.setScalar(scale);
            modelLoader.applyFactionColor(model, this.colors.primary);

            // Center the model within the group to align with ring and hitbox
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.x -= center.x;
            model.position.z -= center.z;

            group.add(model);
        } catch (error) {
            console.error('[UnitRenderer] Failed to load combat model, using fallback');
            group.add(this.createFallbackCombatUnit());
        }

        // Add invisible selection hitbox
        const hitboxGeometry = new THREE.CylinderGeometry(config.radius * 1.5, config.radius * 1.5, config.height, 8);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            transparent: true,
            opacity: 0
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.y = config.height / 2;
        hitbox.userData.unitData = unitData;
        group.add(hitbox);

        // Selection ring
        const selectionRing = this.createSelectionRing();
        selectionRing.scale.setScalar(config.radius / 0.8);
        selectionRing.visible = false;
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

        // Add debug collision box
        this.createDebugCollisionBox(group, config.radius, config.height);

        // Determine Y position - flying units use flyHeight
        const yPosition = config.flyHeight || 0.5;
        group.position.set(unitData.x, yPosition, unitData.z);
        group.userData.unitData = unitData;

        // Mark flying units for animation
        if (config.flyHeight) {
            group.userData.isFlying = true;
            group.userData.baseFlyHeight = config.flyHeight;
        }

        this.scene.addObject(unitData.id, group);
        this.units.set(unitData.id, group);

        return group;
    }

    createFallbackCombatUnit() {
        const group = new THREE.Group();
        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.4, 0.6);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.primary,
            roughness: 0.4,
            metalness: 0.5,
            emissive: this.colors.emissive,
            emissiveIntensity: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.7;
        body.castShadow = true;
        group.add(body);
        return group;
    }

    createSelectionRing() {
        const geometry = new THREE.RingGeometry(0.8, 1, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthTest: false  // Always render on top of terrain
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.15;  // Raised higher above terrain
        ring.renderOrder = 999;  // Render last to ensure visibility
        return ring;
    }

    createDebugCollisionBox(group, radius, height) {
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 12);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00, // Yellow for units
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = height / 2;
        mesh.visible = this.debugMode;

        group.add(mesh);
        group.userData.debugCollisionBox = mesh;
    }

    setSelected(unitId, selected) {
        const unit = this.units.get(unitId);
        if (unit && unit.userData.selectionRing) {
            unit.userData.selectionRing.visible = selected;
        }
    }

    updateUnitPosition(unitId, x, z) {
        const unit = this.units.get(unitId);
        if (unit) {
            unit.position.x = x;
            unit.position.z = z;
        }
    }

    removeUnit(unitId) {
        const unit = this.units.get(unitId);
        if (unit) {
            this.scene.removeObject(unitId);
            this.units.delete(unitId);
        }
    }

    animateUnits(time) {
        this.units.forEach((group, id) => {
            const data = group.userData.unitData;
            if (!data) return;

            // Evolution egg pulsing animation
            if (group.userData.isEvolutionEgg) {
                const offset = group.userData.pulseOffset || 0;
                const pulseTime = time * 2 + offset;

                // Pulse the egg shell
                const eggShell = group.getObjectByName('eggShell');
                if (eggShell) {
                    const scale = 1 + Math.sin(pulseTime) * 0.05;
                    eggShell.scale.set(scale, scale * 1.3, scale);
                    eggShell.material.emissiveIntensity = 0.6 + Math.sin(pulseTime * 2) * 0.2;
                }

                // Pulse the inner core
                const core = group.getObjectByName('eggCore');
                if (core) {
                    const coreScale = 0.6 + Math.sin(pulseTime * 1.5) * 0.1;
                    core.scale.setScalar(coreScale);
                    core.material.emissiveIntensity = 1.0 + Math.sin(pulseTime * 3) * 0.3;
                }

                return; // Skip other animations for eggs
            }

            // Larva wiggling animation (movement is now handled in main.js)
            if (group.userData.isLarva) {
                const offset = group.userData.wiggleOffset || 0;
                const wiggleTime = time * 6 + offset; // Fast wiggle

                // Wiggle each segment with wave motion
                for (let i = 0; i < 5; i++) {
                    const segment = group.getObjectByName(`segment_${i}`);
                    if (segment) {
                        segment.position.x = Math.sin(wiggleTime + i * 0.6) * 0.25;
                        segment.position.y = 0.3 + Math.sin(wiggleTime * 2 + i * 0.4) * 0.1;
                    }
                }

                // Visual side-to-side wiggle for the whole larva 
                // Note: rotation.y is updated by main.js to face movement, 
                // we add the wiggle offset on top of it.
                const baseRotation = group.userData.baseRotationY || 0;
                const wiggleAmount = Math.sin(wiggleTime) * 0.3;
                group.rotation.y = baseRotation + wiggleAmount;

                return;
            }

            // Flying unit animation (Overlord, etc.) - gentle floating bob
            if (group.userData.isFlying) {
                const baseHeight = group.userData.baseFlyHeight || 8;
                const bobAmount = Math.sin(time * 1.5 + group.position.x * 0.1) * 0.5;
                group.position.y = baseHeight + bobAmount;

                // Slight tilt based on movement
                group.rotation.z = Math.sin(time * 0.8) * 0.05;
                group.rotation.x = Math.cos(time * 0.6) * 0.03;
                return;
            }

            // Idle bobbing animation for Protoss
            if (this.faction.id === 'protoss') {
                group.position.y = Math.sin(time * 2 + group.position.x) * 0.1;
            }

            // Mining animation - gentle wiggle while facing resource
            if (data.state === 'mining' || data.state === 'harvesting_gas') {
                const baseRotation = group.userData.baseRotationY || 0;
                group.rotation.y = baseRotation + Math.sin(time * 5) * 0.15;
            }

            // Handle cargo visual for workers
            const cargoVisual = group.userData.cargoVisual;
            if (cargoVisual && data.type === 'worker') {
                const isCarryingMinerals = data.state === 'returning_minerals';
                const isCarryingGas = data.state === 'returning_gas';

                if (isCarryingMinerals || isCarryingGas) {
                    cargoVisual.visible = true;

                    // Show the appropriate cargo type
                    const mineralCargo = cargoVisual.getObjectByName('mineralCargo');
                    const gasCargo = cargoVisual.getObjectByName('gasCargo');
                    if (mineralCargo) mineralCargo.visible = isCarryingMinerals;
                    if (gasCargo) gasCargo.visible = isCarryingGas;

                    // Animate cargo bobbing
                    cargoVisual.position.y = 1.5 + Math.sin(time * 4) * 0.1;
                    cargoVisual.rotation.y = time * 2; // Slow rotation
                } else {
                    cargoVisual.visible = false;
                }
            }
        });
    }

    dispose() {
        this.units.forEach((unit, id) => {
            this.removeUnit(id);
        });
    }
}

export default UnitRenderer;
