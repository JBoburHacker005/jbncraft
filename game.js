// Game variables
let scene, camera, renderer, controls;
let world = {};
let selectedBlock = 'grass';
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let euler = new THREE.Euler(0, 0, 0, 'YXZ');
let PI_2 = Math.PI / 2;
let breakingBlock = null;
let breakProgress = 0;
let isBreaking = false;
let fps = 0;
let fpsCounter = 0;
let fpsTime = 0;

// Block types with more realistic colors
const blockTypes = {
    grass: { top: 0x7cba3d, side: 0x8b6914, bottom: 0x8b6914, name: 'Grass Block' },
    dirt: { top: 0x8b6914, side: 0x8b6914, bottom: 0x8b6914, name: 'Dirt' },
    stone: { top: 0x808080, side: 0x808080, bottom: 0x808080, name: 'Stone' },
    wood: { top: 0x8b4513, side: 0xa0522d, bottom: 0x8b4513, name: 'Wood' },
    sand: { top: 0xdbd3a0, side: 0xdbd3a0, bottom: 0xdbd3a0, name: 'Sand' },
    gravel: { top: 0x888888, side: 0x888888, bottom: 0x888888, name: 'Gravel' },
    cobblestone: { top: 0x6a6a6a, side: 0x6a6a6a, bottom: 0x6a6a6a, name: 'Cobblestone' },
    leaves: { top: 0x2d5016, side: 0x2d5016, bottom: 0x2d5016, name: 'Leaves' },
    glass: { top: 0xc0e8ff, side: 0xc0e8ff, bottom: 0xc0e8ff, name: 'Glass', transparent: true }
};

// Initialize game
function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 50, 150); // Optimized fog distance

    // Camera setup - optimized far plane
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 20, 0);
    euler.setFromQuaternion(camera.quaternion);

    // Renderer setup - optimized for 60 FPS
    renderer = new THREE.WebGLRenderer({ 
        antialias: false, // Disable for better performance
        powerPreference: "high-performance",
        stencil: false,
        depth: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1)); // Limit pixel ratio for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadows
    renderer.sortObjects = false; // Disable sorting for better performance
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Lighting - more realistic
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    // Optimized shadow map size for better FPS
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200; // Reduced far distance
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.bias = -0.0001; // Reduce shadow acne
    scene.add(directionalLight);

    // Add hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.add(hemiLight);

    // Generate world
    generateWorld();

    // Event listeners
    setupEventListeners();

    // Start animation loop
    animate();
}

// Generate the world - improved terrain
function generateWorld() {
    const worldSize = 30;
    const baseHeight = 8;

    // Better terrain generation with noise-like function
    for (let x = -worldSize; x < worldSize; x++) {
        for (let z = -worldSize; z < worldSize; z++) {
            // More realistic terrain using multiple sine waves
            const noise1 = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 3;
            const noise2 = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 1.5;
            const noise3 = Math.sin(x * 0.03) * Math.cos(z * 0.03) * 5;
            const y = Math.floor(noise1 + noise2 + noise3 + baseHeight);
            
            // Create ground layers
            for (let yPos = 0; yPos <= y; yPos++) {
                let blockType;
                if (yPos === y) {
                    // Surface layer
                    if (y < baseHeight - 2) {
                        blockType = 'sand'; // Beach
                    } else {
                        blockType = 'grass';
                    }
                } else if (yPos >= y - 3) {
                    blockType = 'dirt';
                } else if (yPos >= y - 5) {
                    blockType = 'stone';
                } else {
                    blockType = 'cobblestone';
                }
                createBlock(x, yPos, z, blockType);
            }
        }
    }

    // Add trees with better generation
    for (let i = 0; i < 25; i++) {
        const x = Math.floor(Math.random() * worldSize * 2) - worldSize;
        const z = Math.floor(Math.random() * worldSize * 2) - worldSize;
        const y = getBlockHeight(x, z);
        if (y > baseHeight - 2 && y < baseHeight + 5) {
            const treeHeight = 4 + Math.floor(Math.random() * 3);
            // Tree trunk
            for (let j = 1; j <= treeHeight; j++) {
                createBlock(x, y + j, z, 'wood');
            }
            // Tree leaves - better shape
            const leafRadius = 2;
            for (let dx = -leafRadius; dx <= leafRadius; dx++) {
                for (let dz = -leafRadius; dz <= leafRadius; dz++) {
                    for (let dy = treeHeight; dy <= treeHeight + 2; dy++) {
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        if (dist <= leafRadius && (dy === treeHeight || dist <= leafRadius - 0.5)) {
                            if (Math.random() > 0.2) {
                                createBlock(x + dx, y + dy, z + dz, 'leaves');
                            }
                        }
                    }
                }
            }
        }
    }

    // Add some sand patches
    for (let i = 0; i < 15; i++) {
        const x = Math.floor(Math.random() * worldSize * 2) - worldSize;
        const z = Math.floor(Math.random() * worldSize * 2) - worldSize;
        const y = getBlockHeight(x, z);
        if (y > 0) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (Math.random() > 0.5) {
                        const blockY = getBlockHeight(x + dx, z + dz);
                        if (blockY === y) {
                            removeBlock(x + dx, y, z + dz);
                            createBlock(x + dx, y, z + dz, 'sand');
                        }
                    }
                }
            }
        }
    }
}

// Get block height at position
function getBlockHeight(x, z) {
    const floorX = Math.floor(x);
    const floorZ = Math.floor(z);
    let maxY = -1;
    for (let y = 0; y < 50; y++) {
        const key = `${floorX},${y},${floorZ}`;
        if (world[key]) {
            maxY = y;
        }
    }
    return maxY;
}

// Shared geometry for all blocks (optimization)
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

// Material cache for better performance
const materialCache = {};

function getBlockMaterial(type, face) {
    const cacheKey = `${type}_${face}`;
    if (materialCache[cacheKey]) {
        return materialCache[cacheKey];
    }
    
    const blockData = blockTypes[type];
    if (!blockData) return null;
    
    const materialOptions = blockData.transparent ? { transparent: true, opacity: 0.7 } : {};
    let color;
    
    switch(face) {
        case 'top': color = blockData.top; break;
        case 'bottom': color = blockData.bottom; break;
        default: color = blockData.side; break;
    }
    
    const material = new THREE.MeshLambertMaterial({ color, ...materialOptions });
    materialCache[cacheKey] = material;
    return material;
}

// Create a block - optimized
function createBlock(x, y, z, type = 'grass') {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    const key = `${floorX},${floorY},${floorZ}`;
    
    if (world[key]) return; // Block already exists

    const blockData = blockTypes[type];
    if (!blockData) return; // Invalid block type
    
    // Use cached materials
    const materials = [
        getBlockMaterial(type, 'side'), // Right
        getBlockMaterial(type, 'side'), // Left
        getBlockMaterial(type, 'top'),  // Top
        getBlockMaterial(type, 'bottom'), // Bottom
        getBlockMaterial(type, 'side'), // Front
        getBlockMaterial(type, 'side')  // Back
    ];

    const block = new THREE.Mesh(blockGeometry, materials);
    block.position.set(floorX + 0.5, floorY + 0.5, floorZ + 0.5);
    block.castShadow = true;
    block.receiveShadow = true;
    block.userData = { type, x: floorX, y: floorY, z: floorZ };
    block.frustumCulled = true; // Enable frustum culling for performance
    
    scene.add(block);
    world[key] = block;
}

// Remove a block - optimized (materials are cached, don't dispose)
function removeBlock(x, y, z) {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    const key = `${floorX},${floorY},${floorZ}`;
    const block = world[key];
    if (block) {
        scene.remove(block);
        // Don't dispose geometry (it's shared) or materials (they're cached)
        delete world[key];
        breakingBlock = null;
        breakProgress = 0;
        isBreaking = false;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Keyboard controls
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    // Mouse controls
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    // Lock pointer for mouse look
    renderer.domElement.addEventListener('click', () => {
        renderer.domElement.requestPointerLock();
    });
    
    // Pointer lock change
    document.addEventListener('pointerlockchange', onPointerLockChange);
    
    // Inventory selection
    const inventorySlots = document.querySelectorAll('.inventory-slot');
    inventorySlots.forEach((slot, index) => {
        slot.addEventListener('click', () => {
            inventorySlots.forEach(s => s.classList.remove('active'));
            slot.classList.add('active');
            selectedBlock = slot.dataset.block;
        });
    });
    
    // Number key selection for inventory
    document.addEventListener('keydown', (e) => {
        const num = parseInt(e.key);
        if (num >= 1 && num <= inventorySlots.length) {
            inventorySlots[num - 1].click();
        }
    });
    
    // Update block name display
    updateBlockName();
}

// Update block name display - optimized (only update when needed)
let lastBlockName = '';
function updateBlockName() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = 5;
    const intersects = raycaster.intersectObjects(Object.values(world), false);
    
    const blockNameEl = document.getElementById('block-name');
    if (intersects.length > 0) {
        const block = intersects[0].object;
        const blockType = block.userData.type;
        const blockData = blockTypes[blockType];
        if (blockData) {
            const newName = blockData.name;
            // Only update if name changed (performance optimization)
            if (newName !== lastBlockName) {
                blockNameEl.textContent = newName;
                blockNameEl.classList.add('show');
                lastBlockName = newName;
            }
        } else {
            if (lastBlockName !== '') {
                blockNameEl.classList.remove('show');
                lastBlockName = '';
            }
        }
    } else {
        if (lastBlockName !== '') {
            blockNameEl.classList.remove('show');
            lastBlockName = '';
        }
    }
}

// Keyboard handlers
function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space': 
            if (canJump) {
                velocity.y = 8; // Jump velocity
                canJump = false;
            }
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
}

// Mouse handlers - fixed to allow looking down properly
function onMouseMove(event) {
    if (document.pointerLockElement === renderer.domElement) {
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= movementX * 0.002;
        euler.x -= movementY * 0.002;
        
        // Allow full vertical rotation (looking up and down)
        euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
        
        camera.quaternion.setFromEuler(euler);
    }
}

function onMouseDown(event) {
    if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
        return;
    }

    if (event.button === 0) { // Left click - break block
        isBreaking = true;
        breakBlock();
    } else if (event.button === 2) { // Right click - place block
        placeBlock();
    }
}

function onMouseUp(event) {
    if (event.button === 0) {
        isBreaking = false;
        breakingBlock = null;
        breakProgress = 0;
    }
}

// Break block with progress
function breakBlock() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = 5; // Max reach distance
    const intersects = raycaster.intersectObjects(Object.values(world), false);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        const block = intersect.object;
        const { x, y, z } = block.userData;

        // Check if same block
        if (breakingBlock && breakingBlock.x === x && breakingBlock.y === y && breakingBlock.z === z) {
            breakProgress += 0.1;
            if (breakProgress >= 1) {
                removeBlock(x, y, z);
            }
        } else {
            breakingBlock = { x, y, z };
            breakProgress = 0.1;
        }
    } else {
        breakingBlock = null;
        breakProgress = 0;
    }
}

// Place block - fixed normal calculation
function placeBlock() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = 5; // Max reach distance
    const intersects = raycaster.intersectObjects(Object.values(world), false);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        const block = intersect.object;
        const { x, y, z } = block.userData;

        // Get face normal in world space
        const normal = new THREE.Vector3();
        normal.copy(intersect.face.normal);
        normal.transformDirection(block.matrixWorld);
        
        // Round to get direction (should be -1, 0, or 1)
        const dirX = Math.round(normal.x);
        const dirY = Math.round(normal.y);
        const dirZ = Math.round(normal.z);
        
        const newX = x + dirX;
        const newY = y + dirY;
        const newZ = z + dirZ;
        
        // Check if position is not occupied
        const key = `${newX},${newY},${newZ}`;
        if (!world[key]) {
            // Check distance to player (prevent placing inside player)
            const playerPos = camera.position;
            const blockCenter = new THREE.Vector3(newX + 0.5, newY + 0.5, newZ + 0.5);
            const distToPlayer = playerPos.distanceTo(blockCenter);
            
            // Check if block would intersect with player using AABB
            const playerMinX = playerPos.x - 0.3;
            const playerMaxX = playerPos.x + 0.3;
            const playerMinY = playerPos.y - 0.1;
            const playerMaxY = playerPos.y + 1.7;
            const playerMinZ = playerPos.z - 0.3;
            const playerMaxZ = playerPos.z + 0.3;
            
            const blockMinX = newX;
            const blockMaxX = newX + 1;
            const blockMinY = newY;
            const blockMaxY = newY + 1;
            const blockMinZ = newZ;
            const blockMaxZ = newZ + 1;
            
            const intersectsPlayer = !(
                blockMaxX < playerMinX || blockMinX > playerMaxX ||
                blockMaxY < playerMinY || blockMinY > playerMaxY ||
                blockMaxZ < playerMinZ || blockMinZ > playerMaxZ
            );
            
            if (!intersectsPlayer && distToPlayer > 0.5) {
                createBlock(newX, newY, newZ, selectedBlock);
            }
        }
    }
}

function onPointerLockChange() {
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener('mousemove', onMouseMove);
    } else {
        document.removeEventListener('mousemove', onMouseMove);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Update player movement - improved physics
function updatePlayer(delta) {
    // Friction
    velocity.x *= Math.pow(0.6, delta * 10);
    velocity.z *= Math.pow(0.6, delta * 10);
    
    // Gravity
    velocity.y -= 30 * delta; // Gravity

    // Movement direction
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    // Apply movement speed
    const speed = 8; // Blocks per second
    if (moveForward || moveBackward) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
        forward.multiplyScalar(direction.z * speed);
        velocity.x += forward.x * delta * 10;
        velocity.z += forward.z * delta * 10;
    }
    
    if (moveLeft || moveRight) {
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();
        right.multiplyScalar(direction.x * speed);
        velocity.x += right.x * delta * 10;
        velocity.z += right.z * delta * 10;
    }

    // Limit horizontal velocity
    const horizontalVel = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    if (horizontalVel > speed) {
        velocity.x = (velocity.x / horizontalVel) * speed;
        velocity.z = (velocity.z / horizontalVel) * speed;
    }
    
    // Calculate new position
    const newX = camera.position.x + velocity.x * delta;
    const newY = camera.position.y + velocity.y * delta;
    const newZ = camera.position.z + velocity.z * delta;

    // Improved AABB collision detection
    const playerWidth = 0.3;
    const playerHeight = 1.8;
    const playerFeetY = newY - 0.9;
    const playerHeadY = newY + 0.9;
    
    // Player AABB bounds
    const playerMinX = newX - playerWidth;
    const playerMaxX = newX + playerWidth;
    const playerMinY = playerFeetY;
    const playerMaxY = playerHeadY;
    const playerMinZ = newZ - playerWidth;
    const playerMaxZ = newZ + playerWidth;
    
    let canMoveX = true, canMoveY = true, canMoveZ = true;
    let onGround = false;

    // Check all blocks that could intersect with player
    const minBlockX = Math.floor(playerMinX);
    const maxBlockX = Math.floor(playerMaxX);
    const minBlockY = Math.floor(playerMinY);
    const maxBlockY = Math.floor(playerMaxY);
    const minBlockZ = Math.floor(playerMinZ);
    const maxBlockZ = Math.floor(playerMaxZ);

    for (let bx = minBlockX; bx <= maxBlockX; bx++) {
        for (let by = minBlockY; by <= maxBlockY; by++) {
            for (let bz = minBlockZ; bz <= maxBlockZ; bz++) {
                const key = `${bx},${by},${bz}`;
                if (!world[key]) continue;
                
                // Block AABB bounds
                const blockMinX = bx;
                const blockMaxX = bx + 1;
                const blockMinY = by;
                const blockMaxY = by + 1;
                const blockMinZ = bz;
                const blockMaxZ = bz + 1;
                
                // Check AABB intersection
                const intersects = !(
                    playerMaxX < blockMinX || playerMinX > blockMaxX ||
                    playerMaxY < blockMinY || playerMinY > blockMaxY ||
                    playerMaxZ < blockMinZ || playerMinZ > blockMaxZ
                );
                
                if (intersects) {
                    // Determine which axis to resolve collision on
                    const overlapX = Math.min(playerMaxX - blockMinX, blockMaxX - playerMinX);
                    const overlapY = Math.min(playerMaxY - blockMinY, blockMaxY - playerMinY);
                    const overlapZ = Math.min(playerMaxZ - blockMinZ, blockMaxZ - playerMinZ);
                    
                    // Resolve on axis with smallest overlap
                    if (overlapY < overlapX && overlapY < overlapZ) {
                        canMoveY = false;
                        if (newY > by + 1) {
                            // Hitting head
                            velocity.y = 0;
                        } else {
                            // On ground
                            onGround = true;
                            canJump = true;
                        }
                    } else if (overlapX < overlapZ) {
                        canMoveX = false;
                    } else {
                        canMoveZ = false;
                    }
                }
            }
        }
    }

    // Apply movement
    if (canMoveX) camera.position.x = newX;
    if (canMoveZ) camera.position.z = newZ;
    
    if (canMoveY) {
        camera.position.y = newY;
    } else {
        if (onGround) {
            velocity.y = 0;
        } else if (velocity.y < 0) {
            velocity.y = 0;
        }
    }

    // Respawn if fall too far
    if (camera.position.y < -10) {
        camera.position.set(0, 25, 0);
        velocity.set(0, 0, 0);
    }
    
    // Continue breaking block if holding mouse
    if (isBreaking) {
        breakBlock();
    }
}

// Animation loop - optimized for 60 FPS
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    let delta = (time - prevTime) / 1000;
    prevTime = time;
    
    // Cap delta to prevent large jumps
    delta = Math.min(delta, 0.1);
    
    // Calculate FPS
    fpsCounter++;
    if (time - fpsTime >= 1000) {
        fps = fpsCounter;
        fpsCounter = 0;
        fpsTime = time;
        updateFPSDisplay();
    }

    updatePlayer(delta);
    updateBlockName();

    renderer.render(scene, camera);
}

// Update FPS display
function updateFPSDisplay() {
    const fpsEl = document.getElementById('fps-counter');
    if (fpsEl) {
        fpsEl.textContent = `FPS: ${fps}`;
        if (fps < 30) {
            fpsEl.style.color = '#ff0000';
        } else if (fps < 50) {
            fpsEl.style.color = '#ffaa00';
        } else {
            fpsEl.style.color = '#00ff00';
        }
    }
}

// Start the game
init();

