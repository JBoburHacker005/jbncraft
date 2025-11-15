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
let entities = [];
let playerModel = null;
let cameraMode = 'first'; // 'first' or 'third'
let health = 20;
let maxHealth = 20;
let food = 20;
let maxFood = 20;
let playerGroup = null;
let playerPosition = new THREE.Vector3(0, 20, 0); // Actual player position

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

    // Player group for third-person view
    playerGroup = new THREE.Group();
    scene.add(playerGroup);
    
    // Create simple player model
    createPlayerModel();
    
    // Camera setup - optimized far plane
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    playerPosition.set(0, 20, 0);
    camera.position.copy(playerPosition);
    camera.position.y += 0.9; // Eye height
    playerGroup.position.copy(playerPosition);
    playerGroup.position.y -= 0.9;
    euler.setFromQuaternion(camera.quaternion);

    // Renderer setup - optimized for 120 FPS
    renderer = new THREE.WebGLRenderer({ 
        antialias: false, // Disable for better performance
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        logarithmicDepthBuffer: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit pixel ratio for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap; // Faster shadows
    renderer.sortObjects = false; // Disable sorting for better performance
    renderer.autoClear = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Lighting - more realistic
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    // Optimized shadow map size for better FPS
    directionalLight.shadow.mapSize.width = 512; // Reduced for better performance
    directionalLight.shadow.mapSize.height = 512;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 150; // Reduced far distance
    directionalLight.shadow.camera.left = -40;
    directionalLight.shadow.camera.right = 40;
    directionalLight.shadow.camera.top = 40;
    directionalLight.shadow.camera.bottom = -40;
    directionalLight.shadow.bias = -0.0001; // Reduce shadow acne
    directionalLight.shadow.radius = 2; // Softer shadows
    scene.add(directionalLight);

    // Add hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.add(hemiLight);

    // Generate world
    generateWorld();
    
    // Spawn animals
    spawnAnimals();

    // Event listeners
    setupEventListeners();
    
    // Initialize UI
    initUI();

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

// Create player model - improved
function createPlayerModel() {
    const group = new THREE.Group();
    
    // Head
    const headGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.6, 0);
    head.castShadow = true;
    group.add(head);
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.4, 0.6, 0.2);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4a90e2 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 1.1, 0);
    body.castShadow = true;
    group.add(body);
    
    // Arms
    const armGeometry = new THREE.BoxGeometry(0.15, 0.5, 0.15);
    const armMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.3, 1.1, 0);
    leftArm.castShadow = true;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.3, 1.1, 0);
    rightArm.castShadow = true;
    group.add(rightArm);
    
    // Legs
    const legGeometry = new THREE.BoxGeometry(0.15, 0.5, 0.15);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.1, 0.5, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.1, 0.5, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);
    
    group.castShadow = true;
    group.receiveShadow = false; // Player doesn't need to receive shadows
    playerModel = group;
    playerGroup.add(playerModel);
    playerModel.visible = false; // Hidden by default (first-person)
}

// Spawn animals
function spawnAnimals() {
    const worldSize = 30;
    const animalTypes = ['cow', 'pig', 'chicken', 'sheep'];
    
    for (let i = 0; i < 30; i++) {
        const x = (Math.random() * worldSize * 2) - worldSize;
        const z = (Math.random() * worldSize * 2) - worldSize;
        const y = getBlockHeight(Math.floor(x), Math.floor(z)) + 1;
        
        if (y > 0 && y < 20) {
            const animalType = animalTypes[Math.floor(Math.random() * animalTypes.length)];
            createAnimal(x, y, z, animalType);
        }
    }
}

// Create animal
function createAnimal(x, y, z, type) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    
    let bodyColor, size;
    switch(type) {
        case 'cow':
            bodyColor = 0xffffff;
            size = 0.6;
            break;
        case 'pig':
            bodyColor = 0xffb3d9;
            size = 0.5;
            break;
        case 'chicken':
            bodyColor = 0xffffff;
            size = 0.3;
            break;
        case 'sheep':
            bodyColor = 0xffffff;
            size = 0.6;
            break;
        default:
            bodyColor = 0xffffff;
            size = 0.5;
    }
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(size, size * 0.8, size * 1.2);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Head
    const headGeometry = new THREE.BoxGeometry(size * 0.6, size * 0.6, size * 0.6);
    const headMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0, size * 0.7);
    head.castShadow = true;
    group.add(head);
    
    // Legs
    const legGeometry = new THREE.BoxGeometry(size * 0.2, size * 0.6, size * 0.2);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const positions = [
        [-size * 0.3, -size * 0.7, size * 0.3],
        [size * 0.3, -size * 0.7, size * 0.3],
        [-size * 0.3, -size * 0.7, -size * 0.3],
        [size * 0.3, -size * 0.7, -size * 0.3]
    ];
    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(...pos);
        leg.castShadow = true;
        group.add(leg);
    });
    
    const entity = {
        type: type,
        mesh: group,
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(),
        direction: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5,
        wanderTime: 0,
        wanderDuration: 2 + Math.random() * 3
    };
    
    entities.push(entity);
    scene.add(group);
}

// Update entities - improved with collision
function updateEntities(delta) {
    entities.forEach(entity => {
        entity.wanderTime += delta;
        
        if (entity.wanderTime >= entity.wanderDuration) {
            entity.direction = Math.random() * Math.PI * 2;
            entity.wanderDuration = 2 + Math.random() * 3;
            entity.wanderTime = 0;
        }
        
        // Move entity
        const moveX = Math.sin(entity.direction) * entity.speed * delta;
        const moveZ = Math.cos(entity.direction) * entity.speed * delta;
        
        const newX = entity.position.x + moveX;
        const newZ = entity.position.z + moveZ;
        const newY = getBlockHeight(Math.floor(newX), Math.floor(newZ)) + 0.5;
        
        // Simple collision check - don't move into blocks
        const checkX = Math.floor(newX);
        const checkZ = Math.floor(newZ);
        const keyX = `${checkX},${Math.floor(newY)},${Math.floor(entity.position.z)}`;
        const keyZ = `${Math.floor(entity.position.x)},${Math.floor(newY)},${checkZ}`;
        
        let canMoveX = !world[keyX];
        let canMoveZ = !world[keyZ];
        
        if (newY > 0 && newY < 50) {
            if (canMoveX) {
                entity.position.x = newX;
            } else {
                entity.direction += Math.PI; // Turn around
            }
            
            if (canMoveZ) {
                entity.position.z = newZ;
            } else if (!canMoveX) {
                entity.direction += Math.PI; // Turn around
            }
            
            entity.position.y = newY;
            entity.mesh.position.copy(entity.position);
            
            // Rotate entity to face movement direction
            if (canMoveX || canMoveZ) {
                entity.mesh.rotation.y = entity.direction;
            }
        } else {
            entity.direction += Math.PI; // Turn around
        }
    });
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
// Merge geometry for better performance
blockGeometry.computeBoundingBox();

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
    block.matrixAutoUpdate = true;
    
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
            if (slot.dataset.type === 'block') {
                selectedBlock = slot.dataset.block;
            } else if (slot.dataset.type === 'tool') {
                // Tool selected - could add tool functionality here
                selectedBlock = null;
            } else if (slot.dataset.type === 'item') {
                // Item selected - could add item usage here
                selectedBlock = null;
            }
        });
    });
    
    // Number key selection for inventory
    document.addEventListener('keydown', (e) => {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
            inventorySlots[num - 1].click();
        } else if (e.key === '0') {
            inventorySlots[9].click();
        }
    });
    
    // Camera toggle button
    const cameraBtn = document.getElementById('camera-toggle');
    if (cameraBtn) {
        cameraBtn.addEventListener('click', toggleCameraMode);
    }
    
    // Update block name display
    updateBlockName();
}

// Tool types
const toolTypes = {
    pickaxe: { name: 'Pickaxe', color: 0x808080, icon: '⛏️' },
    axe: { name: 'Axe', color: 0x8b4513, icon: '🪓' },
    sword: { name: 'Sword', color: 0xc0c0c0, icon: '⚔️' },
    shovel: { name: 'Shovel', color: 0x696969, icon: '🪚' },
    hoe: { name: 'Hoe', color: 0x654321, icon: '🔨' }
};

// Item types
const itemTypes = {
    apple: { name: 'Apple', color: 0xff0000, icon: '🍎' },
    bread: { name: 'Bread', color: 0xdeb887, icon: '🍞' },
    meat: { name: 'Meat', color: 0x8b0000, icon: '🍖' },
    stick: { name: 'Stick', color: 0x8b4513, icon: '🪵' },
    coal: { name: 'Coal', color: 0x1a1a1a, icon: '⚫' }
};

// Update block name display - optimized (only update when needed)
let lastBlockName = '';
let lastBlockCheck = 0;
function updateBlockName() {
    const now = performance.now();
    // Only check every 100ms for performance
    if (now - lastBlockCheck < 100) return;
    lastBlockCheck = now;
    
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
        case 'KeyF':
            toggleCameraMode();
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
            const eyePos = playerPosition.clone();
            eyePos.y += 0.9;
            const blockCenter = new THREE.Vector3(newX + 0.5, newY + 0.5, newZ + 0.5);
            const distToPlayer = eyePos.distanceTo(blockCenter);
            
            // Check if block would intersect with player using AABB
            const playerMinX = playerPosition.x - 0.3;
            const playerMaxX = playerPosition.x + 0.3;
            const playerMinY = playerPosition.y - 0.9;
            const playerMaxY = playerPosition.y + 0.9;
            const playerMinZ = playerPosition.z - 0.3;
            const playerMaxZ = playerPosition.z + 0.3;
            
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

// Initialize UI
function initUI() {
    updateHealthBar();
    updateFoodBar();
}

// Update health bar
function updateHealthBar() {
    const healthBar = document.getElementById('health-bar');
    if (healthBar) {
        const hearts = Math.ceil(health / 2);
        const fullHearts = Math.floor(health / 2);
        const halfHeart = health % 2 === 1;
        
        let html = '';
        for (let i = 0; i < 10; i++) {
            if (i < fullHearts) {
                html += '<span class="heart full">❤️</span>';
            } else if (i === fullHearts && halfHeart) {
                html += '<span class="heart half">💛</span>';
            } else {
                html += '<span class="heart empty">🤍</span>';
            }
        }
        healthBar.innerHTML = html;
    }
}

// Update food bar
function updateFoodBar() {
    const foodBar = document.getElementById('food-bar');
    if (foodBar) {
        const foodLevel = Math.ceil(food / 2);
        const fullFood = Math.floor(food / 2);
        const halfFood = food % 2 === 1;
        
        let html = '';
        for (let i = 0; i < 10; i++) {
            if (i < fullFood) {
                html += '<span class="food full">🍖</span>';
            } else if (i === fullFood && halfFood) {
                html += '<span class="food half">🍗</span>';
            } else {
                html += '<span class="food empty">⚪</span>';
            }
        }
        foodBar.innerHTML = html;
    }
}

// Toggle camera mode
function toggleCameraMode() {
    cameraMode = cameraMode === 'first' ? 'third' : 'first';
    const cameraBtn = document.getElementById('camera-toggle');
    if (cameraBtn) {
        cameraBtn.textContent = cameraMode === 'first' ? '📷' : '👤';
    }
    
    // Reset camera position when switching
    if (cameraMode === 'first') {
        // Return to first-person (camera at player position)
        camera.position.copy(playerPosition);
        camera.position.y += 0.9; // Eye height
    }
}

// Update player movement - improved physics
function updatePlayer(delta) {
    // Rotate player model to face movement direction
    if (playerModel && (moveForward || moveBackward || moveLeft || moveRight)) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
        const angle = Math.atan2(forward.x, forward.z);
        playerModel.rotation.y = angle;
    }
    
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
    
    // Improved AABB collision detection with separate axis checking
    const playerWidth = 0.3;
    const playerHeight = 1.8;
    const playerEyeHeight = 0.9;
    
    let onGround = false;
    let correctedX = playerPosition.x;
    let correctedY = playerPosition.y;
    let correctedZ = playerPosition.z;
    
    // Check collision for X axis first
    const testX = playerPosition.x + velocity.x * delta;
    let canMoveX = true;
    
    const playerMinX = testX - playerWidth;
    const playerMaxX = testX + playerWidth;
    const playerMinY = playerPosition.y - playerEyeHeight;
    const playerMaxY = playerPosition.y + playerEyeHeight;
    const playerMinZ = playerPosition.z - playerWidth;
    const playerMaxZ = playerPosition.z + playerWidth;
    
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
                
                const blockMinX = bx;
                const blockMaxX = bx + 1;
                const blockMinY = by;
                const blockMaxY = by + 1;
                const blockMinZ = bz;
                const blockMaxZ = bz + 1;
                
                if (!(playerMaxX <= blockMinX || playerMinX >= blockMaxX ||
                      playerMaxY <= blockMinY || playerMinY >= blockMaxY ||
                      playerMaxZ <= blockMinZ || playerMinZ >= blockMaxZ)) {
                    canMoveX = false;
                    if (testX < bx + 0.5) {
                        correctedX = blockMinX - playerWidth - 0.001;
                    } else {
                        correctedX = blockMaxX + playerWidth + 0.001;
                    }
                    velocity.x = 0;
                    break;
                }
            }
            if (!canMoveX) break;
        }
        if (!canMoveX) break;
    }
    
    if (canMoveX) {
        correctedX = testX;
    }
    
    // Check collision for Z axis
    const testZ = playerPosition.z + velocity.z * delta;
    let canMoveZ = true;
    
    const playerMinX2 = correctedX - playerWidth;
    const playerMaxX2 = correctedX + playerWidth;
    const playerMinZ2 = testZ - playerWidth;
    const playerMaxZ2 = testZ + playerWidth;
    
    const minBlockZ2 = Math.floor(playerMinZ2);
    const maxBlockZ2 = Math.floor(playerMaxZ2);
    const minBlockX2 = Math.floor(playerMinX2);
    const maxBlockX2 = Math.floor(playerMaxX2);
    
    for (let bx = minBlockX2; bx <= maxBlockX2; bx++) {
        for (let by = minBlockY; by <= maxBlockY; by++) {
            for (let bz = minBlockZ2; bz <= maxBlockZ2; bz++) {
                const key = `${bx},${by},${bz}`;
                if (!world[key]) continue;
                
                const blockMinX = bx;
                const blockMaxX = bx + 1;
                const blockMinY = by;
                const blockMaxY = by + 1;
                const blockMinZ = bz;
                const blockMaxZ = bz + 1;
                
                if (!(playerMaxX2 <= blockMinX || playerMinX2 >= blockMaxX ||
                      playerMaxY <= blockMinY || playerMinY >= blockMaxY ||
                      playerMaxZ2 <= blockMinZ || playerMinZ2 >= blockMaxZ)) {
                    canMoveZ = false;
                    if (testZ < bz + 0.5) {
                        correctedZ = blockMinZ - playerWidth - 0.001;
                    } else {
                        correctedZ = blockMaxZ + playerWidth + 0.001;
                    }
                    velocity.z = 0;
                    break;
                }
            }
            if (!canMoveZ) break;
        }
        if (!canMoveZ) break;
    }
    
    if (canMoveZ) {
        correctedZ = testZ;
    }
    
    // Check collision for Y axis
    const testY = playerPosition.y + velocity.y * delta;
    let canMoveY = true;
    
    const playerMinY2 = testY - playerEyeHeight;
    const playerMaxY2 = testY + playerEyeHeight;
    
    const minBlockY2 = Math.floor(playerMinY2);
    const maxBlockY2 = Math.floor(playerMaxY2);
    const minBlockX3 = Math.floor(correctedX - playerWidth);
    const maxBlockX3 = Math.floor(correctedX + playerWidth);
    const minBlockZ3 = Math.floor(correctedZ - playerWidth);
    const maxBlockZ3 = Math.floor(correctedZ + playerWidth);
    
    for (let bx = minBlockX3; bx <= maxBlockX3; bx++) {
        for (let by = minBlockY2; by <= maxBlockY2; by++) {
            for (let bz = minBlockZ3; bz <= maxBlockZ3; bz++) {
                const key = `${bx},${by},${bz}`;
                if (!world[key]) continue;
                
                const blockMinX = bx;
                const blockMaxX = bx + 1;
                const blockMinY = by;
                const blockMaxY = by + 1;
                const blockMinZ = bz;
                const blockMaxZ = bz + 1;
                
                if (!(correctedX + playerWidth <= blockMinX || correctedX - playerWidth >= blockMaxX ||
                      playerMaxY2 <= blockMinY || playerMinY2 >= blockMaxY ||
                      correctedZ + playerWidth <= blockMinZ || correctedZ - playerWidth >= blockMaxZ)) {
                    canMoveY = false;
                    if (testY > by + 0.5) {
                        correctedY = blockMaxY + playerEyeHeight + 0.001;
                        velocity.y = Math.max(0, velocity.y);
                    } else {
                        correctedY = blockMinY - playerEyeHeight - 0.001;
                        velocity.y = 0;
                        onGround = true;
                        canJump = true;
                    }
                    break;
                }
            }
            if (!canMoveY) break;
        }
        if (!canMoveY) break;
    }
    
    if (canMoveY) {
        correctedY = testY;
    }
    
    // Final check: ensure player is not inside any block
    const finalMinX = Math.floor(correctedX - playerWidth);
    const finalMaxX = Math.floor(correctedX + playerWidth);
    const finalMinY = Math.floor(correctedY - playerEyeHeight);
    const finalMaxY = Math.floor(correctedY + playerEyeHeight);
    const finalMinZ = Math.floor(correctedZ - playerWidth);
    const finalMaxZ = Math.floor(correctedZ + playerWidth);
    
    for (let bx = finalMinX; bx <= finalMaxX; bx++) {
        for (let by = finalMinY; by <= finalMaxY; by++) {
            for (let bz = finalMinZ; bz <= finalMaxZ; bz++) {
                const key = `${bx},${by},${bz}`;
                if (!world[key]) continue;
                
                const blockMinX = bx;
                const blockMaxX = bx + 1;
                const blockMinY = by;
                const blockMaxY = by + 1;
                const blockMinZ = bz;
                const blockMaxZ = bz + 1;
                
                if (!(correctedX + playerWidth < blockMinX || correctedX - playerWidth > blockMaxX ||
                      correctedY + playerEyeHeight < blockMinY || correctedY - playerEyeHeight > blockMaxY ||
                      correctedZ + playerWidth < blockMinZ || correctedZ - playerWidth > blockMaxZ)) {
                    // Player is inside block - push out
                    const overlapX = Math.min(correctedX + playerWidth - blockMinX, blockMaxX - (correctedX - playerWidth));
                    const overlapY = Math.min(correctedY + playerEyeHeight - blockMinY, blockMaxY - (correctedY - playerEyeHeight));
                    const overlapZ = Math.min(correctedZ + playerWidth - blockMinZ, blockMaxZ - (correctedZ - playerWidth));
                    
                    if (overlapY < overlapX && overlapY < overlapZ) {
                        if (correctedY > by + 0.5) {
                            correctedY = blockMaxY + playerEyeHeight + 0.01;
                        } else {
                            correctedY = blockMinY - playerEyeHeight - 0.01;
                        }
                    } else if (overlapX < overlapZ) {
                        if (correctedX < bx + 0.5) {
                            correctedX = blockMinX - playerWidth - 0.01;
                        } else {
                            correctedX = blockMaxX + playerWidth + 0.01;
                        }
                    } else {
                        if (correctedZ < bz + 0.5) {
                            correctedZ = blockMinZ - playerWidth - 0.01;
                        } else {
                            correctedZ = blockMaxZ + playerWidth + 0.01;
                        }
                    }
                }
            }
        }
    }

    // Apply corrected movement to player position
    playerPosition.x = correctedX;
    playerPosition.z = correctedZ;
    playerPosition.y = correctedY;
    
    // Update velocity if on ground
    if (onGround && velocity.y < 0) {
        velocity.y = 0;
    }
    
    // Update player group position (for model rendering)
    playerGroup.position.x = playerPosition.x;
    playerGroup.position.z = playerPosition.z;
    playerGroup.position.y = playerPosition.y - 0.9; // Ground level
    
    // Update camera based on mode
    if (cameraMode === 'third') {
        // Make player model visible
        if (playerModel) {
            playerModel.visible = true;
        }
        
        // Calculate third-person camera position (behind player)
        const eyePos = playerPosition.clone();
        
        // Get camera direction from quaternion
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.quaternion);
        
        // Calculate offset (behind and slightly above player)
        const offset = new THREE.Vector3(0, 0.3, 4);
        offset.applyQuaternion(camera.quaternion);
        
        // Target camera position
        const targetCameraPos = eyePos.clone().sub(offset);
        
        // Smoothly move camera
        camera.position.lerp(targetCameraPos, 0.15);
        
        // Make camera look at player
        const lookAtPos = eyePos.clone();
        lookAtPos.y += 0.2; // Look slightly above center
        camera.lookAt(lookAtPos);
    } else {
        // Make player model invisible in first-person
        if (playerModel) {
            playerModel.visible = false;
        }
        
        // In first-person, camera is at player eye position
        camera.position.copy(playerPosition);
        camera.position.y += 0.9; // Eye height
    }

    // Respawn if fall too far
    if (playerPosition.y < -10) {
        playerPosition.set(0, 25, 0);
        velocity.set(0, 0, 0);
        health = Math.max(0, health - 2);
        updateHealthBar();
    }
    
    // Continue breaking block if holding mouse
    if (isBreaking) {
        breakBlock();
    }
    
    // Gradually decrease food (slower rate)
    food = Math.max(0, food - delta * 0.005);
    if (food <= 0) {
        health = Math.max(0, health - delta * 0.2);
    }
    
    // Update UI periodically for performance
    if (!updatePlayer.lastUIUpdate) updatePlayer.lastUIUpdate = 0;
    updatePlayer.lastUIUpdate += delta;
    if (updatePlayer.lastUIUpdate >= 0.2) { // Update every 0.2 seconds
        updateFoodBar();
        updateHealthBar();
        updatePlayer.lastUIUpdate = 0;
    }
}

// Animation loop - optimized for 120 FPS
let targetFPS = 120;
let frameInterval = 1000 / targetFPS;
let lastFrameTime = performance.now();
let lastUpdateTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const elapsed = currentTime - lastFrameTime;
    
    if (elapsed >= frameInterval) {
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

        // Update game logic
        updatePlayer(delta);
        
        // Update block name less frequently for performance
        if (time - lastUpdateTime >= 100) {
            updateBlockName();
            lastUpdateTime = time;
        }
        
        // Update entities less frequently for performance
        if (entities.length > 0) {
            updateEntities(delta);
        }

        renderer.render(scene, camera);
        lastFrameTime = currentTime - (elapsed % frameInterval);
    }
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

