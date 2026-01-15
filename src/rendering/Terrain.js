/**
 * Terrain and Resource Node Rendering using GLTF Models
 */

import * as THREE from 'three';
import { modelLoader } from './ModelLoader.js';

export class TerrainRenderer {
    constructor(scene) {
        this.scene = scene;
        this.terrainMesh = null;
        this.resourceNodes = new Map();

        // Preload resource models
        this.preloadModels();
    }

    async preloadModels() {
        await modelLoader.preloadModels([
            '/models/mineral.glb',
            '/models/geyser.glb'
        ]);
        console.log('[TerrainRenderer] Resource models preloaded');
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

        const ringGeometry = new THREE.RingGeometry(13.5, 14.5, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.51;
        this.scene.addObject('platformRing', ring);
    }

    createMineralPatch(data) {
        const group = new THREE.Group();
        group.position.set(data.x, 0, data.z);

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
        group.position.set(data.x, 0, data.z);

        // Load geyser model
        this.loadResourceModel(group, '/models/geyser.glb', 2.0, 0x3a3a3a);

        // Inner glow (gas)
        const gasGeometry = new THREE.CylinderGeometry(1.5, 1.8, 0.8, 16);
        const gasMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.7
        });
        const gasGlow = new THREE.Mesh(gasGeometry, gasMaterial);
        gasGlow.position.y = 0.6;
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

            // Center the model within the group so circles align properly
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.x -= center.x;
            model.position.z -= center.z;

            group.add(model);
        } catch (error) {
            console.warn(`[TerrainRenderer] Failed to load resource model ${path}:`, error);
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
        }
    }

    animateResources(time) {
        this.resourceNodes.forEach((node, id) => {
            // Minerals stay still - no rotation
            if (node.type === 'gas') {
                // Animate gas plume only
                node.group.children.forEach(child => {
                    if (child.userData.isPlume) {
                        child.scale.y = 1 + Math.sin(time * 3) * 0.2;
                        child.material.opacity = 0.2 + Math.sin(time * 4) * 0.1;
                    }
                });
            }
        });
    }

    dispose() {
        this.resourceNodes.forEach((node, id) => {
            this.scene.removeObject(id);
        });
        this.resourceNodes.clear();
    }
}

export default TerrainRenderer;
