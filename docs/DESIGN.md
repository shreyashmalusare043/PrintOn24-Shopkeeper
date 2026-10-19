# Theme Name: Industrial HUD

# Vibe & Description:
Obsidian-black base, neon-orange laser lines, monospaced type, and dashboard ticks simulate the tension and mechanical feel of an industrial-grade rendering console.

# Color

- Strictly limit the palette to pure black, dark gray, light gray, and neon orange.
- Use obsidian black (#020202) for the background, deep black-gray (#0A0A0A) for panels, light gray (#E0E0E0) for text, and medium gray (#888888) for secondary information. Use neon orange (#FF4500) only as the accent color for key values, progress, laser lines, and interaction feedback, creating the visual sense of “the only life signal in a dark instrument.”

# Font

- Use “ZCOOLKuHei” as the title font. (https://resource-static.bj.bcebos.com/fonts-skill/ZCOOLKuHei_Regular.ttf)
- Use “AlibabaPuHuiTi” as the body font. (https://resource-static.bj.bcebos.com/fonts-skill/AlibabaPuHuiTi_Regular.ttf)

# Animation

- On touch, elements should not use soft elastic feedback, but produce a brief, precise mechanical response: the border turns neon orange, shifts slightly upward, and compresses slightly when pressed.
- When data appears, use animations such as progress-bar filling, log scrolling, and laser breathing. Keep them calm and restrained, reinforcing only state changes without decorative motion.

# Layout

- Use a high-density, whitespace-free console-style layout, with sections tightly connected and borders directly dividing information areas.
- Use a top status bar, core visual area, task list, node logs, and cluster cards to form a clear hierarchy. On mobile, keep a vertical stacked structure to ensure information remains compact yet readable.

# Elements

- Cards, tables, and log panels all use sharp-corner borders. Rounded corners and shadows are prohibited. Borders are uniformly #333333.
- Progress bars, key values, and active states uniformly use #FF4500; avoid any other highly saturated colors.
- The background may overlay subtle grain noise to simulate the texture of an industrial screen and film.
- The visual focus may use CSS to draw an obsidian sphere and orange laser lines, strengthening the void-rendering feel and premium VFX console character.