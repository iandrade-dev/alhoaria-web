import bpy
import mathutils
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, ".."))
hand_glb = os.path.join(project_root, "public", "assets", "models", "alhoaria-mao-chef.glb")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

bpy.ops.import_scene.gltf(filepath=hand_glb)

for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
        print(f"Object {obj.name}:")
        print(f"  Dimensions: {obj.dimensions}")
        print(f"  Center: {sum(bbox, mathutils.Vector()) / 8}")
        print(f"  Min: {mathutils.Vector((min(v.x for v in bbox), min(v.y for v in bbox), min(v.z for v in bbox)))}")
        print(f"  Max: {mathutils.Vector((max(v.x for v in bbox), max(v.y for v in bbox), max(v.z for v in bbox)))}")
