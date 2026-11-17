import bpy

cpref = bpy.context.preferences.addons.get('cycles').preferences
cpref.compute_device_type = 'OPTIX'
for d in cpref.get_devices_for_type('OPTIX'):
    d.use = True
    print(f"Enabled device: {d.name}")
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
print("Scene configured for Cycles GPU OptiX successfully!")
