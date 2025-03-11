import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// Constants - Default parameters from the image
const DEFAULT_PARAMS = {
  cameraX: 45,
  cameraY: 1,
  cameraZ: -53,
  lookAtX: 0,
  lookAtY: 0,
  lookAtZ: 0
};

class StaticCamera {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    
    // Initialize parameters
    this.params = { ...DEFAULT_PARAMS };
    
    // Setup GUI
    this.initGUI();
    
    // Initial camera setup
    this.update();
  }

  initGUI() {
    const gui = new GUI({ title: 'Static Camera' });
    
    // Camera position controls
    const cameraFolder = gui.addFolder('Camera Position');
    cameraFolder.add(this.params, 'cameraX', -100, 100, 1)
      .name('Camera X')
      .onChange(() => this.update());
    
    cameraFolder.add(this.params, 'cameraY', -50, 50, 1)
      .name('Camera Y')
      .onChange(() => this.update());
    
    cameraFolder.add(this.params, 'cameraZ', -100, 100, 1)
      .name('Camera Z')
      .onChange(() => this.update());
    
    // Look At controls
    const lookAtFolder = gui.addFolder('Look At');
    lookAtFolder.add(this.params, 'lookAtX', -100, 100, 1)
      .name('Look At X')
      .onChange(() => this.update());
    
    lookAtFolder.add(this.params, 'lookAtY', -50, 50, 1)
      .name('Look At Y')
      .onChange(() => this.update());
    
    lookAtFolder.add(this.params, 'lookAtZ', -100, 100, 1)
      .name('Look At Z')
      .onChange(() => this.update());
  }

  update() {
    // Update camera position
    this.camera.position.set(
      this.params.cameraX,
      this.params.cameraY,
      this.params.cameraZ
    );

    // Update camera look-at
    this.camera.lookAt(
      this.params.lookAtX,
      this.params.lookAtY,
      this.params.lookAtZ
    );
  }
}

export default StaticCamera;