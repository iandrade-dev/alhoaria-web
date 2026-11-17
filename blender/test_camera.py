import bpy
import mathutils

def test_camera_direction():
    cam = bpy.data.objects.get("HeroCamera")
    target = bpy.data.objects.get("CameraTarget")
    if not cam:
        print("HeroCamera not found")
        return
    
    # Direction camera is looking (in world coordinates, camera looks down -Z)
    cam_mat = cam.matrix_world
    view_dir = cam_mat.to_3x3() @ mathutils.Vector((0, 0, -1))
    view_dir.normalize()
    
    cam_pos = cam.location
    to_target = (mathutils.Vector((0.005, 0.0, 0.038)) - cam_pos).normalized()
    dot = view_dir.dot(to_target)
    print(f"Camera position: {cam_pos}")
    print(f"Camera view direction: {view_dir}")
    print(f"Vector to target: {to_target}")
    print(f"Alignment dot product: {dot:.4f} (1.0 is perfectly facing target, -1.0 is facing backwards)")

test_camera_direction()
