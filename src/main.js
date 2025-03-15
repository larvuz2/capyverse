// Configuration object for all adjustable parameters
const config = {
  camera: {
    distance: 1.8,
    height: 0.9,
    lookAtHeight: 0.6,
    smoothing: 0.74,
    minVerticalAngle: -0.5,
    maxVerticalAngle: 0.8,
    rotationSpeed: 0.003,
    reset: function() {
      // Reset camera parameters to defaults
      config.camera.distance = 1.8;
      config.camera.height = 0.9;
      config.camera.lookAtHeight = 0.6;
      config.camera.smoothing = 0.74;
      config.camera.minVerticalAngle = -0.5;
      config.camera.maxVerticalAngle = 0.8;
      config.camera.rotationSpeed = 0.003;
      
      // Update camera with reset values
      if (thirdPersonCamera) {
        thirdPersonCamera.distance = config.camera.distance;
        thirdPersonCamera.height = config.camera.height;
        thirdPersonCamera.smoothing = config.camera.smoothing;
        thirdPersonCamera.minVerticalAngle = config.camera.minVerticalAngle;
        thirdPersonCamera.maxVerticalAngle = config.camera.maxVerticalAngle;
      }
      
      // Update input manager
      if (inputManager) {
        inputManager.sensitivity = config.camera.rotationSpeed;
      }
      
      // Update all controllers
      for (const controller of Object.values(cameraFolder.controllers)) {
        controller.updateDisplay();
      }
    }
  },
  // ... rest of the configuration
};