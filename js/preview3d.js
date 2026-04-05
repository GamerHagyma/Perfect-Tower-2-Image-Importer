import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Preview3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.assets = [];
        this.instancedMesh = null;
        this.isGridVisible = true;
        this.materialsCache = {}; // Cache materials by hex string

        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0b10);

        // Aspect handling
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspect = width / height;
        const d = 12; // Frustum size

        // Orthographic Camera (Isometric style)
        this.camera = new THREE.OrthographicCamera(
            -d * aspect, d * aspect,
            d, -d,
            1, 1000
        );
        
        // Initial isometric position
        this.setCameraIsometric();

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        // Target center of tower (Y axis goes from -1 to 10, so roughly center is 4.5)
        this.controls.target.set(0, 4.5, 0);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 40, 20);
        this.scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0xaabbff, 0.3);
        fillLight.position.set(-20, 20, -20);
        this.scene.add(fillLight);

        // Group for tower assets
        this.towerGroup = new THREE.Group();
        this.scene.add(this.towerGroup);

        this.createGrid();

        // Window resize handle
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Start render loop
        this.animate();
    }

    createGrid() {
        this.gridGroup = new THREE.Group();
        
        // Base plane representing X/Z bounds (-4 to 4)
        const planeGeo = new THREE.PlaneGeometry(8, 8);
        const planeMat = new THREE.MeshBasicMaterial({ 
            color: 0x222233, 
            transparent: true, 
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -1; // Floor is at Y=-1 in game
        this.gridGroup.add(plane);

        // X and Z limits grid helper
        const gridHelper = new THREE.GridHelper(8, 8, 0x6366f1, 0x333344);
        gridHelper.position.y = -0.99; // slightly above base to prevent z-fighting
        this.gridGroup.add(gridHelper);

        // Bounding Box Visualization (Game Limits)
        const boxGeo = new THREE.BoxGeometry(8, 11, 8);
        const edgesGeo = new THREE.EdgesGeometry(boxGeo);
        const boundsMat = new THREE.LineBasicMaterial({ color: 0x444455, transparent: true, opacity: 0.3 });
        const bounds = new THREE.LineSegments(edgesGeo, boundsMat);
        bounds.position.set(0, 4.5, 0); // Center is Y=4.5 (from -1 to 10)
        this.gridGroup.add(bounds);

        this.scene.add(this.gridGroup);
    }

    setCameraIsometric() {
        // Standard isometric 45 view
        this.camera.position.set(20, 20, 20);
        this.camera.lookAt(0, 4.5, 0);
        if (this.controls) {
            this.controls.target.set(0, 4.5, 0);
            this.controls.update();
        }
    }

    toggleGrid() {
        this.isGridVisible = !this.isGridVisible;
        this.gridGroup.visible = this.isGridVisible;
        return this.isGridVisible;
    }

    // Accepts array of pure PT2 API objects {position, size, color}
    renderBlueprint(assets) {
        this.assets = assets;
        
        // Clear old tower
        while(this.towerGroup.children.length > 0) { 
            const child = this.towerGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            this.towerGroup.remove(child); 
        }

        if(!assets || assets.length === 0) return;

        // Group objects by color to minimize draw calls
        const colorGroups = {};
        for(let asset of assets) {
            const hex = asset.color || "#FFFFFF";
            if(!colorGroups[hex]) colorGroups[hex] = [];
            colorGroups[hex].push(asset);
        }

        const defaultGeometry = new THREE.BoxGeometry(1, 1, 1);
        const dummy = new THREE.Object3D();

        for(const [hex, grpAssets] of Object.entries(colorGroups)) {
            let material = this.materialsCache[hex];
            if(!material) {
                material = new THREE.MeshStandardMaterial({ 
                    color: new THREE.Color(hex),
                    roughness: 0.2,
                    metalness: 0.1
                });
                this.materialsCache[hex] = material;
            }

            const iMesh = new THREE.InstancedMesh(defaultGeometry, material, grpAssets.length);
            iMesh.castShadow = true;
            iMesh.receiveShadow = true;

            for(let i = 0; i < grpAssets.length; i++) {
                const a = grpAssets[i];
                dummy.position.set(a.position.x, a.position.y, a.position.z);
                dummy.rotation.set(0, 0, 0); // reset
                if (a.rotation) {
                    dummy.rotation.set(
                        (a.rotation.x || 0) * Math.PI / 180,
                        (a.rotation.y || 0) * Math.PI / 180,
                        (a.rotation.z || 0) * Math.PI / 180
                    );
                }
                dummy.scale.set(a.scale.x, a.scale.y, a.scale.z);
                dummy.updateMatrix();
                iMesh.setMatrixAt(i, dummy.matrix);
            }
            
            iMesh.instanceMatrix.needsUpdate = true;
            this.towerGroup.add(iMesh);
        }
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspect = width / height;

        const d = 12;
        this.camera.left = -d * aspect;
        this.camera.right = d * aspect;
        this.camera.top = d;
        this.camera.bottom = -d;

        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
