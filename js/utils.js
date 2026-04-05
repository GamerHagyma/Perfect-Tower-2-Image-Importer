/**
 * Utility functions for color manipulation and math.
 */

export const MathUtils = {
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    
    // Check if bounds are within the PT2 engine limits
    isValidPosition: (x, y, z) => {
        return x >= -4 && x <= 4 &&
               y >= -1 && y <= 10 &&
               z >= -4 && z <= 4;
    },

    isValidSize: (sx, sy, sz) => {
        return sx >= 0.01 && sx <= 8 &&
               sy >= 0.01 && sy <= 8 &&
               sz >= 0.01 && sz <= 8;
    }
};

export const ColorUtils = {
    // Convert hex string to [r, g, b] 0-255
    hexToRgb: (hex) => {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const num = parseInt(hex, 16);
        return [num >> 16, (num >> 8) & 255, num & 255];
    },

    // Convert [r, g, b] 0-255 to hex string
    rgbToHex: (r, g, b) => {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
    },

    // Euclidean distance between two colors
    colorDistance: (c1, c2) => {
        const dr = c1[0] - c2[0];
        const dg = c1[1] - c2[1];
        const db = c1[2] - c2[2];
        return Math.sqrt(dr * dr + dg * dg + db * db);
    },

    // Find the closest color in a preset palette
    nearestColor: (rgb, palette) => {
        let minDist = Infinity;
        let bestMatch = palette[0];
        for (const pColor of palette) {
            const d = ColorUtils.colorDistance(rgb, pColor);
            if (d < minDist) {
                minDist = d;
                bestMatch = pColor;
            }
        }
        return bestMatch;
    }
};

export const Palettes = {
    gb: [
        [15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15] // Classic Gameboy Green
    ],
    nes: [
        [124,124,124],[0,0,252],[0,0,188],[68,40,188],[148,0,132],[168,0,32],[168,16,0],[136,20,0],[80,48,0],[0,120,0],[0,104,0],[0,88,0],[0,64,88],[0,0,0],
        [188,188,188],[0,120,248],[0,88,248],[104,68,252],[216,0,204],[228,0,88],[248,56,0],[228,92,16],[172,124,0],[0,184,0],[0,168,0],[0,168,68],[0,136,136],
        [248,248,248],[60,188,252],[104,136,252],[152,120,248],[248,120,248],[248,88,152],[248,120,88],[252,160,68],[248,184,0],[184,248,24],[88,216,84],[88,248,152],[0,232,216],[120,120,120],
        [252,252,252],[164,228,252],[184,184,248],[216,184,248],[248,184,248],[248,164,192],[240,208,176],[252,224,168],[248,216,120],[216,248,120],[184,248,184],[184,248,216],[0,252,252],[0,0,0]
    ]
};
