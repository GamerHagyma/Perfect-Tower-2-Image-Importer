import { ColorUtils, Palettes } from './utils.js';

export const ImageProcessor = {
    // Main processing function
    processImage: async (imageElement, options = {}) => {
        const {
            targetResolution = 30, 
            depthScale = 0.1,
            colorPreset = 'original',
            colorCount = 32,
            mergeTolerance = 0,
            useDepthLayers = false
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
            if (colorPreset === 'original') {
                // No quantization
            } else if (colorPreset === 'custom') {
                pixels = ImageProcessor.medianCutQuantize(pixels, colorCount);
            } else {
                pixels = ImageProcessor.applyPalette(pixels, Palettes[colorPreset]);
            }

            const grid2D = ImageProcessor.to2DGrid(pixels, curResX, curResY);

            if (useDepthLayers) {
                bestAssets = ImageProcessor.processWithLayers(grid2D, curResX, curResY, depthScale, mergeTolerance);
            } else {
                const rects = ImageProcessor.greedyMerge(grid2D, mergeTolerance);
                bestAssets = ImageProcessor.rectsToAssets(rects, curResX, curResY, depthScale, 0);
            }

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

    // ============================
    // Proper Median Cut Quantization
    // ============================
    medianCutQuantize: (pixels, numColors) => {
        // Build list of opaque pixel colors
        const pixelColors = [];
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] < 128) continue;
            pixelColors.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
        }

        if (pixelColors.length === 0) return pixels;

        // Run median cut to get a palette
        const palette = ImageProcessor._medianCut(pixelColors, numColors);

        // Apply the palette back to the pixel buffer
        const result = new Uint8ClampedArray(pixels.length);
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] < 128) {
                result[i + 3] = 0;
                continue;
            }
            const nearest = ColorUtils.nearestColor([pixels[i], pixels[i + 1], pixels[i + 2]], palette);
            result[i] = nearest[0];
            result[i + 1] = nearest[1];
            result[i + 2] = nearest[2];
            result[i + 3] = 255;
        }
        return result;
    },

    _medianCut: (colors, targetCount) => {
        if (colors.length === 0) return [[0, 0, 0]];

        let buckets = [colors.slice()];

        while (buckets.length < targetCount) {
            // Find the bucket with the largest color range in any channel
            let maxRange = -1;
            let splitIdx = 0;
            let splitChannel = 0;

            for (let i = 0; i < buckets.length; i++) {
                if (buckets[i].length < 2) continue;
                for (let c = 0; c < 3; c++) {
                    let cMin = 255, cMax = 0;
                    for (const p of buckets[i]) {
                        if (p[c] < cMin) cMin = p[c];
                        if (p[c] > cMax) cMax = p[c];
                    }
                    const range = cMax - cMin;
                    if (range > maxRange) {
                        maxRange = range;
                        splitIdx = i;
                        splitChannel = c;
                    }
                }
            }

            if (maxRange <= 0) break; // All buckets are single-color

            const bucket = buckets[splitIdx];
            bucket.sort((a, b) => a[splitChannel] - b[splitChannel]);
            const mid = Math.floor(bucket.length / 2);

            buckets.splice(splitIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
        }

        // Average each bucket to produce the final palette
        return buckets.map(bucket => {
            if (bucket.length === 0) return [0, 0, 0];
            const sum = [0, 0, 0];
            for (const p of bucket) {
                sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2];
            }
            return [
                Math.round(sum[0] / bucket.length),
                Math.round(sum[1] / bucket.length),
                Math.round(sum[2] / bucket.length)
            ];
        });
    },

    // ============================
    // Depth Layering (Background Extraction)
    // ============================
    // Places a single large cube for the dominant color as a backdrop,
    // then stacks detail cubes on top. Saves blocks wherever the
    // background color appeared in scattered regions.
    processWithLayers: (grid, gridW, gridH, depthScale, tolerance) => {
        // Count color frequencies
        const colorFreq = {};
        let totalPixels = 0;
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                const c = grid[y][x];
                if (c !== null) {
                    colorFreq[c] = (colorFreq[c] || 0) + 1;
                    totalPixels++;
                }
            }
        }

        if (totalPixels === 0) return [];

        // Sort colors by frequency (most common first)
        const sortedColors = Object.entries(colorFreq).sort((a, b) => b[1] - a[1]);
        const bgColor = sortedColors[0][0];
        const bgRatio = sortedColors[0][1] / totalPixels;

        // Only use layers if background covers at least 10% of pixels
        if (bgRatio < 0.10) {
            const rects = ImageProcessor.greedyMerge(grid, tolerance);
            return ImageProcessor.rectsToAssets(rects, gridW, gridH, depthScale, 0);
        }

        const bgRgb = ColorUtils.hexToRgb(bgColor);

        // Layer 0: one full-canvas background rectangle
        const bgAssets = ImageProcessor.rectsToAssets(
            [{ x: 0, y: 0, width: gridW, height: gridH, color: bgColor }],
            gridW, gridH, depthScale, 0
        );

        // Build foreground grid: remove pixels that match background (with tolerance)
        const fgGrid = [];
        for (let y = 0; y < gridH; y++) {
            const row = [];
            for (let x = 0; x < gridW; x++) {
                const c = grid[y][x];
                if (c === null) {
                    row.push(null);
                } else if (c === bgColor) {
                    row.push(null); // handled by background layer
                } else if (tolerance > 0) {
                    const cRgb = ColorUtils.hexToRgb(c);
                    const dist = ColorUtils.colorDistance(cRgb, bgRgb);
                    row.push(dist <= tolerance ? null : c);
                } else {
                    row.push(c);
                }
            }
            fgGrid.push(row);
        }

        // Layer 1: merged foreground detail cubes
        const fgRects = ImageProcessor.greedyMerge(fgGrid, tolerance);
        const fgAssets = ImageProcessor.rectsToAssets(fgRects, gridW, gridH, depthScale, depthScale);

        return [...bgAssets, ...fgAssets];
    },

    // ============================
    // Core helpers
    // ============================
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
            if (pixels[i + 3] === 0) {
                newPixels[i + 3] = 0;
                continue;
            }
            const nearest = ColorUtils.nearestColor([pixels[i], pixels[i + 1], pixels[i + 2]], palette);
            newPixels[i] = nearest[0];
            newPixels[i + 1] = nearest[1];
            newPixels[i + 2] = nearest[2];
            newPixels[i + 3] = 255;
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
                    row.push(null);
                } else {
                    row.push(ColorUtils.rgbToHex(pixels[idx], pixels[idx + 1], pixels[idx + 2]));
                }
            }
            grid.push(row);
        }
        return grid;
    },

    // ============================
    // Greedy Rectangle Merging with Tolerance
    // ============================
    greedyMerge: (grid, tolerance = 0) => {
        const height = grid.length;
        if (height === 0) return [];
        const width = grid[0].length;
        const visited = Array(height).fill(null).map(() => Array(width).fill(false));
        const rectangles = [];

        // Pre-compute RGB lookup for tolerance comparisons
        let rgbCache = null;
        if (tolerance > 0) {
            rgbCache = {};
        }
        function getRgb(hex) {
            if (!rgbCache) return ColorUtils.hexToRgb(hex);
            if (!rgbCache[hex]) rgbCache[hex] = ColorUtils.hexToRgb(hex);
            return rgbCache[hex];
        }
        function colorsMatch(c1, c2) {
            if (c1 === c2) return true;
            if (tolerance === 0) return false;
            return ColorUtils.colorDistance(getRgb(c1), getRgb(c2)) <= tolerance;
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (visited[y][x] || grid[y][x] === null) continue;

                const seedColor = grid[y][x];
                let curW = 1;

                // Expand Right
                while (x + curW < width && !visited[y][x + curW] && grid[y][x + curW] !== null && colorsMatch(grid[y][x + curW], seedColor)) {
                    curW++;
                }

                // Expand Down
                let curH = 1;
                let canExpandDown = true;
                while (y + curH < height && canExpandDown) {
                    for (let wx = 0; wx < curW; wx++) {
                        const cell = grid[y + curH][x + wx];
                        if (visited[y + curH][x + wx] || cell === null || !colorsMatch(cell, seedColor)) {
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

                rectangles.push({ x, y, width: curW, height: curH, color: seedColor });
            }
        }

        return rectangles;
    },

    // ============================
    // Convert merged rectangles to PT2 game assets
    // ============================
    rectsToAssets: (rects, gridW, gridH, depthScale, zOffset) => {
        const maxGameW = 8;
        const maxGameH = 11;

        const scaleX = maxGameW / gridW;
        const scaleY = maxGameH / gridH;
        const finalScale = Math.min(scaleX, scaleY);

        const totalGameW = gridW * finalScale;
        const offsetX = -(totalGameW / 2);
        const offsetY = -1; // y starts at -1

        return rects.map(rect => {
            const gameWidth = rect.width * finalScale;
            const gameHeight = rect.height * finalScale;

            const gameCx = offsetX + ((rect.x + (rect.width / 2)) * finalScale);
            const invertedY = gridH - (rect.y + (rect.height / 2));
            const gameCy = offsetY + (invertedY * finalScale);

            return {
                mesh: "cube",
                rotation: { x: 0, y: 0, z: 0 },
                animations: [],
                position: { x: gameCx, y: gameCy, z: zOffset },
                scale: { x: gameWidth, y: gameHeight, z: depthScale },
                color: rect.color
            };
        });
    }
};
