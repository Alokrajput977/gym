# Gymnastics Academy – Warehouse 3D (React + Three.js)

## Chalane ka tarika
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build -> dist/
```

## Kya bana hai
- Sirf warehouse building – drawing ke exact trapezoid shape mein
  - Back side 60', Front side 76', Left side 101'-6" (seedhi), Right side 106'-11.8" (tirchhi)
- 6 + 6 steel pillars: A01..A06 (left) aur B01..B06 (right), drawing ke spacing par
  (20' clear gap = 21' centre-to-centre; right side 20'-2.7" gap)
- Har A/B pillar jodi ke upar arch rib, curved metal roof + ridge skylight
- 3 floor height (10.8 m), facade bands: brick, navy cladding, glass ribbon
- Front side: glass entrance, canopy, "GYMNASTICS ACADEMY" banner aur letters
- Right side: bahar se steel stairs -> first floor ka darwaza (B03 aur B04 ke beech)
- Back side: 2 loading shutters
- Andar abhi KHAALI (redesign ke liye) – "Enter building" button ya building par click karke andar
- Gymnastics arena loader, day/night, pillar labels (A01..B06) on/off

## Lightweight
- Kuch na hile to render nahi hota (GPU aaram), shadows cache hoti hain
- Sky ek baar bake hota hai, static meshes merge hote hain (kam draw calls)
- Lights sirf zaroorat par (andar 2, raat ko 2)

## Folder
```
src/
  App.jsx, App.css, index.css
  components/   Scene3D, Header, ControlPanel, SpecsCard, ActionBar, Loader (har ek ki .css)
  three/
    plan.js           << DRAWING KE SAARE NAAP YAHAN (corners, pillars, stairs, heights)
    buildWarehouse.js  sab jodta hai
    builders/          shell (walls, entrance, banner), structure (pillars, roof),
                       stairs (bahar ki seedhiyan), site (zameen, plinth)
    environment.js, materials.js, textures.js, helpers.js, cameraViews.js
```
