import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const COMPONENTS = { 5120: [1, 'readInt8'], 5121: [1, 'readUInt8'], 5122: [2, 'readInt16LE'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE'] };
const WIDTHS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
export function parseGLB(bytes) {
  if (bytes.length < 28 || bytes.length > 32000000 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('Invalid GLB header/length');
  let cursor = 12, json, binary;
  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length) throw Error('Truncated chunk');
    const size = bytes.readUInt32LE(cursor), type = bytes.readUInt32LE(cursor + 4);
    if (size % 4 || cursor + 8 + size > bytes.length) throw Error('Invalid chunk length');
    const data = bytes.subarray(cursor + 8, cursor + 8 + size);
    if (type === 0x4e4f534a && !json && cursor === 12) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942 && !binary) binary = data;
    else throw Error('Unexpected/duplicate chunk');
    cursor += size + 8;
  }
  if (!json || !binary || json.buffers?.length !== 1 || json.buffers[0].byteLength > binary.length) throw Error('Missing GLB domains');
  return { json, binary, byteHash: createHash('sha256').update(bytes).digest('hex') };
}
export function encodeGLB(json, binary) {
  const text = Buffer.from(JSON.stringify(json));
  const jp = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(jp);
  const bp = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(bp);
  json.buffers = [{ byteLength: binary.length }];
  const header = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jp.length + 8 + bp.length, 8);
  jh.writeUInt32LE(jp.length); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(bp.length); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, jp, bh, bp]);
}
export function accessor(asset, index) {
  const a = asset.json.accessors?.[index], v = asset.json.bufferViews?.[a?.bufferView];
  const c = COMPONENTS[a?.componentType], width = WIDTHS[a?.type];
  if (!a || !v || !c || !width || !Number.isInteger(a.count) || a.count < 1 || a.count > 2000000 || a.sparse || v.buffer !== 0) throw Error('Invalid accessor');
  const [size, read] = c, element = size * width, stride = v.byteStride || element;
  const start = (v.byteOffset || 0) + (a.byteOffset || 0), end = start + (a.count - 1) * stride + element;
  if (stride < element || start < 0 || end > asset.binary.length || end > (v.byteOffset || 0) + v.byteLength) throw Error('Accessor bounds violation');
  const values = [];
  for (let i = 0; i < a.count; i++) for (let j = 0; j < width; j++) {
    let value = asset.binary[read](start + i * stride + j * size);
    if (a.normalized && a.componentType !== 5126) value /= a.componentType === 5121 ? 255 : 65535;
    if (!Number.isFinite(value)) throw Error('Nonfinite accessor');
    values.push(value);
  }
  return values;
}
// The editable source contains the imported actions. Publishing merges render data into
// the original GLB's exact rig, inverse binds and motion, avoiding importer resampling drift.
export async function preserveCompatibility(rawPath, baselinePath, outputPath) {
  const raw = parseGLB(await fs.readFile(rawPath)), base = parseGLB(await fs.readFile(baselinePath));
  const j = structuredClone(base.json), r = raw.json;
  const binary = Buffer.concat([base.binary, raw.binary]);
  const offset = base.binary.length, viewOffset = j.bufferViews.length, accOffset = j.accessors.length;
  const names = j.skins[0].joints.map((i) => j.nodes[i].name);
  const rawNames = r.skins[0].joints.map((i) => r.nodes[i].name);
  if (rawNames.length !== names.length || rawNames.some((name) => !names.includes(name))) throw Error('Rig names changed in authoring');
  // Remap only skin indices; all skin coordinate/bind values remain baseline owned.
  for (const mesh of r.meshes) for (const p of mesh.primitives) {
    const ai = p.attributes.JOINTS_0;
    if (ai === undefined) throw Error('Unskinned authored mesh');
    const a = r.accessors[ai], v = r.bufferViews[a.bufferView], [size, read] = COMPONENTS[a.componentType];
    const write = a.componentType === 5121 ? 'writeUInt8' : 'writeUInt16LE';
    for (let i = 0; i < a.count; i++) for (let k = 0; k < 4; k++) {
      const at = offset + (v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || size * 4) + k * size;
      const original = binary[read](at), mapped = names.indexOf(rawNames[original]);
      if (mapped < 0) throw Error('Unknown exported joint');
      binary[write](mapped, at);
    }
  }
  for (const v of r.bufferViews) j.bufferViews.push({ ...v, byteOffset: (v.byteOffset || 0) + offset });
  for (const a of r.accessors) j.accessors.push({ ...a, bufferView: a.bufferView + viewOffset });
  j.materials = r.materials;
  j.images = (r.images || []).map((image) => ({ ...image, bufferView: image.bufferView + viewOffset }));
  j.textures = r.textures || []; j.samplers = r.samplers || [];
  j.meshes = r.meshes.map((mesh) => ({ ...mesh, primitives: mesh.primitives.map((p) => ({ ...p, indices: p.indices === undefined ? undefined : p.indices + accOffset, attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, v + accOffset])) })) }));
  for (const node of j.nodes) { delete node.mesh; delete node.skin; }
  for (const node of r.nodes) if (node.mesh !== undefined) {
    const index = j.nodes.length;
    j.nodes.push({ name: node.name, mesh: node.mesh, skin: 0, extras: node.extras });
    j.scenes[j.scene || 0].nodes.push(index);
  }
  j.asset = { version: '2.0', generator: 'VibeOnDuty authored human / preserved compatibility domains' };
  j.buffers = [{ byteLength: binary.length }];
  await fs.writeFile(outputPath, encodeGLB(j, binary));
}
export async function inspectCharacter(filename, options = {}) {
  const asset = parseGLB(await fs.readFile(filename)), j = asset.json;
  for (let i = 0; i < j.accessors.length; i++) accessor(asset, i);
  if (!j.meshes?.length || !j.materials?.length || !j.skins?.length || !j.animations?.length) throw Error('Missing mesh/material/skin/motion');
  let vertices = 0, triangles = 0;
  for (const mesh of j.meshes) for (const p of mesh.primitives) {
    const pos = accessor(asset, p.attributes.POSITION), normals = accessor(asset, p.attributes.NORMAL);
    if (pos.length !== normals.length) throw Error('Invalid normals');
    const joints = accessor(asset, p.attributes.JOINTS_0), weights = accessor(asset, p.attributes.WEIGHTS_0);
    if (joints.length !== weights.length || joints.length / 4 !== pos.length / 3) throw Error('Skin arity mismatch');
    for (let i = 0; i < weights.length; i += 4) {
      const sum = weights.slice(i, i + 4).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1) > 0.0001 || weights.slice(i, i + 4).some((w) => w < 0 || w > 1) || joints.slice(i, i + 4).some((id) => !Number.isInteger(id) || id < 0 || id >= j.skins[0].joints.length)) throw Error('Invalid skin joint/weight');
    }
    if (!j.materials[p.material]) throw Error('Invalid material reference');
    vertices += pos.length / 3;
    if (p.indices !== undefined) {
      const indices = accessor(asset, p.indices);
      if (indices.some((i) => i < 0 || i >= pos.length / 3 || !Number.isInteger(i))) throw Error('Invalid index');
      triangles += indices.length / 3;
    } else triangles += pos.length / 9;
  }
  if (vertices > 100000 || triangles > 100000) throw Error('Geometry budget exceeded');
  for (const image of j.images || []) if (image.uri || !j.bufferViews[image.bufferView]) throw Error('External/missing image');
  if (options.baseline) {
    const base = parseGLB(await fs.readFile(options.baseline));
    assert.deepEqual(j.skins, base.json.skins, 'Exact compatibility skins');
    assert.deepEqual(j.animations, base.json.animations, 'Exact compatibility animation entries including duplicates');
    for (const i of base.json.skins[0].joints) {
      const a = { ...j.nodes[i] }, b = { ...base.json.nodes[i] };
      delete a.mesh; delete a.skin; delete b.mesh; delete b.skin;
      assert.deepEqual(a, b, 'Exact compatibility joint hierarchy and local rest axes');
    }
    assert.deepEqual(accessor(asset, j.skins[0].inverseBindMatrices), accessor(base, base.json.skins[0].inverseBindMatrices), 'Exact inverse binds');
    for (const anim of j.animations) for (const sampler of anim.samplers) {
      assert.deepEqual(accessor(asset, sampler.input), accessor(base, sampler.input), 'Exact action times');
      assert.deepEqual(accessor(asset, sampler.output), accessor(base, sampler.output), 'Exact action transforms');
    }
  }
  return { vertices, triangles, joints: j.skins[0].joints.length, animations: j.animations.length, materials: j.materials.map((m) => m.name), byteHash: asset.byteHash };
}
async function main() {
  if (process.argv.includes('--self-test')) { assert.throws(() => parseGLB(Buffer.alloc(0))); console.log('Inspector empty/corrupt rejection passed'); return; }
  const filename = process.argv[2], idx = process.argv.indexOf('--baseline');
  console.log(JSON.stringify(await inspectCharacter(filename, { baseline: idx < 0 ? undefined : process.argv[idx + 1] }), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exitCode = 1; });
