# Sea Breeze Town companions

Three original companion sculptures: harbor cat, sunny dog, and garden rabbit.
The continuous elliptical lofts, sculpted face geometry, separate markings,
articulated bone-node hierarchy and eleven animation clips are authored in
`src/features/pet-town/townModels.js`. This is the editable, reproducible source.

Rebuild the production glTF 2.0 assets with:

    node scripts/generateTownModels.mjs

The GLBs contain named, baked rotation/translation animation tracks for the
head, neck, ears, legs, eyes and tail. They are hierarchical rigid articulation,
not deformable skin-weighted fur models. Runtime growth adjusts head/body
proportions and reveals the neckerchief. All geometry and materials are original;
there are no downloaded meshes, external textures or runtime network services.

Clips: idle, walk, run, happy, curious, pet, eat, wash, play, sleep, wake.
