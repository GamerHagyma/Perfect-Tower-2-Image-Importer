import { ColorUtils, Palettes } from './utils.js';

export const ImageProcessor = {
    // Main processing function
    processImage: async (imageElement, options = {}) => {
        const {
            targetResolution = 30, 
            depthScale = 0.1,
            colorPreset = 'custom', // 'custom', 'gb', 'nes'
            colorCount = 32
        } = options;

        let bestAssets = [];
        let curResX = targetResolution;
        let curResY = targetResolution;

        // Preserve aspect ratio
        const aspect = imageElement.width / imageElement.height;
        if (aspect > 1) {
            curResY = Math.round(curResX / aspect);
        } else {
            curResX = Math.round(curResY * aspect);
        }

        let isTargetFound = false;

        // Loop to find a resolution that fits in 500 cubes
        while (!isTargetFound && curResX >= 5 && curResY >= 5) {
            const canvasData = ImageProcessor.getCanvasData(imageElement, curResX, curResY);
            
            let pixels = canvasData.pixels;
            if (colorPreset !== 'custom') {
                pixels = ImageProcessor.applyPalette(pixels, Palettes[colorPreset]);
            } else {
                 // Basic Color Quantization using a simplified approach
                 // Reduce bits of precision based on requested count (crude but fast)
                 const bits = Math.max(1, Math.floor(Math.log2(colorCount) / 3));
                 const mask = 256 - (1 << (8 - bits));
                 for(let i=0; i<pixels.length; i+=4) {
                     pixels[i] = pixels[i] & mask;
                     pixels[i+1] = pixels[i+1] & mask;
                     pixels[i+2] = pixels[i+2] & mask;
                 }
            }

            const grid2D = ImageProcessor.to2DGrid(pixels, curResX, curResY);
            bestAssets = ImageProcessor.greedyMerge(grid2D, depthScale);

            if (bestAssets.length <= 500) {
                isTargetFound = true;
            } else {
                // Reduce resolution and try again
                curResX = Math.max(5, Math.floor(curResX * 0.9));
                curResY = Math.max(5, Math.floor(curResY * 0.9));
            }
        }

        return { assets: bestAssets, targetX: curResX, targetY: curResY };
    },

    getCanvasData: (img, width, height) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        return {
            ctx,
            pixels: ctx.getImageData(0, 0, width, height).data
        };
    },

    applyPalette: (pixels, palette) => {
        const newPixels = new Uint8ClampedArray(pixels.length);
        for (let i = 0; i < pixels.length; i += 4) {
            // Ignore fully transparent
            if (pixels[i + 3] === 0) {
                newPixels[i+3] = 0;
                continue;
            }
            
            const r = pixels[i];
            const g = pixels[i+1];
            const b = pixels[i+2];
            
            const nearest = ColorUtils.nearestColor([r, g, b], palette);
            
            newPixels[i] = nearest[0];
            newPixels[i+1] = nearest[1];
            newPixels[i+2] = nearest[2];
            newPixels[i+3] = 255;
        }
        return newPixels;
    },

    to2DGrid: (pixels, width, height) => {
        const grid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const a = pixels[idx + 3];
                if (a < 128) {
                    row.push(null); // Transparent
                } else {
                    const r = pixels[idx];
                    const g = pixels[idx+1];
                    const b = pixels[idx+2];
                    row.push(ColorUtils.rgbToHex(r, g, b));
                }
            }
            grid.push(row);
        }
        return grid;
    },

    // Merges adjacent same-colored pixels into rectangles
    greedyMerge: (grid, depthScale) => {
        const height = grid.length;
        const width = grid[0].length;
        const visited = Array(height).fill(null).map(() => Array(width).fill(false));
        const rectangles = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (visited[y][x] || grid[y][x] === null) continue;

                const color = grid[y][x];
                let curW = 1;

                // Expand Right
                while (x + curW < width && !visited[y][x + curW] && grid[y][x + curW] === color) {
                    curW++;
                }

                // Expand Down
                let curH = 1;
                let canExpandDown = true;
                while (y + curH < height && canExpandDown) {
                    for (let wx = 0; wx < curW; wx++) {
                        if (visited[y + curH][x + wx] || grid[y + curH][x + wx] !== color) {
                            canExpandDown = false;
                            break;
                        }
                    }
                    if (canExpandDown) {
                        curH++;
                    }
                }

                // Mark visited
                for (let hy = 0; hy < curH; hy++) {
                    for (let wx = 0; wx < curW; wx++) {
                        visited[y + hy][x + wx] = true;
                    }
                }

                rectangles.push({ x, y, width: curW, height: curH, color });
            }
        }

        // Convert Rectangles to PT2 Assets
        // Workspace constraints:
        // x: -4 to 4 (width = 8)
        // y: -1 to 10 (height = 11)
        // z: -4 to 4 (depth = 8)

        // Find max bounds of our pixel grid to normalize it
        const maxPixelsW = width;
        const maxPixelsH = height;

        // Choose which axis uses up the max scaling
        // Game has 8 unit width (x), 11 unit height (y)
        const maxGameW = 8;
        const maxGameH = 11;

        // Scale factors to convert pixel to game units
        const scaleX = maxGameW / maxPixelsW;
        const scaleY = maxGameH / maxPixelsH;
        
        // Use the smaller scale to maintain aspect ratio
        const finalScale = Math.min(scaleX, scaleY);
        
        // Calculate offsets to center the model on X and bottom-align on Y
        const totalGameW = maxPixelsW * finalScale;
        const totalGameH = maxPixelsH * finalScale;
        
        const offsetX = -(totalGameW / 2);
        const offsetY = -1; // starts at y = -1

        return rectangles.map(rect => {
            // Assets are positioned by their centers
            const gameWidth = rect.width * finalScale;
            const gameHeight = rect.height * finalScale;
            
            const gameCx = offsetX + ((rect.x + (rect.width / 2)) * finalScale);
            // Y is inverted (top of image is top of tower)
            const invertedY = maxPixelsH - (rect.y + (rect.height / 2));
            const gameCy = offsetY + (invertedY * finalScale);

            return {
                position: { x: gameCx, y: gameCy, z: 0 },
                size: { x: gameWidth, y: gameHeight, z: depthScale },
                color: rect.color
            };
        });
    }
};
