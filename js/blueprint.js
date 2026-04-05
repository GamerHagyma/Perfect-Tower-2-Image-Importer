import { MathUtils } from './utils.js';

/**
 * Handles encoding and decoding of Perfect Tower 2 blueprint strings.
 */
export const Blueprint = {
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

            const rootObject = { assets: validAssets };

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
            position: {
                x: MathUtils.clamp(asset.position.x, -4, 4),
                y: MathUtils.clamp(asset.position.y, -1, 10),
                z: MathUtils.clamp(asset.position.z, -4, 4)
            },
            size: {
                x: MathUtils.clamp(asset.size.x, 0.01, 8),
                y: MathUtils.clamp(asset.size.y, 0.01, 8),
                z: MathUtils.clamp(asset.size.z, 0.01, 8)
            },
            color: asset.color,
            animations: asset.animations || []
        };
    }
};
