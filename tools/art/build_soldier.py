"""Bounded offline authoring. Keep inherited rig/actions; replace render topology only."""
import argparse
import json
import math
import os
import sys
import bpy
import numpy as np
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
CACHE = os.path.join(ROOT, '.cache', 'art')
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
    m['baseAppearance'] = json.dumps({'color': list(color), 'roughness': 0.8})
    return m

def paint(m, domain, color):
    """Original editable UV images, with broad strokes and sparse internal marks."""
    size = 512
    y, x = np.mgrid[0:size, 0:size] / size
    strokes = np.sin(x * 21 + np.sin(y * 17) * 0.8) * np.sin(y * 13)
    fine = np.sin(x * 321 + y * 23) * np.sin(y * 291)
    value = 1 + strokes * (0.10 if domain == 'skin' else 0.16) + fine * 0.012
    if domain == 'fabric':
        value += (np.sin(x * 750) * np.sin(y * 750)) * 0.04
        seams = (np.abs(np.sin(x * math.pi * 4)) < 0.018) | (np.abs(np.sin(y * math.pi * 6)) < 0.014)
        value[seams] *= 0.52
    elif domain in ['armor', 'team-accent']:
        seams = (x < 0.015) | (x > 0.985) | (y < 0.015) | (y > 0.985)
        value[seams] *= 0.3
        wear = ((x < 0.04) | (x > 0.96) | (y < 0.04) | (y > 0.96)) & (np.sin(x * 71 + y * 93) > 0.4)
        value[wear] += 0.35
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[:, :, :3] = np.clip(np.array(color)[None, None, :] * value[:, :, None], 0, 1)
    if domain == 'skin':
        # UV-aware soft neckline transition avoids a polygon-shaped skin boundary.
        blend = np.clip((y * FIT['stature'] - 1.49) / 0.075, 0, 1)
        blend = blend * blend * (3 - 2 * blend)
        pixels[:, :, :3] = pixels[:, :, :3] * blend[:, :, None] + np.array((0.188, 0.224, 0.251))[None, None, :] * (1-blend[:, :, None])
    image = bpy.data.images.new('Paint_' + domain, width=size, height=size)
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    image['originalContribution'] = 'VibeOnDuty original soft planes, brush marks and seam ink'
    tree = m.node_tree
    texture = tree.nodes.new('ShaderNodeTexImage')
    texture.name = 'Editable illustrated color'
    texture.image = image
    bsdf = tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
    tree.links.new(texture.outputs['Color'], bsdf.inputs['Base Color'])
    if domain != 'skin':
        # A genuine tangent normal image: tiny surface variation, no baked key light.
        gy, gx = np.gradient(strokes * 0.9 + fine * 0.04)
        normals = np.ones((size, size, 4), dtype=np.float32)
        normals[:, :, 0] = 0.5 - gx * 0.3
        normals[:, :, 1] = 0.5 - gy * 0.3
        normals[:, :, 2] = 1
        normal = bpy.data.images.new('Surface_' + domain, width=size, height=size)
        normal.colorspace_settings.name = 'Non-Color'
        normal.pixels.foreach_set(normals.ravel())
        normal.pack()
        nt = tree.nodes.new('ShaderNodeTexImage')
        nt.image = normal
        nm = tree.nodes.new('ShaderNodeNormalMap')
        tree.links.new(nt.outputs['Color'], nm.inputs['Color'])
        tree.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])

def projected_uv(obj):
    uv = obj.data.uv_layers.new(name='PaintUV')
    coords = [v.co for v in obj.data.vertices]
    bounds = [(min(p[i] for p in coords), max(p[i] for p in coords)) for i in range(3)]
    for face in obj.data.polygons:
        axes = sorted(sorted(range(3), key=lambda i: abs(face.normal[i]))[:2])
        for loop in face.loop_indices:
            p = coords[obj.data.loops[loop].vertex_index]
            uv.data[loop].uv = [(p[i] - bounds[i][0]) / max(0.001, bounds[i][1] - bounds[i][0]) for i in axes]

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
    skin = material('Skin', (0.58, 0.39, 0.28), 'skin')
    fabric = material('Fabric', (0.188, 0.224, 0.251), 'fabric')
    paint(skin, 'skin', (0.58, 0.39, 0.28))
    paint(fabric, 'fabric', (0.188, 0.224, 0.251))
    obj.data.materials.append(skin)
    obj.data.materials.append(fabric)
    for poly in obj.data.polygons:
        poly.use_smooth = True
        source_height = sum(verts[body_indices[i]].z for i in poly.vertices) / len(poly.vertices)
        neck_face = max(abs(verts[body_indices[i]].x) for i in poly.vertices) < 0.12
        hand_face = all(weights[i][0][0].startswith(('hand_', 'thumb_', 'index_', 'middle_', 'ring_', 'pinky_')) for i in poly.vertices)
        # Extend the skin domain below the visible neckline. Its UV color fades
        # to fabric before this boundary so a triangle's material edge cannot
        # draw an angular skin seam above the collar.
        poly.material_index = 0 if source_height > head_source.z + 0.03 or (source_height > head_source.z - 0.20 and neck_face) or hand_face else 1
    attach(obj, arm, 'HumanBody', weights)
    # Cylinder projection avoids disconnected face-color islands at the neck.
    uv = mesh.uv_layers.new(name='PaintUV')
    for loop in mesh.loops:
        p = fitted[loop.vertex_index]
        is_hand = weights[loop.vertex_index][0][0].startswith(('hand_', 'thumb_', 'index_', 'middle_', 'ring_', 'pinky_'))
        uv.data[loop.index].uv = (0.5 + math.atan2(p.x, -p.y) / math.tau, 0.92 if is_hand else p.z / FIT['stature'])
    armor = material('Armor', (0.349, 0.392, 0.353), 'armor')
    accent = material('TeamAccent', (0.714, 0.627, 0.357), 'team-accent')
    ink = material('Ink', (0.031, 0.035, 0.043), 'ink')
    paint(armor, 'armor', (0.349, 0.392, 0.353))
    paint(accent, 'team-accent', (0.714, 0.627, 0.357))
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
        projected_uv(o)
        attach(o, arm, name, [[(bone, 1)] for v in o.data.vertices])
        return o
    def surface_plate(name, front, bottom, top, bone):
        points, quads = [], []
        rows, columns = 8, 8
        torso_surface = [p for p in fitted if 0.9 < p.z < 1.6 and abs(p.x) < 0.22
                         and (p.y < 0 if front else p.y > 0)]
        for r in range(rows + 1):
            z = bottom + r / rows * (top-bottom)
            width = 0.135 * (0.82 if r == rows else 1)
            for c in range(columns + 1):
                x = -width + c / columns * width * 2
                # Fit depth to the actual body, then smooth the grid below. Raw
                # nearest-vertex depths produced ridges; a fixed-depth shell
                # instead clips or hovers when the torso's blend weights move it.
                nearby = sorted(torso_surface, key=lambda p: (p.x-x)**2 + (p.z-z)**2)[:8]
                gains = [1/max((p.x-x)**2 + (p.z-z)**2, 0.00001) for p in nearby]
                y = sum(p.y*gain for p, gain in zip(nearby, gains))/sum(gains)
                y += -0.015 if front else 0.015
                points.append((x, y, z))
        for _ in range(3):
            smooth = []
            for r in range(rows+1):
                for c in range(columns+1):
                    i = r*(columns+1)+c
                    neighbors = [points[rr*(columns+1)+cc][1]
                                 for rr,cc in [(r,c),(max(0,r-1),c),(min(rows,r+1),c),
                                               (r,max(0,c-1)),(r,min(columns,c+1))]]
                    smooth.append((points[i][0],sum(neighbors)/len(neighbors),points[i][2]))
            points = smooth
        for r in range(rows):
            for c in range(columns):
                a = r * (columns+1) + c
                quad = [a, a+1, a+columns+2, a+columns+1]
                quads.append(quad if front else list(reversed(quad)))
        data = bpy.data.meshes.new(name)
        data.from_pydata(points, [], quads)
        data.update()
        plate = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(plate)
        plate.data.materials.append(armor)
        uv = data.uv_layers.new(name='PaintUV')
        for loop in data.loops:
            index = loop.vertex_index
            uv.data[loop.index].uv = ((index % (columns+1)) / columns, (index // (columns+1)) / rows)
        solid = plate.modifiers.new('Fitted plate thickness', 'SOLIDIFY')
        solid.thickness = 0.009
        bpy.context.view_layer.objects.active = plate
        bpy.ops.object.modifier_apply(modifier=solid.name)
        # The carrier follows the fitted torso's existing blend weights. A rigid
        # single-spine assignment leaves its outer rows hovering in armed/bent
        # poses. Keep the smooth authored surface; sample only weights, not shape.
        torso = [(p, weights[i]) for i, p in enumerate(fitted)
                 if 0.9 < p.z < 1.6 and abs(p.x) < 0.22]
        plate_weights = []
        for v in plate.data.vertices:
            nearby = sorted(torso, key=lambda sample: (sample[0] - v.co).length_squared)[:4]
            combined = {}
            for p, pairs in nearby:
                gain = 1 / max((p - v.co).length_squared, 0.000001)
                for name_, weight in pairs:
                    combined[name_] = combined.get(name_, 0) + weight * gain
            strongest = sorted(combined.items(), key=lambda pair: -pair[1])[:4]
            total = sum(weight for _, weight in strongest)
            plate_weights.append([(name_, weight / total) for name_, weight in strongest])
        attach(plate, arm, name, plate_weights)
        return points
    chest_points = surface_plate('ChestPlate', True, 1.315, 1.425, 'spine_03')
    surface_plate('BackPlate', False, 1.315, 1.425, 'spine_03')
    surface_plate('LowerChestPlate', True, 1.205, 1.305, 'spine_02')
    surface_plate('LowerBackPlate', False, 1.205, 1.305, 'spine_02')
    identifier_y = min(p[1] for p in chest_points if p[2] > 1.35) - 0.008
    box('ChestIdentifier', (0.065, identifier_y, 1.385), (0.082, 0.009, 0.027), 'spine_03', accent, 0.004)
    for sign in [-1, 1]:
        box('CarrierFastener' + str(sign), (sign * 0.11, identifier_y + 0.009, 1.395), (0.016, 0.010, 0.025), 'spine_03', ink, 0.003)

    def tube(name, points, radius, bone, mat):
        vertices, faces = [], []
        for i, point in enumerate(points):
            p = Vector(point)
            tangent = Vector(points[min(i+1, len(points)-1)]) - Vector(points[max(0, i-1)])
            a = tangent.normalized().cross(Vector((0, 1, 0)))
            if a.length < 0.1:
                a = tangent.normalized().cross(Vector((1, 0, 0)))
            a.normalize()
            b = tangent.normalized().cross(a)
            for j in range(6):
                vertices.append(p + radius * (a*math.cos(j*math.tau/6) + b*math.sin(j*math.tau/6)))
            if i:
                for j in range(6):
                    q = i*6+j
                    faces.append([q, i*6+(j+1)%6, (i-1)*6+(j+1)%6, q-6])
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        data.update()
        for poly in data.polygons:
            poly.use_smooth = True
        o = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(o)
        data.materials.append(mat)
        projected_uv(o)
        attach(o, arm, name, [[(bone, 1)] for v in data.vertices])

    # A flexible raised collar covers the skin-to-suit boundary without hiding the jaw.
    collar_points = [(0.073*math.sin(t*math.tau/32), -0.006 + 0.077*math.cos(t*math.tau/32), 1.518) for t in range(33)]
    tube('RaisedFabricCollar', collar_points, 0.026, 'Head', fabric)
    for side, sign in [('l', 1), ('r', -1)]:
        box('ShoulderPlate_' + side, (sign*0.245, 0.062, 1.467), (0.128, 0.145, 0.092), 'upperarm_' + side, accent, 0.025)
        box('ForearmGuard_' + side, (sign*0.595, 0.062, 1.480), (0.185, 0.082, 0.046), 'lowerarm_' + side, armor, 0.014)
        for x in [0.54, 0.65]:
            box('ForearmStrap_' + side + str(x), (sign*x, 0.062, 1.478), (0.013, 0.091, 0.047), 'lowerarm_' + side, ink, 0.004)
        box('ShinPanel_' + side, (sign*0.089, -0.050, 0.355), (0.092, 0.035, 0.215), 'calf_' + side, armor, 0.014)
        box('KneeGuard_' + side, (sign*0.089, -0.060, 0.505), (0.105, 0.04, 0.07), 'calf_' + side, armor, 0.016)
        box('BootAnkle_' + side, (sign*0.089, 0.025, 0.140), (0.102, 0.126, 0.172), 'foot_' + side, fabric, 0.018)
        box('BootToe_' + side, (sign*0.089, -0.092, 0.054), (0.111, 0.245, 0.086), 'foot_' + side, armor, 0.022)
        box('BootSole_' + side, (sign*0.089, -0.078, 0.019), (0.116, 0.284, 0.028), 'foot_' + side, ink, 0.008)
        for n in range(4):
            box('BootLace_' + side + str(n), (sign*0.089, -0.018-n*0.019, 0.103-n*0.008), (0.060, 0.006, 0.005), 'foot_' + side, ink, 0.001)
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
    hu = hm.uv_layers.new(name='PaintUV')
    for poly in hm.polygons:
        for loop in poly.loop_indices:
            index = hm.loops[loop].vertex_index
            side = index % sides
            # Wrap only the rear seam, keeping continuous brush planes across the brow.
            hu.data[loop].uv = (side / sides, (index // sides) / rings)
    for poly in hm.polygons:
        poly.use_smooth = True
    attach(ho, arm, 'OpenHelmet', [[('Head', 1)] for p in helmet_points])
    tube('HelmetRim', helmet_points[-sides:] + [helmet_points[-sides]], 0.004, 'Head', ink)
    for sign in [-1, 1]:
        box('HelmetSidePanel' + str(sign), (sign*0.100, -0.025, 1.705), (0.016, 0.085, 0.042), 'Head', accent, 0.008)
        box('HelmetRail' + str(sign), (sign*0.102, 0.004, 1.675), (0.014, 0.071, 0.014), 'Head', ink, 0.003)
        tube('HelmetStrap' + str(sign), [(sign*0.087, -0.025, 1.670), (sign*0.067, -0.062, 1.585), (sign*0.034, -0.083, 1.565)], 0.005, 'Head', fabric)
    box('HelmetBrowMount', (0, -0.155, 1.727), (0.032, 0.014, 0.025), 'Head', ink, 0.004)
    for side in ['l', 'r']:
        center = head_target + (landmark(f'joint-{side}-eye') - head_source) * head_scale
        tube('BrowInk_' + side, [center + Vector((x, -0.004, 0.018 + 0.003*math.cos(x*90))) for x in [-0.013, -0.006, 0, 0.006, 0.013]], 0.0018, 'Head', ink)
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
