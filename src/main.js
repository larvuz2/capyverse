import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RAPIER from '@dimforge/rapier3d';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('container').appendChild(renderer.domElement);

// Third-person camera settings
const cameraSettings = {
  distance: 3.1694,    // Distance from the character
  height: 1.1741,      // Height above the character
  rotationOffset: 0,   // Rotation offset around character (in radians)
  lookAtHeight: 0.515, // Height offset for lookAt point
  damping: 0.05,       // Camera movement smoothing factor
  rotationSpeed: 0.01  // How fast the camera rotates around character
};

class ThirdPersonCamera {
  constructor(camera, target, settings) {
    this.camera = camera;
    this.target = target;
    this.settings = settings;
    this.rotationAngle = 0; // Track camera rotation around character
    // Add current position and target position for smooth interpolation
    this.currentPosition = camera.position.clone();
    this.desiredPosition = camera.position.clone();
  }
  
  updatePosition() {
    if (!this.target) return;
    
    // Get character's current position and rotation
    const targetPosition = this.target.position.clone();
    const targetRotation = this.target.rotation.y;

    // Calculate desired camera position using character's orientation
    const offset = new THREE.Vector3(0, 0, -this.settings.distance);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationAngle + targetRotation);
    
    // Calculate desired position
    this.desiredPosition.set(
      targetPosition.x + offset.x,
      targetPosition.y + this.settings.height,
      targetPosition.z + offset.z
    );
    
    // Smoothly interpolate current position to desired position
    this.currentPosition.lerp(this.desiredPosition, this.settings.damping);
    this.camera.position.copy(this.currentPosition);
    
    // Smooth look-at target
    const lookAtTarget = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + this.settings.lookAtHeight,
      targetPosition.z
    );
    
    // Create smooth transition for looking at target
    const currentLookAt = this.camera.getWorldDirection(new THREE.Vector3())
      .multiplyScalar(-1)
      .add(this.camera.position);
    
    const finalLookAt = currentLookAt.lerp(lookAtTarget, this.settings.damping);
    this.camera.lookAt(finalLookAt);
  }
  
  // Rotate camera around character
  rotateAroundTarget(angleChange) {
    this.rotationAngle += angleChange;
    // Ensure rotation stays within 0 to 2π
    this.rotationAngle = this.rotationAngle % (Math.PI * 2);
  }
}

// Orbit controls for development
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Physics variables
let world, rapier;
let characterBody, character, mixer, walkAction, idleAction, activeAction;
let thirdPersonCamera;
let isGrounded = false;

// Movement variables
const moveSpeed = 3;
const jumpForce = 5;
const lastDirection = new THREE.Vector3(0, 0, -1);

// Keyboard controls
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
  q: false,
  e: false
};

// Initialize physics
async function initPhysics() {
  rapier = await RAPIER;
  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  world = new rapier.World(gravity);
  
  // Create a debug renderer
  const debugRender = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
  );
  scene.add(debugRender);
  
  console.log("Physics initialized");
}

// Create a temporary character while models load
function createTemporaryCapybara() {
  // Create a simple capsule as placeholder
  const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
  const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  character = new THREE.Mesh(geometry, material);
  character.castShadow = true;
  character.position.set(0, 1, 0);
  scene.add(character);
  
  // Create physics body for character
  const bodyDesc = rapier.RigidBodyDesc.dynamic()
    .setTranslation(0, 1.5, 0);
  characterBody = world.createRigidBody(bodyDesc);
  
  // Add collider (capsule shape)
  const colliderDesc = rapier.ColliderDesc.capsule(0.5, 0.5)
    .setFriction(0.2)
    .setRestitution(0.0);
  world.createCollider(colliderDesc, characterBody);
}

// Load 3D models
async function loadModels() {
  const loader = new GLTFLoader();
  
  try {
    // Load capybara model
    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        'models/capybara.glb',
        resolve,
        undefined,
        reject
      );
    });
    
    // Replace temporary character with loaded model
    scene.remove(character);
    character = gltf.scene;
    character.scale.set(0.5, 0.5, 0.5);
    character.castShadow = true;
    character.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });
    scene.add(character);
    
    // Setup animations
    mixer = new THREE.AnimationMixer(character);
    const animations = gltf.animations;
    
    // Find walk and idle animations
    walkAction = mixer.clipAction(animations.find(clip => clip.name === 'Walk') || animations[0]);
    idleAction = mixer.clipAction(animations.find(clip => clip.name === 'Idle') || animations[0]);
    
    // Start with idle animation
    idleAction.play();
    activeAction = idleAction;
    
    console.log("Models loaded successfully");
  } catch (error) {
    console.error("Error loading models:", error);
    // Keep using the temporary character if model loading fails
  }
}

// Create ground
function createGround() {
  // Create ground plane
  const groundGeometry = new THREE.PlaneGeometry(50, 50);
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x7CFC00,
    roughness: 0.8,
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Add physics for ground
  const groundDesc = rapier.RigidBodyDesc.fixed();
  const groundBody = world.createRigidBody(groundDesc);
  const groundColliderDesc = rapier.ColliderDesc.cuboid(25, 0.1, 25);
  world.createCollider(groundColliderDesc, groundBody);
  
  // Add directional light for shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  scene.add(directionalLight);
  
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
}

function updateCharacter(delta) {
  if (!characterBody) return;
  
  const velocity = characterBody.linvel();
  let movement = new THREE.Vector3();
  
  // Check if grounded
  const position = characterBody.translation();
  const ray = new rapier.Ray(
    { x: position.x, y: position.y, z: position.z },
    { x: 0, y: -1, z: 0 }
  );
  const hit = world.castRay(ray, 1.1, true);
  isGrounded = hit !== null;

  // Movement
  if (keys.w) movement.z -= 1;
  if (keys.s) movement.z += 1;
  if (keys.a) movement.x -= 1;
  if (keys.d) movement.x += 1;
  
  if (movement.length() > 0) {
    movement.normalize().multiplyScalar(moveSpeed);
    lastDirection.copy(movement).normalize();
    
    // Switch to walk animation
    if (mixer && activeAction !== walkAction) {
      activeAction.fadeOut(0.2);
      walkAction.reset().fadeIn(0.2).play();
      activeAction = walkAction;
    }
  } else {
    // Switch to idle animation
    if (mixer && activeAction !== idleAction) {
      activeAction.fadeOut(0.2);
      idleAction.reset().fadeIn(0.2).play();
      activeAction = idleAction;
    }
  }

  // Apply movement
  characterBody.setLinvel(
    { x: movement.x, y: velocity.y, z: movement.z },
    true
  );

  // Jump
  if (keys.space && isGrounded) {
    characterBody.setLinvel({ x: velocity.x, y: jumpForce, z: velocity.z }, true);
  }

  // Update character position
  const pos = characterBody.translation();
  character.position.set(pos.x, pos.y - 0.5, pos.z); // Adjust Y to account for capsule height
  
  // Rotate character to face movement direction
  if (movement.length() > 0) {
    const targetRotation = Math.atan2(movement.x, movement.z);
    character.rotation.y = THREE.MathUtils.lerp(
      character.rotation.y,
      targetRotation,
      0.1 // Smooth rotation
    );
  }
  
  // Camera rotation with Q and E keys
  if (thirdPersonCamera) {
    if (keys.q) {
      thirdPersonCamera.rotateAroundTarget(cameraSettings.rotationSpeed);
    }
    if (keys.e) {
      thirdPersonCamera.rotateAroundTarget(-cameraSettings.rotationSpeed);
    }
    
    // Update camera to follow character
    thirdPersonCamera.updatePosition();
  }
}

// Setup GUI
function setupGUI() {
  const gui = new GUI();
  
  // Camera settings
  const cameraFolder = gui.addFolder('Camera Settings');
  cameraFolder.add(cameraSettings, 'distance', 1, 10).onChange(() => {
    if (thirdPersonCamera) thirdPersonCamera.updatePosition();
  });
  cameraFolder.add(cameraSettings, 'height', 0, 5).onChange(() => {
    if (thirdPersonCamera) thirdPersonCamera.updatePosition();
  });
  cameraFolder.add(cameraSettings, 'lookAtHeight', 0, 2).onChange(() => {
    if (thirdPersonCamera) thirdPersonCamera.updatePosition();
  });
  cameraFolder.add(cameraSettings, 'damping', 0.01, 0.2).name('Smoothing');
  cameraFolder.add(cameraSettings, 'rotationSpeed', 0.001, 0.05).name('Rotation Speed');
  
  // Character settings
  const characterFolder = gui.addFolder('Character Settings');
  characterFolder.add({ speed: moveSpeed }, 'speed', 1, 10).onChange(value => {
    moveSpeed = value;
  });
  characterFolder.add({ jump: jumpForce }, 'jump', 1, 15).onChange(value => {
    jumpForce = value;
  });
  
  return gui;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update physics
  if (world) {
    world.step();
    updateCharacter(1/60);
  }
  
  // Update animations
  if (mixer) {
    mixer.update(1/60);
  }
  
  // Update orbit controls (for development)
  controls.update();
  
  // Render scene
  renderer.render(scene, camera);
}

// Initialize and start
async function init() {
  try {
    // Set initial camera position
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    // Initialize physics first
    await initPhysics();
    
    // Create ground
    createGround();
    
    // Load models
    await loadModels();
    
    // Setup third-person camera
    thirdPersonCamera = new ThirdPersonCamera(camera, character, cameraSettings);
    
    // Setup GUI
    const gui = setupGUI();
    
    // Setup keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = true;
      }
    });
    
    document.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = false;
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Create temporary character if model loading fails
    if (!character) {
      createTemporaryCapybara();
    }
    
    // Start animation loop
    animate();
    
    console.log("Initialization complete");
  } catch (error) {
    console.error("Initialization error:", error);
  }
}

// Start the application
init();