import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

class ThirdPersonCamera {
  constructor(camera, target, options = {}) {
    // Store references
    this.camera = camera;
    this.target = target;
    
    // Configuration with defaults
    this.config = {
      distance: options.distance || 5,            // Distance from target
      height: options.height || 2,                // Height offset from target
      smoothing: options.smoothing || 0.05,       // Camera movement smoothing (lower = smoother)
      rotationSmoothing: options.rotationSmoothing || 0.1, // Rotation smoothing factor
      minDistance: options.minDistance || 1,      // Minimum distance from target
      maxDistance: options.maxDistance || 10,     // Maximum distance from target
      minPolarAngle: options.minPolarAngle || 0.1,// Minimum polar angle (radians)
      maxPolarAngle: options.maxPolarAngle || 1.5,// Maximum polar angle (radians, ~85 degrees)
      lookAhead: options.lookAhead || 0.5,        // How much to look ahead of the character when moving
      collisionLayers: options.collisionLayers || [], // Collision meshes
      useCollision: options.useCollision !== undefined ? options.useCollision : true, // Enable collision detection
      showDebug: options.showDebug || false,      // Show debug helpers
      followSpeed: options.followSpeed || 5,      // How quickly the camera follows character movements
      zoomSpeed: options.zoomSpeed || 0.1         // Speed for zoom in/out
    };
    
    // Internal state
    this.currentPosition = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    
    // Camera angles (in radians)
    this.horizontalAngle = 0; // Default angle (behind character)
    this.verticalAngle = 0.3; // Slightly looking down
    
    // For collision detection
    this.raycaster = new THREE.Raycaster();
    
    // Debug helpers
    if (this.config.showDebug) {
      this.setupDebugHelpers();
    }
    
    // Set up GUI controls
    this.setupGUI();
    
    // Add zoom control listener
    this.setupZoomControl();
    
    // Initialize camera position
    this.updatePosition(0);
  }
  
  setupGUI() {
    const gui = new GUI({ title: 'Camera Settings' });
    const folder = gui.addFolder('Third Person Camera');
    
    folder.add(this.config, 'distance', 1, 15).name('Distance');
    folder.add(this.config, 'height', 0, 5).name('Height');
    folder.add(this.config, 'smoothing', 0.01, 1).name('Smoothing');
    folder.add(this.config, 'useCollision').name('Collision Detection');
    folder.add(this.config, 'lookAhead', 0, 2).name('Look Ahead');
    
    folder.close(); // Closed by default
  }
  
  setupZoomControl() {
    // Add zoom with mouse wheel
    this.wheelListener = (event) => {
      const zoomAmount = Math.sign(event.deltaY) * this.config.zoomSpeed;
      this.config.distance += zoomAmount;
      
      // Clamp distance between min and max
      this.config.distance = Math.max(
        this.config.minDistance,
        Math.min(this.config.maxDistance, this.config.distance)
      );
    };
    
    document.addEventListener('wheel', this.wheelListener);
  }
  
  setupDebugHelpers() {
    // Line to show where camera is looking
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -5)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    this.lookLine = new THREE.Line(lineGeometry, lineMaterial);
    
    // Add to scene if available
    if (this.target && this.target.parent) {
      this.target.parent.add(this.lookLine);
    }
  }
  
  updateAngles(mouseDelta) {
    if (!mouseDelta) return;
    
    // Update camera angles based on mouse movement
    this.horizontalAngle -= mouseDelta.x * 0.01; // Convert to radians and adjust sensitivity
    this.verticalAngle += mouseDelta.y * 0.01;
    
    // Clamp vertical angle to avoid flipping
    this.verticalAngle = Math.max(this.config.minPolarAngle, 
                                 Math.min(this.config.maxPolarAngle, this.verticalAngle));
  }
  
  calculateDesiredPosition() {
    if (!this.target) return;
    
    // Get target position (usually the character)
    this.targetPosition.copy(this.target.position);
    
    // Calculate position based on angles
    const spherical = new THREE.Spherical(
      this.config.distance,
      this.verticalAngle,
      this.horizontalAngle
    );
    
    // Convert spherical coordinates to position
    this.desiredPosition.setFromSpherical(spherical);
    this.desiredPosition.add(this.targetPosition);
    
    // Look ahead adjustment if needed
    if (this.config.lookAhead > 0 && this.target.userData && this.target.userData.velocity) {
      const velocity = this.target.userData.velocity;
      const lookAheadVector = velocity.clone().normalize().multiplyScalar(this.config.lookAhead);
      this.desiredPosition.add(lookAheadVector);
    }
    
    // Handle collisions
    if (this.config.useCollision) {
      this.handleCollisions();
    }
  }
  
  handleCollisions() {
    if (!this.target || this.config.collisionLayers.length === 0) return;
    
    // Direction from target to camera
    const direction = this.desiredPosition.clone().sub(this.targetPosition).normalize();
    
    // Set up raycaster from target to desired camera position
    this.raycaster.set(this.targetPosition, direction);
    
    // Calculate distance to desired position
    const desiredDistance = this.targetPosition.distanceTo(this.desiredPosition);
    
    // Check for collisions
    const intersects = this.raycaster.intersectObjects(this.config.collisionLayers, true);
    
    // Handle collision if found and closer than desired distance
    if (intersects.length > 0 && intersects[0].distance < desiredDistance) {
      const collisionPoint = intersects[0].point;
      
      // Move camera to collision point minus a small offset
      this.desiredPosition.copy(collisionPoint).sub(
        direction.multiplyScalar(0.2) // Small offset to avoid clipping
      );
    }
  }
  
  updatePosition(deltaTime = 1/60) {
    if (!this.target) return;
    
    // Calculate target position and desired camera position
    this.calculateDesiredPosition();
    
    // Calculate look-at position (at target height)
    this.targetLookAt.copy(this.targetPosition);
    
    // Smooth camera position based on delta time
    const smoothFactor = 1.0 - Math.pow(1.0 - this.config.smoothing, deltaTime * 60);
    this.currentPosition.lerp(this.desiredPosition, smoothFactor);
    
    // Update camera position and orientation
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.targetLookAt);
    
    // Update debug helpers if enabled
    if (this.config.showDebug && this.lookLine) {
      this.lookLine.position.copy(this.targetPosition);
      this.lookLine.lookAt(this.camera.position);
    }
  }
  
  // Public method to update the camera with mouse input
  update(deltaTime = 1/60, mouseDelta = null) {
    this.updateAngles(mouseDelta);
    this.updatePosition(deltaTime);
  }
  
  // Reset camera to default position behind target
  reset() {
    this.horizontalAngle = 0;
    this.verticalAngle = 0.3;
    this.update();
  }
  
  // Add collision objects
  addCollisionObject(object) {
    if (!this.config.collisionLayers.includes(object)) {
      this.config.collisionLayers.push(object);
    }
  }
  
  // Set collision layer objects
  setCollisionLayers(objects) {
    this.config.collisionLayers = Array.isArray(objects) ? objects : [objects];
  }
  
  // Clean up method for removing debug helpers etc.
  dispose() {
    if (this.config.showDebug && this.lookLine) {
      if (this.lookLine.parent) {
        this.lookLine.parent.remove(this.lookLine);
      }
      if (this.lookLine.geometry) {
        this.lookLine.geometry.dispose();
      }
      if (this.lookLine.material) {
        this.lookLine.material.dispose();
      }
    }
    
    // Remove zoom wheel listener
    document.removeEventListener('wheel', this.wheelListener);
  }
}

export default ThirdPersonCamera;