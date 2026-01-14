/**
 * Terrain and Resource Node Rendering
 */

import * as THREE from 'three';

export class TerrainRenderer {
    constructor(scene) {
        this.scene = scene;
        this.terrainMesh = null;
        this.resourceNodes = new Map();
    }

    createTerrain() {
        // Main ground plane with gradient material
        const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);

        // Add some subtle terrain variation
        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 1]; // Note: plane is rotated, so Y becomes Z

            // Create subtle height variation using noise-like pattern
            const distance = Math.sqrt(x * x + z * z);
            const height = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.5;

            // Flatten center area for base
            const flattenRadius = 15;
            const flattenFactor = Math.max(0, 1 - distance / flattenRadius);

            vertices[i + 2] = height * (1 - flattenFactor);
        }

        groundGeometry.computeVertexNormals();

        // Ground material
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: false
        });

        this.terrainMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        this.terrainMesh.rotation.x = -Math.PI / 2;
        this.terrainMesh.receiveShadow = true;
        this.scene.addObject('terrain', this.terrainMesh);

        // Add decorative accent platforms
        this.addPlatforms();
    }

    addPlatforms() {
        // Central base platform
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

        // Glowing ring around platform
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

        // Multiple crystal shards per patch
        const crystalCount = 3 + Math.floor(Math.random() * 3);

        for (let i = 0; i < crystalCount; i++) {
            const crystal = this.createCrystal();
            crystal.position.x = (Math.random() - 0.5) * 2;
            crystal.position.z = (Math.random() - 0.5) * 2;
            crystal.rotation.y = Math.random() * Math.PI * 2;
            crystal.rotation.z = (Math.random() - 0.5) * 0.3;
            group.add(crystal);
        }

        // Glow effect
        const glowGeometry = new THREE.SphereGeometry(2.5, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.15
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.y = 1;
        group.add(glow);

        group.position.set(data.x, 0, data.z);
        this.scene.addObject(data.id, group);
        this.resourceNodes.set(data.id, { group, type: 'mineral', data });

        return group;
    }

    createCrystal() {
        // Create a stylized crystal using octahedron geometry
        const geometry = new THREE.OctahedronGeometry(0.8 + Math.random() * 0.4, 0);
        geometry.scale(0.6, 1.5, 0.6);

        const material = new THREE.MeshStandardMaterial({
            color: 0x00d4ff,
            roughness: 0.2,
            metalness: 0.8,
            emissive: 0x0066aa,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        });

        const crystal = new THREE.Mesh(geometry, material);
        crystal.position.y = 1 + Math.random() * 0.5;
        crystal.castShadow = true;

        return crystal;
    }

    createGasGeyser(data) {
        const group = new THREE.Group();

        // Geyser base/vent
        const ventGeometry = new THREE.CylinderGeometry(2, 2.5, 1, 16);
        const ventMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3a3a,
            roughness: 0.8,
            metalness: 0.2
        });
        const vent = new THREE.Mesh(ventGeometry, ventMaterial);
        vent.position.y = 0.5;
        vent.castShadow = true;
        group.add(vent);

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

        // Particle-like gas plume (simple representation)
        const plumeGeometry = new THREE.ConeGeometry(1, 4, 8);
        const plumeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.3
        });
        const plume = new THREE.Mesh(plumeGeometry, plumeMaterial);
        plume.position.y = 3;
        plume.userData.isPlume = true;
        group.add(plume);

        group.position.set(data.x, 0, data.z);
        this.scene.addObject(data.id, group);
        this.resourceNodes.set(data.id, { group, type: 'gas', data });

        return group;
    }

    updateResourceNode(id, data) {
        const node = this.resourceNodes.get(id);
        if (!node) return;

        // Update visual based on remaining resources
        const percent = data.amount / data.maxAmount;

        if (node.type === 'mineral') {
            // Dim crystals as resources deplete
            node.group.children.forEach(child => {
                if (child.material && child.material.emissiveIntensity !== undefined) {
                    child.material.emissiveIntensity = 0.5 * percent;
                }
            });
        }
    }

    animateResources(time) {
        this.resourceNodes.forEach((node, id) => {
            if (node.type === 'mineral') {
                // Subtle floating animation for crystals
                node.group.children.forEach((child, i) => {
                    if (child.geometry && child.geometry.type === 'OctahedronGeometry') {
                        child.position.y = 1 + Math.sin(time * 2 + i) * 0.1;
                    }
                });
            } else if (node.type === 'gas') {
                // Animate gas plume
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
        this.resourceNodes.clear();
    }
}

export default TerrainRenderer;
