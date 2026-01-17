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
    overlord: 1.8
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

            // Center the model within the group
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.x -= center.x;
            model.position.z -= center.z;

            group.add(model);
        } catch (error) {
            console.error('[UnitRenderer] Failed to load worker model, using fallback');
            group.add(this.createFallbackWorker());
        }

        // Add selection ring (hidden by default)
        const selectionRing = this.createSelectionRing();
        selectionRing.visible = false;
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

        // Set position
        group.position.set(unitData.x, 0, unitData.z);
        group.userData.unitData = unitData;

        this.scene.addObject(unitData.id, group);
        this.units.set(unitData.id, group);

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

    async createCombatUnit(unitData) {
        const group = new THREE.Group();

        const unitType = unitData.type || 'marine';
        const modelPath = COMBAT_MODELS[unitType] || COMBAT_MODELS.marine;
        const scale = MODEL_SCALES[unitType] || 0.8;

        try {
            const model = await modelLoader.load(modelPath);
            model.scale.setScalar(scale);
            modelLoader.applyFactionColor(model, this.colors.primary);

            // Center the model within the group
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.x -= center.x;
            model.position.z -= center.z;

            group.add(model);
        } catch (error) {
            console.error('[UnitRenderer] Failed to load combat model, using fallback');
            group.add(this.createFallbackCombatUnit());
        }

        // Selection ring
        const selectionRing = this.createSelectionRing();
        selectionRing.visible = false;
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

        group.position.set(unitData.x, 0, unitData.z);
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

            // Idle bobbing animation for Protoss
            if (this.faction.id === 'protoss') {
                group.position.y = Math.sin(time * 2 + group.position.x) * 0.1;
            }

            // Mining animation - gentle rotation
            if (data && (data.state === 'mining' || data.state === 'harvesting_gas')) {
                group.rotation.y = Math.sin(time * 5) * 0.2;
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
