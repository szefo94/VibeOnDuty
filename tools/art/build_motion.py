"""Original keyed donor authoring and world-rest delta retarget, never inherited renaming.

Trusted local sources only. This is not a sandbox for arbitrary .blend binaries.
The exact retarget formulation is the one documented in tools/retarget.py.
"""
import argparse
import json
import math
import os
import sys
import bpy
from mathutils import Matrix, Quaternion, Vector

p = argparse.ArgumentParser()
p.add_argument('--mode', choices=['author', 'export', 'edit', 'script-fixture', 'invalid-fixture'], required=True)
p.add_argument('--source')
p.add_argument('--manifest', required=True)
p.add_argument('--baseline', required=True)
p.add_argument('--out', required=True)
p.add_argument('--gain', type=float, default=1.12)
p.add_argument('--corruption', choices=['slot', 'action', 'rig', 'unchanged'])
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), '../..'))
CACHE = os.path.join(ROOT, '.planning', 'research', '.cache', '07-motion')

def bounded(filename, roots):
    absolute = os.path.abspath(filename)
    current = absolute
    while True:
        if os.path.islink(current):
            raise RuntimeError('Linked source/output')
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent
    actual = os.path.realpath(absolute)
    if not any(os.path.commonpath([actual, r]) == r for r in roots):
        raise RuntimeError('Path outside owned motion roots')
    return actual

args.out = bounded(args.out, [CACHE])
args.manifest = bounded(args.manifest, [os.path.join(ROOT, 'tools', 'art'), CACHE])
args.baseline = bounded(args.baseline, [os.path.join(ROOT, 'public', 'models'), CACHE])
if args.source:
    args.source = bounded(args.source, [os.path.join(ROOT, 'tools', 'art', 'sources'), CACHE])
if os.path.exists(args.out):
    raise RuntimeError('Existing output')
with open(args.manifest, encoding='utf8') as f:
    manifest = json.load(f)

def rest_world(arm, name):
    return arm.matrix_world @ arm.data.bones[name].matrix_local

def pose_world(arm, pb):
    return arm.matrix_world @ pb.matrix

def target_import():
    bpy.ops.import_scene.gltf(filepath=args.baseline)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    if len(arm.data.bones) != 65:
        raise RuntimeError('Wrong target skeleton')
    return arm

def author():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    target = target_import()
    donor = target.copy()
    donor.data = target.data.copy()
    donor.animation_data_clear()
    donor.name = 'MotionDonor'
    bpy.context.collection.objects.link(donor)
    # Original action starts from a neutral rig, no copied clip, distinct roll convention.
    bpy.context.view_layer.objects.active = donor
    bpy.ops.object.mode_set(mode='EDIT')
    for b in donor.data.edit_bones:
        b.name = 'donor_' + b.name
        b.roll += 0.27
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.data.objects):
        if o != donor:
            bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    donor.animation_data_create()
    for spec in manifest['actions']:
        act = bpy.data.actions.new(spec['donorAction'])
        donor.animation_data.action = act
        for pb in donor.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
        start, end = spec['frames']
        for frame in range(start, end + 1):
            phase = 2 * math.pi * (frame - start) / (end - start)
            for name, target_name in spec['boneMap'].items():
                side = 0 if target_name.endswith('_l') else math.pi
                stride = math.sin(phase + side)
                if target_name.startswith('thigh'):
                    angle = 0.30 * stride
                elif target_name.startswith('calf'):
                    angle = -0.42 * max(0, -stride)
                elif target_name.startswith('foot'):
                    angle = 0.16 * stride
                elif target_name.startswith('ball'):
                    angle = -0.12 * max(0, stride)
                elif target_name == 'pelvis':
                    angle = 0.035 * math.sin(phase)
                else:
                    angle = 0.018 * math.sin(phase)
                pb = donor.pose.bones[name]
                # Convert authored world X hinge into this donor's distinct rest basis.
                axis = rest_world(donor, name).to_quaternion().inverted() @ Vector((1, 0, 0))
                pb.rotation_quaternion = Quaternion(axis, angle)
                pb.keyframe_insert('rotation_quaternion', frame=frame, group=name)
        if len(act.slots) != 1 or act.slots[0].identifier != spec['donorSlot']:
            raise RuntimeError('Authored slot mismatch: ' + str([s.identifier for s in act.slots]))
        act.use_fake_user = True
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation = 'LINEAR'
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 31
    bpy.context.scene.render.fps = 30
    bpy.ops.wm.save_as_mainfile(filepath=args.out, check_existing=False)

def load_donor():
    # Reopen saved source in this fresh process, with source scripts explicitly disabled.
    bpy.ops.wm.open_mainfile(filepath=args.source, use_scripts=False)
    donor = bpy.data.objects.get('MotionDonor')
    if not donor or donor.type != 'ARMATURE':
        raise RuntimeError('Missing original donor')
    if len(donor.data.bones) != manifest['targetJoints']:
        raise RuntimeError('Wrong donor skeleton')
    actions = {}
    for spec in manifest['actions']:
        action = bpy.data.actions.get(spec['donorAction'])
        if not action or len(action.slots) != 1 or action.slots[0].identifier != spec['donorSlot']:
            raise RuntimeError('Missing/duplicate action or slot')
        if action.slots[0].target_id_type != 'OBJECT':
            raise RuntimeError('Unsupported action slot target')
        if list(action.frame_range) != spec['frames']:
            raise RuntimeError('Donor frame range mismatch')
        if any(n not in donor.pose.bones for n in spec['boneMap']):
            raise RuntimeError('Unsupported donor bone')
        actions[spec['id']] = action
    if len(bpy.data.actions) != len(actions):
        raise RuntimeError('Unlisted donor actions')
    return donor, actions

def export():
    donor, actions = load_donor()
    # Import explicitly selected donor rig/actions from the reopened file using the
    # library append API into a clean target scene; slots are then assigned explicitly.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with bpy.data.libraries.load(args.source, link=False) as (available, selected):
        selected.objects = ['MotionDonor']
        selected.actions = [s['donorAction'] for s in manifest['actions']]
    donor = selected.objects[0]
    bpy.context.collection.objects.link(donor)
    actions = {s['id']: bpy.data.actions.get(s['donorAction']) for s in manifest['actions']}
    target = target_import()
    target.animation_data_clear()
    for action in list(bpy.data.actions):
        if action not in actions.values():
            bpy.data.actions.remove(action)
    evidence = {'freshProcess': True, 'reopened': True, 'libraryAppended': True,
        'autoexecDisabled': not bpy.context.preferences.filepaths.use_scripts_auto_execute,
        'sourceScripts': False, 'retarget': 'world-rest delta parents-first',
        'targetJoints': len(target.data.bones), 'actions': []}
    for spec in manifest['actions']:
        source_action = actions[spec['id']]
        rest_angles = [(rest_world(donor, s).to_quaternion().rotation_difference(
            rest_world(target, t).to_quaternion())).angle for s, t in spec['boneMap'].items()]
        if min(rest_angles) < 0.1:
            raise RuntimeError('Donor must retain its distinct rest convention')
        donor.animation_data_create()
        donor.animation_data.action = source_action
        donor.animation_data.action_slot = source_action.slots[0]
        target.animation_data_create()
        action = bpy.data.actions.new(spec['clip'])
        target.animation_data.action = action
        pairs = sorted(spec['boneMap'].items(), key=lambda pair: list(target.data.bones).index(target.data.bones[pair[1]]))
        previous = {}
        for pb in target.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        start, end = spec['frames']
        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            for source_name, target_name in pairs:
                source_pb, pb = donor.pose.bones[source_name], target.pose.bones[target_name]
                delta = pose_world(donor, source_pb) @ rest_world(donor, source_name).inverted()
                desired = delta @ rest_world(target, target_name)
                rotation = desired.to_quaternion()
                world = Matrix.Translation(pose_world(target, pb).translation) @ rotation.to_matrix().to_4x4()
                pb.matrix = target.matrix_world.inverted() @ world
                pb.location = (0, 0, 0)
                pb.scale = (1, 1, 1)
                q = pb.rotation_quaternion
                if target_name in previous and q.dot(previous[target_name]) < 0:
                    q.negate()
                if not all(math.isfinite(v) for v in q):
                    raise RuntimeError('Nonfinite retarget')
                previous[target_name] = q.copy()
                bpy.context.view_layer.update()
                pb.keyframe_insert('rotation_quaternion', frame=frame, group=target_name)
        evidence['actions'].append({'id': spec['id'], 'donorAction': source_action.name,
            'donorSlot': source_action.slots[0].identifier, 'clip': action.name, 'frames': spec['frames'],
            'mappedBones': list(spec['boneMap'].values()), 'measuredRestDifferenceRadians': rest_angles})
    bpy.data.objects.remove(donor, do_unlink=True)
    for action in list(actions.values()):
        bpy.data.actions.remove(action)
    # All selected target actions export through Blender's bundled glTF exporter.
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 31
    bpy.context.scene.render.fps = 30
    bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_animations=True,
        export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_range=False,
        export_anim_slide_to_zero=True, export_def_bones=False, export_skins=True,
        export_extras=True, export_apply=False)
    if not evidence['autoexecDisabled']:
        raise RuntimeError('Autoexec preference unexpectedly enabled')
    with open(args.out + '.evidence.json', 'w', encoding='utf8') as f:
        json.dump(evidence, f, indent=2)

if args.mode == 'author':
    author()
elif args.mode == 'export':
    export()
elif args.mode == 'edit':
    donor, actions = load_donor()
    if not math.isfinite(args.gain) or not 1.01 <= args.gain <= 1.2:
        raise RuntimeError('Keyed gain outside bounded range')
    for action in actions.values():
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        if curve.data_path == 'pose.bones["donor_thigh_l"].rotation_quaternion' and curve.array_index != 0:
                            for key in curve.keyframe_points:
                                key.co.y *= args.gain
    # Normalize keyed quaternion tuples by reevaluating each frame.
    for spec in manifest['actions']:
        donor.animation_data.action = actions[spec['id']]
        donor.animation_data.action_slot = actions[spec['id']].slots[0]
        for frame in range(spec['frames'][0], spec['frames'][1] + 1):
            bpy.context.scene.frame_set(frame)
            pb = donor.pose.bones['donor_thigh_l']
            pb.rotation_quaternion.normalize()
            pb.keyframe_insert('rotation_quaternion', frame=frame)
    bpy.ops.wm.save_as_mainfile(filepath=args.out, check_existing=False)
elif args.mode == 'script-fixture':
    bpy.ops.wm.open_mainfile(filepath=args.source, use_scripts=False)
    text = bpy.data.texts.new('motion_autoexec_sentinel.py')
    text.write('raise RuntimeError("SOURCE SCRIPT EXECUTED")')
    text.use_module = True
    bpy.ops.wm.save_as_mainfile(filepath=args.out, check_existing=False)
else:
    donor, actions = load_donor()
    action = next(iter(actions.values()))
    if args.corruption == 'slot':
        action.slots[0].identifier = 'OBWrongSlot'
    elif args.corruption == 'action':
        action.name = 'UnlistedAction'
    elif args.corruption == 'rig':
        bpy.context.view_layer.objects.active = donor
        bpy.ops.object.mode_set(mode='EDIT')
        donor.data.edit_bones.remove(donor.data.edit_bones['donor_ball_l'])
        bpy.ops.object.mode_set(mode='OBJECT')
    elif args.corruption == 'unchanged':
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.co.y = 1 if curve.array_index == 0 else 0
    else:
        raise RuntimeError('Explicit corruption required')
    bpy.ops.wm.save_as_mainfile(filepath=args.out, check_existing=False)
