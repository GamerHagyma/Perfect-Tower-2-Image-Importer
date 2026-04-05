import { MathUtils } from './utils.js';

/**
 * Handles encoding and decoding of Perfect Tower 2 blueprint strings.
 */
export const Blueprint = {
    decodeRaw: (base64String) => {
        try {
            const binaryString = atob(base64String);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const decompressed = window.pako.inflateRaw(bytes, { to: 'string' });
            const outerJSON = JSON.parse(decompressed);
            return JSON.parse(outerJSON.style[0]);
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    // Decoding Pipeline
    decode: (base64String) => {
        try {
            // 1. Base64 Decode
            const binaryString = atob(base64String);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // 2. Raw DEFLATE Decompression (no zlib headers)
            // -15 windowBits is standard for raw deflate in zlib/pako
            const decompressed = window.pako.inflateRaw(bytes, { to: 'string' });

            // 3. Parse Outer JSON
            const outerJSON = JSON.parse(decompressed);

            if (!outerJSON.style || !outerJSON.style[0]) {
                throw new Error("Invalid outer blueprint structure");
            }

            // 4. Parse Inner JSON
            const innerJSON = JSON.parse(outerJSON.style[0]);
            
            if (!innerJSON.assets || !Array.isArray(innerJSON.assets)) {
                throw new Error("Invalid inner blueprint structure");
            }

            return innerJSON.assets;
        } catch (e) {
            console.error("Blueprint Decode Error:", e);
            throw new Error("Failed to decode blueprint string.");
        }
    },

    // Encoding Pipeline
    encode: (assets) => {
        try {
            // Validate all assets before encoding
            const validAssets = assets.map(a => Blueprint.validateAsset(a));

            const rootObject = {
                assets: validAssets,
                material: { color: "#FFFFFF" },
                mesh: {
                    shape: "cube",
                    triangles: [0, 1, 2, 0, 2, 3, 8, 4, 7, 8, 7, 9, 17, 15, 6, 17, 6, 10, 12, 5, 14, 12, 14, 23, 18, 22, 13, 18, 13, 11, 19, 21, 16, 16, 21, 20],
                    vertices: [0, 0, -0.09999993, 0, 0, -0.1, 0, 0, 0.01, -0.01, 0, 0, 0, 0, 0.1, 0, 0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, -0.09999993, 0, 0, -0.1, 0, 0, 0.01, -0.01, 0, 0, 0, 0, 0.1, 0, 0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, -0.09999993, 0, 0, -0.1, 0, 0, 0.01, -0.01, 0, 0, 0, 0, 0.1, 0, 0.1, 0, 0, 0, 0, 0.1, 0, 0]
                },
                missileEndColor: "#FF0000",
                missileSpawnHeight: 4,
                missileStartColor: "#FBFF00"
            };

            // 1. Stringify Inner Object
            const innerString = JSON.stringify(rootObject);

            // 2. Wrap in Outer JSON and Stringify
            const outerString = JSON.stringify({ style: [innerString] });

            // 3. Raw DEFLATE compress
            const compressed = window.pako.deflateRaw(outerString);

            // 4. Base64 Encode
            // Convert Uint8Array to string, then btoa
            let binary = '';
            const len = compressed.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(compressed[i]);
            }
            
            return btoa(binary);

        } catch (e) {
            console.error("Blueprint Encode Error:", e);
            throw new Error("Failed to encode blueprint string.");
        }
    },

    // Apply engine constraints to an asset
    validateAsset: (asset) => {
        return {
            animations: asset.animations || [],
            color: asset.color || "#FFFFFF",
            mesh: asset.mesh || "cube",
            position: {
                x: MathUtils.clamp(asset.position.x, -4, 4),
                y: MathUtils.clamp(asset.position.y, -1, 10),
                z: MathUtils.clamp(asset.position.z, -4, 4)
            },
            rotation: {
                x: asset.rotation?.x || 0,
                y: asset.rotation?.y || 0,
                z: asset.rotation?.z || 0
            },
            scale: {
                x: MathUtils.clamp(asset.scale?.x || 1, 0.01, 8),
                y: MathUtils.clamp(asset.scale?.y || 1, 0.01, 8),
                z: MathUtils.clamp(asset.scale?.z || 1, 0.01, 8)
            }
        };
    }
};
