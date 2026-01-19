/**
 * Input Handler - Mouse selection, right-click commands, keyboard shortcuts
 */

import * as THREE from 'three';
import gameState from '../game/GameState.js';

export class InputHandler {
    constructor(scene, camera, unitRenderer, terrainRenderer, onSelectionChange, buildingRenderer = null) {
        this.scene = scene;
        this.camera = camera;
        this.unitRenderer = unitRenderer;
        this.terrainRenderer = terrainRenderer;
        this.buildingRenderer = buildingRenderer;
        this.onSelectionChange = onSelectionChange;
        this.onPlayerAction = null; // Callback for AI feedback

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.selectedUnits = [];
        this.selectedBuilding = null; // Track selected building
        this.isBoxSelecting = false;
        this.boxSelectStart = null;

        // Building placement mode
        this.buildingPlacementMode = false;
        this.pendingBuildingType = null;
        this.ghostBuilding = null;
        this.onBuildingPlace = null; // Callback when building is placed

        this.init();
    }

    init() {
        const canvas = this.scene.renderer.domElement;

        // Bind event handlers for easier removal
        this.handlers = {
            click: (e) => this.onLeftClick(e),
            contextmenu: (e) => {
                e.preventDefault();
                this.onRightClick(e);
            },
            mousemove: (e) => this.onMouseMove(e),
            mousedown: (e) => this.onMouseDown(e),
            mouseup: (e) => this.onMouseUp(e)
        };

        // Left click - select
        canvas.addEventListener('click', this.handlers.click);

        // Right click - command
        canvas.addEventListener('contextmenu', this.handlers.contextmenu);

        // Mouse move for hover effects
        canvas.addEventListener('mousemove', this.handlers.mousemove);

        // Box selection (shift+drag)
        canvas.addEventListener('mousedown', this.handlers.mousedown);
        canvas.addEventListener('mouseup', this.handlers.mouseup);
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

        // Handle building placement mode
        if (this.buildingPlacementMode) {
            // Check if placement is valid (for Zerg creep restrictions)
            if (this.ghostBuilding && this.ghostBuilding.userData.isValidPlacement === false) {
                this.showFeedback('Must build on creep!');
                return;
            }

            const position = this.getWorldPositionFromClick(event);
            if (position && this.onBuildingPlace) {
                this.onBuildingPlace(this.pendingBuildingType, position);
                this.cancelBuildingPlacement();
            }
            return;
        }

        // Skip if we just performed a box selection (drag was large enough)
        if (this.wasBoxSelection) {
            this.wasBoxSelection = false;
            return;
        }

        this.updateMousePosition(event);

        // Check for unit selection first
        const unitObjects = this.getSelectableUnitObjects();
        const unitIntersects = this.raycast(unitObjects);

        // Clear previous selection unless shift is held
        if (!event.shiftKey) {
            this.clearSelection();
        }

        if (unitIntersects.length > 0) {
            const hitObject = this.findEntityObject(unitIntersects[0].object);
            if (hitObject && hitObject.userData.unitData) {
                this.selectUnit(hitObject.userData.unitData.id);
                this.notifySelectionChange();
                return;
            }
        }

        // Check for building selection
        const buildingObjects = this.getSelectableBuildingObjects();
        const buildingIntersects = this.raycast(buildingObjects);

        if (buildingIntersects.length > 0) {
            const hitObject = this.findEntityObject(buildingIntersects[0].object);
            if (hitObject && hitObject.userData.buildingData) {
                this.selectBuilding(hitObject.userData.buildingData.id);
                this.notifySelectionChange();
                return;
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
            // Find the closest non-terrain object first
            const entityHit = intersects.find(hit => {
                const obj = this.findEntityObject(hit.object);
                return obj && (obj.userData.unitData || obj.userData.buildingData || obj.userData.type === 'mineral' || obj.userData.type === 'gas');
            });

            const primaryHit = entityHit || intersects[0];
            const hitObject = this.findEntityObject(primaryHit.object);
            const clickPoint = primaryHit.point;

            if (hitObject) {
                // Check if it's a mineral patch
                const resourceId = hitObject.userData?.id || hitObject.parent?.userData?.id;
                const nodeData = this.terrainRenderer.resourceNodes.get(resourceId);

                if (hitObject.userData?.type === 'mineral' || nodeData?.type === 'mineral') {
                    this.commandMineMinerals(resourceId);
                    return;
                }
                // Check if it's a gas geyser
                else if (hitObject.userData?.type === 'gas' || nodeData?.type === 'gas') {
                    this.commandHarvestGas(resourceId);
                    return;
                }
                // Check if it's a building under construction
                else if (hitObject.userData?.buildingData) {
                    const bData = hitObject.userData.buildingData;
                    const building = gameState.buildings.find(b => b.id === bData.id);
                    if (building && !building.isComplete && gameState.faction.id === 'human') {
                        this.commandConstruct(building.id);
                        return;
                    }
                }
            }

            // Check proximity to resources when clicking on ground
            const nearbyResource = this.findNearbyResource(clickPoint.x, clickPoint.z);
            if (nearbyResource) {
                if (nearbyResource.type === 'mineral') {
                    this.commandMineMinerals(nearbyResource.resource.id);
                } else if (nearbyResource.type === 'gas') {
                    this.commandHarvestGas(nearbyResource.resource.id);
                }
                return;
            }

            // Move command if not near any resource
            this.commandMove(clickPoint.x, clickPoint.z);
        } else {
            // Clicked on ground/nothing - check for nearby resources first
            const groundIntersects = this.raycast([this.scene.getObject('terrain')]);
            if (groundIntersects.length > 0) {
                const point = groundIntersects[0].point;

                const nearbyResource = this.findNearbyResource(point.x, point.z);
                if (nearbyResource) {
                    if (nearbyResource.type === 'mineral') {
                        this.commandMineMinerals(nearbyResource.resource.id);
                    } else if (nearbyResource.type === 'gas') {
                        this.commandHarvestGas(nearbyResource.resource.id);
                    }
                    return;
                }

                this.commandMove(point.x, point.z);
            }
        }
    }

    findNearbyResource(x, z) {
        const proximityRadius = 2.0; // Reduced to match visual glow radius exactly

        // Check mineral patches
        for (const patch of gameState.mineralPatches) {
            const dist = Math.sqrt(Math.pow(patch.x - x, 2) + Math.pow(patch.z - z, 2));
            if (dist < proximityRadius) {
                return { type: 'mineral', resource: patch };
            }
        }

        // Check gas geysers
        for (const geyser of gameState.gasGeysers) {
            const dist = Math.sqrt(Math.pow(geyser.x - x, 2) + Math.pow(geyser.z - z, 2));
            if (dist < proximityRadius) {
                return { type: 'gas', resource: geyser };
            }
        }

        return null;
    }

    onMouseMove(event) {
        // Update ghost building position in placement mode
        if (this.buildingPlacementMode) {
            this.updateGhostPosition(event);
            return;
        }

        if (this.isBoxSelecting) {
            this.updateSelectionBox(event);
        }
    }

    onMouseDown(event) {
        if (event.button === 0 && event.target === this.scene.renderer.domElement) {
            // Prevent box selection if Shift is held (used for navigation)
            if (event.shiftKey) return;

            // Start box selection on left mouse down
            this.isBoxSelecting = true;
            this.boxSelectStart = { x: event.clientX, y: event.clientY };
            this.boxSelectEnd = { x: event.clientX, y: event.clientY };
            this.createSelectionBox();
        }
    }

    onMouseUp(event) {
        if (this.isBoxSelecting && event.button === 0) {
            this.boxSelectEnd = { x: event.clientX, y: event.clientY };
            this.finishBoxSelection(event.shiftKey);
            this.removeSelectionBox();
            this.isBoxSelecting = false;
        }
    }

    createSelectionBox() {
        if (this.selectionBoxElement) return;

        this.selectionBoxElement = document.createElement('div');
        this.selectionBoxElement.style.cssText = `
            position: fixed;
            border: 1px solid #00d4ff;
            background: rgba(0, 212, 255, 0.1);
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.selectionBoxElement);
    }

    updateSelectionBox(event) {
        if (!this.selectionBoxElement || !this.boxSelectStart) return;

        this.boxSelectEnd = { x: event.clientX, y: event.clientY };

        const left = Math.min(this.boxSelectStart.x, this.boxSelectEnd.x);
        const top = Math.min(this.boxSelectStart.y, this.boxSelectEnd.y);
        const width = Math.abs(this.boxSelectEnd.x - this.boxSelectStart.x);
        const height = Math.abs(this.boxSelectEnd.y - this.boxSelectStart.y);

        this.selectionBoxElement.style.left = `${left}px`;
        this.selectionBoxElement.style.top = `${top}px`;
        this.selectionBoxElement.style.width = `${width}px`;
        this.selectionBoxElement.style.height = `${height}px`;
    }

    removeSelectionBox() {
        if (this.selectionBoxElement) {
            this.selectionBoxElement.remove();
            this.selectionBoxElement = null;
        }
    }

    finishBoxSelection(addToSelection) {
        const boxWidth = Math.abs(this.boxSelectEnd.x - this.boxSelectStart.x);
        const boxHeight = Math.abs(this.boxSelectEnd.y - this.boxSelectStart.y);

        // If box is too small, treat as single click (already handled in onLeftClick)
        if (boxWidth < 5 && boxHeight < 5) return;

        // Mark that we did a box selection so click handler skips
        this.wasBoxSelection = true;

        if (!addToSelection) {
            this.clearSelection();
        }

        const left = Math.min(this.boxSelectStart.x, this.boxSelectEnd.x);
        const right = Math.max(this.boxSelectStart.x, this.boxSelectEnd.x);
        const top = Math.min(this.boxSelectStart.y, this.boxSelectEnd.y);
        const bottom = Math.max(this.boxSelectStart.y, this.boxSelectEnd.y);

        // Check each unit to see if it's within the box
        this.unitRenderer.units.forEach((group, unitId) => {
            const screenPos = this.worldToScreen(group.position);
            if (screenPos.x >= left && screenPos.x <= right &&
                screenPos.y >= top && screenPos.y <= bottom) {
                this.selectUnit(unitId);
            }
        });

        this.notifySelectionChange();
    }

    worldToScreen(position) {
        const vector = position.clone();
        vector.project(this.camera);

        const canvas = this.scene.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        return {
            x: (vector.x * 0.5 + 0.5) * rect.width + rect.left,
            y: (-vector.y * 0.5 + 0.5) * rect.height + rect.top
        };
    }

    getSelectableUnitObjects() {
        const objects = [];
        this.unitRenderer.units.forEach((group, id) => {
            objects.push(group);
        });
        return objects;
    }

    getSelectableBuildingObjects() {
        const objects = [];
        if (this.buildingRenderer && this.buildingRenderer.buildings) {
            this.buildingRenderer.buildings.forEach((group, id) => {
                objects.push(group);
            });
        }
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
        if (this.buildingRenderer && this.buildingRenderer.buildings) {
            this.buildingRenderer.buildings.forEach((group, id) => {
                objects.push(group);
            });
        }

        return objects;
    }

    findEntityObject(object) {
        let current = object;
        while (current) {
            if (current.userData && (
                current.userData.unitData ||
                current.userData.buildingData ||
                current.userData.type === 'mineral' ||
                current.userData.type === 'gas'
            )) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    selectUnit(unitId) {
        // Clear building selection when selecting units
        this.clearBuildingSelection();
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

    selectBuilding(buildingId) {
        // Clear unit selection when selecting a building
        this.clearUnitSelection();
        this.clearBuildingSelection();

        this.selectedBuilding = buildingId;
        if (this.buildingRenderer) {
            this.buildingRenderer.setSelected(buildingId, true);
        }
    }

    clearUnitSelection() {
        this.selectedUnits.forEach(unitId => {
            this.unitRenderer.setSelected(unitId, false);
        });
        this.selectedUnits = [];
    }

    clearBuildingSelection() {
        if (this.selectedBuilding && this.buildingRenderer) {
            this.buildingRenderer.setSelected(this.selectedBuilding, false);
        }
        this.selectedBuilding = null;
    }

    clearSelection() {
        this.clearUnitSelection();
        this.clearBuildingSelection();
    }

    notifySelectionChange() {
        if (this.onSelectionChange) {
            // Check for building selection first
            if (this.selectedBuilding) {
                const building = gameState.buildings.find(b => b.id === this.selectedBuilding);
                if (building) {
                    this.onSelectionChange([building], 'building');
                    return;
                }
            }

            // Otherwise return unit selection
            const selectedData = this.selectedUnits.map(id =>
                gameState.units.find(u => u.id === id)
            ).filter(Boolean);
            this.onSelectionChange(selectedData, 'unit');
        }
    }

    // Commands
    commandMineMinerals(targetResourceId = null) {
        let assigned = 0;
        this.selectedUnits.forEach(unitId => {
            const unit = gameState.units.find(u => u.id === unitId);
            if (unit && unit.type === 'worker') {
                // Remove from gas workers if assigned there
                gameState.gasWorkers = gameState.gasWorkers.filter(id => id !== unitId);

                if (gameState.assignWorkerToMinerals(unitId, targetResourceId)) {
                    assigned++;
                }
            }
        });

        if (assigned > 0) {
            this.showFeedback(`${assigned} worker(s) assigned to minerals`);
            this.onPlayerAction?.('mine_minerals', { count: assigned });
        }
    }

    commandHarvestGas(targetResourceId = null) {
        let assigned = 0;
        this.selectedUnits.forEach(unitId => {
            const unit = gameState.units.find(u => u.id === unitId);
            if (unit && unit.type === 'worker') {
                // Remove from mineral workers if assigned there
                gameState.mineralWorkers = gameState.mineralWorkers.filter(id => id !== unitId);

                if (gameState.assignWorkerToGas(unitId, targetResourceId)) {
                    assigned++;
                }
            }
        });

        if (assigned > 0) {
            this.showFeedback(`${assigned} worker(s) assigned to gas`);
            this.onPlayerAction?.('harvest_gas', { count: assigned });
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
                unit.targetBuildingId = null; // Clear construction target
            }
        });
    }

    commandConstruct(buildingId) {
        const building = gameState.buildings.find(b => b.id === buildingId);
        if (!building) return;

        let assigned = 0;
        this.selectedUnits.forEach(unitId => {
            const unit = gameState.units.find(u => u.id === unitId);
            if (unit && unit.type === 'worker') {
                // Clear other assignments
                gameState.mineralWorkers = gameState.mineralWorkers.filter(id => id !== unitId);
                gameState.gasWorkers = gameState.gasWorkers.filter(id => id !== unitId);

                unit.state = 'constructing';
                unit.targetBuildingId = buildingId;
                unit.targetX = building.x;
                unit.targetZ = building.z;
                assigned++;
            }
        });

        if (assigned > 0) {
            this.showFeedback(`${assigned} workers assigned to construction`);
        }
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
        const canvas = this.scene.renderer.domElement;
        if (this.handlers) {
            canvas.removeEventListener('click', this.handlers.click);
            canvas.removeEventListener('contextmenu', this.handlers.contextmenu);
            canvas.removeEventListener('mousemove', this.handlers.mousemove);
            canvas.removeEventListener('mousedown', this.handlers.mousedown);
            canvas.removeEventListener('mouseup', this.handlers.mouseup);
        }
        this.selectedUnits = [];
        this.cancelBuildingPlacement();
    }

    // Building placement mode methods
    enterBuildingPlacementMode(buildingType, onPlace) {
        this.buildingPlacementMode = true;
        this.pendingBuildingType = buildingType;
        this.onBuildingPlace = onPlace;
        this.createGhostBuilding(buildingType);
        document.body.style.cursor = 'crosshair';
    }

    cancelBuildingPlacement() {
        this.buildingPlacementMode = false;
        this.pendingBuildingType = null;
        this.onBuildingPlace = null;
        this.removeGhostBuilding();
        document.body.style.cursor = 'default';
    }

    createGhostBuilding(buildingType) {
        this.removeGhostBuilding();

        // Create a simple ghost mesh for the building
        const sizes = {
            supply: { size: 3, height: 2 },
            creepcolony: { size: 3, height: 2 },
            barracks: { size: 4, height: 3 },
            factory: { size: 5, height: 4 },
            gasExtractor: { size: 3, height: 2 }
        };

        const type = buildingType.toLowerCase();
        const config = sizes[type] || sizes.supply;

        const geometry = new THREE.BoxGeometry(config.size, config.height, config.size);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            wireframe: true
        });

        this.ghostBuilding = new THREE.Mesh(geometry, material);
        this.ghostBuilding.position.y = 0.5 + config.height / 2; // Account for platform height
        this.ghostBuilding.userData.buildingType = buildingType; // Store for creep check
        this.ghostMaterial = material; // Store reference for color updates
        this.scene.scene.add(this.ghostBuilding);
    }

    removeGhostBuilding() {
        if (this.ghostBuilding) {
            this.scene.scene.remove(this.ghostBuilding);
            this.ghostBuilding.geometry.dispose();
            this.ghostBuilding.material.dispose();
            this.ghostBuilding = null;
        }
    }

    updateGhostPosition(event) {
        if (!this.ghostBuilding) return;

        this.updateMousePosition(event);

        // Raycast to terrain to get world position
        const terrain = this.scene.getObject('terrain');
        if (!terrain) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(terrain, true);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.ghostBuilding.position.x = point.x;
            this.ghostBuilding.position.z = point.z;

            // Check if placement is valid - Zerg must build on creep (except for buildings with canBuildAnywhere)
            let isValidPlacement = true;
            if (gameState.faction?.id === 'zerg' && this.terrainRenderer) {
                // Check if this building type can be built anywhere
                const buildingConfig = gameState.faction.buildings?.[this.pendingBuildingType];
                const canBuildAnywhere = buildingConfig?.canBuildAnywhere || false;

                if (!canBuildAnywhere) {
                    isValidPlacement = this.terrainRenderer.isOnCreep(point.x, point.z);
                }
            }

            // Update ghost color based on validity
            if (this.ghostMaterial) {
                this.ghostMaterial.color.setHex(isValidPlacement ? 0x00ff00 : 0xff0000);
            }

            // Store validity for click handling
            this.ghostBuilding.userData.isValidPlacement = isValidPlacement;
        }
    }

    getWorldPositionFromClick(event) {
        this.updateMousePosition(event);

        const terrain = this.scene.getObject('terrain');
        if (!terrain) return null;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(terrain, true);

        if (intersects.length > 0) {
            return { x: intersects[0].point.x, z: intersects[0].point.z };
        }
        return null;
    }
}

export default InputHandler;
