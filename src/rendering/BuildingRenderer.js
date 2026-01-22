/**
 * Building Rendering using GLTF Models
 */

import * as THREE from 'three';
import { modelLoader } from './ModelLoader.js';
import { getBuildingDimensions, normalizeBuildingType, BUILDING_DIMENSIONS } from '../game/BuildingConfig.js';

// Faction-specific colors
const FACTION_COLORS = {
    zerg: { primary: 0x8b00ff, secondary: 0x4a0080, emissive: 0x440088 },
    human: { primary: 0x00aaff, secondary: 0x004488, emissive: 0x003366 },
    protoss: { primary: 0xffcc00, secondary: 0x886600, emissive: 0x664400 }
};

// Model paths for buildings
const BUILDING_MODELS = {
    base: '/models/buildings/base.glb',
    supply: '/models/buildings/supply.glb',
    barracks: '/models/buildings/barracks.glb',
    factory: '/models/buildings/factory.glb',
    gasExtractor: '/models/buildings/gasextractor.glb'
};



export class BuildingRenderer {
    constructor(scene, faction) {
        this.scene = scene;
        this.faction = faction;
        this.buildings = new Map();
        this.colors = FACTION_COLORS[faction.id] || FACTION_COLORS.human;
        this.debugMode = false;

        // Preload building models
        this.preloadModels();
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.buildings.forEach(group => {
            if (group.userData.debugCollisionBox) {
                group.userData.debugCollisionBox.visible = enabled;
            }
        });
    }

    async preloadModels() {
        const modelsToLoad = Object.values(BUILDING_MODELS);
        await modelLoader.preloadModels(modelsToLoad);
    }

    createBuilding(buildingData) {

        const dims = getBuildingDimensions(buildingData.type);
        const group = new THREE.Group();
        group.position.set(buildingData.x, 0.5, buildingData.z);
        group.userData.buildingData = buildingData;

        // Add invisible hitbox for click detection (covers entire building)
        const hitboxSize = dims.clickHitboxSize;
        const hitboxHeight = buildingData.type === 'base' ? 6 : 4;

        // Initial fallback halfSize for collision before model loads
        buildingData.halfSize = dims.collisionHalfSize;

        const hitboxGeometry = new THREE.BoxGeometry(hitboxSize, hitboxHeight, hitboxSize);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false // Invisible but still raycastable
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.y = hitboxHeight / 2; // Raise to cover building height
        hitbox.userData.buildingData = buildingData; // Copy userData for raycast detection
        group.add(hitbox);

        // Add debug collision box (visible only in debug mode)
        this.createDebugCollisionBox(group, buildingData.type);

        // Load the appropriate model asynchronously
        this.loadBuildingModel(group, buildingData.type);

        // Add selection ring (hidden by default)
        const selectionRing = this.createSelectionRing(buildingData.type);
        selectionRing.visible = false;
        group.add(selectionRing);
        group.userData.selectionRing = selectionRing;

        // Add construction overlay if not complete
        if (!buildingData.isComplete) {
            const overlay = this.createConstructionOverlay(buildingData);
            group.add(overlay);
            group.userData.constructionOverlay = overlay;
        }

        // Add Pylon power field effect for Protoss
        const normalizedType = buildingData.type?.toLowerCase();
        if (this.faction.id === 'protoss' && (normalizedType === 'pylon' || normalizedType === 'supply')) {
            const powerFieldRadius = this.faction.buildings?.supply?.powerFieldRadius || 8;
            const powerField = this.createPowerFieldEffect(powerFieldRadius);
            powerField.visible = buildingData.isComplete; // Only show when construction is complete
            group.add(powerField);
            group.userData.powerField = powerField;
        }

        this.scene.addObject(buildingData.id, group);
        this.buildings.set(buildingData.id, group);

        return group;
    }

    createSelectionRing(type) {
        // Different sizes for different building types
        const canonicalType = normalizeBuildingType(type);
        const ringSize = canonicalType === 'base' ? 4 : 2.5;
        const geometry = new THREE.RingGeometry(ringSize, ringSize + 0.3, 32);
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

    setSelected(buildingId, selected) {
        const building = this.buildings.get(buildingId);
        if (building && building.userData.selectionRing) {
            building.userData.selectionRing.visible = selected;
        }
    }

    async loadBuildingModel(group, type) {
        // Normalize building type
        const canonicalType = normalizeBuildingType(type);
        const dims = BUILDING_DIMENSIONS[canonicalType];

        const modelPath = BUILDING_MODELS[canonicalType] || BUILDING_MODELS.base;
        const scale = dims.visualScale;

        try {
            const model = await modelLoader.load(modelPath);
            model.scale.setScalar(scale);
            modelLoader.applyFactionColor(model, this.colors.primary);

            // Dynamic measuring removed as per user request to use central config
            // Centering the model based on its bounding box
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());

            model.position.x -= center.x;
            model.position.z -= center.z;

            group.add(model);

            // Update debug collision box if it exists
            if (group.userData.debugCollisionBox) {
                const debugBox = group.userData.debugCollisionBox;
                // Dimensions are already set in createDebugCollisionBox based on config
            }
        } catch (error) {
            console.error(`[BuildingRenderer] Failed to load building model ${type} (canonical: ${canonicalType}):`, error);
            group.add(this.createFallbackBuilding(canonicalType));
        }
    }

    createFallbackBuilding(type) {
        // Simple procedural fallback
        const size = type === 'base' ? 4 : 2;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({
            color: this.colors.secondary,
            roughness: 0.5,
            metalness: 0.3
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = size / 2;
        return mesh;
    }

    createDebugCollisionBox(group, type) {
        const dims = getBuildingDimensions(type);
        const w = dims.collisionWidth || 5;
        const h = dims.collisionHeight || 4;
        const d = dims.collisionDepth || 5;

        // Use slightly larger values for wireframe to avoid z-fighting with model if they overlap perfectly
        const geometry = new THREE.BoxGeometry(w, h, d);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = h / 2;
        mesh.visible = this.debugMode;

        group.add(mesh);
        group.userData.debugCollisionBox = mesh;
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
        wire.userData.isWireframe = true;
        group.add(wire);

        // Progress bar background (Floating above building)
        const barBgGeometry = new THREE.PlaneGeometry(4, 0.3);
        const barBgMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const barBg = new THREE.Mesh(barBgGeometry, barBgMaterial);
        barBg.position.set(0, 7, 0);
        barBg.rotation.x = -Math.PI / 4; // Tilt towards camera
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
        barFill.position.set(0, 7, 0.01);
        barFill.rotation.x = -Math.PI / 4;
        barFill.scale.x = 0.01;
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
        timerSprite.position.set(0, 8, 0);
        timerSprite.scale.set(2, 1, 1);
        timerSprite.userData.isTimer = true;
        timerSprite.userData.canvas = canvas;
        timerSprite.userData.texture = texture;
        group.add(timerSprite);

        return group;
    }

    updateConstructionProgress(buildingId, progress, remainingTime, isPaused = false) {
        const building = this.buildings.get(buildingId);
        if (building && building.userData.constructionOverlay) {
            const overlay = building.userData.constructionOverlay;

            overlay.children.forEach(child => {
                // Update wireframe color (Green if active, Yellow if paused)
                if (child.userData?.isWireframe) {
                    child.material.color.set(isPaused ? 0xffcc00 : 0x00ff00);
                }

                // Update progress bar
                if (child.userData?.isProgressBar) {
                    child.scale.x = Math.max(0.01, progress);
                    child.position.x = -1.95 + (progress * 1.95);
                    child.material.color.set(isPaused ? 0xffcc00 : 0x00ff00);
                }

                // Update timer text
                if (child.userData?.isTimer) {
                    const canvas = child.userData.canvas;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.textAlign = 'center';

                    // No text status, just timer if not paused
                    if (!isPaused) {
                        ctx.fillStyle = '#00ff00';
                        ctx.font = 'bold 32px monospace';

                        const seconds = Math.ceil(remainingTime);
                        const mins = Math.floor(seconds / 60);
                        const secs = seconds % 60;
                        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                        ctx.fillText(timeStr, 64, 40);
                    } else {
                        // Paused - show nothing or maybe a small pause icon?
                        // User said "don't show any text above"
                    }

                    child.userData.texture.needsUpdate = true;
                }
            });

            // Adjust building opacity based on progress
            building.traverse(child => {
                if (child.isMesh && child.material && !child.userData?.isProgressBar && !child.userData?.isTimer) {
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
            const overlay = building.userData.constructionOverlay;
            building.remove(overlay);
            this.scene.disposeObject(overlay);
            building.userData.constructionOverlay = null;
            building.userData.buildingData.isComplete = true;

            // Reset opacity
            building.traverse(child => {
                if (child.isMesh && child.material && !child.userData?.isProgressBar && !child.userData?.isTimer) {
                    if (child.material.transparent) {
                        child.material.opacity = 1.0;
                    }
                }
            });

            // Show power field for completed Pylons
            if (building.userData.powerField) {
                building.userData.powerField.visible = true;
            }
        } else {
            console.error('[BuildingRenderer] Could not complete construction - building or overlay not found');
        }
    }

    removeBuilding(buildingId) {
        const building = this.buildings.get(buildingId);
        if (building) {
            this.scene.removeObject(buildingId);
            this.buildings.delete(buildingId);
        }
    }

    // Create Protoss Pylon power field visual effect
    createPowerFieldEffect(radius) {
        // Create a circular disc that shows the power field area
        const geometry = new THREE.CircleGeometry(radius, 64);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffcc00, // Protoss golden color
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            depthWrite: false // Prevent z-fighting with ground
        });
        const disc = new THREE.Mesh(geometry, material);
        disc.rotation.x = -Math.PI / 2; // Lay flat on ground
        disc.position.y = 0.1; // Slightly above ground
        disc.userData.isPowerField = true;
        return disc;
    }

    animateBuildings(time) {
        this.buildings.forEach((group, id) => {
            // Animate construction overlay rotation
            if (group.userData.constructionOverlay) {
                group.userData.constructionOverlay.rotation.y = time;
            }

            // Animate Pylon power field
            if (group.userData.powerField && group.userData.powerField.visible) {
                const powerField = group.userData.powerField;
                // Gentle pulsing opacity
                const pulse = 0.25 + Math.sin(time * 2) * 0.1;
                if (powerField.material) {
                    powerField.material.opacity = pulse;
                }
                // Slow rotation
                powerField.rotation.z = time * 0.1;
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
