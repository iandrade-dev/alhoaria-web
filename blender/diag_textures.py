import bpy
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, ".."))
concepts_dir = os.path.join(project_root, "public", "assets", "concepts")

for name in ['texture_dark_wood.jpg', 'texture_bread_crust.jpg', 'texture_costela_meat.jpg', 'texture_cheese_torch.jpg', 'candidate_render_pass5.png']:
    p = os.path.join(concepts_dir, name)
    img = bpy.data.images.load(p)
    num_px = img.size[0] * img.size[1]
    # Sample 1000 pixels
    step = max(1, num_px // 1000)
    samples_r = [img.pixels[i*4] for i in range(0, num_px, step)]
    samples_g = [img.pixels[i*4+1] for i in range(0, num_px, step)]
    samples_b = [img.pixels[i*4+2] for i in range(0, num_px, step)]
    r_avg = sum(samples_r) / len(samples_r)
    g_avg = sum(samples_g) / len(samples_g)
    b_avg = sum(samples_b) / len(samples_b)
    print(f"{name}: Avg RGB: R={r_avg:.3f}, G={g_avg:.3f}, B={b_avg:.3f} | Size: {img.size[0]}x{img.size[1]}")
