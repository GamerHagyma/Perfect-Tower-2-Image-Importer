import { Blueprint } from './blueprint.js';
import { ImageProcessor } from './imageProcessor.js';
import { Preview3D } from './preview3d.js';

class App {
    constructor() {
        this.baseAssets = [];
        this.assets = [];
        this.currentImageInfo = null;
        this.transformState = { rotation: 90, flipH: false, flipV: false };

        this.initUI();
        // Delay 3D init slightly to ensure container is rendered and has size
        setTimeout(() => {
            this.preview = new Preview3D('canvas-container');
        }, 100);
    }

    initUI() {
        // DOM Elements
        this.dropZone = document.getElementById('drop-zone');
        this.fileInput = document.getElementById('image-upload');
        this.previewCanvas = document.getElementById('image-preview-canvas');
        
        // Settings
        this.presetSelect = document.getElementById('color-preset');
        this.colorCountSetting = document.getElementById('color-count-setting');
        this.colorCountInput = document.getElementById('color-count');
        this.colorCountVal = document.getElementById('color-count-val');
        
        this.targetResInput = document.getElementById('target-resolution');
        this.targetResVal = document.getElementById('target-res-val');
        
        this.depthScaleInput = document.getElementById('depth-scale');
        this.depthScaleVal = document.getElementById('depth-scale-val');

        this.mergeToleranceInput = document.getElementById('merge-tolerance');
        this.mergeToleranceVal = document.getElementById('merge-tolerance-val');

        this.depthLayersCheckbox = document.getElementById('depth-layers');
        
        this.reprocessBtn = document.getElementById('reprocess-btn');

        // Rotations & Transforms
        this.fineRotationInput = document.getElementById('fine-rotation');
        this.fineRotationVal = document.getElementById('fine-rotation-val');

        this.rotCcwBtn = document.getElementById('rot-ccw-btn');
        this.rotCwBtn = document.getElementById('rot-cw-btn');
        this.flipHBtn = document.getElementById('flip-h-btn');
        this.flipVBtn = document.getElementById('flip-v-btn');
        this.actionButtons = document.querySelectorAll('.disable-empty');

        // View controls
        this.resetCamBtn = document.getElementById('reset-camera-btn');
        this.toggleGridBtn = document.getElementById('toggle-grid-btn');

        // Export/Import
        this.exportArea = document.getElementById('export-code');
        this.copyBtn = document.getElementById('copy-btn');
        this.importArea = document.getElementById('import-code');
        this.importBtn = document.getElementById('import-btn');
        this.importError = document.getElementById('import-error');
        this.rawJsonArea = document.getElementById('raw-json-code');

        // Stats
        this.cubeCountSpan = document.getElementById('cube-count');
        this.cubeDimsSpan = document.getElementById('cube-dims');

        this.loadingOverlay = document.getElementById('loading-overlay');

        this.bindEvents();
    }

    bindEvents() {
        // Drag & Drop
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });
        this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('dragover'));
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Settings change
        this.presetSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                this.colorCountSetting.style.display = 'flex';
            } else {
                this.colorCountSetting.style.display = 'none';
            }
        });
        
        // Run once manually on init to set default UI state
        if (this.presetSelect.value !== 'custom') {
            this.colorCountSetting.style.display = 'none';
        }

        this.colorCountInput.addEventListener('input', (e) => {
            this.colorCountVal.textContent = e.target.value;
        });
        
        this.targetResInput.addEventListener('input', (e) => {
            this.targetResVal.textContent = e.target.value;
        });

        this.depthScaleInput.addEventListener('input', (e) => {
            this.depthScaleVal.textContent = e.target.value;
        });

        this.mergeToleranceInput.addEventListener('input', (e) => {
            this.mergeToleranceVal.textContent = e.target.value;
        });

        this.reprocessBtn.addEventListener('click', () => {
             if (this.currentImageInfo) {
                 this.processLoadedImage(this.currentImageInfo);
             }
        });

        // Transforms
        this.fineRotationInput.addEventListener('input', (e) => {
            this.fineRotationVal.textContent = e.target.value + '°';
            this.transformState.rotation = parseInt(e.target.value);
            this.applyTransforms();
        });

        this.rotCwBtn.addEventListener('click', () => this.transformBlueprint('rotcw'));
        this.rotCcwBtn.addEventListener('click', () => this.transformBlueprint('rotccw'));
        this.flipHBtn.addEventListener('click', () => this.transformBlueprint('fliph'));
        this.flipVBtn.addEventListener('click', () => this.transformBlueprint('flipv'));

        // View Toggles
        this.resetCamBtn.addEventListener('click', () => {
            if(this.preview) this.preview.setCameraIsometric();
        });
        
        this.toggleGridBtn.addEventListener('click', () => {
            if(this.preview) {
                const isActive = this.preview.toggleGrid();
                this.toggleGridBtn.classList.toggle('active', isActive);
            }
        });

        // Copy Export
        this.copyBtn.addEventListener('click', () => {
            if (this.exportArea.value) {
                navigator.clipboard.writeText(this.exportArea.value).then(() => {
                    const origCtx = this.copyBtn.textContent;
                    this.copyBtn.textContent = "Copied!";
                    setTimeout(() => this.copyBtn.textContent = origCtx, 2000);
                });
            }
        });

        // Import Blueprint
        this.importBtn.addEventListener('click', () => {
            const code = this.importArea.value.trim();
            if (!code) return;
            
            try {
                this.importError.classList.add('hidden');
                let newAssets = Blueprint.decode(code);
                
                // Clear active image
                this.currentImageInfo = null;
                this.previewCanvas.style.display = 'none';
                this.dropZone.querySelector('.drop-text').style.display = 'block';
                this.reprocessBtn.disabled = true;

                // Decode raw for the display section
                const rawObj = Blueprint.decodeRaw(code);
                if (rawObj) {
                    this.rawJsonArea.value = JSON.stringify(rawObj, null, 2);
                } else {
                    this.rawJsonArea.value = "Failed to parse raw JSON";
                }

                // Setup imported state
                this.transformState = { rotation: 0, flipH: false, flipV: false };
                this.updateUIForState();
                
                this.updateAssets(newAssets, newAssets, "Imported");
            } catch (e) {
                console.error(e);
                this.importError.classList.remove('hidden');
            }
        });
    }

    handleFileUpload(file) {
        if (!file.type.match('image.*')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImageInfo = img;
                
                // Show thumbnail
                const ctx = this.previewCanvas.getContext('2d');
                let tWidth = img.width;
                let tHeight = img.height;
                // keep under 150px height
                if(tHeight > 150) {
                    tWidth = Math.floor(tWidth * (150 / tHeight));
                    tHeight = 150;
                }
                this.previewCanvas.width = tWidth;
                this.previewCanvas.height = tHeight;
                ctx.drawImage(img, 0, 0, tWidth, tHeight);
                
                this.previewCanvas.style.display = 'block';
                this.dropZone.querySelector('.drop-text').style.display = 'none';
                this.reprocessBtn.disabled = false;

                this.processLoadedImage(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async processLoadedImage(img) {
        this.setLoading(true);
        // Small delay to allow overlay to render
        await new Promise(r => setTimeout(r, 50)); 
        
        try {
            const options = {
                targetResolution: parseInt(this.targetResInput.value),
                depthScale: parseFloat(this.depthScaleInput.value),
                colorPreset: this.presetSelect.value,
                colorCount: parseInt(this.colorCountInput.value),
                mergeTolerance: parseInt(this.mergeToleranceInput.value),
                useDepthLayers: this.depthLayersCheckbox.checked
            };

            const result = await ImageProcessor.processImage(img, options);
            // Default generated images to 90deg CW to fix game's default CCW import expectation
            this.transformState = { rotation: 90, flipH: false, flipV: false };
            this.updateUIForState();
            
            this.updateAssets(result.assets, result.assets, `${result.targetX}x${result.targetY}`);
            
        } catch(e) {
            console.error("Processing error:", e);
        } finally {
            this.setLoading(false);
        }
    }

    updateUIForState() {
        this.fineRotationInput.value = this.transformState.rotation;
        this.fineRotationVal.textContent = this.transformState.rotation + '°';
    }

    transformBlueprint(action) {
        if(!this.baseAssets || this.baseAssets.length === 0) return;

        if (action === 'rotcw') {
            this.transformState.rotation = (this.transformState.rotation + 90) % 360;
            // keep it in -180 to 180 logic if slider requires
            if (this.transformState.rotation > 180) this.transformState.rotation -= 360;
        } else if (action === 'rotccw') {
            this.transformState.rotation = (this.transformState.rotation - 90) % 360;
            if (this.transformState.rotation < -180) this.transformState.rotation += 360;
        } else if (action === 'fliph') {
            this.transformState.flipH = !this.transformState.flipH;
        } else if (action === 'flipv') {
            this.transformState.flipV = !this.transformState.flipV;
        }

        this.updateUIForState();
        this.applyTransforms();
    }

    applyTransforms() {
        if (!this.baseAssets || this.baseAssets.length === 0) return;

        // Convert degrees to radians for JS Math
        const rad = this.transformState.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const newData = this.baseAssets.map(a => {
            let nx = a.position.x;
            let nz = a.position.z;

            // Apply Flips first
            if (this.transformState.flipH) nx = -nx;
            if (this.transformState.flipV) nz = -nz;

            // Apply Rotation around Y axis
            const rx = nx * cos - nz * sin;
            const rz = nx * sin + nz * cos;

            // Compute new Y Rotation for individual cube
            const baseYRot = a.rotation?.y || 0;
            let finalYRot = baseYRot - this.transformState.rotation;

            return {
                ...a,
                position: { ...a.position, x: rx, z: rz },
                rotation: { ...a.rotation, y: finalYRot }
            };
        });

        this.updateAssets(newData, this.baseAssets, null);
    }

    updateAssets(newAssets, baseAssetsRef, dimsStr = null) {
        if (baseAssetsRef) {
            this.baseAssets = baseAssetsRef;
        }
        this.assets = newAssets;

        // Update UI counters
        this.cubeCountSpan.textContent = this.assets.length;
        if (this.assets.length > 500) {
            this.cubeCountSpan.parentElement.classList.add('danger');
        } else {
            this.cubeCountSpan.parentElement.classList.remove('danger');
        }

        if (dimsStr !== null) {
            this.cubeDimsSpan.textContent = dimsStr;
        }

        // Enable actions
        this.actionButtons.forEach(btn => btn.disabled = (this.assets.length === 0));

        // Update 3D Preview
        if(this.preview) this.preview.renderBlueprint(this.assets);

        // Generate Export string (asynchronously to avoid UI lock if many cubes)
        setTimeout(() => {
            try {
                this.exportArea.value = Blueprint.encode(this.assets);
            } catch(e) {
                this.exportArea.value = "Error encoding blueprint.";
            }
        }, 10);
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.loadingOverlay.classList.remove('hidden');
            this.reprocessBtn.disabled = true;
        } else {
            this.loadingOverlay.classList.add('hidden');
            this.reprocessBtn.disabled = false;
        }
    }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
