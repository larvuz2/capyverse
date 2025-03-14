import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

export default class NatureEnvironment {
  constructor(scene) {
    this.scene = scene;
    
    // Configuration options
    this.config = {
      terrain: {
        width: 200,
        height: 200,
        segments: 50,  // Reduced segments since we don't need as many for flat terrain
        heightScale: 0, // Set to 0 to make terrain flat
        noiseScale: 0.1,
      },
      trees: {
        count: 100,
        minHeight: 1,
        maxHeight: 3,
        minRadius: 0.5,
        maxRadius: 1.5,
      },
      clouds: {
        count: 20,
        minHeight: 25,
        maxHeight: 40,
        minSize: 5,
        maxSize: 15,
        speed: 0.02,
      }
    };
    
    // Container for environment objects
    this.objects = {
      terrain: null,
      trees: [],
      clouds: [],
    };
    
    // Initialize noise generator
    this.noise = new SimplexNoise();
  }
  
  // Initialize the entire environment
  init() {
    this.createTerrain();
    this.createTrees();
    this.createClouds();
    return this;
  }
  
  // Create flat terrain
  createTerrain() {
    const { width, height, segments } = this.config.terrain;
    
    // Create geometry - we don't need to modify the vertices anymore
    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    
    // Create material with green color for fields
    const material = new THREE.MeshStandardMaterial({
      color: 0x4CAF50,
      roughness: 0.8,
      metalness: 0.2,
      flatShading: false,
    });
    
    // Create mesh and add to scene
    this.objects.terrain = new THREE.Mesh(geometry, material);
    this.objects.terrain.rotation.x = -Math.PI / 2; // Make it horizontal
    this.objects.terrain.receiveShadow = true;
    this.scene.add(this.objects.terrain);
    
    return this.objects.terrain;
  }
  
  // Create trees distributed across the terrain
  createTrees() {
    const { count, minHeight, maxHeight, minRadius, maxRadius } = this.config.trees;
    const { width, height } = this.config.terrain;
    
    for (let i = 0; i < count; i++) {
      // Random position on the terrain
      const x = (Math.random() - 0.5) * width * 0.8; // Keep away from edges
      const z = (Math.random() - 0.5) * height * 0.8;
      
      // For flat terrain, y is always 0
      const y = 0;
      
      // Random tree properties
      const treeHeight = minHeight + Math.random() * (maxHeight - minHeight);
      const trunkRadius = minRadius + Math.random() * (maxRadius - minRadius);
      
      // Create tree
      const tree = this.createTree(treeHeight, trunkRadius);
      tree.position.set(x, y, z);
      
      // Add to scene and store in objects
      this.scene.add(tree);
      this.objects.trees.push(tree);
    }
    
    return this.objects.trees;
  }
  
  // Create a simple tree with trunk and leaves
  createTree(height, radius) {
    const group = new THREE.Group();
    
    // Create trunk
    const trunkGeometry = new THREE.CylinderGeometry(radius * 0.3, radius * 0.4, height * 0.6, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513,
      roughness: 0.9,
      metalness: 0.1,
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = height * 0.3;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);
    
    // Create leaves (as a cone)
    const leavesGeometry = new THREE.ConeGeometry(radius, height, 8);
    const leavesMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x228B22,
      roughness: 0.8,
      metalness: 0.1,
    });
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.y = height * 0.5 + height * 0.25;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    group.add(leaves);
    
    return group;
  }
  
  // Create clouds in the sky
  createClouds() {
    const { count, minHeight, maxHeight, minSize, maxSize } = this.config.clouds;
    const { width, height } = this.config.terrain;
    
    for (let i = 0; i < count; i++) {
      // Random position in the sky
      const x = (Math.random() - 0.5) * width * 1.5;
      const y = minHeight + Math.random() * (maxHeight - minHeight);
      const z = (Math.random() - 0.5) * height * 1.5;
      
      // Random cloud size
      const size = minSize + Math.random() * (maxSize - minSize);
      
      // Create cloud
      const cloud = this.createCloud(size);
      cloud.position.set(x, y, z);
      
      // Store some movement properties on the cloud
      cloud.userData.speed = 0.01 + Math.random() * 0.02;
      cloud.userData.direction = new THREE.Vector3(
        -0.5 + Math.random(), 
        0, 
        -0.2 + Math.random() * 0.4
      ).normalize();
      
      // Add to scene and store in objects
      this.scene.add(cloud);
      this.objects.clouds.push(cloud);
    }
    
    return this.objects.clouds;
  }
  
  // Create a fluffy cloud made of several spheres
  createCloud(size) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.9,
      roughness: 1,
      metalness: 0,
    });
    
    // Create the main body of the cloud
    const mainSphere = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.5, 7, 7),
      material
    );
    group.add(mainSphere);
    
    // Add several smaller spheres to create a fluffy appearance
    const numPuffs = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numPuffs; i++) {
      const puffSize = size * (0.2 + Math.random() * 0.3);
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(puffSize, 7, 7),
        material
      );
      
      // Position the puff relative to the main body
      const angle = (i / numPuffs) * Math.PI * 2;
      const radius = size * 0.4;
      puff.position.x = Math.cos(angle) * radius;
      puff.position.y = (Math.random() - 0.5) * size * 0.2;
      puff.position.z = Math.sin(angle) * radius;
      
      group.add(puff);
    }
    
    return group;
  }
  
  // Get the height of the terrain at a given x, z position
  // For flat terrain, this is always 0
  getTerrainHeight(x, z) {
    return 0;
  }
  
  // Update clouds position for animation
  update(deltaTime) {
    // Move clouds
    this.objects.clouds.forEach(cloud => {
      const { speed, direction } = cloud.userData;
      cloud.position.add(
        direction.clone().multiplyScalar(speed * deltaTime)
      );
      
      // Reset cloud position if it goes too far
      const { width, height } = this.config.terrain;
      if (
        cloud.position.x < -width || 
        cloud.position.x > width || 
        cloud.position.z < -height || 
        cloud.position.z > height
      ) {
        // Reset to the opposite side
        cloud.position.x = Math.sign(cloud.position.x) * -width * 0.8;
        cloud.position.z = (Math.random() - 0.5) * height;
      }
    });
  }
} 