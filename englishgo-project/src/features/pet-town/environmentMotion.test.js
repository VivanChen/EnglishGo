import { describe, expect, it } from 'vitest';
import { Group, Mesh, SphereGeometry, MeshStandardMaterial } from 'three';
import { bindEnvironmentMotion, environmentFollowup } from './environmentMotion.js';

describe('environment response motion', () => {
  it('sways leaves without accumulating drift and restores original transforms', () => {
    const root=new Group(), geometry=new SphereGeometry(), material=new MeshStandardMaterial(), leaf=new Mesh(geometry,material);
    leaf.position.set(.2,.7,0);leaf.rotation.z=.3;root.add(leaf);
    const rig=bindEnvironmentMotion(root,'planter',()=>{});
    rig.update(3,1);const angle=leaf.rotation.z;expect(angle).not.toBe(.3);
    for(let i=0;i<100;i++)rig.update(3,1);
    expect(leaf.rotation.z).toBe(angle);expect(leaf.position.y).toBe(.7);
    rig.restore();expect(leaf.rotation.z).toBe(.3);
    rig.update(4,2,false);expect(leaf.rotation.z).toBe(.3);
    geometry.dispose();material.dispose();
  });
  it('compresses the cushion during contact, fades out, and restores its scale', () => {
    const root=new Group();root.scale.set(1.4,.8,1.2);const rig=bindEnvironmentMotion(root,'cushion',()=>{});
    rig.update(1,1);expect(root.scale.y).toBeLessThan(.8);
    rig.update(6,6);expect(root.scale.y).toBe(.8);
    rig.restore();expect(root.scale.toArray()).toEqual([1.4,.8,1.2]);
  });
  it('keeps light material changes local and registers ownership for disposal', () => {
    const root=new Group(), geometry=new SphereGeometry(), material=new MeshStandardMaterial({emissiveIntensity:.8}), lamp=new Mesh(geometry,material), owned=[];
    root.add(lamp);const rig=bindEnvironmentMotion(root,'lantern',m=>owned.push(m));
    expect(owned).toEqual([lamp.material]);expect(lamp.material).not.toBe(material);
    rig.update(1,1);expect(lamp.material.emissiveIntensity).toBeGreaterThan(.8);expect(material.emissiveIntensity).toBe(.8);
    rig.restore();expect(lamp.material.emissiveIntensity).toBe(.8);
    owned.forEach(m=>m.dispose());geometry.dispose();material.dispose();
  });
  it('closes the mailbox and hides its letter after cancellation or reduced motion', () => {
    const root=new Group(), door=new Group(), letter=new Group();door.userData.environmentRole='door';letter.userData.environmentRole='letter';letter.visible=false;root.add(door,letter);
    const rig=bindEnvironmentMotion(root,'mailbox',()=>{});rig.update(2,1);
    expect(door.rotation.x).toBeGreaterThan(1);expect(letter.visible).toBe(true);
    rig.restore();expect(door.rotation.x).toBe(0);expect(letter.visible).toBe(false);
    rig.update(3,2,false);expect(door.rotation.x).toBe(0);expect(letter.visible).toBe(false);
    expect(environmentFollowup('mailbox')[0]).toBe('greet');expect(environmentFollowup('cushion')).toBeUndefined();
  });
});
