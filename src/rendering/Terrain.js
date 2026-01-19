/**
 * Terrain and Resource Node Rendering using GLTF Models
 */

import * as THREE from 'three';
import { modelLoader } from './ModelLoader.js';

export class TerrainRenderer {
    constructor(scene, faction = null) {
        this.scene = scene;
        this.faction = faction;
        this.terrainMesh = null;
        this.resourceNodes = new Map();
        this.creepPatches = new Map(); // Track creep terrain patches for Zerg

        // Preload resource models
        this.preloadResources();
    }

    async preloadResources() {
        const modelsToLoad = [
            '/models/mineral.glb',
            '/models/geyser.glb'
        ];
        await modelLoader.preloadModels(modelsToLoad);
    }

    createTerrain() {
        // Main ground plane with gradient material
        const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);

        // Add some subtle terrain variation
        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 1];

            const distance = Math.sqrt(x * x + z * z);
            const height = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.5;

            const flattenRadius = 15;
            const flattenFactor = Math.max(0, 1 - distance / flattenRadius);

            vertices[i + 2] = height * (1 - flattenFactor);
        }

        groundGeometry.computeVertexNormals();

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.9,
            metalness: 0.1
        });

        this.terrainMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        this.terrainMesh.rotation.x = -Math.PI / 2;
        this.terrainMesh.receiveShadow = true;
        this.scene.addObject('terrain', this.terrainMesh);

        this.addPlatforms();
    }

    addPlatforms() {
        // Skip base platform for Zerg - they use creep instead
        if (this.faction?.id === 'zerg') {
            return;
        }

        const platformGeometry = new THREE.CylinderGeometry(12, 14, 0.5, 32);
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a4e,
            roughness: 0.7,
            metalness: 0.3,
            emissive: 0x111122,
            emissiveIntensity: 0.2
        });

        const basePlatform = new THREE.Mesh(platformGeometry, platformMaterial);
        basePlatform.position.y = 0.25;
        basePlatform.receiveShadow = true;
        this.scene.addObject('basePlatform', basePlatform);
    }

    createMineralPatch(data) {
        const group = new THREE.Group();
        group.position.set(data.x, 0.5, data.z);

        // Load mineral model
        this.loadResourceModel(group, '/models/mineral.glb', 1.5, 0x00d4ff);

        // Glow effect
        const glowGeometry = new THREE.SphereGeometry(2, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.15
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.y = 1;
        group.add(glow);

        this.scene.addObject(data.id, group);
        this.resourceNodes.set(data.id, { group, type: 'mineral', data });

        return group;
    }

    createGasGeyser(data) {
        const group = new THREE.Group();
        group.position.set(data.x, 0.5, data.z);

        // Load geyser model
        this.loadResourceModel(group, '/models/geyser.glb', 2.0, 0x3a3a3a).then(() => {
            // Tag the loaded model for visibility control
            group.children.forEach(child => {
                if (!child.userData.isPlume && !child.userData.isGasGlow && !child.userData.isExtractionHaze) {
                    child.userData.isGeyserModel = true;
                }
            });
        });

        // Inner glow (gas)
        const gasGeometry = new THREE.CylinderGeometry(1.5, 1.8, 0.8, 16);
        const gasMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.7
        });
        const gasGlow = new THREE.Mesh(gasGeometry, gasMaterial);
        gasGlow.position.y = 0.6;
        gasGlow.userData.isGasGlow = true;
        group.add(gasGlow);

        // Simple gas plume
        const plumeGeometry = new THREE.ConeGeometry(0.8, 3, 8);
        const plumeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.3
        });
        const plume = new THREE.Mesh(plumeGeometry, plumeMaterial);
        plume.position.y = 2.5;
        plume.userData.isPlume = true;
        group.add(plume);

        // Extraction haze (shown when extractor is built)
        const hazeGeometry = new THREE.CylinderGeometry(2.5, 2.5, 4, 16, 1, true);
        const hazeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.0, // Start invisible
            side: THREE.DoubleSide
        });
        const haze = new THREE.Mesh(hazeGeometry, hazeMaterial);
        haze.position.y = 3;
        haze.userData.isExtractionHaze = true;
        haze.visible = false; // Hidden until extractor is built
        group.add(haze);

        this.scene.addObject(data.id, group);
        this.resourceNodes.set(data.id, { group, type: 'gas', data });

        return group;
    }

    async loadResourceModel(group, path, scale, color) {
        try {
            const model = await modelLoader.load(path);
            model.scale.setScalar(scale);

            // For resources, we don't necessarily apply faction color
            // but we can apply a default tint if needed
            if (path.includes('mineral')) {
                modelLoader.applyFactionColor(model, 0x00d4ff);
            }

            // Center the model's bounding box on X/Z to align with the base circle
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());

            // Offset model position to subtract the center offset (centering it)
            // We keep Y relative to the pivot if needed, or we could center it too but resources usually sit on ground
            model.position.x -= center.x;
            model.position.z -= center.z;

            group.add(model);
        } catch (error) {
            console.error(`[TerrainRenderer] Failed to load resource model ${path}:`, error);
        }
    }

    updateResourceNode(id, data) {
        const node = this.resourceNodes.get(id);
        if (!node) return;

        const percent = data.amount / data.maxAmount;

        if (node.type === 'mineral') {
            node.group.traverse(child => {
                if (child.isMesh && child.material && child.material.emissiveIntensity !== undefined) {
                    child.material.emissiveIntensity = 0.5 * percent;
                }
            });
        } else if (node.type === 'gas') {
            // Hide geyser model when extractor is built
            node.group.children.forEach(child => {
                if (child.userData.isPlume || child.userData.isGasGlow || child.userData.isGeyserModel) {
                    child.visible = !data.hasExtractor;
                }
                // Show/update extraction haze when extractor is built
                if (child.userData.isExtractionHaze) {
                    child.visible = data.hasExtractor && data.amount > 0;
                    if (child.material) {
                        child.material.opacity = 0.4 * percent; // Fade as gas depletes
                    }
                }
            });
        }
    }

    animateResources(time) {
        this.resourceNodes.forEach((node, id) => {
            // Minerals stay still - no rotation
            if (node.type === 'gas') {
                node.group.children.forEach(child => {
                    // Animate gas plume (only if visible - no extractor)
                    if (child.userData.isPlume && child.visible) {
                        child.scale.y = 1 + Math.sin(time * 3) * 0.2;
                        child.material.opacity = 0.2 + Math.sin(time * 4) * 0.1;
                    }
                    // Animate extraction haze (swirling effect)
                    if (child.userData.isExtractionHaze && child.visible) {
                        child.rotation.y = time * 0.5;
                        child.scale.y = 1 + Math.sin(time * 2) * 0.15;
                    }
                });
            }
        });
    }

    // ============== UNIFIED MERGED CREEP SYSTEM ==============
    // Single merged mesh that combines all creep circles into one organic shape

    static HATCHERY_CREEP_RADIUS = 40; // Doubled from 20
    static CREEP_COLONY_RADIUS = 20;   // Doubled from 10 (half of Hatchery)

    // Initialize creep system
    initCreepSystem() {
        this.creepSources = this.creepSources || new Map(); // {buildingId: {x, z, radius}}
        this.creepMesh = this.creepMesh || null;

        if (!this.creepMaterial) {
            this.creepMaterial = new THREE.MeshStandardMaterial({
                color: 0x5a1080,
                roughness: 0.8,
                metalness: 0.05,
                transparent: true,
                opacity: 0.95,
                emissive: 0x330044,
                emissiveIntensity: 0.35,
                side: THREE.DoubleSide
            });
        }
    }

    // Add a creep source and regenerate the unified mesh
    createCreep(buildingId, x, z, radius = 8, isBase = false) {
        this.initCreepSystem();

        // Determine radius based on building type
        const creepRadius = isBase ?
            TerrainRenderer.HATCHERY_CREEP_RADIUS :
            TerrainRenderer.CREEP_COLONY_RADIUS;

        // Store the creep source
        this.creepSources.set(buildingId, { x, z, radius: creepRadius, isBase });

        // Also store in creepPatches for isOnCreep checks
        this.creepPatches.set(buildingId, { x, z, radius: creepRadius, isBase });

        // Regenerate the unified mesh
        this.regenerateCreepMesh();

        console.log(`[Creep] Added ${isBase ? 'Hatchery' : 'Colony'} at (${x}, ${z}) radius ${creepRadius}`);
    }

    // Remove a creep source and regenerate
    removeCreep(buildingId) {
        if (this.creepSources?.has(buildingId)) {
            this.creepSources.delete(buildingId);
            this.creepPatches.delete(buildingId);
            this.regenerateCreepMesh();
            console.log(`[Creep] Removed creep for building ${buildingId}`);
        }
    }

    // Get terrain height at any world position (matching the terrain generation formula)
    getTerrainHeight(x, z) {
        const distance = Math.sqrt(x * x + z * z);
        const height = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.5;

        const flattenRadius = 15;
        const flattenFactor = Math.max(0, 1 - distance / flattenRadius);

        return height * (1 - flattenFactor);
    }

    // Check if a position is on any creep source
    isOnCreep(x, z) {
        if (!this.creepPatches || this.creepPatches.size === 0) {
            return false;
        }

        for (const [id, source] of this.creepPatches) {
            const dx = x - source.x;
            const dz = z - source.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            // Allow building within 95% of radius
            if (distance <= source.radius * 0.95) {
                return true;
            }
        }
        return false;
    }

    // Check if a point is inside any creep source
    isPointInCreep(x, z) {
        for (const [id, source] of this.creepSources) {
            const dx = x - source.x;
            const dz = z - source.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance <= source.radius) {
                return true;
            }
        }
        return false;
    }

    // Regenerate creep as single unified mesh
    regenerateCreepMesh() {
        // Remove old unified mesh
        if (this.creepMesh) {
            this.scene.removeObject('unified_creep');
            this.creepMesh.geometry.dispose();
            this.creepMesh = null;
        }

        if (!this.creepSources || this.creepSources.size === 0) return;

        // Create unified terrain-conforming mesh
        const geometry = this.createUnifiedCreepGeometry();
        if (!geometry) return;

        this.creepMesh = new THREE.Mesh(geometry, this.creepMaterial);
        this.creepMesh.receiveShadow = true;
        this.creepMesh.userData.isCreep = true;

        this.scene.addObject('unified_creep', this.creepMesh);
    }

    // Create a single unified mesh covering all creep sources
    createUnifiedCreepGeometry() {
        const sources = Array.from(this.creepSources.values());
        if (sources.length === 0) return null;

        // Calculate bounding box of all sources
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        sources.forEach(s => {
            minX = Math.min(minX, s.x - s.radius);
            maxX = Math.max(maxX, s.x + s.radius);
            minZ = Math.min(minZ, s.z - s.radius);
            maxZ = Math.max(maxZ, s.z + s.radius);
        });

        // Grid resolution - smaller = smoother edges
        const cellSize = 0.8;
        const cols = Math.ceil((maxX - minX) / cellSize) + 1;
        const rows = Math.ceil((maxZ - minZ) / cellSize) + 1;

        // Create grid of vertices
        const vertexGrid = []; // 2D array of vertex indices (-1 if outside creep)
        const vertices = [];
        const uvs = [];
        let vertexIndex = 0;

        for (let j = 0; j <= rows; j++) {
            vertexGrid[j] = [];
            for (let i = 0; i <= cols; i++) {
                const x = minX + i * cellSize;
                const z = minZ + j * cellSize;

                if (this.isPointInCreep(x, z)) {
                    const y = this.getTerrainHeight(x, z) + 0.1;
                    vertices.push(x, y, z);

                    // UVs based on position
                    const u = (x - minX) / (maxX - minX);
                    const v = (z - minZ) / (maxZ - minZ);
                    uvs.push(u, v);

                    vertexGrid[j][i] = vertexIndex++;
                } else {
                    vertexGrid[j][i] = -1;
                }
            }
        }

        if (vertices.length === 0) return null;

        // Create triangles using marching squares for smooth edges
        const indices = [];
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const v00 = vertexGrid[j][i];
                const v10 = vertexGrid[j][i + 1];
                const v01 = vertexGrid[j + 1][i];
                const v11 = vertexGrid[j + 1][i + 1];

                // Count how many corners are inside
                const corners = [v00 >= 0, v10 >= 0, v01 >= 0, v11 >= 0];
                const insideCount = corners.filter(c => c).length;

                if (insideCount === 4) {
                    // Full quad - 2 triangles
                    indices.push(v00, v10, v11);
                    indices.push(v00, v11, v01);
                } else if (insideCount === 3) {
                    // Partial - 1 triangle (smooth edge)
                    if (!corners[0]) { // v00 missing
                        indices.push(v10, v11, v01);
                    } else if (!corners[1]) { // v10 missing
                        indices.push(v00, v11, v01);
                    } else if (!corners[2]) { // v01 missing  
                        indices.push(v00, v10, v11);
                    } else { // v11 missing
                        indices.push(v00, v10, v01);
                    }
                }
                // Skip cells with 2 or fewer corners
            }
        }

        if (indices.length === 0) return null;

        // Create BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    // Animate creep with pulsing effect
    animateCreep(time) {
        if (this.creepMaterial) {
            const pulse = 0.3 + Math.sin(time * 1.0) * 0.1;
            this.creepMaterial.emissiveIntensity = pulse;
        }
    }

    dispose() {
        this.resourceNodes.forEach((node, id) => {
            this.scene.removeObject(id);
        });
        this.resourceNodes.clear();

        // Clean up unified creep mesh
        if (this.creepMesh) {
            this.scene.removeObject('unified_creep');
            this.creepMesh.geometry.dispose();
            this.creepMesh = null;
        }

        this.creepSources?.clear();
        this.creepPatches.clear();

        if (this.creepMaterial) {
            this.creepMaterial.dispose();
            this.creepMaterial = null;
        }
    }
}

export default TerrainRenderer;





