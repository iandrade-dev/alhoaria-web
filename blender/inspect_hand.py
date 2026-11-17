import bpy

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

bpy.ops.import_scene.gltf(filepath='public/assets/models/alhoaria-mao-chef.glb')

print("=== CHEF HAND OBJECTS AND MATERIALS ===")
for obj in bpy.context.scene.objects:
    print(f"Object: {obj.name} | Type: {obj.type} | Loc: {obj.location} | Scale: {obj.scale} | Rot: {obj.rotation_euler}")
    if obj.type == 'MESH':
        print(f"  Verts: {len(obj.data.vertices)} | Mats: {[m.name for m in obj.data.materials if m]}")
        for m in obj.data.materials:
            if m and m.use_nodes:
                bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                if bsdf:
                    print(f"  Mat {m.name} -> Base Color: {list(bsdf.inputs['Base Color'].default_value)}")
