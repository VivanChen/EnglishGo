# EnglishGo companion models

Original smooth-surface cat, rabbit, and dog sculptures generated with:

    node scripts/generateCompanionModels.mjs

No third-party model or texture is used. Models are lazy-loaded locally by
PetCharacterScene. Facial features and articulated tail movement are added by
the renderer. The body meshes are static sculptures with gentle group animation,
not fully skeletal-rigged animals. Other species retain the existing stylized model.
