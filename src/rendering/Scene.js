/**
 * Three.js Scene Setup and Management
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class GameScene {
    constructor(container) {
        this.container = container;
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        // Three.js core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Lighting
        this.ambientLight = null;
        this.directionalLight = null;

        // Object collections
        this.objects = new Map();

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a15);
        this.scene.fog = new THREE.Fog(0x0a0a15, 80, 200);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            this.width / this.height,
            0.1,
            1000
        );
        this.camera.position.set(0, 40, 50);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Controls - disabled by default, enabled with Shift key
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 120;
        this.controls.maxPolarAngle = Math.PI / 2.2;
        this.controls.target.set(0, 0, 0);
        this.controls.enabled = false; // Disabled by default

        // Enable controls only when Shift is held
        this.onKeyDown = (e) => {
            if (e.key === 'Shift') {
                this.controls.enabled = true;
            }
        };
        this.onKeyUp = (e) => {
            if (e.key === 'Shift') {
                this.controls.enabled = false;
            }
        };
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);

        // Lighting
        this.setupLighting();

        // Grid helper (subtle)
        const gridHelper = new THREE.GridHelper(200, 40, 0x1a1a2e, 0x0f0f1a);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // Resize handler
        this.onResizeHandler = () => this.onResize();
        window.addEventListener('resize', this.onResizeHandler);
    }

    setupLighting() {
        // Ambient light
        this.ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(this.ambientLight);

        // Main directional light (sun)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        this.directionalLight.position.set(30, 50, 30);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 1;
        this.directionalLight.shadow.camera.far = 150;
        this.directionalLight.shadow.camera.left = -50;
        this.directionalLight.shadow.camera.right = 50;
        this.directionalLight.shadow.camera.top = 50;
        this.directionalLight.shadow.camera.bottom = -50;
        this.scene.add(this.directionalLight);

        // Hemisphere light for ambient color variation
        const hemisphereLight = new THREE.HemisphereLight(0x4488ff, 0x002244, 0.3);
        this.scene.add(hemisphereLight);

        // Point lights for atmosphere
        const pointLight1 = new THREE.PointLight(0x00aaff, 0.5, 100);
        pointLight1.position.set(-30, 10, -30);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff00aa, 0.3, 100);
        pointLight2.position.set(30, 10, 30);
        this.scene.add(pointLight2);
    }

    onResize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.width, this.height);
    }

    addObject(id, object) {
        this.objects.set(id, object);
        this.scene.add(object);
    }

    removeObject(id) {
        const object = this.objects.get(id);
        if (object) {
            this.scene.remove(object);
            this.objects.delete(id);
            this.disposeObject(object);
        }
    }

    /**
     * Recursively dispose of an object's resources (geometries, materials, textures)
     */
    disposeObject(object) {
        if (!object) return;

        object.traverse((node) => {
            if (node.isMesh || node.isSprite || node.isLine || node.isPoints) {
                // Dispose geometry
                if (node.geometry) {
                    node.geometry.dispose();
                }

                // Dispose materials
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(m => this.disposeMaterial(m));
                    } else {
                        this.disposeMaterial(node.material);
                    }
                }
            }
        });
    }

    /**
     * Helper to dispose of a single material and its textures
     */
    disposeMaterial(material) {
        if (!material) return;

        // Dispose textures
        Object.keys(material).forEach(key => {
            if (material[key] && material[key].isTexture) {
                material[key].dispose();
            }
        });

        material.dispose();
    }

    getObject(id) {
        return this.objects.get(id);
    }

    update() {
        this.controls.update();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('resize', this.onResizeHandler);

        this.controls.dispose();
        this.renderer.dispose();

        this.objects.forEach((obj, id) => {
            this.removeObject(id);
        });

        if (this.container && this.renderer.domElement) {
            this.container.removeChild(this.renderer.domElement);
        }
    }

    // Camera movement helpers
    panCamera(dx, dz) {
        const offset = new THREE.Vector3(dx, 0, dz);
        offset.applyQuaternion(this.camera.quaternion);
        this.controls.target.add(offset);
        this.camera.position.add(offset);
    }

    setCameraTarget(x, y, z) {
        this.controls.target.set(x, y, z);
    }
}

export default GameScene;
