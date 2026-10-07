import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { exportSource, CACHE, ROOT, SOURCES, PIN, hash, owned, bootstrap,
  applyIteration, iterationPath, inspectArtCandidate, approvedArtMotion } from './pipeline.mjs';
import { inspectCharacter, compareSemanticExports, parseGLB, accessor } from './inspect-character.mjs';

function assertNumbersEqual(a, b, description) {
  assert.equal(a.length, b.length, description);
  for (let i = 0; i < a.length; i++)
    assert.ok(Math.abs(a[i] - b[i]) <= 0.00001, description + ' at ' + i);
}
function panelTriangles(asset, primitive, offset) {
  const attributes = Object.fromEntries(Object.entries(primitive.attributes)
    .filter(([key]) => !['NORMAL', 'TANGENT'].includes(key))
    .map(([key, index]) => [key, accessor(asset, index)]));
  const indices = accessor(asset, primitive.indices);
  const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const corners = indices.map((vertex) => Object.keys(attributes).sort().map((key) => {
    const width = widths[asset.json.accessors[primitive.attributes[key]].type];
    assert.ok(width, 'Reviewed panel attribute: ' + key);
    return attributes[key].slice(vertex * width, (vertex + 1) * width)
      .map((value, axis) => Math.round((value - (key === 'POSITION' && axis === 1 ? offset : 0)) * 1e5));
  }).flat().join(','));
  const triangles = [];
  for (let i = 0; i < corners.length; i += 3) {
    const face = corners.slice(i, i + 3);
    // Canonical cyclic starting corner preserves winding despite exporter vertex splits.
    const cycles = [face, [face[1], face[2], face[0]], [face[2], face[0], face[1]]];
    triangles.push(cycles.map((cycle) => cycle.join('|')).sort()[0]);
  }
  return triangles.sort();
}
async function verifyEditedDomains(beforePath, changedPath, operations) {
  const before = parseGLB(await fs.readFile(beforePath));
  const changed = parseGLB(await fs.readFile(changedPath));
  const panelNames = new Set(['HelmetSidePanel-1', 'HelmetSidePanel1']);
  const editedNodes = [];
  for (const node of before.json.nodes.filter((n) => n.mesh !== undefined)) {
    const other = changed.json.nodes.find((n) => n.name === node.name);
    assert.ok(other, 'Retained render node: ' + node.name);
    assert.deepEqual(other, node, 'Retained node transform, skin and mesh association');
    const a = before.json.meshes[node.mesh], b = changed.json.meshes[other.mesh];
    assert.equal(a.primitives.length, b.primitives.length);
    for (let at = 0; at < a.primitives.length; at++) {
      const p = a.primitives[at], q = b.primitives[at];
      assert.equal(p.material, q.material); assert.equal(p.mode, q.mode);
      assert.deepEqual(Object.keys(p.attributes), Object.keys(q.attributes));
      if (panelNames.has(node.name)) {
        assert.deepEqual(panelTriangles(before, p, operations['helmet-cheek-guard-offset']),
          panelTriangles(changed, q, 0), 'Exact translated panel shape/UV/weights/winding');
        editedNodes.push(node.name);
        continue;
      }
      assert.deepEqual(accessor(before, p.indices), accessor(changed, q.indices));
      for (const key of Object.keys(p.attributes)) {
        const x = accessor(before, p.attributes[key]), y = accessor(changed, q.attributes[key]);
        assertNumbersEqual(x, y, 'Protected geometry/UV/weights: ' + node.name + '/' + key);
      }
    }
  }
  assert.deepEqual([...new Set(editedNodes)].sort(), [...panelNames].sort());
  assert.equal(before.json.meshes.length, changed.json.meshes.length);
  const imageBytes = (asset, image) => {
    const view = asset.json.bufferViews[image.bufferView];
    return asset.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  };
  const editedImages = [];
  for (const image of before.json.images) {
    const other = changed.json.images.find((i) => i.name === image.name);
    assert.ok(other);
    const equal = hash(imageBytes(before, image)) === hash(imageBytes(changed, other));
    if (image.name === 'Paint_team-accent') { assert.equal(equal, false); editedImages.push(image.name); }
    else assert.equal(equal, true, 'Protected packed paint/normal image: ' + image.name);
  }
  assert.equal(before.json.images.length, changed.json.images.length);
  for (const material of before.json.materials) {
    const other = changed.json.materials.find((m) => m.name === material.name);
    assert.ok(other);
    if (material.name === 'TeamAccent') {
      const base = JSON.parse(material.extras.baseAppearance);
      const edited = JSON.parse(other.extras.baseAppearance);
      assertNumbersEqual(base.color.map((c) => c * operations['accent-paint-gain']), edited.color,
        'Bounded accent base appearance');
      assert.equal(base.roughness, edited.roughness);
    } else assert.deepEqual(other, material, 'Protected complete material: ' + material.name);
  }
  return { editedNodes: [...new Set(editedNodes)], editedImages, protectedGeometry: true,
    protectedPaintAndMaterials: true, exactPanelOffset: operations['helmet-cheek-guard-offset'] };
}

export async function verifyIteration() {
  const reportFile = await iterationPath([CACHE], path.join(CACHE, 'iteration-report.json'));
  const record = JSON.parse(await fs.readFile(reportFile, 'utf8'));
  assert.equal(record.schemaVersion, 1);
  const directory = await iterationPath([CACHE], path.resolve(ROOT, record.directory));
  assert.equal(hash(await fs.readFile(path.join(SOURCES, 'soldier.blend'))), record.beforeInputs.source);
  assert.equal(hash(await fs.readFile(path.join(ROOT, 'tools/art/character-params.json'))), record.beforeInputs.params);
  assert.equal(hash(await fs.readFile(path.join(ROOT, 'public/models/enemy.glb'))), record.beforeInputs.published);
  assert.deepEqual(record.approvedMotion, await approvedArtMotion(), 'Current approved motion identity');
  const expectedFiles = ['baseline.blend', 'baseline.params.json', 'request.json', 'before.glb',
    'changed.blend', 'changed.blend.params.json', 'changed.blend.operation.json', 'changed.glb',
    'restored.blend', 'restored.params.json', 'restored.glb'];
  assert.deepEqual(Object.keys(record.files).sort(), expectedFiles.sort(), 'Complete executed artifact set');
  for (const name of expectedFiles) {
    const filename = await iterationPath([directory], path.join(directory, name));
    assert.equal(hash(await fs.readFile(filename)), record.files[name], 'Retained file identity: ' + name);
  }
  assert.deepEqual(Object.keys(record.scriptHashes).sort(),
    ['iterate.py', 'pipeline.mjs', 'review.mjs', 'build_soldier.py', 'inspect-character.mjs'].sort());
  for (const [name, digest] of Object.entries(record.scriptHashes)) {
    assert.equal(path.basename(name), name);
    const filename = await iterationPath([path.join(ROOT, 'tools/art')], path.join(ROOT, 'tools/art', name));
    assert.equal(hash(await fs.readFile(filename)), digest, 'Inspected script identity: ' + name);
  }
  const exe = await bootstrap();
  assert.equal(record.runtime.archiveHash, PIN.sha256);
  assert.equal(record.runtime.executableHash, hash(await fs.readFile(exe)));
  const operation = JSON.parse(await fs.readFile(path.join(directory, 'changed.blend.operation.json')));
  assert.equal(operation.runtimeVersion, record.runtime.version);
  assert.equal(operation.runtimeBuild, record.runtime.buildHash);
  assert.equal(operation.scriptHash, record.scriptHashes['iterate.py']);
  assert.equal(operation.autoexec, false);
  assert.deepEqual(operation.request, record.operations);
  assert.equal(operation.inputs.source, record.files['baseline.blend']);
  assert.equal(operation.inputs.params, record.files['baseline.params.json']);
  assert.equal(operation.inputs.request, record.files['request.json']);
  assert.equal(operation.sourceHash, record.files['changed.blend']);
  assert.equal(operation.parameterHash, record.files['changed.blend.params.json']);
  assert.equal(record.files['baseline.blend'], record.files['restored.blend']);
  assert.equal(record.files['baseline.params.json'], record.files['restored.params.json']);
  const before = path.join(directory, 'before.glb'), changed = path.join(directory, 'changed.glb');
  const edited = await compareSemanticExports(before, changed);
  assert.equal(edited.equal, false); assert.equal(edited.domains.mesh, false);
  assert.equal(edited.domains.images, false); assert.equal(edited.domains.skin, true);
  assert.equal(edited.domains.motion, true);
  const domains = await verifyEditedDomains(before, changed, record.operations.operations);
  const source = path.join(directory, 'restored.blend');
  const params = path.join(directory, 'restored.params.json');
  const verification = await fs.mkdtemp(path.join(directory, 'independent-'));
  const output = path.join(verification, 'regenerated.glb');
  // New process opens the recovered editable file and its recovered parameter file.
  await exportSource(source, output, ['--params', params]);
  await inspectArtCandidate(output);
  const regenerated = await compareSemanticExports(before, output);
  assert.equal(regenerated.semanticSchemaVersion, 2, 'Restoration includes canonical render graph');
  assert.equal(regenerated.equal, true, 'Independent restored-source semantic baseline');
  const preserved = [source, params, path.join(SOURCES, 'soldier.blend'),
    path.join(ROOT, 'tools/art/character-params.json'), path.join(ROOT, 'public/models/enemy.glb')];
  const inputHashes = await Promise.all(preserved.map(async (p) => hash(await fs.readFile(p))));
  const rejected = [];
  const request = path.join(verification, 'negative.json');
  const rejectedOut = path.join(verification, 'rejected.blend');
  const options = { source, params, request, out: rejectedOut };
  const pythonArgs = (out) => ['--background', '--factory-startup', '--disable-autoexec',
    '--python-exit-code', '1', '--python', path.join(ROOT, 'tools/art/iterate.py'), '--',
    '--source', source, '--params', params, '--request', request, '--out', out];
  const rejectBoth = async (label, requestValue, out, expectedError) => {
    await fs.writeFile(request, JSON.stringify(requestValue));
    await assert.rejects(applyIteration({ ...options, out }));
    await assert.rejects(promisify(execFile)(exe, pythonArgs(out),
      { windowsHide: true, timeout: 30000, maxBuffer: 1000000 }), (error) => {
        assert.equal(error.code, 1, 'Bounded Python rejection, not timeout/crash');
        assert.ok((error.stdout + error.stderr).includes(expectedError));
        return true;
      });
    rejected.push(label);
  };
  await rejectBoth('unknown-operation', { schemaVersion: 1, operations: { arbitrary: 1 } },
    rejectedOut, 'Unknown/nonfinite iteration operation');
  await rejectBoth('out-of-range', { schemaVersion: 1, operations: { 'accent-paint-gain': 1.31 } },
    rejectedOut, 'Iteration operation out of range');
  const valid = { schemaVersion: 1, operations: { 'accent-paint-gain': 0.8 } };
  await rejectBoth('path-escape', valid, path.join(CACHE, '../rejected.blend'), 'Iteration path escapes');
  const link = path.join(verification, 'linked');
  await fs.symlink(verification, link, process.platform === 'win32' ? 'junction' : 'dir');
  try { await rejectBoth('real-linked-output', valid, path.join(link, 'rejected.blend'), 'Linked iteration path'); }
  finally { await fs.unlink(link); }
  await assert.rejects(fs.access(rejectedOut));
  assert.deepEqual(await Promise.all(preserved.map(async (p) => hash(await fs.readFile(p)))), inputHashes,
    'All negative cases retain editable inputs and accepted publication');
  const frames = record.review.frames;
  for (const label of ['before', 'changed', 'restored']) {
    const filename = await iterationPath([directory], path.join(directory, frames[label].image));
    assert.equal(hash(await fs.readFile(filename)), frames[label].imageHash);
    assert.equal(frames[label].modelHash, record.files[label + '.glb']);
    for (const field of ['pose', 'camera', 'lights', 'viewport', 'dpr', 'exposure'])
      assert.deepEqual(frames[label][field], frames.before[field]);
  }
  assert.notEqual(frames.before.pixelHash, frames.changed.pixelHash);
  assert.equal(frames.before.pixelHash, frames.restored.pixelHash);
  const result = { schemaVersion: 1, demonstration: path.relative(ROOT, directory),
    demonstrationReportHash: hash(await fs.readFile(reportFile)),
    verifierScriptHash: hash(await fs.readFile(fileURLToPath(import.meta.url))),
    runtime: record.runtime, regeneratedOutput: path.relative(ROOT, output),
    regeneratedHash: hash(await fs.readFile(output)), regenerated, edited, domains,
    rejected, inputsUnchanged: true, matchedGameCaptures: true };
  await fs.writeFile(path.join(CACHE, 'iteration-verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

export async function verifyRepeat() {
  await fs.mkdir(CACHE, { recursive: true });
  const directory = await fs.mkdtemp(path.join(CACHE, 'repeat-'));
  owned(CACHE, directory);
  const source = path.join(SOURCES, 'soldier.blend');
  const a = path.join(directory, 'first.glb'),
    b = path.join(directory, 'second.glb');
  // Separate Blender processes both reopen the retained editable file.
  await exportSource(source, a);
  await exportSource(source, b);
  const baseline = path.join(CACHE, 'baseline.glb');
  const checks = [await inspectArtCandidate(a), await inspectArtCandidate(b)];
  const comparison = await compareSemanticExports(a, b);
  assert.equal(comparison.semanticSchemaVersion, 2, 'Repeat includes canonical render graph');
  const report = {
    source: path.relative(ROOT, source),
    sourceHash: hash(await fs.readFile(source)),
    parameterHash: hash(await fs.readFile(path.join(ROOT, 'tools/art/character-params.json'))),
    scriptHashes: Object.fromEntries(
      await Promise.all(
        ['build_soldier.py', 'pipeline.mjs', 'inspect-character.mjs', 'verify-export.mjs'].map(
          async (name) => [name, hash(await fs.readFile(path.join(ROOT, 'tools/art', name)))]
        )
      )
    ),
    runtime: { version: '4.5.13 LTS', archiveHash: PIN.sha256, buildHash: 'daeeeca98fb0' },
    outputs: [path.relative(ROOT, a), path.relative(ROOT, b)],
    checks,
    comparison,
    meaning:
      'Geometry and canonical active render graph (roots, reachability, parents, mesh/skin bindings, transforms and rendering metadata), bind hierarchy, material/image pixels and exact retained sampled motion compared independently of serializer indices. Byte identity reported only when observed.',
  };
  await fs.writeFile(path.join(CACHE, 'repeat-report.json'), JSON.stringify(report, null, 2));
  if (!comparison.equal)
    throw Error('Repeat export semantic differences: ' + comparison.differences.join(', '));
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--self-test') {
    const { test } = await import('node:test');
    const { default: assert } = await import('node:assert/strict');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    await test('independent iteration verification reopens restored source and checks changed domains', async () => {
      const result = await promisify(execFile)(process.execPath,
        [fileURLToPath(import.meta.url), '--iteration'], { maxBuffer: 4000000, windowsHide: true })
        .then(() => true, () => false);
      assert.equal(result, true, 'Independent source re-export and changed-domain checks must pass');
    });
  } else if (process.argv[2] === '--motion' && process.argv.length === 3) {
    const { verifyMotion } = await import('./motion-pipeline.mjs');
    await verifyMotion().catch((error) => { console.error(error); process.exitCode = 1; });
  } else if (process.argv[2] === '--iteration' && process.argv.length === 3) {
    verifyIteration().catch((error) => { console.error(error); process.exitCode = 1; });
  } else if (process.argv[2] !== '--repeat') {
    console.error('Expected --repeat, --iteration, --motion or --self-test');
    process.exitCode = 1;
  } else
    verifyRepeat().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
