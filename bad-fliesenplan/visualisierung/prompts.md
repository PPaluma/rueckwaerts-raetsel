# Bad DG – Visualisierung: Prompts

**So gehst du vor:** Lade bei Gemini oder ChatGPT immer das passende Render-Bild als **Vorlage** hoch und gib dazu den Prompt ein. Die Renders haben die echten Maße aus dem Plan. Die KI soll nur das Aussehen fotorealistisch machen, nicht den Grundriss ändern.
Die Prompts sind auf Englisch, damit funktionieren die Bildmodelle am zuverlässigsten. Gemini und ChatGPT verstehen sie genauso.

---

## Gemeinsamer Material-Block
Der steckt schon in jedem Prompt unten. Hier steht er noch einmal einzeln, falls du einen eigenen Prompt schreiben willst:

> Materials: matte sand-coloured porcelain wall and floor tiles, 60 × 30 cm, laid horizontally (long side horizontal) in a running bond with a 30 cm offset, thin warm-beige grout (3 mm). Walls above the tiles and untiled walls: cloudy, softly mottled off-white lime plaster. Sanitary ceramics: glossy white. All fittings: polished silver / chrome. 10 mm clear frameless glass shower screen with slim chrome wall profile and chrome stabilising bar. Bright natural daylight, soft shadows, realistic interior photography, 24 mm lens, high detail, no people, no text.

---

## 1 · eingang.png – Blick von der Tür
> Use the attached image as the exact layout and camera reference. Do not move, add or remove any objects; keep all proportions. Turn it into a photorealistic interior photo of a modern attic bathroom seen from the doorway: a white freestanding oval bathtub in front of a wide white double window, a tiled ledge under the window with a wall-mounted chrome waterfall spout, a round chrome thermostat and a slim chrome stick hand shower; a chrome towel ladder on the right wall; a walk-in shower on the right behind a frameless glass panel; a white washbasin on the left under a large mirror with an LED light bar. Materials: matte sand-coloured porcelain tiles 60 × 30 cm, laid horizontally in a running bond with a 30 cm offset, thin warm-beige grout, tiled up to 2.35 m; above that, cloudy off-white lime plaster; glossy white ceramics; polished chrome fittings. Bright natural daylight through the window, soft shadows, realistic architectural photography, 24 mm lens.

## 2 · dusche.png – Walk-in-Dusche
> Use the attached image as the exact layout and camera reference; keep every object, position and proportion. Photorealistic view into a floor-level walk-in shower: frameless 10 mm clear glass panel (120 × 235 cm) with slim chrome wall profile and a chrome stabilising bar to the back wall; on the side wall a recessed tiled niche 30 × 60 cm with a tiled shelf in the middle, below it a round chrome concealed thermostat, above it a round chrome rain shower head on a wall arm; to the right of the niche a slim chrome stick hand shower in a wall holder; a stainless-steel linear wall drain along the side wall at floor level; a chrome towel ladder on the left wall. Matte sand-coloured porcelain tiles 60 × 30 cm, laid horizontally in a running bond with a 30 cm offset, thin warm-beige grout, on walls (up to 2.35 m) and floor; cloudy off-white lime plaster above; glossy white ceramics; polished chrome. Soft daylight, a few water drops on the glass, realistic interior photography.

## 3 · wanne.png – Freistehende Wanne vor dem Fenster
> Use the attached image as the exact layout and camera reference; keep all objects and proportions. Photorealistic view of a glossy white freestanding bathtub (slightly tapered oval) placed 10 cm in front of a tiled ledge under a wide white double window. On the front of the ledge: a wall-mounted flat chrome waterfall spout (about 15 × 20 cm) above the middle of the tub, a round chrome thermostat to its right, and a slim chrome stick hand shower in a wall holder to its left, all below the window sill. A chrome towel ladder on the right wall. Matte sand-coloured porcelain tiles 60 × 30 cm, horizontal running bond with a 30 cm offset, thin warm-beige grout, tiled up to 2.35 m including the window reveals; cloudy off-white lime plaster above; polished chrome; bright soft daylight through the window, calm spa atmosphere, realistic interior photography.

## 4 · waschbecken.png – Waschtisch-Wand
> Use the attached image as the exact layout and camera reference; keep all objects and proportions. Photorealistic view of a wall-hung rectangular white washbasin (90 cm) mounted in front of a tiled half-height ledge (1.17 m); a polished chrome wall-mounted basin tap; above the ledge a frameless rectangular mirror (80 × 70 cm) with a slim LED light bar on top and white sockets left and right of the mirror; on the left the wall ends with a clean edge, and the untiled part continues in cloudy off-white plaster with a narrow tiled skirting. Matte sand-coloured porcelain tiles 60 × 30 cm, horizontal running bond with a 30 cm offset, thin warm-beige grout; cloudy off-white lime plaster above 2.35 m; glossy white ceramics; polished chrome. Soft daylight, realistic interior photography.

## 5 · oben.png – Vogelperspektive (Puppenhaus-Schnitt)
> Use the attached image as the exact layout reference; keep all positions and proportions. Photorealistic 3D cutaway "dollhouse" view from above of a modern bathroom, with two walls removed so you can see inside: a freestanding white bathtub along the window wall, a walk-in shower with a frameless glass panel and a linear drain, a wall-hung white WC in a niche behind a partition wall, a white washbasin with mirror, and a door. Matte sand-coloured 60 × 30 cm porcelain tiles in a horizontal running bond with a 30 cm offset on floor and walls (up to 2.35 m), cloudy off-white lime plaster above and on the untiled walls, glossy white ceramics, polished chrome fittings. Soft even lighting, clean architectural visualisation style, white background.

---

## Tipps

- **Gemini / ChatGPT:** Bild hochladen, Prompt einfügen. Wenn die KI etwas verschiebt, zum Beispiel Wanne, Glas oder Nische, schreib dazu: *„Keep the layout exactly as in the reference image, only change materials and lighting.“*
- **Nur das Material ändern:** Lade das Ergebnis wieder hoch und schreib zum Beispiel: *„Make the tiles one shade lighter / the grout lighter / the fittings brushed instead of polished. Change nothing else.“*

## ComfyUI

Das Modell „MiniMax H3“ kenne ich nicht genau. Prüf deshalb zuerst, welche Eingänge sein Node in ComfyUI hat.

- **Bildmodell mit Bild-Eingang** (Bild-zu-Bild oder Referenzbild): Gib das Render als Eingangsbild an und nimm den Prompt von oben.
  - Wenn der Node eine Stärke hat (Denoise/Strength): mit **0,35–0,5** anfangen. Niedriger heißt, die Geometrie bleibt eher erhalten. Höher heißt, das Bild wird realistischer, aber die KI erfindet mehr dazu.
- **Videomodell** (Bild zu Video, bei MiniMax z. B. Hailuo): Nimm zuerst ein gutes Foto aus Gemini oder ChatGPT als Startbild und lass daraus eine langsame Kamerafahrt machen. Ein passender Prompt dafür: *„slow smooth camera dolly forward into the bathroom, static scene, no people, natural daylight“*.
- **Mit einem lokalen Modell** (SDXL oder Flux): Lass aus dem Render eine **Tiefen- oder Kantenkarte** erzeugen (ControlNet „Depth“ oder „Canny“), Stärke etwa 0,6–0,8. Dann bleibt die Geometrie sehr genau erhalten.
