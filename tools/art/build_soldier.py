"""Bounded offline authoring. Keep inherited rig/actions; replace render topology only."""
import argparse
import json
import math
import os
import sys
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--mode', choices=['probe', 'build', 'export'], required=True)
parser.add_argument('--baseline')
parser.add_argument('--base')
parser.add_argument('--source')
parser.add_argument('--params', default=os.path.join(os.path.dirname(__file__), 'character-params.json'))
parser.add_argument('--out', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), '../..'))
CACHE = os.path.join(ROOT, '.planning', 'research', '.cache', '06-art')
SOURCES = os.path.join(ROOT, 'tools', 'art', 'sources')
def bounded(filename, roots):
    target = os.path.realpath(filename)
    if not any(os.path.commonpath([target, root]) == root for root in roots):
        raise RuntimeError('Path outside owned art roots')
    return target
args.out = bounded(args.out, [CACHE])
if args.source:
    args.source = bounded(args.source, [CACHE, SOURCES])
if args.baseline:
    args.baseline = bounded(args.baseline, [CACHE])
if args.base:
    args.base = bounded(args.base, [CACHE, SOURCES])
args.params = bounded(args.params, [os.path.join(ROOT, 'tools', 'art'), CACHE])
with open(args.params, encoding='utf8') as f:
    parameters = json.load(f)
FIT = parameters['fit']
for value, low, high in [(FIT['stature'], 1.6, 2.0), (FIT['headTransition'], 0.03, 0.08),
    (FIT['helmet']['widthRadius'], 0.08, 0.14), (FIT['helmet']['depthRadius'], 0.09, 0.16),
    (FIT['helmet']['heightRadius'], 0.1, 0.17)]:
    if not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise RuntimeError('Authoring parameter out of bounds')

def probe():
    options = [p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties]
    data = {'version': bpy.app.version_string, 'exporterOptions': options}
    if args.baseline:
        bpy.ops.import_scene.gltf(filepath=args.baseline)
        arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
        data['bones'] = {b.name: {'head': list(arm.matrix_world @ b.head_local), 'tail': list(arm.matrix_world @ b.tail_local)} for b in arm.data.bones}
        data['actions'] = [a.name for a in bpy.data.actions]
    with open(args.out, 'w', encoding='utf8') as f:
        json.dump(data, f, indent=2)
    print(json.dumps({'version': data['version'], 'probe': args.out}))

def export():
    bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animations=False,
        export_apply=False, export_extras=True, export_def_bones=False,
        export_skins=True, export_influence_nb=4, export_all_influences=False)

def parse_base(filename):
    verts, faces, groups = [], [], {}
    group = ''
    with open(filename, encoding='utf8') as f:
        for line in f:
            fields = line.split()
            if not fields:
                continue
            if fields[0] == 'v':
                x, y, z = map(float, fields[1:4])
                verts.append(Vector((x, -z, y)) * 0.1)
            elif fields[0] == 'g':
                group = fields[1]
            elif fields[0] == 'f':
                indices = [int(v.split('/')[0]) - 1 for v in fields[1:]]
                groups.setdefault(group, set()).update(indices)
                if group == 'body':
                    faces.append(indices)
    centers = {k: sum((verts[i] for i in ids), Vector()) / len(ids) for k, ids in groups.items()}
    return verts, faces, centers

def material(name, color, domain):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 0.8
    m['artDomain'] = domain
    return m

def attach(obj, arm, name, weights):
    obj.parent = arm
    obj.matrix_parent_inverse = arm.matrix_world.inverted()
    modifier = obj.modifiers.new('Compatible skin', 'ARMATURE')
    modifier.object = arm
    groups = {b.name: obj.vertex_groups.new(name=b.name) for b in arm.data.bones}
    for index, pairs in enumerate(weights):
        for bone, weight in pairs:
            groups[bone].add([index], weight, 'REPLACE')
    obj.name = name

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.baseline)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.animation_data.action = None
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    old = [o for o in bpy.data.objects if o.type == 'MESH']
    verts, faces, centers = parse_base(args.base)
    print(json.dumps({'sourceLandmarks': {k: list(centers[k]) for k in ['joint-head', 'joint-spine-1', 'joint-spine-2', 'joint-spine-3', 'joint-spine-4', 'joint-pelvis', 'joint-l-hand', 'joint-l-hand-2', 'joint-l-hand-3', 'joint-l-eye']}}))
    def landmark(name):
        if name not in centers:
            raise RuntimeError('Missing source landmark ' + name)
        return centers[name]
    mapping = {
        'pelvis': ('joint-pelvis', 'joint-spine-4'),
        'spine_01': ('joint-spine-4', 'joint-spine-3'),
        'spine_02': ('joint-spine-3', 'joint-spine-2'),
        'spine_03': ('joint-spine-2', 'joint-spine-1'),
        'neck_01': ('joint-spine-1', 'joint-neck'),
    }
    for side in ['l', 'r']:
        mapping.update({
            'upperarm_' + side: (f'joint-{side}-shoulder', f'joint-{side}-elbow'),
            'lowerarm_' + side: (f'joint-{side}-elbow', f'joint-{side}-hand'),
            'hand_' + side: (f'joint-{side}-hand', f'joint-{side}-hand-2'),
            'thigh_' + side: (f'joint-{side}-upper-leg', f'joint-{side}-knee'),
            'calf_' + side: (f'joint-{side}-knee', f'joint-{side}-ankle'),
            'foot_' + side: (f'joint-{side}-ankle', f'joint-{side}-foot-1'),
            'ball_' + side: (f'joint-{side}-foot-1', f'joint-{side}-foot-2'),
        })
        for finger, number in [('thumb', 1), ('index', 2), ('middle', 3), ('ring', 4), ('pinky', 5)]:
            for i in range(1, 4):
                mapping[f'{finger}_0{i}_{side}'] = (f'joint-{side}-finger-{number}-{i}', f'joint-{side}-finger-{number}-{i+1}')
    segments = []
    for name, (a, b) in mapping.items():
        if name not in arm.data.bones:
            continue
        sa, sb = landmark(a), landmark(b)
        bone = arm.data.bones[name]
        ta = arm.matrix_world @ bone.head_local
        # Actual child heads give authoritative articulation, not imported display-tail estimates.
        children = [child for child in bone.children if not child.name.endswith('leaf')]
        tb = arm.matrix_world @ (children[0].head_local if children else bone.tail_local)
        if name.startswith('hand_'):
            sb = landmark(f'joint-{name[-1]}-finger-3-1')
            tb = arm.matrix_world @ arm.data.bones[f'middle_01_{name[-1]}'].head_local
        source_direction, target_direction = sb - sa, tb - ta
        rotation = source_direction.normalized().rotation_difference(target_direction.normalized())
        segments.append((name, sa, sb, ta, tb, rotation))
    head_source = landmark('joint-neck')
    head_target = arm.matrix_world @ arm.data.bones['Head'].head_local
    body_indices = sorted(set(i for f in faces for i in f))
    source_top = max(verts[i].z for i in body_indices)
    head_scale = (FIT['stature'] - head_target.z) / (source_top - head_source.z)
    head_end = head_source + Vector((0, 0, source_top - head_source.z))
    segments.append(('Head', head_source, head_end, head_target, head_target + Vector((0, 0, FIT['stature']-head_target.z)), Vector((0, 0, 1)).rotation_difference(Vector((0, 0, 1)))))
    fitted, weights = [], []
    for i in body_indices:
        p = verts[i]
        ranked = []
        for segment in segments:
            name, a, b, ta, tb, rotation = segment
            delta = b - a
            t = max(0, min(1, (p - a).dot(delta) / max(delta.length_squared, 1e-10)))
            distance = (p - (a + delta * t)).length
            ranked.append((distance, segment, t))
        ranked.sort(key=lambda item: item[0])
        candidates = ranked[:4]
        # Tight nearest-segment blending preserves fingers; broad soft blend around elbows/knees.
        exponent = 6 if candidates[0][1][0].startswith(('thumb', 'index', 'middle', 'ring', 'pinky', 'hand')) else 4
        raw = [1 / max(d, 0.008) ** exponent for d, _, _ in candidates]
        total = sum(raw)
        out = Vector()
        pairs = []
        for (distance, seg, t), weight in zip(candidates, raw):
            name, a, b, ta, tb, rotation = seg
            w = weight / total
            along = max(0, min(1, (p - a).dot(b-a) / max((b-a).length_squared, 1e-10)))
            offset = p - (a + (b-a) * along)
            if name == 'Head':
                offset *= head_scale
            out += (ta + (tb-ta) * along + rotation @ offset) * w
            pairs.append((name, w))
        # Keep face planes/ears intact. Blend only at the lower neck, where articulation belongs.
        if p.z > head_source.z - 0.06 and (abs(p.x) < 0.07 or p.z > head_source.z + 0.03):
            alpha = max(0.0, min(1.0, (p.z - (head_source.z - 0.06)) / FIT['headTransition']))
            alpha = alpha * alpha * (3 - 2 * alpha)
            out = out.lerp(head_target + (p - head_source) * head_scale, alpha)
            accumulated = {name: value * (1-alpha) for name, value in pairs}
            accumulated['Head'] = accumulated.get('Head', 0) + alpha
            pairs = sorted(accumulated.items(), key=lambda pair: -pair[1])[:4]
            total_weight = sum(value for name, value in pairs)
            pairs = [(name, value / total_weight) for name, value in pairs]
        fitted.append(out)
        weights.append(pairs)
    remap = {old: new for new, old in enumerate(body_indices)}
    mesh = bpy.data.meshes.new('Anatomical human topology')
    mesh.from_pydata(fitted, [], [[remap[i] for i in f] for f in faces])
    mesh.update()
    obj = bpy.data.objects.new('HumanBody', mesh)
    bpy.context.collection.objects.link(obj)
    obj['anatomicalFace'] = True
    obj['sourceRole'] = 'CC0 anatomical body fitted to inherited compatible skeleton'
    skin = material('Skin', (0.48, 0.29, 0.19), 'skin')
    fabric = material('Fabric', (0.075, 0.095, 0.115), 'fabric')
    obj.data.materials.append(skin)
    obj.data.materials.append(fabric)
    for poly in obj.data.polygons:
        poly.use_smooth = True
        source_height = sum(verts[body_indices[i]].z for i in poly.vertices) / len(poly.vertices)
        neck_face = max(abs(verts[body_indices[i]].x) for i in poly.vertices) < 0.07
        hand_face = all(weights[i][0][0].startswith(('hand_', 'thumb_', 'index_', 'middle_', 'ring_', 'pinky_')) for i in poly.vertices)
        poly.material_index = 0 if source_height > head_source.z + 0.03 or (source_height > head_source.z - 0.025 and neck_face) or hand_face else 1
    attach(obj, arm, 'HumanBody', weights)
    armor = material('Armor', (0.20, 0.25, 0.21), 'armor')
    accent = material('TeamAccent', (0.47, 0.39, 0.16), 'team-accent')
    def box(name, location, scale, bone, mat, bevel=0.02):
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
        o = bpy.context.object
        o.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = o.modifiers.new('Machined soft edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        # Convert geometry to world-space for matching skinned bind placement.
        for v in o.data.vertices:
            v.co = o.matrix_world @ v.co
        o.matrix_world.identity()
        o.data.materials.append(mat)
        attach(o, arm, name, [[(bone, 1)] for v in o.data.vertices])
        return o
    box('ChestPlate', (0, -0.125, 1.31), (0.34, 0.065, 0.30), 'spine_03', armor, 0.035)
    box('ChestIdentifier', (0.085, -0.161, 1.38), (0.095, 0.012, 0.035), 'spine_03', accent, 0.005)
    box('BackPlate', (0, 0.15, 1.31), (0.32, 0.065, 0.29), 'spine_03', armor)
    # Original continuous shell: high front brow opening, lower sides/back. No face visor.
    helmet_points, helmet_faces = [], []
    rings, sides = 12, 32
    for ring in range(rings + 1):
        for side in range(sides):
            phi = side * math.tau / sides
            maximum = 1.60 - 0.25 * math.cos(phi)
            theta = 0.02 + (maximum - 0.02) * ring / rings
            helmet_points.append(Vector((FIT['helmet']['widthRadius'] * math.sin(theta) * math.sin(phi),
                -0.055 - FIT['helmet']['depthRadius'] * math.sin(theta) * math.cos(phi),
                FIT['stature'] - 0.12 + FIT['helmet']['heightRadius'] * math.cos(theta))))
    for ring in range(rings):
        for side in range(sides):
            a = ring * sides + side
            b = ring * sides + (side+1) % sides
            helmet_faces.append([a+sides, b+sides, b, a])
    hm = bpy.data.meshes.new('Open fitted helmet shell')
    hm.from_pydata(helmet_points, [], helmet_faces)
    ho = bpy.data.objects.new('OpenHelmet', hm)
    bpy.context.collection.objects.link(ho)
    ho.data.materials.append(armor)
    for poly in hm.polygons:
        poly.use_smooth = True
    attach(ho, arm, 'OpenHelmet', [[('Head', 1)] for p in helmet_points])
    for side in ['l', 'r']:
        center = head_target + (landmark(f'joint-{side}-eye') - head_source) * head_scale
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.012, location=center)
        eye = bpy.context.object
        for v in eye.data.vertices:
            v.co = eye.matrix_world @ v.co
        eye.matrix_world.identity()
        eye.data.materials.append(material('EyeWhite_' + side, (0.55, 0.53, 0.46), 'skin'))
        attach(eye, arm, 'Eye_' + side, [[('Head', 1)] for v in eye.data.vertices])
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.0055, location=center + Vector((0, -0.010, 0)))
        iris = bpy.context.object
        iris.scale.y = 0.25
        for v in iris.data.vertices:
            v.co = iris.matrix_world @ v.co
        iris.matrix_world.identity()
        iris.data.materials.append(material('Iris_' + side, (0.025, 0.04, 0.025), 'skin'))
        attach(iris, arm, 'Iris_' + side, [[('Head', 1)] for v in iris.data.vertices])
    for o in old:
        bpy.data.objects.remove(o, do_unlink=True)
    arm.data.pose_position = 'POSE'
    for action in bpy.data.actions:
        action.use_fake_user = True
    bpy.context.scene['authoringParameters'] = json.dumps(parameters, sort_keys=True)
    bpy.ops.wm.save_as_mainfile(filepath=args.source)
    export()
    print(json.dumps({'source': args.source, 'bodyVertices': len(fitted), 'actions': len(bpy.data.actions), 'headScale': head_scale}))

if args.mode == 'probe':
    probe()
elif args.mode == 'export':
    bpy.ops.wm.open_mainfile(filepath=args.source)
    export()
else:
    build()
