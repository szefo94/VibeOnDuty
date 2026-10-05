import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { inflateSync, deflateSync } from 'node:zlib';

const PARAMS = JSON.parse(await fs.readFile(new URL('./character-params.json', import.meta.url)));
const BUDGET = PARAMS.budgets;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

const COMPONENTS = {
  5120: [1, 'readInt8'],
  5121: [1, 'readUInt8'],
  5122: [2, 'readInt16LE'],
  5123: [2, 'readUInt16LE'],
  5125: [4, 'readUInt32LE'],
  5126: [4, 'readFloatLE'],
};
const WIDTHS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
export function parseGLB(bytes) {
  if (
    bytes.length < 28 ||
    bytes.length > BUDGET.maxGlbBytes ||
    bytes.readUInt32LE(0) !== 0x46546c67 ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  )
    throw Error('Invalid GLB header/length');
  let cursor = 12,
    json,
    binary;
  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length) throw Error('Truncated chunk');
    const size = bytes.readUInt32LE(cursor),
      type = bytes.readUInt32LE(cursor + 4);
    if (size % 4 || cursor + 8 + size > bytes.length) throw Error('Invalid chunk length');
    const data = bytes.subarray(cursor + 8, cursor + 8 + size);
    if (type === 0x4e4f534a && !json && cursor === 12) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942 && !binary) binary = data;
    else throw Error('Unexpected/duplicate chunk');
    cursor += size + 8;
  }
  if (!json || !binary || json.buffers?.length !== 1 || json.buffers[0].byteLength > binary.length)
    throw Error('Missing GLB domains');
  return { json, binary, byteHash: createHash('sha256').update(bytes).digest('hex') };
}
export function encodeGLB(json, binary) {
  json.buffers = [{ byteLength: binary.length }];
  const text = Buffer.from(JSON.stringify(json));
  const jp = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32);
  text.copy(jp);
  const bp = Buffer.alloc(Math.ceil(binary.length / 4) * 4);
  binary.copy(bp);
  const header = Buffer.alloc(12),
    jh = Buffer.alloc(8),
    bh = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jp.length + 8 + bp.length, 8);
  jh.writeUInt32LE(jp.length);
  jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(bp.length);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, jp, bh, bp]);
}
export function accessor(asset, index) {
  const a = asset.json.accessors?.[index],
    v = asset.json.bufferViews?.[a?.bufferView];
  const c = COMPONENTS[a?.componentType],
    width = WIDTHS[a?.type];
  if (
    !a ||
    !v ||
    !c ||
    !width ||
    !Number.isInteger(a.count) ||
    a.count < 1 ||
    a.count > BUDGET.maxAccessorElements ||
    a.sparse ||
    v.buffer !== 0
  )
    throw Error('Invalid accessor');
  const [size, read] = c,
    element = size * width,
    stride = v.byteStride || element;
  const start = (v.byteOffset || 0) + (a.byteOffset || 0),
    end = start + (a.count - 1) * stride + element;
  if (
    stride < element ||
    start < 0 ||
    end > asset.binary.length ||
    end > (v.byteOffset || 0) + v.byteLength
  )
    throw Error('Accessor bounds violation');
  const values = [];
  for (let i = 0; i < a.count; i++)
    for (let j = 0; j < width; j++) {
      let value = asset.binary[read](start + i * stride + j * size);
      if (a.normalized && a.componentType !== 5126) value /= a.componentType === 5121 ? 255 : 65535;
      if (!Number.isFinite(value)) throw Error('Nonfinite accessor');
      values.push(value);
    }
  return values;
}
function imageDomain(asset, image) {
  const v = asset.json.bufferViews[image.bufferView];
  if (!v || image.uri || v.byteLength > BUDGET.maxImageBytes) throw Error('Invalid image domain');
  const bytes = asset.binary.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  if (
    image.mimeType !== 'image/png' ||
    bytes.length < 33 ||
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
  )
    throw Error('Only bounded embedded PNG paint sources are supported');
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20),
    depth = bytes[24],
    type = bytes[25];
  if (
    !width ||
    !height ||
    width > BUDGET.maxImageDimension ||
    height > BUDGET.maxImageDimension ||
    depth !== 8 ||
    ![2, 6].includes(type) ||
    bytes[28] !== 0
  )
    throw Error('Image dimensions/encoding bound');
  const channels = type === 6 ? 4 : 3,
    stride = width * channels;
  const idat = [];
  let cursor = 8,
    ended = false;
  while (cursor + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(cursor),
      tag = bytes.subarray(cursor + 4, cursor + 8).toString();
    if (cursor + size + 12 > bytes.length) throw Error('Truncated PNG chunk');
    if (
      crc32(bytes.subarray(cursor + 4, cursor + 8 + size)) !== bytes.readUInt32BE(cursor + 8 + size)
    )
      throw Error('PNG checksum mismatch');
    if (tag === 'IDAT') idat.push(bytes.subarray(cursor + 8, cursor + 8 + size));
    if (tag === 'IEND') {
      ended = true;
      break;
    }
    cursor += size + 12;
  }
  if (!ended || !idat.length) throw Error('Missing PNG data');
  const rows = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height });
  if (rows.length !== (stride + 1) * height) throw Error('PNG decoded length mismatch');
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = rows[y * (stride + 1)];
    if (filter > 4) throw Error('Invalid PNG filter');
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y ? pixels[(y - 1) * stride + x] : 0;
      const c = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      pixels[y * stride + x] = (rows[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels: sha(pixels) };
}
// The published character contract includes these authored body/equipment nodes.
// Checking resources alone cannot establish that they belong to the active scene.
const REQUIRED_RENDER_NODES = ['HumanBody', 'OpenHelmet', 'ChestPlate', 'BackPlate',
  'RaisedFabricCollar', 'ChestIdentifier', 'ShoulderPlate_l', 'ShoulderPlate_r',
  'ForearmGuard_l', 'ForearmGuard_r', 'KneeGuard_l', 'KneeGuard_r',
  'HelmetSidePanel-1', 'HelmetSidePanel1', 'BootSole_l', 'BootSole_r'];

function sceneMembership(j, parents) {
  if (!Array.isArray(j.scenes) || !j.scenes.length || j.scenes.length > 64 ||
      !Number.isInteger(j.scene ?? 0) || !j.scenes[j.scene ?? 0])
    throw Error('Invalid active scene reference');
  for (const scene of j.scenes) {
    if (!Array.isArray(scene.nodes) || new Set(scene.nodes).size !== scene.nodes.length ||
        scene.nodes.some((i) => !Number.isInteger(i) || !j.nodes[i] || parents.has(i)))
      throw Error('Invalid scene root reference');
  }
  const active = j.scenes[j.scene ?? 0], reachable = new Set();
  const visit = (i) => {
    if (reachable.has(i)) return;
    if (!Number.isInteger(i) || !j.nodes[i]) throw Error('Invalid hierarchy reference');
    reachable.add(i);
    for (const child of j.nodes[i].children || []) visit(child);
  };
  for (const root of active.nodes) visit(root);
  return { active, reachable };
}

function validateStructure(asset) {
  const j = asset.json;
  for (const [key, maximum] of [
    ['nodes', 1024],
    ['accessors', 32768],
    ['bufferViews', 32768],
    ['meshes', 256],
    ['materials', 64],
    ['skins', 16],
    ['animations', 128],
  ]) {
    if (!Array.isArray(j[key]) || j[key].length > maximum)
      throw Error('Missing/oversized structural domain: ' + key);
  }
  for (const v of j.bufferViews || []) {
    if (
      v.buffer !== 0 ||
      !Number.isInteger(v.byteLength) ||
      v.byteLength < 1 ||
      !Number.isInteger(v.byteOffset || 0) ||
      (v.byteOffset || 0) < 0 ||
      (v.byteOffset || 0) + v.byteLength > j.buffers[0].byteLength
    )
      throw Error('Invalid buffer view');
  }
  const parents = new Map();
  for (let i = 0; i < j.nodes.length; i++) {
    const node = j.nodes[i];
    if (
      (node.mesh !== undefined && (!Number.isInteger(node.mesh) || !j.meshes[node.mesh])) ||
      (node.skin !== undefined && (node.mesh === undefined || !Number.isInteger(node.skin) || !j.skins[node.skin]))
    )
      throw Error('Invalid mesh/skin node reference');
    for (const key of ['translation', 'rotation', 'scale', 'matrix'])
      if (node[key]) {
        if (
          node[key].length !== { translation: 3, rotation: 4, scale: 3, matrix: 16 }[key] ||
          node[key].some((n) => !Number.isFinite(n))
        )
          throw Error('Invalid rest transform');
      }
    for (const child of node.children || []) {
      if (!Number.isInteger(child) || !j.nodes[child] || child === i || parents.has(child))
        throw Error('Invalid hierarchy reference');
      parents.set(child, i);
    }
  }
  for (const i of parents.keys()) {
    const seen = new Set();
    let at = i;
    while (parents.has(at)) {
      if (seen.has(at)) throw Error('Hierarchy cycle');
      seen.add(at);
      at = parents.get(at);
    }
  }
  const { reachable } = sceneMembership(j, parents);
  for (const name of REQUIRED_RENDER_NODES) {
    const matches = j.nodes.map((node, i) => ({ node, i })).filter(({ node }) => node.name === name);
    if (matches.length !== 1 || !reachable.has(matches[0].i) ||
        matches[0].node.mesh === undefined || matches[0].node.skin === undefined)
      throw Error('Required reachable body/equipment render node: ' + name);
  }
  const body = j.nodes.find((node) => node.name === 'HumanBody');
  if (j.meshes[body.mesh].name !== 'Anatomical human topology' ||
      !body.extras?.anatomicalFace || j.skins[body.skin].name !== 'Armature')
    throw Error('Invalid authored body mesh/skin binding');
  for (let i = 0; i < j.nodes.length; i++)
    if (j.nodes[i].mesh !== undefined) {
      if (!reachable.has(i)) throw Error('Authored render node is unreachable: ' + j.nodes[i].name);
      if (j.nodes[i].skin !== body.skin) throw Error('Invalid authored equipment skin binding');
    }
  for (let mesh = 0; mesh < j.meshes.length; mesh++)
    if (!j.nodes.some((node, i) => node.mesh === mesh && reachable.has(i)))
      throw Error('Unbound authored body/equipment mesh resource: ' + j.meshes[mesh].name);
  for (const skin of j.skins || []) {
    if (
      !skin.joints?.length ||
      skin.joints.length > 256 ||
      new Set(skin.joints).size !== skin.joints.length ||
      skin.joints.some((i) => !j.nodes[i])
    )
      throw Error('Invalid skin hierarchy');
    const a = j.accessors[skin.inverseBindMatrices];
    if (!a || a.type !== 'MAT4' || a.componentType !== 5126 || a.count !== skin.joints.length)
      throw Error('Invalid inverse bind matrices');
  }
  for (const animation of j.animations) {
    if (
      !animation.name ||
      !animation.channels?.length ||
      animation.channels.length > 512 ||
      !animation.samplers?.length ||
      animation.samplers.length > 1024
    )
      throw Error('Invalid animation domain');
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler],
        target = channel.target;
      if (
        !sampler ||
        !j.nodes[target.node] ||
        !['translation', 'rotation', 'scale'].includes(target.path)
      )
        throw Error('Invalid animation target');
      const times = accessor(asset, sampler.input),
        values = accessor(asset, sampler.output);
      const width = target.path === 'rotation' ? 4 : 3,
        multiplier = sampler.interpolation === 'CUBICSPLINE' ? 3 : 1;
      if (
        j.accessors[sampler.input].type !== 'SCALAR' ||
        values.length !== times.length * width * multiplier ||
        times.some((t, i) => t < 0 || t > 600 || (i && t <= times[i - 1]))
      )
        throw Error('Invalid sampled animation');
    }
  }
  const colors = (array, length) =>
    Array.isArray(array) &&
    array.length === length &&
    array.every((n) => Number.isFinite(n) && n >= 0 && n <= 1);
  for (const m of j.materials || []) {
    const p = m.pbrMetallicRoughness || {};
    if (p.baseColorFactor && !colors(p.baseColorFactor, 4)) throw Error('Invalid material color');
    if (m.emissiveFactor && !colors(m.emissiveFactor, 3)) throw Error('Invalid material emission');
    for (const key of ['metallicFactor', 'roughnessFactor'])
      if (p[key] !== undefined && (!Number.isFinite(p[key]) || p[key] < 0 || p[key] > 1))
        throw Error('Invalid material factor');
    if (
      m.extras?.artDomain &&
      !['skin', 'fabric', 'armor', 'team-accent', 'ink', 'weapon', 'stone'].includes(
        m.extras.artDomain
      )
    )
      throw Error('Unknown material domain');
    for (const info of [
      p.baseColorTexture,
      p.metallicRoughnessTexture,
      m.normalTexture,
      m.occlusionTexture,
      m.emissiveTexture,
    ])
      if (info && (!j.textures?.[info.index] || !j.images?.[j.textures[info.index].source]))
        throw Error('Invalid material image reference');
  }
  if ((j.images || []).length > BUDGET.maxImages) throw Error('Image count bound');
  let pixels = 0;
  for (const image of j.images || []) {
    const domain = imageDomain(asset, image);
    pixels += domain.width * domain.height;
  }
  if (pixels > BUDGET.maxTotalImagePixels) throw Error('Total image pixel bound');
}
// The editable source contains the imported actions. Publishing merges render data into
// the original GLB's exact rig, inverse binds and motion, avoiding importer resampling drift.
export async function preserveCompatibility(rawPath, baselinePath, outputPath) {
  const raw = parseGLB(await fs.readFile(rawPath)),
    base = parseGLB(await fs.readFile(baselinePath));
  const j = structuredClone(base.json),
    r = raw.json;
  const binary = Buffer.concat([base.binary, raw.binary]);
  const offset = base.binary.length,
    viewOffset = j.bufferViews.length,
    accOffset = j.accessors.length;
  const names = j.skins[0].joints.map((i) => j.nodes[i].name);
  const rawNames = r.skins[0].joints.map((i) => r.nodes[i].name);
  if (rawNames.length !== names.length || rawNames.some((name) => !names.includes(name)))
    throw Error('Rig names changed in authoring');
  // Remap only skin indices; all skin coordinate/bind values remain baseline owned.
  for (const mesh of r.meshes)
    for (const p of mesh.primitives) {
      const ai = p.attributes.JOINTS_0;
      if (ai === undefined) throw Error('Unskinned authored mesh');
      const a = r.accessors[ai],
        v = r.bufferViews[a.bufferView],
        [size, read] = COMPONENTS[a.componentType];
      const write = a.componentType === 5121 ? 'writeUInt8' : 'writeUInt16LE';
      for (let i = 0; i < a.count; i++)
        for (let k = 0; k < 4; k++) {
          const at =
            offset +
            (v.byteOffset || 0) +
            (a.byteOffset || 0) +
            i * (v.byteStride || size * 4) +
            k * size;
          const original = binary[read](at),
            mapped = names.indexOf(rawNames[original]);
          if (mapped < 0) throw Error('Unknown exported joint');
          binary[write](mapped, at);
        }
    }
  for (const v of r.bufferViews)
    j.bufferViews.push({ ...v, byteOffset: (v.byteOffset || 0) + offset });
  for (const a of r.accessors) j.accessors.push({ ...a, bufferView: a.bufferView + viewOffset });
  j.materials = r.materials;
  j.images = (r.images || []).map((image) => ({
    ...image,
    bufferView: image.bufferView + viewOffset,
  }));
  j.textures = r.textures || [];
  j.samplers = r.samplers || [];
  j.meshes = r.meshes.map((mesh) => ({
    ...mesh,
    primitives: mesh.primitives.map((p) => ({
      ...p,
      indices: p.indices === undefined ? undefined : p.indices + accOffset,
      attributes: Object.fromEntries(
        Object.entries(p.attributes).map(([k, v]) => [k, v + accOffset])
      ),
    })),
  }));
  for (const node of j.nodes) {
    delete node.mesh;
    delete node.skin;
  }
  for (const node of r.nodes)
    if (node.mesh !== undefined) {
      const index = j.nodes.length;
      j.nodes.push({ name: node.name, mesh: node.mesh, skin: 0, extras: node.extras });
      j.scenes[j.scene || 0].nodes.push(index);
    }
  j.asset = {
    version: '2.0',
    generator: 'VibeOnDuty authored human / preserved compatibility domains',
  };
  j.buffers = [{ byteLength: binary.length }];
  await fs.writeFile(outputPath, encodeGLB(j, binary));
}
export async function inspectCharacter(filename, options = {}) {
  const asset = parseGLB(Buffer.isBuffer(filename) ? filename : await fs.readFile(filename)),
    j = asset.json;
  validateStructure(asset);
  for (let i = 0; i < j.accessors.length; i++) accessor(asset, i);
  if (!j.meshes?.length || !j.materials?.length || !j.skins?.length || !j.animations?.length)
    throw Error('Missing mesh/material/skin/motion');
  for (const required of PARAMS.compatibility.requiredClips)
    if (!j.animations.some((a) => a.name.normalize('NFC') === required))
      throw Error('Required clip absent: ' + required);
  let vertices = 0,
    triangles = 0;
  for (const mesh of j.meshes)
    for (const p of mesh.primitives) {
      const pos = accessor(asset, p.attributes.POSITION),
        normals = accessor(asset, p.attributes.NORMAL);
      for (const key of ['POSITION', 'NORMAL'])
        if (
          j.accessors[p.attributes[key]].type !== 'VEC3' ||
          j.accessors[p.attributes[key]].componentType !== 5126
        )
          throw Error('Invalid geometric attribute type');
      if (pos.length !== normals.length) throw Error('Invalid normals');
      for (let i = 0; i < normals.length; i += 3)
        if (Math.abs(Math.hypot(...normals.slice(i, i + 3)) - 1) > 0.01)
          throw Error('Unnormalized normals');
      const joints = accessor(asset, p.attributes.JOINTS_0),
        weights = accessor(asset, p.attributes.WEIGHTS_0);
      for (const key of ['JOINTS_0', 'WEIGHTS_0'])
        if (j.accessors[p.attributes[key]].type !== 'VEC4')
          throw Error('More than four skin influences');
      if (joints.length !== weights.length || joints.length / 4 !== pos.length / 3)
        throw Error('Skin arity mismatch');
      for (let i = 0; i < weights.length; i += 4) {
        const sum = weights.slice(i, i + 4).reduce((a, b) => a + b, 0);
        if (
          Math.abs(sum - 1) > 0.0001 ||
          weights.slice(i, i + 4).some((w) => w < 0 || w > 1) ||
          joints
            .slice(i, i + 4)
            .some((id) => !Number.isInteger(id) || id < 0 || id >= j.skins[0].joints.length)
        )
          throw Error('Invalid skin joint/weight');
      }
      if (!j.materials[p.material]) throw Error('Invalid material reference');
      vertices += pos.length / 3;
      if (p.indices !== undefined) {
        const indices = accessor(asset, p.indices);
        if (indices.some((i) => i < 0 || i >= pos.length / 3 || !Number.isInteger(i)))
          throw Error('Invalid index');
        triangles += indices.length / 3;
      } else triangles += pos.length / 9;
    }
  if (vertices > BUDGET.maxVertices || triangles > BUDGET.maxTriangles)
    throw Error('Geometry budget exceeded');
  for (const image of j.images || [])
    if (image.uri || !j.bufferViews[image.bufferView]) throw Error('External/missing image');
  if (options.baseline) {
    const base = parseGLB(await fs.readFile(options.baseline));
    assert.deepEqual(j.skins, base.json.skins, 'Exact compatibility skins');
    assert.deepEqual(
      j.animations,
      base.json.animations,
      'Exact compatibility animation entries including duplicates'
    );
    for (let i = 0; i < base.json.nodes.length; i++) {
      const a = { ...j.nodes[i] },
        b = { ...base.json.nodes[i] };
      delete a.mesh;
      delete a.skin;
      delete b.mesh;
      delete b.skin;
      assert.deepEqual(a, b, 'Exact compatibility joint hierarchy and local rest axes');
    }
    assert.deepEqual(
      accessor(asset, j.skins[0].inverseBindMatrices),
      accessor(base, base.json.skins[0].inverseBindMatrices),
      'Exact inverse binds'
    );
    for (const anim of j.animations)
      for (const sampler of anim.samplers) {
        assert.deepEqual(
          accessor(asset, sampler.input),
          accessor(base, sampler.input),
          'Exact action times'
        );
        assert.deepEqual(
          accessor(asset, sampler.output),
          accessor(base, sampler.output),
          'Exact action transforms'
        );
      }
  }
  return {
    vertices,
    triangles,
    joints: j.skins[0].joints.length,
    animations: j.animations.length,
    materials: j.materials.map((m) => m.name),
    byteHash: asset.byteHash,
  };
}
function nfc(value) {
  if (typeof value === 'string') return value.normalize('NFC');
  if (Array.isArray(value)) return value.map(nfc);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key.normalize('NFC'), nfc(value[key])])
    );
  return value;
}
function semantics(asset) {
  const j = asset.json,
    name = (i) => (j.nodes[i]?.name || `unnamed-${i}`).normalize('NFC');
  const parents = new Map();
  j.nodes.forEach((node, i) => (node.children || []).forEach((child) => parents.set(child, i)));
  // Names are authored stable identities, never serializer array indices. Reject
  // ambiguous identities rather than accidentally comparing different bindings equal.
  const identities = (entries, domain) => {
    const names = entries.map((entry) => entry.name?.normalize('NFC'));
    if (names.some((value) => !value) || new Set(names).size !== names.length)
      throw Error('Missing/ambiguous semantic identity: ' + domain);
    return names;
  };
  const nodeNames = identities(j.nodes, 'nodes'), meshNames = identities(j.meshes, 'meshes'),
    skinNames = identities(j.skins, 'skins');
  const { active, reachable } = sceneMembership(j, parents);
  const renderGraph = {
    activeScene: active.name?.normalize('NFC') ?? null,
    extras: active.extras ?? null,
    extensions: active.extensions ?? null,
    roots: active.nodes.map((i) => nodeNames[i]).sort(),
    nodes: j.nodes.map((node, i) => ({
      name: nodeNames[i], reachable: reachable.has(i),
      parent: parents.has(i) ? nodeNames[parents.get(i)] : null,
      children: (node.children || []).map((child) => nodeNames[child]).sort(),
      mesh: node.mesh === undefined ? null : meshNames[node.mesh],
      skin: node.skin === undefined ? null : skinNames[node.skin],
      matrix: node.matrix ?? null, translation: node.translation ?? [0, 0, 0],
      rotation: node.rotation ?? [0, 0, 0, 1], scale: node.scale ?? [1, 1, 1],
      weights: node.weights ?? null, extras: node.extras ?? null,
      extensions: node.extensions ?? null,
    })).sort((a, b) => a.name.localeCompare(b.name)),
  };
  const images = (j.images || []).map((image) => imageDomain(asset, image));
  const materials = (j.materials || []).map((m) => {
    const result = structuredClone(m);
    function resolveTexture(object) {
      for (const [key, value] of Object.entries(object)) {
        if (key.endsWith('Texture') && value?.index !== undefined) {
          const texture = j.textures[value.index];
          object[key] = {
            ...value,
            index: undefined,
            image: (j.images[texture.source].name || `image-${texture.source}`).normalize('NFC'),
            sampler: j.samplers?.[texture.sampler] || {},
          };
        } else if (value && typeof value === 'object') resolveTexture(value);
      }
    }
    resolveTexture(result);
    result.domain = m.extras?.artDomain || null;
    return nfc(result);
  });
  const mesh = j.meshes
    .map((m) => ({
      name: m.name.normalize('NFC'),
      weights: m.weights ?? null, extras: m.extras ?? null, extensions: m.extensions ?? null,
      primitives: m.primitives.map((p) => ({
        material: materials[p.material].name || `material-${p.material}`,
        mode: p.mode ?? 4,
        extras: p.extras ?? null, extensions: p.extensions ?? null,
        indices: p.indices === undefined ? null : accessor(asset, p.indices),
        attributes: Object.fromEntries(
          Object.entries(p.attributes)
            .sort()
            .map(([key, index]) => [
              key,
              key === 'JOINTS_0'
                ? accessor(asset, index).map((id) => name(j.skins[0].joints[id]))
                : accessor(asset, index),
            ])
        ),
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const skin = j.skins.map((s, skinIndex) => {
    const bind = accessor(asset, s.inverseBindMatrices);
    const joints = s.joints
      .map((i, k) => ({
        name: name(i),
        parent: parents.has(i) ? name(parents.get(i)) : null,
        inverseBind: bind.slice(k * 16, k * 16 + 16),
        matrix: j.nodes[i].matrix || null,
        translation: j.nodes[i].translation || [0, 0, 0],
        rotation: j.nodes[i].rotation || [0, 0, 0, 1],
        scale: j.nodes[i].scale || [1, 1, 1],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const ancestors = new Set();
    for (let i of s.joints)
      while (parents.has(i)) {
        i = parents.get(i);
        ancestors.add(i);
      }
    return {
      name: skinNames[skinIndex],
      skeleton: s.skeleton === undefined ? null : name(s.skeleton),
      joints,
      ancestors: [...ancestors]
        .map((i) => ({
          name: name(i),
          parent: parents.has(i) ? name(parents.get(i)) : null,
          matrix: j.nodes[i].matrix || null,
          translation: j.nodes[i].translation || [0, 0, 0],
          rotation: j.nodes[i].rotation || [0, 0, 0, 1],
          scale: j.nodes[i].scale || [1, 1, 1],
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const occurrences = new Map();
  const motion = (j.animations || [])
    .map((a) => {
      const key = a.name.normalize('NFC'),
        occurrence = occurrences.get(key) || 0;
      occurrences.set(key, occurrence + 1);
      return {
        name: key,
        occurrence,
        channels: a.channels
          .map((c) => {
            const s = a.samplers[c.sampler];
            return {
              target: name(c.target.node),
              path: c.target.path,
              interpolation: s.interpolation || 'LINEAR',
              times: accessor(asset, s.input),
              values: accessor(asset, s.output),
            };
          })
          .sort((a, b) => `${a.target}:${a.path}`.localeCompare(`${b.target}:${b.path}`)),
      };
    })
    .sort((a, b) => `${a.name}:${a.occurrence}`.localeCompare(`${b.name}:${b.occurrence}`));
  return nfc({
    mesh: { resources: mesh, renderGraph },
    skin,
    materials: materials.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    images,
    motion,
  });
}
function equivalent(a, b, tolerance, at = '') {
  if (typeof a === 'number' && typeof b === 'number')
    return Math.abs(a - b) <= tolerance ? null : at;
  if (a === b) return null;
  if (
    !a ||
    !b ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return at;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return at + '.length';
    for (let i = 0; i < a.length; i++) {
      const diff = equivalent(a[i], b[i], tolerance, at + '.' + i);
      if (diff !== null) return diff;
    }
    return null;
  }
  const ak = Object.keys(a).filter((key) => a[key] !== undefined),
    bk = Object.keys(b).filter((key) => b[key] !== undefined);
  if (ak.length !== bk.length || ak.some((key) => !bk.includes(key))) return at + '.keys';
  for (const key of ak) {
    const diff = equivalent(a[key], b[key], tolerance, at + '.' + key);
    if (diff !== null) return diff;
  }
  return null;
}
export async function compareSemanticExports(first, second, options = {}) {
  const read = async (input) => parseGLB(Buffer.isBuffer(input) ? input : await fs.readFile(input));
  const a = await read(first),
    b = await read(second),
    sa = semantics(a),
    sb = semantics(b);
  const domains = {},
    differences = [];
  for (const domain of ['mesh', 'skin', 'materials', 'images', 'motion']) {
    const where = equivalent(
      sa[domain],
      sb[domain],
      options.tolerance ?? PARAMS.numericTolerance,
      domain
    );
    domains[domain] = where === null;
    if (where !== null) differences.push(where);
  }
  return {
    semanticSchemaVersion: 2, // mesh domain includes the canonical active render graph
    equal: differences.length === 0,
    byteIdentical: a.byteHash === b.byteHash,
    byteHashes: [a.byteHash, b.byteHash],
    domains,
    differences,
  };
}
async function main() {
  if (process.argv.includes('--self-test')) {
    const { test } = await import('node:test');
    const original = await fs.readFile(new URL('../../public/models/enemy.glb', import.meta.url));
    const mutate = (fn) => {
      const a = parseGLB(Buffer.from(original));
      fn(a);
      return encodeGLB(a.json, a.binary);
    };
    const changeFirst = (a, attribute, value) => {
      const p = a.json.meshes[0].primitives[0],
        acc = a.json.accessors[p.attributes[attribute]],
        view = a.json.bufferViews[acc.bufferView];
      const at = (view.byteOffset || 0) + (acc.byteOffset || 0);
      const write =
        acc.componentType === 5126
          ? 'writeFloatLE'
          : acc.componentType === 5121
            ? 'writeUInt8'
            : 'writeUInt16LE';
      a.binary[write](value, at);
    };
    await test('rejects missing required gameplay clips', async () => {
      const asset = parseGLB(
        await fs.readFile(new URL('../../public/models/enemy.glb', import.meta.url))
      );
      asset.json.animations = asset.json.animations.filter((a) => a.name !== 'attack');
      await assert.rejects(
        () => inspectCharacter(encodeGLB(asset.json, asset.binary)),
        /Required clip/
      );
    });
    await test('rejects empty truncated oversized GLB and invalid accessor bounds', async () => {
      for (const bytes of [
        Buffer.alloc(0),
        original.subarray(0, original.length - 1),
        Buffer.alloc(BUDGET.maxGlbBytes + 1),
      ])
        assert.throws(() => parseGLB(bytes));
      await assert.rejects(() =>
        inspectCharacter(
          mutate((a) => {
            a.json.accessors[0].count = BUDGET.maxAccessorElements + 1;
          })
        )
      );
      await assert.rejects(() =>
        inspectCharacter(
          mutate((a) => {
            a.json.bufferViews[0].byteOffset = -1;
          })
        )
      );
    });
    await test('rejects invalid joints nonfinite positions and unnormalized weights', async () => {
      await assert.rejects(
        () => inspectCharacter(mutate((a) => changeFirst(a, 'JOINTS_0', 255))),
        /Invalid skin/
      );
      await assert.rejects(
        () => inspectCharacter(mutate((a) => changeFirst(a, 'POSITION', NaN))),
        /Nonfinite/
      );
      await assert.rejects(
        () => inspectCharacter(mutate((a) => changeFirst(a, 'WEIGHTS_0', 0))),
        /Invalid skin/
      );
    });
    await test('zero meshes and materials reject; one and many primitives and materials pass', async () => {
      await assert.rejects(() =>
        inspectCharacter(
          mutate((a) => {
            a.json.meshes = [];
          })
        )
      );
      await assert.rejects(() =>
        inspectCharacter(
          mutate((a) => {
            a.json.materials = [];
          })
        )
      );
      await inspectCharacter(
        mutate((a) => {
          a.json.materials = [a.json.materials[0]];
          for (const mesh of a.json.meshes) {
            mesh.primitives = [mesh.primitives[0]];
            mesh.primitives[0].material = 0;
          }
        })
      );
      await inspectCharacter(original);
    });
    await test('active render graph rejects detached body/equipment, empty scenes and changed bindings', async () => {
      for (const edit of [
        (a) => { const i = a.json.nodes.findIndex((n) => n.name === 'HumanBody');
          a.json.scenes[a.json.scene ?? 0].nodes = a.json.scenes[a.json.scene ?? 0].nodes.filter((n) => n !== i); },
        (a) => { const i = a.json.nodes.findIndex((n) => n.name === 'OpenHelmet');
          a.json.scenes[a.json.scene ?? 0].nodes = a.json.scenes[a.json.scene ?? 0].nodes.filter((n) => n !== i); },
        (a) => { a.json.scene = a.json.scenes.length; a.json.scenes.push({ name: 'Empty', nodes: [] }); },
        (a) => { a.json.nodes.find((n) => n.name === 'HumanBody').mesh = 0; },
        (a) => { delete a.json.nodes.find((n) => n.name === 'HumanBody').skin; },
        (a) => { delete a.json.nodes.find((n) => n.name === 'BootLace_l0').mesh;
          delete a.json.nodes.find((n) => n.name === 'BootLace_l0').skin; },
      ]) {
        const candidate = mutate(edit);
        const result = await compareSemanticExports(original, candidate);
        assert.equal(result.equal, false);
        assert.equal(result.domains.mesh, false, 'Render graph is part of mesh semantics');
        await assert.rejects(() => inspectCharacter(candidate), /reachable|binding|Unbound/);
      }
    });
    await test('render graph detects parent, skin, transform and rendering metadata changes', async () => {
      for (const edit of [
        (a) => { const body = a.json.nodes.findIndex((n) => n.name === 'HumanBody');
          const scene = a.json.scenes[a.json.scene ?? 0];
          scene.nodes = scene.nodes.filter((n) => n !== body);
          a.json.nodes.push({ name: 'BodyParent', children: [body] }); scene.nodes.push(a.json.nodes.length - 1); },
        (a) => { a.json.skins.push({ ...structuredClone(a.json.skins[0]), name: 'OtherRig' });
          a.json.nodes.find((n) => n.name === 'HumanBody').skin = 1; },
        (a) => { a.json.nodes.find((n) => n.name === 'HumanBody').translation = [0, 0.2, 0]; },
        (a) => { a.json.nodes.find((n) => n.name === 'HumanBody').rotation = [0, 1, 0, 0]; },
        (a) => { a.json.nodes.find((n) => n.name === 'HumanBody').scale = [0, 0, 0]; },
        (a) => { a.json.nodes.find((n) => n.name === 'HumanBody').extras.artContour = false; },
      ]) assert.equal((await compareSemanticExports(original, mutate(edit))).domains.mesh, false);
      assert.equal((await compareSemanticExports(original, mutate((a) => {
        a.json.materials[0].extras.artContour = false;
      }))).domains.materials, false, 'Material rendering metadata is retained');
    });
    await test('inspector rejects invalid active scene and root references', async () => {
      for (const edit of [
        (a) => { a.json.scene = 99; },
        (a) => { a.json.scenes[0].nodes.push(-1); },
        (a) => { a.json.scenes[0].nodes.push(0.5); },
        (a) => { a.json.scenes[0].nodes.push(a.json.scenes[0].nodes[0]); },
        (a) => { a.json.scenes[0].nodes.push(a.json.skins[0].joints[0]); },
      ]) await assert.rejects(() => inspectCharacter(mutate(edit)), /scene/);
    });
    await test('serializer node, scene, mesh and skin index reorder preserves semantic identities', async () => {
      const candidate = mutate((a) => {
        const j = a.json, reverse = (key) => {
          const count = j[key].length; j[key].reverse(); return (i) => count - 1 - i;
        };
        const node = reverse('nodes'), mesh = reverse('meshes'), skin = reverse('skins');
        for (const n of j.nodes) {
          if (n.children) n.children = n.children.map(node).reverse();
          if (n.mesh !== undefined) n.mesh = mesh(n.mesh);
          if (n.skin !== undefined) n.skin = skin(n.skin);
        }
        for (const s of j.skins) {
          s.joints = s.joints.map(node);
          if (s.skeleton !== undefined) s.skeleton = node(s.skeleton);
        }
        for (const a of j.animations) for (const c of a.channels) c.target.node = node(c.target.node);
        for (const s of j.scenes) s.nodes = s.nodes.map(node).reverse();
        j.scenes.unshift({ name: 'Unused', nodes: [] }); j.scene = (j.scene ?? 0) + 1;
      });
      const result = await compareSemanticExports(original, candidate);
      assert.equal(result.equal, true); assert.equal(result.byteIdentical, false);
      await inspectCharacter(candidate);
    });
    await test('detects hierarchy cycles and invalid material image domains', async () => {
      await assert.rejects(
        () =>
          inspectCharacter(
            mutate((a) => {
              a.json.nodes[0].children = [0];
            })
          ),
        /hierarchy/
      );
      await assert.rejects(
        () =>
          inspectCharacter(
            mutate((a) => {
              a.json.materials[0].pbrMetallicRoughness.baseColorFactor = [2, 0, 0, 1];
            })
          ),
        /material color/
      );
      await assert.rejects(() =>
        inspectCharacter(
          mutate((a) => {
            a.json.images = [{ uri: 'https://example.invalid/image.png' }];
          })
        )
      );
    });
    await test('serialization and NFC names match semantically but exact byte hashes remain distinct', async () => {
      const a = mutate((a) => {
        a.json.meshes[0].name = 'Caf\u00e9';
      });
      const b = mutate((a) => {
        a.json.meshes[0].name = 'Cafe\u0301';
        a.json.asset.generator = 'different serializer';
      });
      const result = await compareSemanticExports(a, b);
      assert.equal(result.equal, true);
      assert.equal(result.byteIdentical, false);
    });
    await test('comparison identifies changed mesh skin material and sampled motion domains', async () => {
      for (const [domain, edit] of [
        ['mesh', (a) => changeFirst(a, 'POSITION', 42)],
        [
          'skin',
          (a) => {
            a.json.nodes[a.json.skins[0].joints[0]].translation = [0, 0, 1];
          },
        ],
        [
          'materials',
          (a) => {
            a.json.materials[0].pbrMetallicRoughness.roughnessFactor = 0.1;
          },
        ],
        [
          'motion',
          (a) => {
            a.json.animations[0].samplers[0].interpolation = 'LINEAR';
          },
        ],
      ]) {
        const result = await compareSemanticExports(original, mutate(edit));
        assert.equal(result.equal, false, domain);
        assert.equal(result.domains[domain], false, domain);
        assert.ok(result.differences.some((d) => d.startsWith(domain)));
      }
      const duplicated = mutate((a) => {
        a.json.animations.push(structuredClone(a.json.animations[0]));
      });
      assert.equal((await compareSemanticExports(duplicated, duplicated)).equal, true);
      assert.equal(
        (await compareSemanticExports(original, duplicated)).domains.motion,
        false,
        'Duplicate occurrence must remain distinct'
      );
      const changedDuplicate = parseGLB(Buffer.from(duplicated));
      changedDuplicate.json.animations.at(-1).samplers[0].interpolation = 'LINEAR';
      assert.equal(
        (
          await compareSemanticExports(
            duplicated,
            encodeGLB(changedDuplicate.json, changedDuplicate.binary)
          )
        ).domains.motion,
        false
      );
    });
    await test('bounded PNG image pixels compare independently of metadata and reject corrupted images', async () => {
      const chunk = (tag, data) => {
        const bytes = Buffer.alloc(data.length + 12);
        bytes.writeUInt32BE(data.length);
        bytes.write(tag, 4);
        data.copy(bytes, 8);
        bytes.writeUInt32BE(crc32(bytes.subarray(4, 8 + data.length)), 8 + data.length);
        return bytes;
      };
      const png = (red, note) => {
        const header = Buffer.alloc(13);
        header.writeUInt32BE(1);
        header.writeUInt32BE(1, 4);
        header[8] = 8;
        header[9] = 6;
        return Buffer.concat([
          Buffer.from('89504e470d0a1a0a', 'hex'),
          chunk('IHDR', header),
          chunk('tEXt', Buffer.from(note)),
          chunk('IDAT', deflateSync(Buffer.from([0, red, 0, 0, 255]))),
          chunk('IEND', Buffer.alloc(0)),
        ]);
      };
      const withImage = (image) => {
        const a = parseGLB(Buffer.from(original));
        // Replace one packed image without invalidating the current textured
        // character's other material/texture references.
        a.json.images[0] = { ...a.json.images[0], mimeType: 'image/png',
          bufferView: a.json.bufferViews.length };
        a.json.bufferViews.push({
          buffer: 0,
          byteOffset: a.binary.length,
          byteLength: image.length,
        });
        return encodeGLB(a.json, Buffer.concat([a.binary, image]));
      };
      const a = withImage(png(255, 'first')),
        b = withImage(png(255, 'second'));
      await inspectCharacter(a);
      await inspectCharacter(b);
      assert.equal((await compareSemanticExports(a, b)).equal, true);
      assert.equal((await compareSemanticExports(a, b)).byteIdentical, false);
      assert.equal(
        (await compareSemanticExports(a, withImage(png(32, 'first')))).domains.images,
        false
      );
      const corrupt = png(255, 'first');
      corrupt[corrupt.length - 1] ^= 1;
      await assert.rejects(() => inspectCharacter(withImage(corrupt)), /PNG checksum/);
      const oversized = png(255, 'first');
      oversized.writeUInt32BE(BUDGET.maxImageDimension + 1, 16);
      await assert.rejects(() => inspectCharacter(withImage(oversized)), /dimensions/);
    });
    return;
  }
  const filename = process.argv[2],
    idx = process.argv.indexOf('--baseline');
  console.log(
    JSON.stringify(
      await inspectCharacter(filename, { baseline: idx < 0 ? undefined : process.argv[idx + 1] }),
      null,
      2
    )
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
