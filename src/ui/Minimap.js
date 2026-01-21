/**
 * Minimap UI Component
 * Renders a top-down view of the game map showing units, buildings, and resources
 */

import gameState from '../game/GameState.js';

export class Minimap {
    constructor(scene) {
        this.scene = scene; // GameScene reference for camera position
        this.canvas = document.getElementById('minimap-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Map bounds (from Terrain.js - 200x200 plane)
        this.mapSize = 200;
        this.mapHalf = this.mapSize / 2;

        // Canvas size
        this.width = 200;
        this.height = 200;

        // Set canvas resolution
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Colors
        this.colors = {
            background: '#0a0a15',
            terrain: '#1a1a2e',
            minerals: '#00d4ff',
            gas: '#00ff88',
            playerUnit: '#00ff00',
            playerBuilding: '#00cc00',
            enemyUnit: '#ff0000',
            enemyBuilding: '#cc0000',
            camera: 'rgba(255, 255, 255, 0.3)',
            cameraBorder: 'rgba(255, 255, 255, 0.8)'
        };

        // Click handling for camera movement
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.onMouseUp());

        this.isDragging = false;
    }

    /**
     * Convert world coordinates to minimap coordinates
     */
    worldToMinimap(worldX, worldZ) {
        // World coords: -100 to 100
        // Minimap coords: 0 to 200
        const x = ((worldX + this.mapHalf) / this.mapSize) * this.width;
        const y = ((worldZ + this.mapHalf) / this.mapSize) * this.height;
        return { x, y };
    }

    /**
     * Convert minimap coordinates to world coordinates
     */
    minimapToWorld(minimapX, minimapY) {
        const worldX = (minimapX / this.width) * this.mapSize - this.mapHalf;
        const worldZ = (minimapY / this.height) * this.mapSize - this.mapHalf;
        return { x: worldX, z: worldZ };
    }

    /**
     * Handle click on minimap to move camera
     */
    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;
        const minimapX = (e.clientX - rect.left) * scaleX;
        const minimapY = (e.clientY - rect.top) * scaleY;

        const worldPos = this.minimapToWorld(minimapX, minimapY);
        this.moveCameraTo(worldPos.x, worldPos.z);
    }

    onMouseDown(e) {
        this.isDragging = true;
        this.onClick(e);
    }

    onMouseMove(e) {
        if (this.isDragging) {
            this.onClick(e);
        }
    }

    onMouseUp() {
        this.isDragging = false;
    }

    /**
     * Move camera to world position
     */
    moveCameraTo(worldX, worldZ) {
        if (this.scene && this.scene.controls) {
            this.scene.setCameraTarget(worldX, 0, worldZ);

            // Also update camera position to maintain viewing angle
            const camera = this.scene.camera;
            const controls = this.scene.controls;

            // Calculate offset from target to camera
            const offsetX = camera.position.x - controls.target.x;
            const offsetY = camera.position.y - controls.target.y;
            const offsetZ = camera.position.z - controls.target.z;

            // Move camera to new position maintaining offset
            camera.position.set(worldX + offsetX, offsetY, worldZ + offsetZ);
            controls.target.set(worldX, 0, worldZ);
        }
    }

    /**
     * Get camera view frustum for minimap display
     */
    getCameraViewRect() {
        if (!this.scene || !this.scene.camera) return null;

        const camera = this.scene.camera;
        const target = this.scene.controls?.target;

        if (!target) return null;

        // Estimate visible area based on camera height and FOV
        const cameraHeight = camera.position.y;
        const fov = camera.fov * (Math.PI / 180);
        const aspect = camera.aspect;

        // Calculate visible width/height at ground level
        const visibleHeight = 2 * cameraHeight * Math.tan(fov / 2);
        const visibleWidth = visibleHeight * aspect;

        // Scale down since camera is looking at an angle
        const scale = 0.6;

        return {
            x: target.x,
            z: target.z,
            width: visibleWidth * scale,
            height: visibleHeight * scale
        };
    }

    /**
     * Render the minimap
     */
    render() {
        const ctx = this.ctx;

        // Clear
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw terrain background
        ctx.fillStyle = this.colors.terrain;
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw resources
        this.drawResources(ctx);

        // Draw buildings
        this.drawBuildings(ctx);

        // Draw units
        this.drawUnits(ctx);

        // Draw camera view rectangle
        this.drawCameraView(ctx);
    }

    drawResources(ctx) {
        const resources = gameState.resources || [];

        resources.forEach(resource => {
            const pos = this.worldToMinimap(resource.x, resource.z);

            if (resource.type === 'mineral') {
                ctx.fillStyle = this.colors.minerals;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
                ctx.fill();
            } else if (resource.type === 'gas') {
                ctx.fillStyle = this.colors.gas;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    drawBuildings(ctx) {
        const buildings = gameState.buildings || [];

        buildings.forEach(building => {
            const pos = this.worldToMinimap(building.x, building.z);

            // Player buildings are green, enemies would be red
            ctx.fillStyle = this.colors.playerBuilding;

            // Building size based on type
            let size = 6;
            if (building.type === 'base' || building.type === 'hatchery' || building.type === 'nexus') {
                size = 10;
            } else if (building.type === 'supply' || building.type === 'pylon') {
                size = 4;
            }

            // Unfinshed buildings are semi-transparent
            if (!building.isComplete) {
                ctx.globalAlpha = 0.5;
            }

            ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
            ctx.globalAlpha = 1;
        });
    }

    drawUnits(ctx) {
        const units = gameState.units || [];

        units.forEach(unit => {
            const pos = this.worldToMinimap(unit.x, unit.z);

            // Player units are bright green
            ctx.fillStyle = this.colors.playerUnit;

            // Unit size
            const size = unit.type === 'worker' || unit.type === 'larva' ? 2 : 3;

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawCameraView(ctx) {
        const viewRect = this.getCameraViewRect();
        if (!viewRect) return;

        const topLeft = this.worldToMinimap(
            viewRect.x - viewRect.width / 2,
            viewRect.z - viewRect.height / 2
        );
        const size = {
            width: (viewRect.width / this.mapSize) * this.width,
            height: (viewRect.height / this.mapSize) * this.height
        };

        // Fill
        ctx.fillStyle = this.colors.camera;
        ctx.fillRect(topLeft.x, topLeft.y, size.width, size.height);

        // Border
        ctx.strokeStyle = this.colors.cameraBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(topLeft.x, topLeft.y, size.width, size.height);
    }

    /**
     * Update minimap (call from game loop)
     */
    update() {
        this.render();
    }

    dispose() {
        // Remove event listeners
        this.canvas.removeEventListener('click', this.onClick);
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('mouseleave', this.onMouseUp);
    }
}

export default Minimap;
