import bpy
import os

print("=== TESTING ASSET LOADING ===")

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, ".."))
poly_dir = os.path.join(script_dir, "assets", "polyhaven")

board_blend = os.path.join(poly_dir, "wooden_cutting_board_1k.blend")
hdri_path = os.path.join(poly_dir, "warm_restaurant_night_1k.hdr")
hand_glb = os.path.join(project_root, "public", "assets", "models", "alhoaria-mao-chef.glb")

print("Board blend exists:", os.path.exists(board_blend))
print("HDRI exists:", os.path.exists(hdri_path))
print("Hand GLB exists:", os.path.exists(hand_glb))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 1. Append board from blend file
with bpy.data.libraries.load(board_blend, link=False) as (data_from, data_to):
    data_to.objects = [name for name in data_from.objects if "board" in name.lower()]

for obj in data_to.objects:
    bpy.context.collection.objects.link(obj)
    print(f"Appended object: {obj.name} | Dimensions: {obj.dimensions}")

# 2. Setup HDRI world
world = bpy.context.scene.world
world.use_nodes = True
nodes = world.node_tree.nodes
links = world.node_tree.links
nodes.clear()

env = nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(hdri_path)
bg = nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 1.0
out = nodes.new('ShaderNodeOutputWorld')
links.new(env.outputs['Color'], bg.inputs['Color'])
links.new(bg.outputs['Background'], out.inputs['Surface'])
print("HDRI World configured successfully!")

# 3. Import Hand GLB
bpy.ops.import_scene.gltf(filepath=hand_glb)
print("Hand GLB imported successfully!")
print("Scene objects count:", len(bpy.context.scene.objects))
