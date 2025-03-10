import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// Constants
const DEFAULT_PARAMS = {
  distance: 5,           // Reduced distance for better visibility
  minDistance: 2,
  maxDistance: 20,
  height: 2.5,           // Increased height to look down at character
  minHeight: 1,
  maxHeight: 15,
  followSpeed: 5,
  rotationSpeed: 3,
  offsetX: 0,
  offsetZ: 0,            // Changed to 0 to position camera directly behind
  lookAhead: 0.5,
  damping: 0.1
};

class ThirdPersonCamera {
  constructor(camera, target, scene) {
    this.camera = camera;
    this.target = target; // Character object
    this.scene = scene;
    
    // Camera positioning
    this.currentPosition = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.lookAtPosition = new THREE.Vector3();
    
    // Initialize parameters
    this.params = { ...DEFAULT_PARAMS };
    
    // Setup GUI
    this.initGUI();
    
    // Initial camera setup
    this.update(0);
  }

  initGUI() {
    const gui = new GUI({ title: 'Camera Controls' });
    
    gui.add(this.params, 'distance', 
      this.params.minDistance, 
      this.params.maxDistance, 
      0.1).name('Distance').onChange(() => this.updateImmediately());
    
    gui.add(this.params, 'height', 
      this.params.minHeight, 
      this.params.maxHeight, 
      0.1).name('Height').onChange(() => this.updateImmediately());
    
    gui.add(this.params, 'followSpeed', 
      1, 10, 0.1).name('Follow Speed');
    
    gui.add(this.params, 'rotationSpeed', 
      1, 10, 0.1).name('Rotation Speed');
    
    gui.add(this.params, 'offsetX', 
      -5, 5, 0.1).name('X Offset').onChange(() => this.updateImmediately());
    
    gui.add(this.params, 'offsetZ', 
      -5, 5, 0.1).name('Z Offset').onChange(() => this.updateImmediately());
    
    gui.add(this.params, 'lookAhead', 
      0, 2, 0.1).name('Look Ahead').onChange(() => this.updateImmediately());
    
    gui.add(this.params, 'damping', 
      0, 1, 0.01).name('Damping');
  }

  // Method to update camera immediately when parameters change
  updateImmediately() {
    if (!this.target) return;
    
    // Force update with a small delta to ensure smooth movement
    this.update(0.016);
  }

  update(delta) {
    if (!this.target) return;
    
    // Get character position from physics body or THREE object
    const targetPos = this.target.position instanceof THREE.Vector3 
      ? this.target.position.clone()
      : new THREE.Vector3().copy(this.target.translation());

    // Calculate desired position
    const direction = new THREE.Vector3(0, 0, 1);
    
    // Apply rotation based on character movement
    if (this.target.rotation) {
      direction.applyQuaternion(this.target.quaternion);
    }

    // Calculate offset
    const offset = new THREE.Vector3(
      this.params.offsetX,
      this.params.height,
      this.params.offsetZ - this.params.distance
    );
    
    // Calculate desired camera position
    this.desiredPosition.copy(targetPos)
      .add(direction.clone().multiplyScalar(this.params.lookAhead))
      .add(offset);

    // Smooth camera movement
    if (this.currentPosition.length() === 0) {
      this.currentPosition.copy(this.desiredPosition);
    } else {
      this.currentPosition.lerp(
        this.desiredPosition,
        Math.min(1, this.params.damping * (delta > 0 ? delta * 60 : 1))
      );
    }

    // Update camera position
    this.camera.position.copy(this.currentPosition);

    // Calculate look-at position with smoothing
    const targetLookAt = targetPos.clone()
      .add(direction.multiplyScalar(this.params.lookAhead));
    
    if (this.lookAtPosition.length() === 0) {
      this.lookAtPosition.copy(targetLookAt);
    } else {
      this.lookAtPosition.lerp(
        targetLookAt,
        Math.min(1, this.params.damping * (delta > 0 ? delta * 60 : 1))
      );
    }

    // Update camera look-at
    this.camera.lookAt(this.lookAtPosition);

    // Basic collision avoidance
    this.adjustForCollisions(targetPos);
  }

  adjustForCollisions(targetPos) {
    const raycaster = new THREE.Raycaster(
      targetPos,
      this.camera.position.clone().sub(targetPos).normalize(),
      0,
      this.params.distance
    );
    
    const intersects = raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0 && intersects[0].distance < this.params.distance) {
      const safeDistance = intersects[0].distance - 0.1;
      this.camera.position.copy(
        targetPos.clone().add(
          this.camera.position.clone()
            .sub(targetPos)
            .normalize()
            .multiplyScalar(safeDistance)
        )
      );
    }
  }

  setTarget(newTarget) {
    this.target = newTarget;
  }
}

export default ThirdPersonCamera;