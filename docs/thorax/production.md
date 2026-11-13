# Thorax production recipe

The original Thorax dock was the identity reference: ivory ribs, brown wet
sinew, grey translucent sacs, warm amber capillaries. Every new asset was derived
from the same whole-player concept, rather than independently invented.

## Generation passes

All artwork was created with the built-in image generation tool. Transparent
assets retain the generated alpha. The preparation script only normalizes atlas
cell bounds, encodes WebP and assembles GIF studies; it does not paint anatomy.

1. **Whole-player target.** Evolve the original Thorax dock into a complete
   frontal orthographic player: interwoven ivory rib perimeter, empty dark
   aperture, paired sternum valve on the left, long continuous tendon groove
   and amber larva in the middle, three translucent bellows on the right.
   All regions grow from one shared wet fibrous hammock. No conventional UI
   borders, repeated cutout seams, text, or numbers.
2. **Clean common body.** Edit that exact concept. Remove only the three
   functional foreground organs and progress light. Fill vacated regions with
   continuous living tendon membrane. Keep skeletal crown, rib perimeter,
   material, lighting and view. Make aperture and outer background transparent.
3. **Sternum transformation.** Fifteen equal registered cells, five columns
   by three rows. Preserve the paired sacs, collar, veins and creases. Begin
   inflated with two amber pause slits. Contract inward into pleats, gradually
   resolving the light into a recessed right-facing play triangle. Keep outer
   attachments pinned. Transparent background, no labels or unrelated anatomy.
4. **Bellows transformation.** Fifteen equal registered cells, five by three.
   Exactly three connected horizontal sacs, same camera and landmarks. Begin
   collapsed with an extended bone tendril; progressively inflate left to right
   as the piston retracts. Finish with taut translucent grey-amber sacs. Keep
   veins and wrinkles consistent. Transparent background, no symbols or legs.
5. **Larva loop.** Nine equal registered cells, three by three. Same small
   ivory armored amber larva, facing right and walking in place. One peristaltic
   squirm cycle with sliding plates, alternating legs and swaying antennae.
   First and last phases nearly coincide. No rails, camera drift or translation.
6. **Continuous channel.** One panoramic tendon painting: smooth upper and
   lower sinew lips with a narrow dark cleft, fine veins, ivory edge struts and
   tiny amber capillaries. Tapered ends, no sockets, larva, progress line, text,
   or repeated vertebrae. Transparent outside the silhouette.
7. **Compact body refinement.** Recompose the clean body into a taller chest,
   with a transparent aperture above and a broad membrane hammock below for
   a rail over the valve/bellows row. Rebuild naturally curved short rib braces
   instead of vertically stretching the wide skeleton. Preserve identity,
   crown, surface material and illumination. Keep all foreground organs absent.

## Iterations after browser review

- Enlarged the larva and increased local channel opening for legible contact.
- Corrected frame blending so intermediate sprites retain opacity.
- Removed an artificial dark rail underlay whose rounded end looked like a tube.
- Replaced overstretched wide body artwork with the dedicated compact body.
- Reduced procedural connector strokes to fine translucent capillaries.
- Kept the body and controls on one scene so resize, shadows and light agree.
- Added an artwork loading fallback and lazy loading for unselected Thorax.

## Assets and studies

- `../../dist/tissue/thorax-body-v2.webp`: common wide skeleton and membrane.
- `../../dist/tissue/thorax-compact-v2.webp`: compact anatomy.
- `../../dist/tissue/thorax-valve-v2.webp`: 15-pose play/pause atlas.
- `../../dist/tissue/thorax-bellows-v2.webp`: 15-pose volume atlas.
- `../../dist/tissue/thorax-larva-v2.webp`: nine-pose squirm loop.
- `../../dist/tissue/thorax-channel-v2.webp`: continuous channel painting.
- [Whole-player target](concept.webp)
- [Valve study](valve-study.gif)
- [Bellows study](bellows-study.gif)
- [Larva study](larva-study.gif)

The GIFs show the authored sprite studies. They are not recordings of the final
renderer, which also supplies shared breathing, spatial deformation and light.

## Approved iris integration

The original 15-pose sternum study has been superseded in the live player by
the approved 30-pose alien iris animation. The atlas is
`../../dist/tissue/thorax-iris-v3.webp` (6 columns, 5 rows). Playing closes the
membrane petals; pausing opens them to reveal the amber triangular tissue film.
The state animation uses constant-speed reversible travel rather than restarting
on each activation. Reduced-motion mode selects the endpoint immediately.

The atlas uses the approved stabilized animation frames, encoded as WebP.
Its background is matted once by the renderer, with the interior cavity excluded
from the matte so the depth shadow survives. The shared Thorax scene then adds
ambient breathing, contact shadows and amber light.

Browser review confirmed the open/closed endpoints, mouse and keyboard activation,
rapid state changes, and narrow/extended layouts. The browser used Canvas; the
existing WebGL enhancement still needs device verification.

## Continuous worm revision

The old larva scrubber has been superseded by a continuous extracted worm and
a stationary skeletal cage. See [worm production notes](worm/production.md)
for the generated assets, material mapping, spring mechanics and browser QA.
