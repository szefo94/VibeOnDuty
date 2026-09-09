"""
retarget.py — rebuild public/models/enemy.glb with every clip on one skeleton.

Why this exists
---------------
enemy.glb shipped with two clip families: 24 clips authored on the UE-mannequin rig,
and 12 Mixamo clips merged in by an earlier script that premultiplied a fixed +90 deg X
"correction" instead of retargeting. The two families end up ~180 deg apart on every
limb-root bone (thigh, upperarm, clavicle, ball), which is the root cause of the
crouch/roll/jump blending faults. Measurements: docs/ANIMATION-SPACES.md.

What it does
------------
Imports the mannequin rig from the current GLB, then for each recovered Mixamo FBX
retargets the animation onto that rig and replaces the corresponding bad action.

The retarget is the standard exact formulation, not a fitted correction. For a bone,
its animation is the world-space delta from its own rest pose:

    D_source = pose_source @ rest_source^-1

Applying that delta to the *target's* rest pose gives the equivalent pose on a rig with
different bone rolls and proportions:

    pose_target = D_source @ rest_target

Bones are processed parents-first, with a depsgraph update between each, because
setting a pose bone's world matrix depends on its parent already being posed.

Usage
-----
    blender --background --factory-startup --python tools/retarget.py -- \
        --glb public/models/enemy.glb --anims <dir of Mixamo fbx> --out public/models/enemy.glb
"""
import bpy, sys, os, math
from mathutils import Matrix, Vector

# Mixamo bone -> mannequin bone. HeadTop_End and the mannequin's `root` have no
# counterpart and are intentionally absent.
M = {
    'Hips': 'pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02', 'Spine2': 'spine_03',
    'Neck': 'neck_01', 'Head': 'Head',
    'LeftShoulder': 'clavicle_l', 'LeftArm': 'upperarm_l', 'LeftForeArm': 'lowerarm_l', 'LeftHand': 'hand_l',
    'RightShoulder': 'clavicle_r', 'RightArm': 'upperarm_r', 'RightForeArm': 'lowerarm_r', 'RightHand': 'hand_r',
    'LeftUpLeg': 'thigh_l', 'LeftLeg': 'calf_l', 'LeftFoot': 'foot_l', 'LeftToeBase': 'ball_l', 'LeftToe_End': 'ball_leaf_l',
    'RightUpLeg': 'thigh_r', 'RightLeg': 'calf_r', 'RightFoot': 'foot_r', 'RightToeBase': 'ball_r', 'RightToe_End': 'ball_leaf_r',
}
for side, s in (('Left', 'l'), ('Right', 'r')):
    for f, name in (('Thumb', 'thumb'), ('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Pinky', 'pinky')):
        for i in (1, 2, 3):
            M[f'{side}Hand{f}{i}'] = f'{name}_0{i}_{s}'
        M[f'{side}Hand{f}4'] = f'{name}_04_leaf_{s}'

# Mixamo FBX -> the action name in the GLB it replaces.
CLIPS = {
    'walking': 'walk', 'rifle run': 'run', 'rifle aiming idle': 'attack',
    'firing rifle': 'shoot', 'reloading': 'reload', 'hit reaction': 'hit',
    'rifle jump': 'jump_loop', 'toss grenade': 'nade',
    'run backwards': 'run_back', 'walking backwards': 'walk_back',
    'strafe left': 'strafe_l', 'strafe right': 'strafe_r',
}

def arg(flag, default=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default

def only_armature():
    return [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]

def rest_world(arm, bone_name):
    """Bone rest matrix in true world space.

    Must be world, not armature, space: the glTF and FBX importers apply different
    up-axis conversions, so the two rigs sit in different armature frames. A delta
    computed in armature space is then expressed in the wrong basis and comes out
    rotated ~90 deg -- the character ends up leaning back with its arms straight up.
    """
    return arm.matrix_world @ arm.data.bones[bone_name].matrix_local

def pose_world(arm, pb):
    """Pose bone matrix in true world space."""
    return arm.matrix_world @ pb.matrix

def retarget(tgt_arm, src_arm, src_action, out_name, scale):
    """Bake src_action onto tgt_arm as a new action called out_name."""
    src_arm.animation_data_create()
    src_arm.animation_data.action = src_action
    start, end = (int(x) for x in src_action.frame_range)

    tgt_arm.animation_data_create()
    act = bpy.data.actions.new(out_name)
    tgt_arm.animation_data.action = act

    # Parents first: a child's world matrix is only meaningful once its parent is posed.
    order = [b.name for b in tgt_arm.data.bones]           # Blender stores parents first
    pairs = [(s, t) for s, t in M.items() if t in tgt_arm.pose.bones]
    pairs.sort(key=lambda st: order.index(st[1]))

    for pb in tgt_arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'

    hips_rest = rest_world(src_arm, PRE + 'Hips').translation
    pelvis_rest = rest_world(tgt_arm, 'pelvis').translation

    for f in range(start, end + 1):
        bpy.context.scene.frame_set(f)
        for s_name, t_name in pairs:
            s_pb = src_arm.pose.bones.get(PRE + s_name)
            t_pb = tgt_arm.pose.bones.get(t_name)
            if not s_pb or not t_pb:
                continue
            # world-space delta from the source bone's own rest pose
            # World-space delta from the source bone's own rest pose, applied to the
            # target bone's rest pose. Exact for rigs that differ in bone roll and
            # proportion, which is the whole problem here.
            D = pose_world(src_arm, s_pb) @ rest_world(src_arm, PRE + s_name).inverted()
            desired = D @ rest_world(tgt_arm, t_name)
            _, rot, _ = desired.decompose()                 # orientation only
            here = pose_world(tgt_arm, t_pb).translation
            want_world = Matrix.Translation(here) @ rot.to_matrix().to_4x4()
            t_pb.matrix = tgt_arm.matrix_world.inverted() @ want_world
            # Setting .matrix makes Blender solve for a location offset as well. Only
            # rotation is keyframed, so any residual offset would survive as a constant
            # translation and tear the limbs apart at export. Zero it explicitly; the
            # pelvis is the one bone allowed to translate, handled below.
            t_pb.location = (0.0, 0.0, 0.0)
            bpy.context.view_layer.update()
            t_pb.keyframe_insert('rotation_quaternion', frame=f)

        # Pelvis translation carries the vertical bob and any root motion. Scale it by
        # the rig height ratio so a taller/shorter source does not lift the character.
        s_hips = src_arm.pose.bones.get(PRE + 'Hips')
        t_pelvis = tgt_arm.pose.bones.get('pelvis')
        if s_hips and t_pelvis:
            delta = (pose_world(src_arm, s_hips).translation - hips_rest) * scale
            # Strip horizontal root motion. Mixamo clips travel (a walk cycle moves the
            # character forward), but the game drives position itself and expects the
            # animation to be in place -- transferring the travel makes the character
            # slide away from its own transform. Vertical bob is kept.
            delta.x = 0.0
            delta.y = 0.0
            want = (Matrix.Translation(pelvis_rest + delta)
                    @ pose_world(tgt_arm, t_pelvis).to_quaternion().to_matrix().to_4x4())
            t_pelvis.matrix = tgt_arm.matrix_world.inverted() @ want
            bpy.context.view_layer.update()
            t_pelvis.keyframe_insert('location', frame=f)
            t_pelvis.keyframe_insert('rotation_quaternion', frame=f)
    return act

# ── main ──────────────────────────────────────────────────────────────────────
glb   = arg('--glb'); anims = arg('--anims'); out = arg('--out')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
tgt = only_armature()
print(f"[retarget] target rig: {tgt.name}, {len(tgt.data.bones)} bones, {len(bpy.data.actions)} actions")

# Height reference for translation scaling. Use the pelvis->head distance rather than a
# single axis: the mannequin's root carries a -90 deg X rotation, so "up" is not Z in
# armature space and picking an axis silently yields a negative scale.
t_head = (rest_world(tgt, 'Head').translation - rest_world(tgt, 'pelvis').translation).length or 1.0

done, failed = [], []
for fbx in sorted(os.listdir(anims)):
    if not fbx.lower().endswith('.fbx'):
        continue
    stem = os.path.splitext(fbx)[0]
    target_action = CLIPS.get(stem)
    if not target_action:
        print(f"[retarget] SKIP {stem} (no mapping)"); continue

    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(anims, fbx))
    new = [o for o in bpy.data.objects if o not in before]
    src = [o for o in new if o.type == 'ARMATURE'][0]
    PRE = 'mixamorig1:' if any(b.name.startswith('mixamorig1:') for b in src.data.bones) else 'mixamorig:'
    globals()['PRE'] = PRE

    s_head = (rest_world(src, PRE + 'Head').translation
              - rest_world(src, PRE + 'Hips').translation).length or 1.0
    scale = t_head / s_head

    src_action = src.animation_data.action
    old = bpy.data.actions.get(target_action)
    if old:
        bpy.data.actions.remove(old)
    try:
        retarget(tgt, src, src_action, target_action, scale)
        done.append(target_action)
        print(f"[retarget] OK {stem} -> {target_action} (scale {scale:.3f})")
    except Exception as e:
        failed.append((stem, str(e)))
        print(f"[retarget] FAIL {stem}: {e}")
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)

tgt.animation_data.action = None
print(f"[retarget] retargeted {len(done)}: {sorted(done)}")
if failed:
    print(f"[retarget] FAILURES: {failed}")

bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB',
    export_animations=True, export_animation_mode='ACTIONS',
    export_force_sampling=True, export_apply=False,
)
print(f"[retarget] wrote {out}")
