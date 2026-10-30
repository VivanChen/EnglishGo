// Cache movable parts once. Updating a visit never rebuilds geometry or materials.
export function bindEnvironmentMotion(root, kind, ownMaterial) {
  const parts = [];
  root.traverse(node => {
    let role = node.userData.environmentRole;
    if (!role && node.isMesh) {
      if ((kind === 'planter' && node.position.y > .48) || (kind === 'tree' && node.position.y > 1.3)) role = 'leaf';
      if (kind === 'bowl' && node.geometry.type === 'SphereGeometry') role = 'food';
      if (kind === 'shells') role = 'shell';
      if (kind === 'chime' && node.userData.envChime) role = 'chime';
      if (kind === 'lantern' && node.material.emissiveIntensity > 0) role = 'light';
    }
    if (!role) return;
    if (role === 'light' || role === 'ripple') { node.material = node.material.clone(); ownMaterial(node.material); }
    parts.push({ node, role, position: node.position.clone(), rotation: node.rotation.clone(), scale: node.scale.clone(), visible: node.visible, emission: node.material?.emissiveIntensity, opacity: node.material?.opacity });
  });
  const scale = root.scale.clone();
  const restore = () => {
    root.scale.copy(scale);
    for (const p of parts) {
      p.node.position.copy(p.position); p.node.rotation.copy(p.rotation); p.node.scale.copy(p.scale);
      p.node.visible = p.visible;
      if (p.role === 'light') p.node.material.emissiveIntensity = p.emission;
      if (p.role === 'ripple') p.node.material.opacity = p.opacity;
    }
  };
  return {
    restore,
    update(time, age, motion = true, duration = 6) {
      restore();
      if (!motion) return;
      const contact = age == null ? 0 : Math.min(1, age * 3) * Math.min(1, Math.max(0, duration - age) * 2);
      if (kind === 'cushion' && contact) { root.scale.y *= 1 - contact * .16; root.scale.x *= 1 + contact * .035; }
      parts.forEach((p, i) => {
        const { node, role } = p, phase = time * 1.6 + i * .7;
        if (role === 'leaf') { node.rotation.z += Math.sin(phase) * (.025 + contact * .14); node.rotation.x += Math.cos(phase * .8) * (.015 + contact * .07); }
        if (role === 'food' && contact) node.position.y += Math.abs(Math.sin(age * 8 + i)) * .025 * contact;
        if (role === 'shell' && contact) { node.rotation.z += Math.sin(age * 7 + i) * .18 * contact; node.position.y += Math.abs(Math.sin(age * 5 + i)) * .035 * contact; }
        if (role === 'chime') node.rotation.z += Math.sin(time * (contact ? 5 : 1.7) + i * .4) * (.025 + contact * .25);
        if (role === 'light') node.material.emissiveIntensity = p.emission + .05 + (Math.sin(time * 2) + 1) * (.025 + contact * .25);
        if (role === 'door') node.rotation.x += contact * 1.15;
        if (role === 'letter') { node.position.y += contact * .08; node.position.z += contact * .22; node.visible = contact > .05; }
        if (role === 'ripple') { const wave = (time * .45 + i / 3) % 1; node.scale.multiplyScalar(.3 + wave * (contact ? 1.3 : 1)); node.material.opacity = (1 - wave) * (contact ? .65 : .25); }
      });
    },
  };
}

export function environmentFollowup(kind) {
  return { bowl: ['happy', '吃完點心，滿足地抬起頭。'], planter: ['listen', '葉子輕輕晃了晃，牠豎起耳朵。'], shells: ['greet', '把喜歡的小貝殼推向你。'], mailbox: ['greet', '信箱打開了，裡面有一封小小的信！'], fountain: ['play', '伸出小爪，追著水面的波紋。'], chime: ['listen', '風鈴響了，牠安靜地聽著。'], lantern: ['curious', '暖暖的燈光亮了起來。'] }[kind];
}
