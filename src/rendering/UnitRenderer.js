/**
 * Unit Rendering - Workers and Combat Units using GLTF Models
 */

import * as THREE from 'three';
import { modelLoader } from './ModelLoader.js';

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
    marine: '/models/units/marine.glb',
    zergling: '/models/units/zergling.glb',
    zealot: '/models/units/zealot.glb',
    overlord: '/models/units/overlord.glb'
};

// Model scales (may need adjustment)
const MODEL_SCALES = {
    worker: 1.5,
    marine: 1.5,
    zergling: 1.5,
    zealot: 1.5,
    overlord: 1.8,
    larva: 0.6
};

export class UnitRenderer {
    constructor(scene, faction) {
        this.scene = scene;
        this.faction = faction;
        this.units = new Map();
        this.colors = FACTION_COLORS[faction.id] || FACTION_COLORS.human;
        this.modelsLoaded = false;

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

    async createWorker(unitData) {
        const group = new THREE.Group();

        const modelPath = WORKER_MODELS[this.faction.id] || WORKER_MODELS.human;

        try {
            const model = await modelLoader.load(modelPath);
            model.scale.setScalar(MODEL_SCALES.worker);
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
        const hitboxGeometry = new THREE.CylinderGeometry(1.2, 1.2, 2.5, 8);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            transparent: true,
            opacity: 0
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.y = 1.25;
        hitbox.userData.unitData = unitData; // Essential for selection
        group.add(hitbox);

        // Add selection ring (hidden by default)
        const selectionRing = this.createSelectionRing();
        selectionRing.visible = false;
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

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
        const group = new THREE.Group();
        const scale = MODEL_SCALES.larva;

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

        // Add invisible selection hitbox
        const hitboxGeometry = new THREE.CylinderGeometry(0.8, 0.8, 1, 8);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            transparent: true,
            opacity: 0
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.y = 0.5;
        hitbox.userData.unitData = unitData;
        group.add(hitbox);

        // Selection ring
        const selectionRing = this.createSelectionRing();
        selectionRing.visible = false;
        selectionRing.scale.setScalar(0.6); // Smaller ring for larva
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

        // Position
        group.position.set(unitData.x, 0, unitData.z);
        group.userData.unitData = unitData;
        group.userData.isLarva = true;
        group.userData.wiggleOffset = Math.random() * Math.PI * 2; // Random start phase

        this.scene.addObject(unitData.id, group);
        this.units.set(unitData.id, group);

        return group;
    }

    async createCombatUnit(unitData) {
        const group = new THREE.Group();

        const unitType = unitData.type || 'marine';
        const modelPath = COMBAT_MODELS[unitType] || COMBAT_MODELS.marine;
        const scale = MODEL_SCALES[unitType] || 0.8;

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
        const hitboxGeometry = new THREE.CylinderGeometry(1.5, 1.5, 3, 8);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            transparent: true,
            opacity: 0
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.y = 1.5;
        hitbox.userData.unitData = unitData;
        group.add(hitbox);

        // Selection ring
        const selectionRing = this.createSelectionRing();
        selectionRing.visible = false;
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

        group.position.set(unitData.x, 0.5, unitData.z);
        group.userData.unitData = unitData;

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
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        return ring;
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

            // Larva wiggling animation
            if (group.userData.isLarva) {
                const offset = group.userData.wiggleOffset || 0;
                const wiggleTime = time * 3 + offset;

                // Wiggle each segment with wave motion
                for (let i = 0; i < 5; i++) {
                    const segment = group.getObjectByName(`segment_${i}`);
                    if (segment) {
                        segment.position.x = Math.sin(wiggleTime + i * 0.5) * 0.15;
                        segment.position.y = 0.3 + Math.sin(wiggleTime * 2 + i * 0.3) * 0.05;
                    }
                }

                // Slow random rotation (wandering)
                group.rotation.y += Math.sin(wiggleTime * 0.5) * 0.002;
                return; // Skip other animations for larva
            }

            // Idle bobbing animation for Protoss
            if (this.faction.id === 'protoss') {
                group.position.y = Math.sin(time * 2 + group.position.x) * 0.1;
            }

            // Mining animation - gentle rotation
            if (data.state === 'mining' || data.state === 'harvesting_gas') {
                group.rotation.y = Math.sin(time * 5) * 0.2;
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
