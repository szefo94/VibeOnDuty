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
p.add_argument('--mode', choices=['author', 'export', 'edit', 'correct-crouch', 'script-fixture', 'invalid-fixture'], required=True)
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

def smooth(t):
    t = min(1, max(0, t))
    return t * t * (3 - 2 * t)

def keyed_path(t, keys):
    for (ta, a), (tb, b) in zip(keys, keys[1:]):
        if t <= tb:
            return Vector(a).lerp(Vector(b), smooth((t - ta) / (tb - ta)))
    return Vector(keys[-1][1])

def world_hinge(arm, name, axis, angle):
    pb = arm.pose.bones['donor_' + name]
    # Author in world space on the donor's distinct roll convention. Never use
    # an inherited action as a pose/curve input.
    local_axis = rest_world(arm, pb.name).to_quaternion().inverted() @ Vector(axis)
    pb.rotation_quaternion = Quaternion(local_axis, angle)

def compose_world_hinge(arm, name, axis, angle):
    """Add a world-plane stride to the existing crouch joint, including its parent pose."""
    bpy.context.view_layer.update()
    pb = arm.pose.bones['donor_' + name]
    local_axis = pose_world(arm, pb).to_quaternion().inverted() @ Vector(axis)
    pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion(local_axis, angle)

def place_arm(arm, side, hand_target):
    upper = arm.pose.bones['donor_upperarm_' + side]
    lower = arm.pose.bones['donor_lowerarm_' + side]
    hand = arm.pose.bones['donor_hand_' + side]
    bpy.context.view_layer.update()
    shoulder = pose_world(arm, upper).translation
    target = Vector(hand_target)
    l1 = (rest_world(arm, lower.name).translation - rest_world(arm, upper.name).translation).length
    l2 = (rest_world(arm, hand.name).translation - rest_world(arm, lower.name).translation).length
    direction = target - shoulder
    distance = min(l1 + l2 - .005, max(.1, direction.length))
    direction.normalize()
    along = (l1*l1 - l2*l2 + distance*distance) / (2*distance)
    height = math.sqrt(max(0, l1*l1 - along*along))
    pole = Vector((.35 if side == 'l' else -.35, .2, -1))
    pole = (pole - direction * pole.dot(direction)).normalized()
    elbow = shoulder + direction * along + pole * height
    target = shoulder + direction * distance
    for pb, next_pb, start, end in [(upper, lower, shoulder, elbow), (lower, hand, elbow, target)]:
        rest = rest_world(arm, pb.name)
        rest_direction = rest_world(arm, next_pb.name).translation - rest.translation
        swing = rest_direction.normalized().rotation_difference((end - start).normalized())
        rotation = swing @ rest.to_quaternion()
        pb.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(pose_world(arm, pb).translation) @ rotation.to_matrix().to_4x4())
        pb.location = (0, 0, 0)
        bpy.context.view_layer.update()
    # Mount basis is +Y forward/+Z up. Contact positions are Blender metres.
    forward = Vector((0, -1, 0))
    up = Vector((0, 0, 1))
    right = forward.cross(up)
    basis = Matrix((right, forward, up)).transposed().to_4x4()
    hand.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(pose_world(arm, hand).translation) @ basis)
    hand.location = (0, 0, 0)
    bpy.context.view_layer.update()

def original_pose(donor, spec, t):
    kind = spec['kind']
    phase = 2 * math.pi * t
    contacts = spec['contactTargets']
    grip, support = Vector(contacts['grip']), Vector(contacts['support'])
    lower_body = kind in ['walk', 'run', 'crouch', 'sprint', 'supersprint']
    for side, shift in [('l', 0), ('r', math.pi)]:
        stride = math.sin(phase + shift)
        amplitude = .48 if kind in ['run', 'sprint', 'supersprint'] else .30
        if lower_body:
            axis = (0, 1, 0) if spec['direction'] in ['left', 'right'] else (1, 0, 0)
            sign = -1 if spec['direction'] in ['back', 'right'] else 1
            world_hinge(donor, 'thigh_'+side, axis, sign * amplitude * stride)
            world_hinge(donor, 'calf_'+side, (1,0,0), -.55 * max(0, -stride))
            world_hinge(donor, 'foot_'+side, (1,0,0), .14 * stride)
            world_hinge(donor, 'ball_'+side, (1,0,0), -.16 * max(0, stride))
        if kind.startswith('crouch'):
            direction = spec['direction']
            sagittal = .13*stride if lower_body and direction=='forward' else -.13*stride if lower_body and direction=='back' else 0
            world_hinge(donor, 'thigh_'+side, (1,0,0), .72 + sagittal)
            world_hinge(donor, 'calf_'+side, (1,0,0), -1.35)
            world_hinge(donor, 'foot_'+side, (1,0,0), .63)
            if lower_body and direction in ['left', 'right']:
                lateral = .13*stride * (1 if direction=='left' else -1)
                compose_world_hinge(donor, 'thigh_'+side, (0,1,0), lateral)
                # Counter-roll at the ankle keeps the crouch contact sole level.
                compose_world_hinge(donor, 'foot_'+side, (0,1,0), -lateral)
            if lower_body and direction=='back':
                world_hinge(donor, 'ball_'+side, (1,0,0), -.16 * max(0, -stride))
        if kind.startswith('jump'):
            compress = math.sin(math.pi*t) if kind != 'jump_loop' else .55+.03*math.sin(phase)
            world_hinge(donor, 'thigh_'+side, (1,0,0), .4 * compress)
            world_hinge(donor, 'calf_'+side, (1,0,0), -.65 * compress)
            world_hinge(donor, 'foot_'+side, (1,0,0), .25 * compress)
        if kind in ['stop','reversal','turn']:
            plant = math.sin(math.pi*t)
            world_hinge(donor, 'thigh_'+side, (1,0,0), (.2 if side=='l' else -.2)*plant)
            world_hinge(donor, 'calf_'+side, (1,0,0), -.22*plant)
            if kind=='turn':
                world_hinge(donor, 'foot_'+side, (0,0,1), (.35 if spec['direction']=='left' else -.35)*plant)
        if kind=='death' or kind.startswith(('slide','dive','prone')):
            amount = smooth(t/.82) if kind=='death' or kind.endswith('entry') else 1-smooth(t) if kind.endswith('exit') else 1
            direction = spec['direction']
            axis = (0,1,0) if direction in ['left','right'] else (1,0,0)
            sign = -1 if direction in ['back','right'] else 1
            world_hinge(donor,'pelvis',axis, sign*(1.45 if not kind.startswith('slide') else .45)*amount)
            world_hinge(donor,'thigh_'+side,(1,0,0),(.3 if kind=='death' else .9)*amount)
            world_hinge(donor,'calf_'+side,(1,0,0),-.8*amount)
    body_phase = smooth(t/.82) if kind=='death' or kind.endswith('entry') else 1-smooth(t) if kind.endswith('exit') else math.sin(math.pi*t) if kind.startswith('jump') else 1
    if spec['bodyDrop']:
        pelvis = donor.pose.bones['donor_pelvis']
        # Vertical root-relative compression only, converted to the bone rest basis.
        parent_rest = donor.matrix_world @ pelvis.bone.matrix_local
        pelvis.location = parent_rest.to_quaternion().inverted() @ Vector((0,0,-spec['bodyDrop']*body_phase))
    torso = .012 * math.sin(phase) if spec['loop'] else .025*math.sin(math.pi*t)
    if kind=='death': torso = 0
    if kind=='damage': torso = .07*math.sin(math.pi*t)**2
    if kind=='turn': torso = (.20 if spec['direction']=='left' else -.20)*math.sin(math.pi*t)
    world_hinge(donor,'spine_02',(0,0,1),torso)
    world_hinge(donor,'spine_03',(1,0,0),.008*math.sin(phase) if spec['loop'] else 0)
    if kind=='ads':
        grip.z += .045
        support.z += .045
    if kind in ['sprint','supersprint','sprint_reload']:
        grip.z -= .13
        support.z -= .13
    if kind=='supersprint':
        support = Vector((.23,.04,1.08)) + Vector((0,.08*math.sin(phase),0))
        grip = Vector((-.16,-.18,1.16))
    if kind in ['reload','sprint_reload']:
        support = keyed_path(t, [(0,support),(.12,support),(.22,contacts['remove']),(.4,contacts['remove']),
            (.56,contacts['insert']),(.66,contacts['insert']),(.76,contacts['charge']),(.9,support),(1,support)])
        if spec['weapon']=='awp' and .65<=t<=.9:
            grip = keyed_path(t,[(.65,grip),(.76,contacts['charge']),(.83,[-.14,-.23,1.42]),(.9,grip)])
    if kind=='fire':
        kick = math.sin(math.pi*min(1,t/.25)) if t<=.25 else 0
        grip.y += .018*kick
        support.y += .018*kick
        if spec['weapon']=='awp':
            grip = keyed_path(t,[(0,grip),(.25,grip),(.42,contacts['charge']),(.65,[-.16,-.2,1.42]),(.8,grip),(1,grip)])
    if kind=='throw':
        grip = keyed_path(t,[(0,grip),(.25,[-.2,.07,1.63]),(.45,[-.1,-.45,1.63]),(.65,[-.1,-.5,1.36]),(1,grip)])
        support = Vector((.18,-.12,1.15))
    if kind=='melee':
        hand = 'l' if spec['id'].endswith('jab') else 'r'
        target = keyed_path(t,[(0,support if hand=='l' else grip),(.3,[.12 if hand=='l' else -.12,-.2,1.45]),(.5,[0,-.58,1.43]),(1,support if hand=='l' else grip)])
        if hand=='l': support=target
        else: grip=target
    if spec['bodyDrop']:
        offset = spec['bodyDrop']*body_phase
        grip.z -= offset
        support.z -= offset
        if kind=='death':
            grip.y += .18*smooth(t/.82)
            support.y += .14*smooth(t/.82)
    # Secure poses with anatomical two-segment reach, rather than whole-gun rotation.
    place_arm(donor,'r',grip)
    place_arm(donor,'l',support)

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
            if 'kind' in spec:
                for pb in donor.pose.bones:
                    pb.rotation_quaternion = (1, 0, 0, 0)
                    pb.location = (0, 0, 0)
                original_pose(donor, spec, (frame-start)/(end-start))
            for name, target_name in spec['boneMap'].items():
                if 'kind' in spec:
                    donor.pose.bones[name].keyframe_insert('rotation_quaternion', frame=frame, group=name)
                    if target_name=='pelvis' and spec['bodyDrop']:
                        donor.pose.bones[name].keyframe_insert('location', frame=frame, group=name)
                    continue
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
    bpy.context.scene.render.fps = manifest['actions'][0]['fps']
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
    # Retargeting needs bone matrices, never repeatedly deformed render meshes.
    # Restore the same modifiers before export; the semantic merge still sources
    # every protected mesh/material/image byte from the accepted baseline.
    deferred_skin = [m for o in bpy.data.objects if o.type=='MESH'
        for m in o.modifiers if m.type=='ARMATURE' and m.show_viewport]
    for modifier in deferred_skin:
        modifier.show_viewport = False
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
            # Resolve the parent-first pose matrices in memory. Updating the
            # Blender dependency graph once per bone repeatedly deforms/evaluates
            # a whole character; the same basis equation needs only one donor
            # frame evaluation and the already resolved parent matrix.
            resolved = {}
            def parent_pose(bone):
                if bone.name in resolved:
                    return resolved[bone.name]
                if bone.parent:
                    relative = bone.parent.matrix_local.inverted() @ bone.matrix_local
                    value = parent_pose(bone.parent) @ relative
                else:
                    value = bone.matrix_local.copy()
                resolved[bone.name] = value
                return value
            for source_name, target_name in pairs:
                source_pb, pb = donor.pose.bones[source_name], target.pose.bones[target_name]
                delta = pose_world(donor, source_pb) @ rest_world(donor, source_name).inverted()
                desired = delta @ rest_world(target, target_name)
                base = parent_pose(pb.bone)
                desired_arm = target.matrix_world.inverted() @ desired
                pb.rotation_quaternion = base.to_quaternion().inverted() @ desired_arm.to_quaternion()
                pb.location = (0, 0, 0)
                if target_name == 'pelvis' and spec.get('bodyDrop', 0):
                    delta_location = pose_world(donor, source_pb).translation - rest_world(donor, source_name).translation
                    pb.location = rest_world(target, target_name).to_quaternion().inverted() @ delta_location
                pb.scale = (1, 1, 1)
                q = pb.rotation_quaternion
                if target_name in previous and q.dot(previous[target_name]) < 0:
                    q.negate()
                if not all(math.isfinite(v) for v in q):
                    raise RuntimeError('Nonfinite retarget')
                previous[target_name] = q.copy()
                resolved[target_name] = base @ Matrix.Translation(pb.location) @ q.to_matrix().to_4x4()
                pb.keyframe_insert('rotation_quaternion', frame=frame, group=target_name)
                if target_name=='pelvis' and spec.get('bodyDrop', 0):
                    pb.keyframe_insert('location', frame=frame, group=target_name)
        evidence['actions'].append({'id': spec['id'], 'donorAction': source_action.name,
            'donorSlot': source_action.slots[0].identifier, 'clip': action.name, 'frames': spec['frames'],
            'mappedBones': list(spec['boneMap'].values()), 'measuredRestDifferenceRadians': rest_angles})
    bpy.data.objects.remove(donor, do_unlink=True)
    for action in list(actions.values()):
        bpy.data.actions.remove(action)
    for modifier in deferred_skin:
        modifier.show_viewport = True
    # All selected target actions export through Blender's bundled glTF exporter.
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 31
    bpy.context.scene.render.fps = manifest['actions'][0]['fps']
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
elif args.mode == 'correct-crouch':
    # Retain the inspectable original donor and all unrelated action curves.
    # Only these three original actions are reauthored, never inherited actions.
    donor, actions = load_donor()
    corrected = []
    for spec in manifest['actions']:
        if spec['id'] not in ['crouch_back', 'crouch_left', 'crouch_right']:
            continue
        action = actions[spec['id']]
        donor.animation_data.action = action
        donor.animation_data.action_slot = action.slots[0]
        for frame in range(spec['frames'][0], spec['frames'][1] + 1):
            bpy.context.scene.frame_set(frame)
            for pb in donor.pose.bones:
                pb.rotation_mode = 'QUATERNION'
                pb.rotation_quaternion = (1, 0, 0, 0)
                pb.location = (0, 0, 0)
            original_pose(donor, spec, (frame-spec['frames'][0])/(spec['frames'][1]-spec['frames'][0]))
            for name, target_name in spec['boneMap'].items():
                donor.pose.bones[name].keyframe_insert('rotation_quaternion', frame=frame, group=name)
                if target_name=='pelvis' and spec['bodyDrop']:
                    donor.pose.bones[name].keyframe_insert('location', frame=frame, group=name)
        corrected.append(spec['id'])
    if corrected != ['crouch_back', 'crouch_left', 'crouch_right']:
        raise RuntimeError('Expected exact crouch correction actions')
    bpy.ops.wm.save_as_mainfile(filepath=args.out, check_existing=False)
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
