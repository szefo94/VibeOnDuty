"""Original editable paint atlas, exported by the pinned Blender runtime only."""
import argparse
import json
import math
import os
import sys
import bpy
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--mode', choices=['build', 'export'], required=True)
parser.add_argument('--source', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), '../..'))
CACHE = os.path.join(ROOT, '.cache', 'art')
SOURCES = os.path.join(ROOT, 'tools', 'art', 'sources')
for filename, roots in [(args.source, [CACHE, SOURCES]), (args.out, [CACHE])]:
    if not any(os.path.commonpath([os.path.realpath(filename), root]) == root for root in roots):
        raise RuntimeError('Slice path outside owned roots')
if not args.source.endswith('.blend') or not args.out.endswith('.png'):
    raise RuntimeError('Slice source/export extension rejected')

REGIONS = {'metal': [0, 0, 0.5, 0.5], 'polymer': [0.5, 0, 0.5, 0.5],
           'stoneWall': [0, 0.5, 0.5, 0.5], 'stoneFloor': [0.5, 0.5, 0.5, 0.5]}
PALETTE = {'metal': (0.29, 0.32, 0.33), 'polymer': (0.24, 0.27, 0.23),
           'stoneWall': (0.68, 0.64, 0.53), 'stoneFloor': (0.49, 0.48, 0.41)}

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.view_settings.view_transform = 'Standard'
    pixels = np.ones((1024, 1024, 4), dtype=np.float32)
    y, x = np.mgrid[0:512, 0:512] / 512
    for index, (name, region) in enumerate(REGIONS.items()):
        broad = np.sin(x * 13 + np.sin(y * 11)*1.3) * np.sin(y*17) * 0.08
        brush = np.sin(x*57 + y*19 + np.sin(y*61)) * 0.016
        variation = 1 + broad + brush
        ink = np.zeros_like(x, dtype=bool)
        if name.startswith('stone'):
            row = np.floor(y*4)
            column = np.floor(x*3 + (row % 2)*0.5)
            variation += np.sin(row*3.7 + column*8.1) * 0.055
            # Sparse masonry joints and a fine weathered fracture, no baked light direction.
            ink = (np.mod(y*4, 1) < 0.016) | (np.mod(x*3 + (row % 2)*0.5, 1) < 0.011)
            ink |= (np.abs(x - 0.34 - np.sin(y*31)*0.012) < 0.0015) & (y > 0.28) & (y < 0.67)
        else:
            ink = (x < 0.014) | (x > 0.986) | (y < 0.014) | (y > 0.986)
            ink |= (np.abs(y-0.25) < 0.004) & (x > 0.15) & (x < 0.85)
            if name == 'polymer':
                variation += np.sin(x*330)*np.sin(y*290)*0.018
        patch = np.ones((512, 512, 4), dtype=np.float32)
        patch[:, :, :3] = np.array(PALETTE[name])[None, None, :] * variation[:, :, None]
        patch[ink, :3] *= 0.50 if name.startswith('stone') else 0.30
        wear = ((x < 0.04) | (x > 0.96) | (y < 0.04) | (y > 0.96)) & (np.sin(x*83+y*71) > 0.6) & ~ink
        patch[wear, :3] = patch[wear, :3] * 0.7 + np.array((0.67, 0.65, 0.55)) * 0.3
        ox, oy = int(region[0]*1024), int(region[1]*1024)
        pixels[oy:oy+512, ox:ox+512] = np.clip(patch, 0, 1)
        # Retained per-domain paint layers are the editable source for future operations.
        layer = bpy.data.images.new('Editable_' + name, width=512, height=512)
        layer.pixels.foreach_set(patch.ravel())
        layer.pack()
        layer.use_fake_user = True
        mat = bpy.data.materials.new('Illustration_' + name)
        mat.use_nodes = True
        image_node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        image_node.image = layer
        mat.node_tree.links.new(image_node.outputs['Color'], mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = 0.82
        mat['artDomain'] = 'stone' if name.startswith('stone') else 'weapon'
        # Editable swatch geometry, not a replacement runtime map or weapon.
        bpy.ops.mesh.primitive_plane_add(size=1, location=((index % 2)*1.2, (index // 2)*1.2, 0))
        bpy.context.object.name = name + '_paint_swatch'
        bpy.context.object.data.materials.append(mat)
    image = bpy.data.images.new('ComicSliceAtlas', width=1024, height=1024)
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    image.use_fake_user = True
    bpy.context.scene['atlasRegions'] = json.dumps(REGIONS, sort_keys=True)
    bpy.context.scene['originalContribution'] = 'VibeOnDuty original illustrated metal, polymer and masonry planes/seams/wear; no inherited weapon FBX'
    bpy.ops.wm.save_as_mainfile(filepath=args.source)

if args.mode == 'build':
    build()
else:
    bpy.ops.wm.open_mainfile(filepath=args.source)
image = bpy.data.images.get('ComicSliceAtlas')
if not image or tuple(image.size) != (1024, 1024) or not image.packed_file:
    raise RuntimeError('Missing bounded packed editable atlas')
values = np.asarray(image.pixels[:], dtype=np.float32)
if values.reshape(-1, 4)[:, :3].std() < 0.02:
    raise RuntimeError('Uniform illustration rejected')
image.filepath_raw = args.out
image.file_format = 'PNG'
image.save()
print(json.dumps({'source': args.source, 'out': args.out, 'dimensions': list(image.size), 'colorSpace': image.colorspace_settings.name, 'regions': REGIONS}))
