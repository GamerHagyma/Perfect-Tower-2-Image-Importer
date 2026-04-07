# Perfect Tower 2 Image Importer
[**Click me to try it now**](https://gamerhagyma.github.io/Perfect-Tower-2-Image-Importer/)

A fast, client-side, browser-based editor that converts uploaded images directly into valid, importable tower blueprint strings for the game **The Perfect Tower II**.

## Features

- **Image to Blueprint:** Upload an image and immediately get a Base64 blueprint string ready to paste right into the game.
- **3D Isometric Preview:** Real-time WebGL (Three.js) preview simulating the exact in-game 45° isometric camera angle, giving you a 1:1 look at your creation.
- **Block Budget Management (The 500 Cube Limit):** Uses an advanced, completely automated greedy rectangle-merging algorithm to compress the drawing so that the number of final object cubes remains underneath the game's strict 500 constraint limit.
- **Block Optimizations:**
  - **Color Quantization:** True median-cut algorithm reduces image color palettes automatically, dramatically combining similar blocks. Includes manual Gameboy (4 color) and NES (54 color) presets!
  - **Merge Tolerance:** A slider that actively smooths out JPEGs and gradients; letting similar-but-not-identical colors unite into the same block to quickly save budget.
  - **Depth Layering:** Detects and extracts the image's background, turning it into a single base block and stacking the details flawlessly on top! Reduces block counts by 30-60%.
- **Blueprint Transformer:** Slider controls for pinpoint Y-axis model rotation directly in WebGL, alongside absolute 90° CW/CCW rotations or horizontal/vertical flips.
- **Raw JSON Decoder Panel:** Import and paste an existing game blueprint strictly to decompress and read its internal object/structure.
- **Fully Client-Side:** Processes files right inside your browser immediately without making any outside server requests.

## Setup

No setup or build tools are required!
Simply drop the files onto any web server, or locally host the folder instance:

```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000/`.
