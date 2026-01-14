/**
 * Building Rendering
 */

import * as THREE from 'three';

const FACTION_COLORS = {
    zerg: { primary: 0x8b00ff, secondary: 0x4a0080, emissive: 0x440088 },
    human: { primary: 0x00aaff, secondary: 0x004488, emissive: 0x003366 },
    protoss: { primary: 0xffcc00, secondary: 0x886600, emissive: 0x664400 }
};

export class BuildingRenderer {
    constructor(scene, faction) {
        this.scene = scene;
        this.faction = faction;
        this.buildings = new Map();
        this.colors = FACTION_COLORS[faction.id] || FACTION_COLORS.human;
    }

    createBuilding(buildingData) {
        let building;

        switch (buildingData.type) {
            case 'base':
                building = this.createBase(buildingData);
                break;
            case 'supply':
                building = this.createSupply(buildingData);
                break;
            case 'gasExtractor':
                building = this.createGasExtractor(buildingData);
                break;
            case 'barracks':
                building = this.createProductionBuilding(buildingData, 'barracks');
                break;
            case 'factory':
                building = this.createProductionBuilding(buildingData, 'factory');
                break;
            default:
                building = this.createGenericBuilding(buildingData);
        }

        building.position.set(buildingData.x, 0, buildingData.z);
        building.userData.buildingData = buildingData;

        // Add construction overlay if not complete
        if (!buildingData.isComplete) {
            const overlay = this.createConstructionOverlay(buildingData);
            building.add(overlay);
            building.userData.constructionOverlay = overlay;
        }

        this.scene.addObject(buildingData.id, building);
        this.buildings.set(buildingData.id, building);

        return building;
    }

    createBase(data) {
        const group = new THREE.Group();

        if (this.faction.id === 'zerg') {
            // Hatchery - organic, oval shape
            const baseGeometry = new THREE.SphereGeometry(4, 16, 12);
            baseGeometry.scale(1.2, 0.5, 1);
            const baseMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.primary,
                roughness: 0.7,
                metalness: 0.1,
                emissive: this.colors.emissive,
                emissiveIntensity: 0.3
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 1;
            base.castShadow = true;
            group.add(base);

            // Central spawning pool
            const poolGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16);
            const poolMaterial = new THREE.MeshBasicMaterial({
                color: 0x44ff44,
                transparent: true,
                opacity: 0.7
            });
            const pool = new THREE.Mesh(poolGeometry, poolMaterial);
            pool.position.y = 1.3;
            group.add(pool);

        } else if (this.faction.id === 'protoss') {
            // Nexus - crystalline, pyramidal
            const baseGeometry = new THREE.CylinderGeometry(3, 4, 3, 6);
            const baseMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.primary,
                roughness: 0.2,
                metalness: 0.7,
                emissive: this.colors.emissive,
                emissiveIntensity: 0.4
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 1.5;
            base.castShadow = true;
            group.add(base);

            // Central pylon crystal
            const crystalGeometry = new THREE.OctahedronGeometry(1.5, 0);
            const crystalMaterial = new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                roughness: 0.1,
                metalness: 0.9,
                emissive: 0x00aaaa,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.9
            });
            const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
            crystal.position.y = 4;
            crystal.castShadow = true;
            group.add(crystal);

        } else {
            // Command Center - industrial, rectangular
            const baseGeometry = new THREE.BoxGeometry(6, 2, 5);
            const baseMaterial = new THREE.MeshStandardMaterial({
                color: 0x4a5568,
                roughness: 0.6,
                metalness: 0.4
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 1;
            base.castShadow = true;
            group.add(base);

            // Control tower
            const towerGeometry = new THREE.BoxGeometry(2, 3, 2);
            const tower = new THREE.Mesh(towerGeometry, baseMaterial);
            tower.position.set(1, 3.5, 0);
            tower.castShadow = true;
            group.add(tower);

            // Antenna
            const antennaGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
            const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            antenna.position.set(1, 6, 0);
            group.add(antenna);

            // Blue accent lights
            const lightMaterial = new THREE.MeshBasicMaterial({ color: this.colors.primary });
            const light1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 2), lightMaterial);
            light1.position.set(-2.5, 2.1, 0);
            group.add(light1);
        }

        return group;
    }

    createSupply(data) {
        const group = new THREE.Group();

        if (this.faction.id === 'zerg') {
            // Overlord would be a unit, but for building version
            const bodyGeometry = new THREE.SphereGeometry(2, 12, 10);
            bodyGeometry.scale(1, 0.6, 1);
            const bodyMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.primary,
                roughness: 0.6,
                metalness: 0.1,
                emissive: this.colors.emissive,
                emissiveIntensity: 0.3
            });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.position.y = 2;
            body.castShadow = true;
            group.add(body);

        } else if (this.faction.id === 'protoss') {
            // Pylon
            const pylonGeometry = new THREE.CylinderGeometry(0.5, 1.5, 4, 6);
            const pylonMaterial = new THREE.MeshStandardMaterial({
                color: this.colors.primary,
                roughness: 0.2,
                metalness: 0.7,
                emissive: this.colors.emissive,
                emissiveIntensity: 0.5
            });
            const pylon = new THREE.Mesh(pylonGeometry, pylonMaterial);
            pylon.position.y = 2;
            pylon.castShadow = true;
            group.add(pylon);

            // Power field
            const fieldGeometry = new THREE.RingGeometry(0, 4, 32);
            const fieldMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide
            });
            const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
            field.rotation.x = -Math.PI / 2;
            field.position.y = 0.05;
            group.add(field);

        } else {
            // Supply Depot
            const depotGeometry = new THREE.BoxGeometry(2.5, 1.5, 2.5);
            const depotMaterial = new THREE.MeshStandardMaterial({
                color: 0x4a5568,
                roughness: 0.6,
                metalness: 0.4
            });
            const depot = new THREE.Mesh(depotGeometry, depotMaterial);
            depot.position.y = 0.75;
            depot.castShadow = true;
            group.add(depot);

            // Accent stripe
            const stripeGeometry = new THREE.BoxGeometry(2.6, 0.2, 0.5);
            const stripeMaterial = new THREE.MeshBasicMaterial({ color: this.colors.primary });
            const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
            stripe.position.set(0, 1.4, 0);
            group.add(stripe);
        }

        return group;
    }

    createGasExtractor(data) {
        const group = new THREE.Group();

        // Base structure
        const baseGeometry = new THREE.CylinderGeometry(2.5, 3, 1.5, 8);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3a4a,
            roughness: 0.7,
            metalness: 0.3
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.75;
        base.castShadow = true;
        group.add(base);

        // Extraction pipe
        const pipeGeometry = new THREE.CylinderGeometry(0.8, 0.8, 3, 12);
        const pipeMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.secondary,
            roughness: 0.4,
            metalness: 0.6
        });
        const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
        pipe.position.y = 3;
        pipe.castShadow = true;
        group.add(pipe);

        // Green gas glow
        const glowGeometry = new THREE.CylinderGeometry(0.6, 0.6, 2, 12);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.6
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.y = 3;
        group.add(glow);

        return group;
    }

    createProductionBuilding(data, type) {
        const group = new THREE.Group();

        const isBarracks = type === 'barracks';
        const size = isBarracks ? { w: 4, h: 2.5, d: 3.5 } : { w: 4.5, h: 3, d: 4 };

        // Main structure
        const buildingGeometry = new THREE.BoxGeometry(size.w, size.h, size.d);
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a5568,
            roughness: 0.6,
            metalness: 0.4
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = size.h / 2;
        building.castShadow = true;
        group.add(building);

        // Faction accent
        const accentGeometry = new THREE.BoxGeometry(size.w + 0.1, 0.3, 0.5);
        const accentMaterial = new THREE.MeshBasicMaterial({ color: this.colors.primary });
        const accent = new THREE.Mesh(accentGeometry, accentMaterial);
        accent.position.set(0, size.h, 0);
        group.add(accent);

        // Door / entrance
        const doorGeometry = new THREE.BoxGeometry(1.5, 2, 0.1);
        const doorMaterial = new THREE.MeshBasicMaterial({
            color: 0x222222
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, 1, size.d / 2 + 0.05);
        group.add(door);

        return group;
    }

    createGenericBuilding(data) {
        const group = new THREE.Group();

        const buildingGeometry = new THREE.BoxGeometry(3, 2, 3);
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.secondary,
            roughness: 0.5,
            metalness: 0.3
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = 1;
        building.castShadow = true;
        group.add(building);

        return group;
    }

    createConstructionOverlay(data) {
        const group = new THREE.Group();

        // Wireframe scaffolding effect
        const wireGeometry = new THREE.BoxGeometry(5, 4, 5);
        const wireMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        const wire = new THREE.Mesh(wireGeometry, wireMaterial);
        wire.position.y = 2;
        group.add(wire);

        // Progress bar background
        const barBgGeometry = new THREE.PlaneGeometry(4, 0.3);
        const barBgMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const barBg = new THREE.Mesh(barBgGeometry, barBgMaterial);
        barBg.position.set(0, 5, 0);
        barBg.lookAt(new THREE.Vector3(0, 5, 10)); // Face camera roughly
        group.add(barBg);

        // Progress bar fill
        const barFillGeometry = new THREE.PlaneGeometry(3.9, 0.25);
        const barFillMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const barFill = new THREE.Mesh(barFillGeometry, barFillMaterial);
        barFill.position.set(0, 5, 0.01);
        barFill.scale.x = 0.01; // Start empty
        barFill.userData.isProgressBar = true;
        group.add(barFill);

        // Timer text using canvas texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('--:--', 64, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const timerMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        const timerSprite = new THREE.Sprite(timerMaterial);
        timerSprite.position.set(0, 6, 0);
        timerSprite.scale.set(2, 1, 1);
        timerSprite.userData.isTimer = true;
        timerSprite.userData.canvas = canvas;
        timerSprite.userData.texture = texture;
        group.add(timerSprite);

        return group;
    }

    updateConstructionProgress(buildingId, progress, remainingTime) {
        const building = this.buildings.get(buildingId);
        if (building && building.userData.constructionOverlay) {
            const overlay = building.userData.constructionOverlay;

            overlay.children.forEach(child => {
                // Update progress bar
                if (child.userData?.isProgressBar) {
                    child.scale.x = Math.max(0.01, progress);
                    child.position.x = -1.95 + (progress * 1.95); // Slide from left
                }

                // Update timer text
                if (child.userData?.isTimer) {
                    const canvas = child.userData.canvas;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#00ff00';
                    ctx.font = 'bold 32px monospace';
                    ctx.textAlign = 'center';

                    const seconds = Math.ceil(remainingTime);
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                    ctx.fillText(timeStr, 64, 40);

                    child.userData.texture.needsUpdate = true;
                }
            });

            // Adjust building opacity based on progress
            building.children.forEach(child => {
                if (child !== overlay && child.material) {
                    if (child.material.transparent === undefined) {
                        child.material.transparent = true;
                    }
                    child.material.opacity = 0.3 + (progress * 0.7);
                }
            });
        }
    }

    completeConstruction(buildingId) {
        const building = this.buildings.get(buildingId);
        if (building && building.userData.constructionOverlay) {
            building.remove(building.userData.constructionOverlay);
            building.userData.constructionOverlay = null;
            building.userData.buildingData.isComplete = true;
        }
    }

    removeBuilding(buildingId) {
        const building = this.buildings.get(buildingId);
        if (building) {
            this.scene.removeObject(buildingId);
            this.buildings.delete(buildingId);
        }
    }

    animateBuildings(time) {
        this.buildings.forEach((group, id) => {
            // Animate Protoss pylons
            if (this.faction.id === 'protoss' && group.userData.buildingData?.type === 'supply') {
                group.children.forEach(child => {
                    if (child.geometry?.type === 'RingGeometry') {
                        child.material.opacity = 0.15 + Math.sin(time * 2) * 0.1;
                    }
                });
            }

            // Animate construction
            if (group.userData.constructionOverlay) {
                group.userData.constructionOverlay.rotation.y = time;
            }
        });
    }

    dispose() {
        this.buildings.forEach((building, id) => {
            this.removeBuilding(id);
        });
    }
}

export default BuildingRenderer;
