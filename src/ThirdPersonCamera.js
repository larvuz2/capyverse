// Third-person camera controller with smooth following
import * as THREE from 'three';

/**
 * Third-person camera that follows a target with smoothing
 */
class ThirdPersonCamera {
  /**
   * Create a new third-person camera
   * @param {THREE.Camera} camera - The camera to control
   * @param {THREE.Object3D} target - The target to follow
   * @param {Object} options - Configuration options
   */
  constructor(camera, target, options = {}) {
    this.camera = camera;
    this.target = target;
    
    // Configuration with defaults
    this.distance = options.distance || 5;
    this.height = options.height || 2;
    this.lookAtHeightOffset = options.lookAtHeightOffset || 0.5;
    this.smoothing = options.smoothing !== undefined ? options.smoothing : 0.05;
    
    // Rotation controls
    this.horizontalAngle = options.horizontalAngle || Math.PI; // Default behind the target
    this.verticalAngle = options.verticalAngle || 0.5;
    this.minVerticalAngle = options.minVerticalAngle || -Math.PI / 4;
    this.maxVerticalAngle = options.maxVerticalAngle || Math.PI / 3;
    
    // Collision detection
    this.collisionDetection = options.collisionDetection || false;
    this.collisionLayers = options.collisionLayers || 1;
    this.collisionZoomSpeed = options.collisionZoomSpeed || 2;
    
    // Internal state
    this.currentDistance = this.distance;
    this.quaternion = new THREE.Quaternion();
    this.updateRotationQuaternion();
  }
  
  /**
   * Add rotation based on mouse/touch input
   * @param {Object} movement - x/y movement deltas
   */
  updateRotation(movement) {
    if (!movement) return;
    
    // Update angles based on input
    this.horizontalAngle -= movement.x;
    this.verticalAngle = Math.max(
      this.minVerticalAngle,
      Math.min(this.maxVerticalAngle, this.verticalAngle + movement.y)
    );
    
    // Update the quaternion from the updated angles
    this.updateRotationQuaternion();
  }
  
  /**
   * Update the quaternion from Euler angles
   */
  updateRotationQuaternion() {
    // Create Euler angle from our horizontal and vertical angles
    const euler = new THREE.Euler(this.verticalAngle, this.horizontalAngle, 0, 'YXZ');
    
    // Convert to quaternion
    this.quaternion.setFromEuler(euler);
  }
  
  /**
   * Update camera position and rotation
   * @param {number} deltaTime - Time since last update
   * @param {Object} mouseMovement - Mouse movement delta (if any)
   */
  update(deltaTime, mouseMovement) {
    if (!this.target) return;
    
    // Apply mouse movement to camera rotation if provided
    if (mouseMovement) {
      this.updateRotation(mouseMovement);
    }
    
    // Update camera position based on current rotation
    this.updatePosition(deltaTime);
  }
  
  /**
   * Update camera position based on current state
   * @param {number} deltaTime - Time since last update
   */
  updatePosition(deltaTime) {
    if (!this.target) return;
    
    // Get target position (where we're focusing on)
    const targetPosition = new THREE.Vector3();
    this.target.getWorldPosition(targetPosition);
    
    // Calculate the desired camera position based on target, distance and angles
    const offset = new THREE.Vector3(0, 0, this.distance);
    offset.applyQuaternion(this.quaternion);
    
    // Add the calculated offset to the target position
    const desiredPosition = targetPosition.clone().add(offset);
    
    // Add height offset to camera position
    desiredPosition.y = targetPosition.y + this.height;
    
    // Collision detection logic (if enabled)
    if (this.collisionDetection) {
      // Add appropriate collision detection here
      // This is a simplified version that checks for objects between target and camera
      const raycaster = new THREE.Raycaster();
      const direction = targetPosition.clone().sub(desiredPosition).normalize();
      raycaster.set(targetPosition, direction);
      
      // Get all objects in the scene
      const objects = this.camera.parent.children;
      const intersects = raycaster.intersectObjects(objects, true);
      
      // If we hit something that's not the target, adjust camera distance
      if (intersects.length > 0 && intersects[0].distance < this.distance) {
        // Set the camera closer to avoid clipping
        const collision = intersects[0];
        const newDistance = collision.distance * 0.8; // 80% of the collision distance
        this.currentDistance = Math.max(this.currentDistance - deltaTime * this.collisionZoomSpeed, newDistance);
      } else {
        // Smoothly return to the desired distance when no collision
        this.currentDistance = THREE.MathUtils.lerp(
          this.currentDistance,
          this.distance,
          deltaTime * this.collisionZoomSpeed
        );
      }
    } else {
      this.currentDistance = this.distance;
    }
    
    // Apply smoothing (lerp) between current and desired position
    if (this.smoothing > 0) {
      this.camera.position.lerp(desiredPosition, this.smoothing);
    } else {
      this.camera.position.copy(desiredPosition);
    }
    
    // Point the camera to look at the target (plus any height offset)
    const lookAtPosition = targetPosition.clone();
    lookAtPosition.y += this.lookAtHeightOffset;
    this.camera.lookAt(lookAtPosition);
  }
  
  /**
   * Reset camera position immediately (no smoothing)
   */
  reset() {
    if (!this.target) return;
    
    // Get target position
    const targetPosition = new THREE.Vector3();
    this.target.getWorldPosition(targetPosition);
    
    // Calculate offset position
    const offset = new THREE.Vector3(0, 0, this.distance);
    offset.applyQuaternion(this.quaternion);
    
    // Set camera position
    this.camera.position.copy(targetPosition.clone().add(offset));
    this.camera.position.y = targetPosition.y + this.height;
    
    // Look at target
    const lookAtPosition = targetPosition.clone();
    lookAtPosition.y += this.lookAtHeightOffset;
    this.camera.lookAt(lookAtPosition);
  }
}

export default ThirdPersonCamera;