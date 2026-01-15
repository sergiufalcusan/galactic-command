/**
 * Model Loader - GLTF/GLB model loading utility
 * Handles loading, caching, and cloning of 3D models
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class ModelLoader {
    constructor() {
        this.loader = new GLTFLoader();
        this.cache = new Map();
        this.loadingPromises = new Map();
    }

    /**
     * Load a GLTF/GLB model with caching
     * @param {string} path - Path to the model file
     * @returns {Promise<THREE.Group>} - Cloned model ready for use
     */
    async load(path) {
        // Return cached model clone if available
        if (this.cache.has(path)) {
            return this.cloneModel(this.cache.get(path));
        }

        // Wait for existing loading promise if model is being loaded
        if (this.loadingPromises.has(path)) {
            await this.loadingPromises.get(path);
            return this.cloneModel(this.cache.get(path));
        }

        // Load the model
        const loadPromise = new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    this.cache.set(path, model);
                    resolve(model);
                },
                (progress) => {
                    // Loading progress
                },
                (error) => {
                    console.error(`Failed to load model: ${path}`, error);
                    reject(error);
                }
            );
        });

        this.loadingPromises.set(path, loadPromise);
        await loadPromise;
        this.loadingPromises.delete(path);

        return this.cloneModel(this.cache.get(path));
    }

    /**
     * Clone a model for reuse
     */
    cloneModel(original) {
        const clone = original.clone();

        // Clone materials to allow independent coloring
        clone.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
            }
        });

        return clone;
    }

    /**
     * Apply faction color to a model
     */
    applyFactionColor(model, color) {
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                // Tint the model with faction color
                if (child.material.color) {
                    child.material.color.lerp(new THREE.Color(color), 0.5);
                }
                child.material.emissive = new THREE.Color(color);
                child.material.emissiveIntensity = 0.2;
            }
        });
    }

    /**
     * Preload multiple models
     */
    async preloadModels(paths) {
        const promises = paths.map(path => this.load(path).catch(e => {
            console.warn(`Could not preload: ${path}`);
            return null;
        }));
        return Promise.all(promises);
    }

    /**
     * Clear cache to free memory
     */
    clearCache() {
        this.cache.forEach((model) => {
            model.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
        this.cache.clear();
    }
}

// Singleton instance
export const modelLoader = new ModelLoader();
export default modelLoader;
