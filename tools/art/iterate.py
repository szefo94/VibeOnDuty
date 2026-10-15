"""LLM-authored, inspectable offline edits. No prompts, eval, imports from input or subprocesses.

Version 1 changes only the two exact helmet panels and/or the packed TeamAccent paint.
All request/path/range checks happen before opening a .blend. Inputs are never overwritten.
"""
import argparse
import hashlib
import json
import math
import os
import stat
import sys
import bpy
import numpy as np

ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), '../..'))
CACHE = os.path.join(ROOT, '.cache', 'art')
SOURCES = os.path.join(ROOT, 'tools', 'art', 'sources')
OPERATIONS = {'helmet-cheek-guard-offset': (-0.025, 0.025), 'accent-paint-gain': (0.4, 1.3)}


def bounded(filename, roots):
    target = os.path.abspath(filename)
    if not any(os.path.commonpath([target, root]) == root and target != root for root in roots):
        raise ValueError('Iteration path escapes owned root')
    current = target
    while True:
        if os.path.lexists(current):
            info = os.lstat(current)
            if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                raise ValueError('Linked iteration path')
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent
    return target


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate request key')
        result[key] = value
    return result


def digest(filename):
    with open(filename, 'rb') as stream:
        return hashlib.sha256(stream.read()).hexdigest()


parser = argparse.ArgumentParser()
for field in ['source', 'params', 'request', 'out']:
    parser.add_argument('--' + field, required=True)
arguments = sys.argv[sys.argv.index('--') + 1:]
if len(arguments) != 8 or len(set(arguments[::2])) != 4:
    raise ValueError('Exact explicit iteration arguments required')
args = parser.parse_args(arguments)
args.source = bounded(args.source, [SOURCES, CACHE])
args.params = bounded(args.params, [os.path.join(ROOT, 'tools', 'art'), CACHE])
args.request = bounded(args.request, [CACHE])
args.out = bounded(args.out, [CACHE])
if not args.source.endswith('.blend') or not args.out.endswith('.blend') or not all(
        filename.endswith('.json') for filename in [args.params, args.request]):
    raise ValueError('Iteration extensions')
for filename in [args.source, args.params, args.request]:
    if not os.path.isfile(filename) or os.path.getsize(filename) > (
            64000000 if filename.endswith('.blend') else 64000):
        raise ValueError('Iteration input bound')
outputs = [args.out, args.out + '.params.json', args.out + '.operation.json']
for filename in outputs:
    bounded(filename, [CACHE])
    if os.path.lexists(filename) or os.path.normcase(filename) in [
            os.path.normcase(p) for p in [args.source, args.params, args.request]]:
        raise ValueError('Iteration output exists or aliases input')
with open(args.request, encoding='utf8') as stream:
    request = json.load(stream, object_pairs_hook=unique_pairs)
if not isinstance(request, dict) or set(request) != {'schemaVersion', 'operations'} or (
        type(request['schemaVersion']) is not int or request['schemaVersion'] != 1):
    raise ValueError('Iteration request schema')
operations = request['operations']
if not isinstance(operations, dict) or not operations:
    raise ValueError('Empty/invalid operations')
for name, value in operations.items():
    if name not in OPERATIONS or type(value) not in [int, float] or not math.isfinite(value):
        raise ValueError('Unknown/nonfinite iteration operation')
    low, high = OPERATIONS[name]
    if not low <= value <= high:
        raise ValueError('Iteration operation out of range')
with open(args.params, encoding='utf8') as stream:
    parameters = json.load(stream, object_pairs_hook=unique_pairs)
if parameters.get('schemaVersion') != 1:
    raise ValueError('Authoring parameters schema')
before = {name: digest(getattr(args, name)) for name in ['source', 'params', 'request']}

# Explicit use_scripts=False supplements CLI --disable-autoexec; never trust embedded text.
bpy.ops.wm.open_mainfile(filepath=args.source, load_ui=False, use_scripts=False)
panels = [bpy.data.objects.get('HelmetSidePanel' + str(sign)) for sign in [-1, 1]]
accent = bpy.data.materials.get('TeamAccent')
image = bpy.data.images.get('Paint_team-accent')
if any(p is None or p.type != 'MESH' or p.library or p.data.library or
       p.data.users != 1 or len(p.data.vertices) > 5000 for p in panels):
    raise ValueError('Expected exact owned helmet panels')
if accent is None or accent.library or accent.get('artDomain') != 'team-accent' or (
        image is None or image.library or list(image.size) != [512, 512] or not image.packed_file):
    raise ValueError('Expected exact owned packed accent paint')
if 'helmet-cheek-guard-offset' in operations:
    for panel in panels:
        for vertex in panel.data.vertices:
            vertex.co.z -= operations['helmet-cheek-guard-offset']
        panel.data.update()
if 'accent-paint-gain' in operations:
    gain = operations['accent-paint-gain']
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(-1, 4)
    pixels[:, :3] = np.clip(pixels[:, :3] * gain, 0, 1)
    image.pixels.foreach_set(pixels.ravel())
    image.update()
    image.pack()
    base = json.loads(accent['baseAppearance'])
    base['color'] = [min(1, c * gain) for c in base['color']]
    accent['baseAppearance'] = json.dumps(base)
    accent.diffuse_color = (*base['color'], 1)
parameters['iteration'] = request
bpy.context.scene['authoringParameters'] = json.dumps(parameters, sort_keys=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=args.out, check_existing=False)
with open(args.out + '.params.json', 'w', encoding='utf8') as stream:
    json.dump(parameters, stream, indent=2)
for name in before:
    if digest(getattr(args, name)) != before[name]:
        raise RuntimeError('Input mutation detected')
with open(args.out + '.operation.json', 'w', encoding='utf8') as stream:
    json.dump({'schemaVersion': 1, 'request': request, 'inputs': before,
               'sourceHash': digest(args.out), 'parameterHash': digest(args.out + '.params.json'),
               'runtimeVersion': bpy.app.version_string,
               'runtimeBuild': bpy.app.build_hash.decode(),
               'scriptHash': digest(__file__), 'autoexec': False,
               'objectNames': [p.name for p in panels]}, stream, indent=2)
print(json.dumps({'editedSource': args.out, 'operations': operations, 'inputsUnchanged': True}))
