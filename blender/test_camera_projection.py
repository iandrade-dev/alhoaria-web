import bpy
import bmesh
import math
import mathutils
import os

def test_cam_projection():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # 1. Camera matching 1376x768 concept art
    scene = bpy.context.scene
    scene.render.resolution_x = 1376
    scene.render.resolution_y = 768

    cam_data = bpy.data.cameras.new("ConceptCamera")
    cam_data.lens = 50
    cam_data.sensor_width = 36.0 # standard 35mm sensor
    cam_data.sensor_height = 36.0 * (768 / 1376)
    
    cam_obj = bpy.data.objects.new("ConceptCamera", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Position camera looking at center
    cam_obj.location = (0.0, -0.42, 0.22)
    target = mathutils.Vector((0.0, 0.0, 0.03))
    
    # Track to target
    track = cam_obj.constraints.new(type='TRACK_TO')
    target_obj = bpy.data.objects.new("Target", None)
    bpy.context.collection.objects.link(target_obj)
    target_obj.location = target
    track.target = target_obj
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    bpy.context.view_layer.update()

    # Test object: plane at target
    bpy.ops.mesh.primitive_plane_add(size=0.2, location=target)
    plane = bpy.context.active_object

    # Project UVs using camera matrix
    inv_mat = cam_obj.matrix_world.inverted()
    fov_x = 2 * math.atan((cam_data.sensor_width / 2) / cam_data.lens)
    fov_y = 2 * math.atan((cam_data.sensor_height / 2) / cam_data.lens)

    bm = bmesh.new()
    bm.from_mesh(plane.data)
    uv_layer = bm.loops.layers.uv.verify()

    for face in bm.faces:
        for loop in face.loops:
            p_world = plane.matrix_world @ loop.vert.co
            p_cam = inv_mat @ p_world
            # Camera looks down -Z
            depth = -p_cam.z
            if depth > 0.001:
                u = 0.5 + 0.5 * (p_cam.x / depth) / math.tan(fov_x / 2)
                v = 0.5 + 0.5 * (p_cam.y / depth) / math.tan(fov_y / 2)
                loop[uv_layer].uv = (u, v)
                print(f"Vertex {loop.vert.co} -> UV ({u:.3f}, {v:.3f})")

    bm.to_mesh(plane.data)
    bm.free()
    print("Camera projection test SUCCESSFUL!")

test_cam_projection()
