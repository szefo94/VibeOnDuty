import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportSource, CACHE, ROOT, SOURCES, PIN, hash, owned } from './pipeline.mjs';
import { inspectCharacter, compareSemanticExports } from './inspect-character.mjs';

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
  const checks = [await inspectCharacter(a, { baseline }), await inspectCharacter(b, { baseline })];
  const comparison = await compareSemanticExports(a, b);
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
      'Geometry, bind hierarchy, material/image pixels and exact retained sampled motion compared independently of serializer metadata. Byte identity reported only when observed.',
  };
  await fs.writeFile(path.join(CACHE, 'repeat-report.json'), JSON.stringify(report, null, 2));
  if (!comparison.equal)
    throw Error('Repeat export semantic differences: ' + comparison.differences.join(', '));
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--repeat') {
    console.error('Expected --repeat');
    process.exitCode = 1;
  } else
    verifyRepeat().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
