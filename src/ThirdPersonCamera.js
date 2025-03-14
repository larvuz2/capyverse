import * as THREE from 'three';

/**
 * Simplified ThirdPersonCamera class
 * Core functionality for a reliable third-person camera that follows a target
 */
class ThirdPersonCamera {
  constructor(camera, target, options = {}) {
    // Store references
    this.camera = camera;
    this.target = target;
    
    // Core configuration with sensible defaults
    this._distance = options.distance || 5;       // Distance behind character
    this._height = options.height || 2;           // Height above character
    this._smoothing = options.smoothing || 0.1;   // Simple position smoothing factor
    this._lookAtHeightOffset = options.lookAtHeightOffset || 0.5; // Vertical offset for look target
    
    // Camera angles (in radians)
    this.horizontalAngle = 0;                   // Initial angle (directly behind character)
    this.verticalAngle = 0.3;                   // Slightly looking down
    
    // Angle constraints
    this._minVerticalAngle = options.minVerticalAngle || -0.5;  // Limit looking up
    this._maxVerticalAngle = options.maxVerticalAngle || 0.8;   // Limit looking down
    
    // Camera positioning
    this.currentPosition = new THREE.Vector3();  // Current smoothed position
    this.currentLookAt = new THREE.Vector3();    // Current smoothed look-at point
    this.desiredPosition = new THREE.Vector3();  // Target position before smoothing
    
    // Initialize camera position
    this.updatePosition(0);
    
    console.log('Simplified ThirdPersonCamera initialized');
  }
  
  // Getter and setter for distance
  get distance() {
    return this._distance;
  }
  
  set distance(value) {
    this._distance = value;
  }
  
  // Getter and setter for height
  get height() {
    return this._height;
  }
  
  set height(value) {
    this._height = value;
  }
  
  // Getter and setter for smoothing
  get smoothing() {
    return this._smoothing;
  }
  
  set smoothing(value) {
    this._smoothing = value;
  }
  
  // Getter and setter for lookAtHeightOffset
  get lookAtHeightOffset() {
    return this._lookAtHeightOffset;
  }
  
  set lookAtHeightOffset(value) {
    this._lookAtHeightOffset = value;
  }
  
  // Getter and setter for minVerticalAngle
  get minVerticalAngle() {
    return this._minVerticalAngle;
  }
  
  set minVerticalAngle(value) {
    this._minVerticalAngle = value;
    // Re-clamp current vertical angle to ensure it's within new bounds
    this.verticalAngle = Math.max(
      this._minVerticalAngle,
      Math.min(this._maxVerticalAngle, this.verticalAngle)
    );
  }
  
  // Getter and setter for maxVerticalAngle
  get maxVerticalAngle() {
    return this._maxVerticalAngle;
  }
  
  set maxVerticalAngle(value) {
    this._maxVerticalAngle = value;
    // Re-clamp current vertical angle to ensure it's within new bounds
    this.verticalAngle = Math.max(
      this._minVerticalAngle,
      Math.min(this._maxVerticalAngle, this.verticalAngle)
    );
  }
  
  /**
   * Update camera angles based on mouse input
   */
  updateAngles(mouseDelta) {
    if (!mouseDelta) return;
    
    // Update camera angles based on mouse movement
    this.horizontalAngle -= mouseDelta.x;
    this.verticalAngle += mouseDelta.y;
    
    // Clamp vertical angle to avoid flipping
    this.verticalAngle = Math.max(
      this._minVerticalAngle,
      Math.min(this._maxVerticalAngle, this.verticalAngle)
    );
  }
  
  /**
   * Calculate desired camera position based on target and angles
   */
  calculateDesiredPosition() {
    if (!this.target) {
      console.warn('ThirdPersonCamera: No target assigned');
      return;
    }
    
    // Get target position (the character position)
    const targetPosition = this.target.position.clone();
    
    // Calculate desired position using spherical coordinates
    const spherical = new THREE.Spherical(
      this._distance,
      Math.PI/2 - this.verticalAngle, // Convert to spherical theta
      this.horizontalAngle
    );
    
    // Convert to Cartesian coordinates and add to target position
    this.desiredPosition.setFromSpherical(spherical);
    this.desiredPosition.add(targetPosition);
    
    // Calculate look-at position (at target position plus height)
    this.targetLookAt = targetPosition.clone();
    this.targetLookAt.y += this._height * this._lookAtHeightOffset; // Look at upper body, not feet
  }
  
  /**
   * Update camera position with simple smoothing
   */
  updatePosition(deltaTime = 1/60) {
    if (!this.target) return;
    
    // Calculate desired position
    this.calculateDesiredPosition();
    
    // Simple smoothing with delta time compensation
    const smoothFactor = Math.min(1.0, this._smoothing * deltaTime * 60);
    
    // If this is the first update, snap to position without smoothing
    if (this.currentPosition.lengthSq() === 0) {
      this.currentPosition.copy(this.desiredPosition);
      this.currentLookAt = this.targetLookAt.clone();
    } else {
      // Apply smoothing to camera position and look-at
      this.currentPosition.lerp(this.desiredPosition, smoothFactor);
      this.currentLookAt.lerp(this.targetLookAt, smoothFactor);
    }
    
    // Update actual camera position and orientation
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }
  
  /**
   * Main update method called from animation loop
   */
  update(deltaTime = 1/60, mouseDelta = null) {
    if (!this.target) {
      console.warn('ThirdPersonCamera: No target assigned');
      return;
    }
    
    // Update camera angles and position
    this.updateAngles(mouseDelta);
    this.updatePosition(deltaTime);
  }
  
  /**
   * Reset camera to default position behind character
   */
  reset() {
    this.horizontalAngle = 0;
    this.verticalAngle = 0.3;
    this.currentPosition.set(0, 0, 0); // Force immediate repositioning
    this.update();
  }
  
  /**
   * Change the target the camera is following
   */
  setTarget(newTarget) {
    this.target = newTarget;
    this.reset();
  }
}

export default ThirdPersonCamera; 
