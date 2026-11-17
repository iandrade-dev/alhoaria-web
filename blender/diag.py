import bpy
import os

print("=== BLENDER SYSTEM DIAGNOSTICS ===")
print("Blender version:", bpy.app.version_string)
cpref = bpy.context.preferences.addons.get('cycles')
if cpref:
    print("Cycles addon found!")
    cpreferences = cpref.preferences
    print("Compute device types:", [item[0] for item in cpreferences.bl_rna.properties['compute_device_type'].enum_items])
    for dt in ['OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL']:
        try:
            cpreferences.compute_device_type = dt
            devices = cpreferences.get_devices_for_type(dt)
            print(f"Device type {dt}: {[d.name for d in devices]}")
        except Exception as e:
            pass

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, ".."))
concepts_dir = os.path.join(project_root, "public", "assets", "concepts")

print("\n=== CHECKING ASSET TEXTURES ===")
for name in ["texture_dark_wood.jpg", "texture_bread_crust.jpg", "texture_costela_meat.jpg", "texture_cheese_torch.jpg", "alhoaria_pao_de_alho_3d_stylized.jpg"]:
    p = os.path.join(concepts_dir, name)
    exists = os.path.exists(p)
    print(f"File: {name} | Exists: {exists} | Path: {p}")
    if exists:
        try:
            img = bpy.data.images.load(p)
            print(f"  -> Successfully loaded into Blender: {img.size[0]}x{img.size[1]}")
            bpy.data.images.remove(img)
        except Exception as err:
            print(f"  -> FAILED to load: {err}")
