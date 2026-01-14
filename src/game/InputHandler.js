/**
 * Input Handler - Mouse selection, right-click commands, keyboard shortcuts
 */

import * as THREE from 'three';
import gameState from '../game/GameState.js';

export class InputHandler {
    constructor(scene, camera, unitRenderer, terrainRenderer, onSelectionChange) {
        this.scene = scene;
        this.camera = camera;
        this.unitRenderer = unitRenderer;
        this.terrainRenderer = terrainRenderer;
        this.onSelectionChange = onSelectionChange;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.selectedUnits = [];
        this.isBoxSelecting = false;
        this.boxSelectStart = null;

        this.init();
    }

    init() {
        const canvas = this.scene.renderer.domElement;

        // Left click - select
        canvas.addEventListener('click', (e) => this.onLeftClick(e));

        // Right click - command
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.onRightClick(e);
        });

        // Mouse move for hover effects
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Box selection (shift+drag)
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    }

    updateMousePosition(event) {
        const canvas = this.scene.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    raycast(objects) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        return this.raycaster.intersectObjects(objects, true);
    }

    onLeftClick(event) {
        // Ignore if clicking on UI
        if (event.target !== this.scene.renderer.domElement) return;

        this.updateMousePosition(event);

        // Check for unit selection
        const unitObjects = this.getSelectableUnitObjects();
        const intersects = this.raycast(unitObjects);

        // Clear previous selection unless shift is held
        if (!event.shiftKey) {
            this.clearSelection();
        }

        if (intersects.length > 0) {
            const hitObject = this.findParentWithUserData(intersects[0].object);
            if (hitObject && hitObject.userData.unitData) {
                this.selectUnit(hitObject.userData.unitData.id);
            }
        }

        this.notifySelectionChange();
    }

    onRightClick(event) {
        if (this.selectedUnits.length === 0) return;

        this.updateMousePosition(event);

        // Check what we're clicking on
        const targetObjects = this.getTargetableObjects();
        const intersects = this.raycast(targetObjects);

        if (intersects.length > 0) {
            const hitObject = this.findParentWithUserData(intersects[0].object);

            if (hitObject) {
                // Check if it's a mineral patch
                if (hitObject.userData?.type === 'mineral' ||
                    this.terrainRenderer.resourceNodes.get(hitObject.parent?.userData?.id)?.type === 'mineral') {
                    this.commandMineMinerals();
                }
                // Check if it's a gas geyser
                else if (hitObject.userData?.type === 'gas' ||
                    this.terrainRenderer.resourceNodes.get(hitObject.parent?.userData?.id)?.type === 'gas') {
                    this.commandHarvestGas();
                }
                // Ground click - could be move command (for future)
                else {
                    const point = intersects[0].point;
                    this.commandMove(point.x, point.z);
                }
            }
        } else {
            // Clicked on ground/nothing - move command
            const groundIntersects = this.raycast([this.scene.getObject('terrain')]);
            if (groundIntersects.length > 0) {
                const point = groundIntersects[0].point;
                this.commandMove(point.x, point.z);
            }
        }
    }

    onMouseMove(event) {
        // Could add hover highlighting here
    }

    onMouseDown(event) {
        if (event.button === 0 && event.shiftKey) {
            // Start box selection
            this.isBoxSelecting = true;
            this.boxSelectStart = { x: event.clientX, y: event.clientY };
        }
    }

    onMouseUp(event) {
        if (this.isBoxSelecting) {
            this.isBoxSelecting = false;
            // Could implement box selection here
        }
    }

    getSelectableUnitObjects() {
        const objects = [];
        this.unitRenderer.units.forEach((group, id) => {
            objects.push(group);
        });
        return objects;
    }

    getTargetableObjects() {
        const objects = [];

        // Add terrain
        const terrain = this.scene.getObject('terrain');
        if (terrain) objects.push(terrain);

        // Add resource nodes
        this.terrainRenderer.resourceNodes.forEach((node, id) => {
            objects.push(node.group);
        });

        // Add buildings
        this.unitRenderer?.buildings?.forEach((group, id) => {
            objects.push(group);
        });

        return objects;
    }

    findParentWithUserData(object) {
        let current = object;
        while (current) {
            if (current.userData && Object.keys(current.userData).length > 0) {
                return current;
            }
            current = current.parent;
        }
        return object;
    }

    selectUnit(unitId) {
        if (!this.selectedUnits.includes(unitId)) {
            this.selectedUnits.push(unitId);
            this.unitRenderer.setSelected(unitId, true);
        }
    }

    deselectUnit(unitId) {
        const index = this.selectedUnits.indexOf(unitId);
        if (index > -1) {
            this.selectedUnits.splice(index, 1);
            this.unitRenderer.setSelected(unitId, false);
        }
    }

    clearSelection() {
        this.selectedUnits.forEach(unitId => {
            this.unitRenderer.setSelected(unitId, false);
        });
        this.selectedUnits = [];
    }

    notifySelectionChange() {
        if (this.onSelectionChange) {
            const selectedData = this.selectedUnits.map(id =>
                gameState.units.find(u => u.id === id)
            ).filter(Boolean);
            this.onSelectionChange(selectedData);
        }
    }

    // Commands
    commandMineMinerals() {
        let assigned = 0;
        this.selectedUnits.forEach(unitId => {
            const unit = gameState.units.find(u => u.id === unitId);
            if (unit && unit.type === 'worker') {
                // Remove from gas workers if assigned there
                gameState.gasWorkers = gameState.gasWorkers.filter(id => id !== unitId);

                if (gameState.assignWorkerToMinerals(unitId)) {
                    assigned++;
                }
            }
        });

        if (assigned > 0) {
            this.showFeedback(`${assigned} worker(s) assigned to minerals`);
        }
    }

    commandHarvestGas() {
        let assigned = 0;
        this.selectedUnits.forEach(unitId => {
            const unit = gameState.units.find(u => u.id === unitId);
            if (unit && unit.type === 'worker') {
                // Remove from mineral workers if assigned there
                gameState.mineralWorkers = gameState.mineralWorkers.filter(id => id !== unitId);

                if (gameState.assignWorkerToGas(unitId)) {
                    assigned++;
                }
            }
        });

        if (assigned > 0) {
            this.showFeedback(`${assigned} worker(s) assigned to gas`);
        } else {
            this.showFeedback('Build a gas extractor first!');
        }
    }

    commandMove(x, z) {
        // For now, just set idle and update position
        // Full pathfinding can be added later
        this.selectedUnits.forEach(unitId => {
            const unit = gameState.units.find(u => u.id === unitId);
            if (unit) {
                // Remove from worker assignments
                gameState.mineralWorkers = gameState.mineralWorkers.filter(id => id !== unitId);
                gameState.gasWorkers = gameState.gasWorkers.filter(id => id !== unitId);

                unit.state = 'moving';
                unit.targetX = x;
                unit.targetZ = z;
            }
        });
    }

    showFeedback(message) {
        // Use HUD notification system
        const event = new CustomEvent('gameFeedback', { detail: message });
        window.dispatchEvent(event);
    }

    // Select all workers
    selectAllWorkers() {
        this.clearSelection();
        gameState.units.forEach(unit => {
            if (unit.type === 'worker') {
                this.selectUnit(unit.id);
            }
        });
        this.notifySelectionChange();
    }

    // Select idle workers
    selectIdleWorkers() {
        this.clearSelection();
        gameState.getIdleWorkers().forEach(unit => {
            this.selectUnit(unit.id);
        });
        this.notifySelectionChange();
    }

    dispose() {
        // Remove event listeners would go here
    }
}

export default InputHandler;
