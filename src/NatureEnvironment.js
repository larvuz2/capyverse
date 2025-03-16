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
      rocks: {
        pairCount: 30,     // Number of rock pairs to generate
        minSize: 0.3,      // Minimum rock size
        maxSize: 0.8,      // Maximum rock size
        pairDistance: 0.8, // Average distance between rocks in a pair
        roughness: 0.7,    // Material roughness
      },
      ponds: {
        count: 15,          // Number of ponds to generate
        minRadius: 2,       // Minimum pond radius
        maxRadius: 5,       // Maximum pond radius
        depth: 0.3,         // Depth of the pond
        waterColor: 0x3498DB // Brighter blue color for visibility
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
      rocks: [],
      ponds: [],
      clouds: [],
    };
    
    // Initialize noise generator
    this.noise = new SimplexNoise();
  }
  
  // Initialize the entire environment
  init() {
    this.createTerrain();
    this.createTrees();
    this.createRocks();
    this.createPonds();
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
  
  // Create rocks distributed across the terrain
  createRocks() {
    const { pairCount, minSize, maxSize, pairDistance, roughness } = this.config.rocks;
    const { width, height } = this.config.terrain;
    
    for (let i = 0; i < pairCount; i++) {
      // Random position for the pair center
      const centerX = (Math.random() - 0.5) * width * 0.8; // Keep away from edges
      const centerZ = (Math.random() - 0.5) * height * 0.8;
      
      // For flat terrain, y is always 0
      const y = 0;
      
      // Create the first rock
      const size1 = minSize + Math.random() * (maxSize - minSize);
      const rock1 = this.createRock(size1);
      
      // Random angle for pair positioning
      const angle = Math.random() * Math.PI * 2;
      const distance = pairDistance * (0.8 + Math.random() * 0.4); // Varied distance
      
      // Position and rotate first rock
      rock1.position.set(
        centerX + Math.cos(angle) * distance * 0.5,
        y,
        centerZ + Math.sin(angle) * distance * 0.5
      );
      rock1.rotation.y = Math.random() * Math.PI * 2; // Random rotation
      
      // Create the second rock with a different size
      const size2 = minSize + Math.random() * (maxSize - minSize);
      const rock2 = this.createRock(size2);
      
      // Position and rotate second rock 
      rock2.position.set(
        centerX - Math.cos(angle) * distance * 0.5,
        y,
        centerZ - Math.sin(angle) * distance * 0.5
      );
      rock2.rotation.y = Math.random() * Math.PI * 2; // Random rotation
      
      // Add to scene and store in objects
      this.scene.add(rock1);
      this.scene.add(rock2);
      this.objects.rocks.push(rock1);
      this.objects.rocks.push(rock2);
    }
    
    return this.objects.rocks;
  }
  
  // Create a rock with realistic appearance
  createRock(size) {
    const group = new THREE.Group();
    
    // Create a random color variation for the rock
    const colorVariation = Math.random() * 0.2 - 0.1; // -0.1 to 0.1
    const rockColor = new THREE.Color(0x7D7D7D); // Base gray color
    rockColor.r += colorVariation;
    rockColor.g += colorVariation;
    rockColor.b += colorVariation;
    
    const material = new THREE.MeshStandardMaterial({
      color: rockColor,
      roughness: this.config.rocks.roughness,
      metalness: 0.1,
      flatShading: true, // Enable flat shading for rocky appearance
    });
    
    // Determine rock shape type
    const shapeType = Math.floor(Math.random() * 3); // 0, 1, or 2 for different shapes
    
    if (shapeType === 0) {
      // Angular rock using modified box geometry
      const geometry = new THREE.BoxGeometry(
        size * (0.8 + Math.random() * 0.4),
        size * (0.6 + Math.random() * 0.3),
        size * (0.7 + Math.random() * 0.5)
      );
      
      // Displace vertices for irregular shape
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        // Random displacement
        const displacement = (Math.random() - 0.5) * size * 0.2;
        positions.setXYZ(i, x + displacement, y + displacement, z + displacement);
      }
      
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
    } 
    else if (shapeType === 1) {
      // Round rock using sphere-based geometry
      const mainSphere = new THREE.Mesh(
        new THREE.SphereGeometry(size * 0.5, 7, 7),
        material
      );
      group.add(mainSphere);
      
      // Add several smaller spheres to create a rocky appearance
      const numPuffs = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numPuffs; i++) {
        const puffSize = size * (0.2 + Math.random() * 0.3);
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(puffSize, 6, 6),
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
    }
    else {
      // Flat rock using modified cylinder
      const geometry = new THREE.CylinderGeometry(
        size * (0.6 + Math.random() * 0.4), // top radius
        size * (0.7 + Math.random() * 0.3), // bottom radius
        size * (0.2 + Math.random() * 0.3), // height
        6 + Math.floor(Math.random() * 3), // segments
        1, // height segments
        false // open ended
      );
      
      // Displace vertices for irregular shape
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        // Only displace the edge vertices (not top and bottom center)
        if (Math.sqrt(x*x + z*z) > size * 0.2) {
          const displacement = (Math.random() - 0.5) * size * 0.2;
          positions.setXYZ(i, x + displacement, y, z + displacement);
        }
      }
      
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = Math.PI / 2; // Lay flat
      group.add(mesh);
    }
    
    // Add cast and receive shadows
    group.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    
    return group;
  }
  
  // Create ponds distributed across the terrain
  createPonds() {
    const { count, minRadius, maxRadius, depth, waterColor } = this.config.ponds;
    const { width, height } = this.config.terrain;
    
    // Reduced minimum distances to allow more pond placement
    const minDistanceToTree = 3; // Minimum distance to trees
    const minDistanceToRock = 2; // Minimum distance to rocks
    
    // Try to place ponds with collision detection
    let attempts = 0;
    let placedCount = 0;
    
    console.log("Attempting to place ponds...");
    
    while (placedCount < count && attempts < count * 10) {
      attempts++;
      
      // Random position for the pond center
      const centerX = (Math.random() - 0.5) * width * 0.8; // Keep away from edges
      const centerZ = (Math.random() - 0.5) * height * 0.8;
      
      // For flat terrain, y is always 0
      const y = 0;
      
      // Random pond size
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      
      // Check collision with trees
      let collidesWithTree = false;
      for (const tree of this.objects.trees) {
        const distance = Math.sqrt(
          Math.pow(tree.position.x - centerX, 2) + 
          Math.pow(tree.position.z - centerZ, 2)
        );
        if (distance < radius + minDistanceToTree) {
          collidesWithTree = true;
          break;
        }
      }
      
      if (collidesWithTree) continue;
      
      // Check collision with rocks
      let collidesWithRock = false;
      for (const rock of this.objects.rocks) {
        const distance = Math.sqrt(
          Math.pow(rock.position.x - centerX, 2) + 
          Math.pow(rock.position.z - centerZ, 2)
        );
        if (distance < radius + minDistanceToRock) {
          collidesWithRock = true;
          break;
        }
      }
      
      if (collidesWithRock) continue;
      
      // Create pond
      const pond = this.createPond(radius, depth, waterColor);
      // Position at ground level for visibility
      pond.position.set(centerX, 0.05, centerZ); // Slightly above ground
      
      // Store pond data for animation
      pond.userData.originalPosition = pond.position.clone();
      pond.userData.time = Math.random() * Math.PI * 2; // Random start time
      
      // Add to scene and store in objects
      this.scene.add(pond);
      this.objects.ponds.push(pond);
      placedCount++;
    }
    
    console.log(`Successfully placed ${placedCount} ponds out of ${count} after ${attempts} attempts`);
    
    return this.objects.ponds;
  }
  
  // Create a pond with stylized texture
  createPond(radius, depth, waterColor) {
    const group = new THREE.Group();
    
    // Create pond base/bed with darker color
    const bedGeometry = new THREE.CylinderGeometry(radius, radius * 0.95, depth * 0.4, 32);
    const bedMaterial = new THREE.MeshStandardMaterial({
      color: 0x1E3B4D, // Darker blue for pond bed
      roughness: 0.9,
      metalness: 0.1,
    });
    const bed = new THREE.Mesh(bedGeometry, bedMaterial);
    bed.position.y = -depth * 0.2; // Positioned slightly below ground
    bed.receiveShadow = true;
    group.add(bed);
    
    // Create water surface with stylized look
    const waterGeometry = new THREE.CircleGeometry(radius, 32);
    
    // Add light blue tint to water color with more saturation
    const baseColor = new THREE.Color(waterColor);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.85, // Increased opacity for visibility
      roughness: 0.1, // More reflective
      metalness: 0.5, // More metallic for water shine
    });
    
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2; // Make horizontal
    water.position.y = 0.1; // Slightly above ground for visibility
    water.receiveShadow = true;
    group.add(water);
    
    // Add simple ripple pattern on the water
    const rippleGeometry = new THREE.CircleGeometry(radius * 0.7, 32);
    const rippleMaterial = new THREE.MeshStandardMaterial({
      color: 0xCCE6FF, // Light blue for ripples
      transparent: true,
      opacity: 0.4, // Increased opacity for visibility
      roughness: 0.1,
      metalness: 0.3,
    });
    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.rotation.x = -Math.PI / 2; // Make horizontal
    ripple.position.y = 0.11; // Slightly above water
    group.add(ripple);
    
    // Store ripple reference for animation
    group.userData.ripple = ripple;
    
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
    
    // Animate water ripples
    this.objects.ponds.forEach(pond => {
      // Update time
      pond.userData.time += deltaTime * 0.5;
      
      // Access the ripple
      const ripple = pond.userData.ripple;
      if (ripple) {
        // Scale the ripple based on sine wave for pulsing effect
        const scale = 0.7 + Math.sin(pond.userData.time) * 0.2;
        ripple.scale.set(scale, scale, 1);
        
        // Rotate ripple slowly
        ripple.rotation.z += deltaTime * 0.1;
        
        // Change opacity slightly based on cosine wave
        const material = ripple.material;
        material.opacity = 0.1 + Math.abs(Math.cos(pond.userData.time * 0.7)) * 0.1;
      }
    });
  }
} 