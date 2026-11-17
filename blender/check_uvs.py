import bpy

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

bpy.ops.import_scene.gltf(filepath='public/assets/models/alhoaria-ingredientes.glb')

for name in ['stage_board', 'stage_bread', 'stage_gratin']:
    obj = bpy.data.objects.get(name)
    if obj:
        print(f"Object {name}:")
        print(f"  Dimensions: {obj.dimensions}")
        print(f"  Location: {obj.location}")
        print(f"  UV layers: {[uv.name for uv in obj.data.uv_layers]}")
