import bpy
import mathutils
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
poly_dir = os.path.join(script_dir, "assets", "polyhaven")
board_blend = os.path.join(poly_dir, "wooden_cutting_board_1k.blend")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

with bpy.data.libraries.load(board_blend, link=False) as (data_from, data_to):
    data_to.objects = [name for name in data_from.objects if "board" in name.lower()]

board = data_to.objects[0]
bpy.context.collection.objects.link(board)

bbox = [board.matrix_world @ mathutils.Vector(corner) for corner in board.bound_box]
min_z = min(v.z for v in bbox)
max_z = max(v.z for v in bbox)
print(f"Board Location: {board.location}")
print(f"Board Z bounds: min={min_z:.4f}, max={max_z:.4f}, thickness={max_z-min_z:.4f}")
