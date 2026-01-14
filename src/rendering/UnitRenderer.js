/**
 * Unit Rendering - Workers and Combat Units
 */

import * as THREE from 'three';

// Faction-specific colors
const FACTION_COLORS = {
    zerg: { primary: 0x8b00ff, secondary: 0x4a0080, emissive: 0x440088 },
    human: { primary: 0x00aaff, secondary: 0x004488, emissive: 0x003366 },
    protoss: { primary: 0xffcc00, secondary: 0x886600, emissive: 0x664400 }
};

export class UnitRenderer {
    constructor(scene, faction) {
        this.scene = scene;
        this.faction = faction;
        this.units = new Map();
        this.colors = FACTION_COLORS[faction.id] || FACTION_COLORS.human;
    }

    createWorker(unitData) {
        const group = new THREE.Group();

        // Worker body shape varies by faction
        let body;

        if (this.faction.id === 'zerg') {
            // Organic, insect-like shape
            body = this.createZergWorker();
        } else if (this.faction.id === 'protoss') {
            // Sleek, hovering probe
            body = this.createProtossWorker();
        } else {
            // Mechanical SCV
            body = this.createHumanWorker();
        }

        group.add(body);

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

    createZergWorker() {
        const group = new THREE.Group();

        // Main body (organic blob)
        const bodyGeometry = new THREE.SphereGeometry(0.6, 12, 8);
        bodyGeometry.scale(1.2, 0.8, 1);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.primary,
            roughness: 0.6,
            metalness: 0.2,
            emissive: this.colors.emissive,
            emissiveIntensity: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        body.castShadow = true;
        group.add(body);

        // Eyes/sensory organs
        const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0044 });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.3, 0.6, 0.4);
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.3, 0.6, 0.4);
        group.add(rightEye);

        return group;
    }

    createHumanWorker() {
        const group = new THREE.Group();

        // SCV body (boxy mechanical)
        const bodyGeometry = new THREE.BoxGeometry(1, 1.2, 0.8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.primary,
            roughness: 0.4,
            metalness: 0.6,
            emissive: this.colors.emissive,
            emissiveIntensity: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        body.castShadow = true;
        group.add(body);

        // Cockpit/visor
        const visorGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.1);
        const visorMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8
        });
        const visor = new THREE.Mesh(visorGeometry, visorMaterial);
        visor.position.set(0, 1.1, 0.45);
        group.add(visor);

        // Arms/tools
        const armGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const armMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.5,
            metalness: 0.7
        });

        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.7, 0.6, 0);
        group.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.7, 0.6, 0);
        group.add(rightArm);

        return group;
    }

    createProtossWorker() {
        const group = new THREE.Group();

        // Floating probe body
        const bodyGeometry = new THREE.DodecahedronGeometry(0.5, 0);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.primary,
            roughness: 0.2,
            metalness: 0.8,
            emissive: this.colors.emissive,
            emissiveIntensity: 0.5
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1;
        body.castShadow = true;
        group.add(body);

        // Energy glow underneath
        const glowGeometry = new THREE.ConeGeometry(0.4, 0.8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.5
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.y = 0.3;
        glow.rotation.x = Math.PI;
        group.add(glow);

        // Psionic orb on top
        const orbGeometry = new THREE.SphereGeometry(0.2, 12, 12);
        const orbMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8
        });
        const orb = new THREE.Mesh(orbGeometry, orbMaterial);
        orb.position.y = 1.6;
        group.add(orb);

        return group;
    }

    createCombatUnit(unitData) {
        const group = new THREE.Group();

        // Generic combat unit body
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

        // Head
        const headGeometry = new THREE.SphereGeometry(0.3, 12, 12);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 1.6;
        head.castShadow = true;
        group.add(head);

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
            // Smooth movement could be added here
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

            // Idle bobbing animation
            if (this.faction.id === 'protoss') {
                // Probes float and bob
                group.position.y = Math.sin(time * 2 + group.position.x) * 0.1;
            }

            // Mining animation
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
