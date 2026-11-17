import bpy

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

bpy.ops.import_scene.gltf(filepath='public/assets/models/alhoaria-ingredientes.glb')

print("=== MESHES IN ALHOARIA-INGREDIENTES.GLB ===")
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        print(f"Mesh: {obj.name} | Verts: {len(obj.data.vertices)} | Faces: {len(obj.data.polygons)} | Mats: {[m.name for m in obj.data.materials if m]}")
        for m in obj.data.materials:
            if m and m.use_nodes:
                bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                if bsdf:
                    bc = bsdf.inputs['Base Color'].default_value
                    print(f"  Material: {m.name} -> Base Color: {list(bc)}")
                    # Check if there are any image textures
                    tex = [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']
                    print(f"  Textures: {[t.name for t in tex]}")
