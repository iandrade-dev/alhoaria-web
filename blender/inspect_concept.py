import bpy
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, ".."))
concept_path = os.path.join(project_root, "public", "assets", "concepts", "alhoaria_pao_de_alho_3d_stylized.jpg")

img = bpy.data.images.load(concept_path)
print(f"Concept loaded: {img.size[0]}x{img.size[1]}, channels={img.channels}")

# Let's inspect brightness across quadrants
w, h = img.size[0], img.size[1]
def get_avg_region(x0, y0, x1, y1):
    total_r, total_g, total_b, count = 0, 0, 0, 0
    step = 4
    for y in range(y0, y1, step):
        for x in range(x0, x1, step):
            idx = (y * w + x) * 4
            total_r += img.pixels[idx]
            total_g += img.pixels[idx+1]
            total_b += img.pixels[idx+2]
            count += 1
    return total_r/count, total_g/count, total_b/count

print("Overall image color:", get_avg_region(0, 0, w, h))
print("Center (Sandwich):", get_avg_region(int(w*0.3), int(h*0.3), int(w*0.7), int(h*0.7)))
print("Top-Right (Chef/Torch):", get_avg_region(int(w*0.65), int(h*0.5), w, h))
print("Bottom (Board/Table):", get_avg_region(0, 0, w, int(h*0.3)))
print("Top-Left (Background Bokeh):", get_avg_region(0, int(h*0.6), int(w*0.4), h))
