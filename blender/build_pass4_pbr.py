"""
=============================================================================
ALHOARIA — SCRIPT GOURMET DEFINITIVO PBR (PASS 4)
Aplica texturas PBR fotorrealistas de alta resolução:
- Casca de pão rústico artesanal enfarinhada (texture_bread_crust.jpg)
- Costela 6h desfiada suculenta com fibras reais (texture_costela_meat.jpg)
- Manto de queijo com manchas autênticas de maçarico (texture_cheese_torch.jpg)
- Tábua de madeira nobre escura com canaleta (texture_dark_wood.jpg)
- Câmera 3/4 travada com TRACK_TO (enquadramento hero impecável)
- Salpicos de cebolinha fresca, flor de sal e cumbuca cerâmica
- Iluminação profissional de gastropub com luz de recorte âmbar (rim light)
=============================================================================
"""

import bpy
import bmesh
import math
import random
import os

def clean_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in [bpy.data.materials, bpy.data.meshes, bpy.data.textures, bpy.data.curves, bpy.data.lights, bpy.data.cameras, bpy.data.images]:
        for item in list(block):
            block.remove(item)

def load_texture_image(filepath):
    """Carrega uma imagem de textura do disco de forma segura."""
    if os.path.exists(filepath):
        return bpy.data.images.load(filepath)
    print(f"AVISO: Arquivo de textura não encontrado: {filepath}")
    return None

def smart_uv_unwrap(obj):
    """Executa unwrapping UV inteligente no modo de edição com contexto correto."""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')

def create_board_with_pbr_wood(tex_path):
    """Cria a tábua de madeira rústica com canaleta de suco e textura PBR nobre."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.014))
    board = bpy.context.active_object
    board.name = "stage_board"
    board.dimensions = (0.42, 0.23, 0.028)
    bpy.ops.object.transform_apply(scale=True)

    bev = board.modifiers.new("Bevel", 'BEVEL')
    bev.width = 0.012
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Canaleta de suco
    bpy.ops.curve.primitive_bezier_circle_add(radius=1.0, location=(0, 0, 0.001))
    c = bpy.context.active_object
    c.scale = (0.185, 0.092, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    c.data.bevel_depth = 0.005
    c.data.bevel_resolution = 4
    bpy.ops.object.convert(target='MESH')
    cutter = bpy.context.active_object

    mod_b = board.modifiers.new("GrooveCut", 'BOOLEAN')
    mod_b.operation = 'DIFFERENCE'
    mod_b.object = cutter
    bpy.ops.object.modifier_apply(modifier="GrooveCut")
    bpy.data.objects.remove(cutter, do_unlink=True)

    # Gera UV inteligente
    smart_uv_unwrap(board)

    # Material com textura PBR de madeira escura
    mat = bpy.data.materials.new("stage_board_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.55

    img = load_texture_image(tex_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.35
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.08, 0.05, 0.03, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    board.data.materials.append(mat)
    bpy.ops.object.shade_smooth()

    # Cumbuca cerâmica com ervas na lateral direita
    bpy.ops.mesh.primitive_cylinder_add(radius=0.032, depth=0.024, location=(0.165, 0.075, 0.012))
    dish = bpy.context.active_object
    dish.name = "RusticRamekin"
    bev_d = dish.modifiers.new("Bevel", 'BEVEL')
    bev_d.width = 0.003
    bev_d.segments = 3
    bpy.ops.object.modifier_apply(modifier="Bevel")

    mat_dish = bpy.data.materials.new("Mat_Ceramica_Preta")
    mat_dish.use_nodes = True
    b_d = mat_dish.node_tree.nodes.get("Principled BSDF")
    if b_d:
        b_d.inputs['Base Color'].default_value = (0.035, 0.035, 0.035, 1.0)
        b_d.inputs['Roughness'].default_value = 0.40
    dish.data.materials.append(mat_dish)
    bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.025, location=(0.165, 0.075, 0.018))
    herbs = bpy.context.active_object
    herbs.scale = (1.0, 1.0, 0.45)
    mat_h = bpy.data.materials.new("Mat_Ervas_Cumbuca")
    mat_h.use_nodes = True
    b_h = mat_h.node_tree.nodes.get("Principled BSDF")
    if b_h:
        b_h.inputs['Base Color'].default_value = (0.12, 0.42, 0.08, 1.0)
        b_h.inputs['Roughness'].default_value = 0.35
    herbs.data.materials.append(mat_h)
    bpy.ops.object.shade_smooth()

    return board

def create_bread_with_pbr_crust(tex_path):
    """Cria a baguete rústica de pão de alho volumosa com textura PBR da casca enfarinhada."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.032))
    bread = bpy.context.active_object
    bread.name = "stage_bread"
    bread.dimensions = (0.26, 0.096, 0.065)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(bread.data)
    for v in bm.verts:
        nx = v.co.x / 0.13
        ny = v.co.y / 0.048
        nz = (v.co.z - 0.032) / 0.0325

        taper_x = max(0.25, 1.0 - (abs(nx) ** 2.2) * 0.40)
        v.co.y *= taper_x

        if abs(ny) > 0.6:
            v.co.z -= 0.008 * (abs(ny) - 0.6)

        # Fenda longitudinal para o recheio
        if v.co.z > 0.040 and abs(nx) < 0.85:
            dist_y = abs(v.co.y)
            if dist_y < 0.028:
                v.co.z -= 0.022 * (1.0 - (dist_y / 0.028) ** 2)

    bm.to_mesh(bread.data)
    bm.free()

    sub = bread.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2

    disp = bread.modifiers.new("CrustDisplace", 'DISPLACE')
    tex_crust = bpy.data.textures.new("CrustNoisePBR", 'CLOUDS')
    tex_crust.noise_scale = 0.04
    disp.texture = tex_crust
    disp.strength = 0.002
    bpy.ops.object.shade_smooth()

    # Mapeamento UV Smart
    smart_uv_unwrap(bread)

    # Material com textura PBR da casca crocante e enfarinhada
    mat = bpy.data.materials.new("stage_bread_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.75

    img = load_texture_image(tex_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.40
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.84, 0.58, 0.28, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bread.data.materials.append(mat)
    return bread

def create_costela_with_pbr_meat(tex_path):
    """Cria a montanha de costela desfiada 6h com textura PBR de carne suculenta e mechas."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.045))
    meat = bpy.context.active_object
    meat.name = "meat_mound_base"
    meat.dimensions = (0.21, 0.062, 0.032)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(meat.data)
    for v in bm.verts:
        nx = abs(v.co.x) / 0.105
        v.co.y *= max(0.35, 1.0 - (nx ** 2) * 0.55)
    bm.to_mesh(meat.data)
    bm.free()

    sub = meat.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2

    disp = meat.modifiers.new("MeatRoughness", 'DISPLACE')
    tex_m = bpy.data.textures.new("MeatDisplaceNoise", 'CLOUDS')
    tex_m.noise_scale = 0.015
    disp.texture = tex_m
    disp.strength = 0.007
    bpy.ops.object.shade_smooth()

    smart_uv_unwrap(meat)

    mat = bpy.data.materials.new("filling_costela_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.22 # Brilho suculento de colágeno e molho quente
    bsdf.inputs['Metallic'].default_value = 0.01

    img = load_texture_image(tex_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.55
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.16, 0.065, 0.035, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    meat.data.materials.append(mat)

    empty = bpy.data.objects.new("filling_costela", None)
    bpy.context.collection.objects.link(empty)
    meat.parent = empty

    # 35 mechas orgânicas adicionais
    random.seed(42)
    for i in range(35):
        cx = random.uniform(-0.09, 0.09)
        cy = random.choice([random.uniform(0.022, 0.033), random.uniform(-0.033, -0.022)])
        cz = random.uniform(0.040, 0.052)

        curve_data = bpy.data.curves.new(f"MeatFiber_{i}", type='CURVE')
        curve_data.dimensions = '3D'
        curve_data.bevel_depth = random.uniform(0.0018, 0.0035)
        curve_data.bevel_resolution = 2

        spline = curve_data.splines.new('BEZIER')
        spline.bezier_points.add(2)
        p0, p1, p2 = spline.bezier_points[0], spline.bezier_points[1], spline.bezier_points[2]

        sl = random.uniform(0.025, 0.045)
        p0.co = (cx - sl*0.5, cy, cz)
        p1.co = (cx, cy + random.uniform(-0.005, 0.005), cz + 0.004)
        p2.co = (cx + sl*0.5, cy, cz - 0.006)

        for p in (p0, p1, p2):
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'

        fiber_obj = bpy.data.objects.new(f"filling_costela_portion_{i:02d}", curve_data)
        bpy.context.collection.objects.link(fiber_obj)
        fiber_obj.parent = empty
        fiber_obj.data.materials.append(mat)

    return empty, meat

def create_cheese_with_pbr_torch(tex_path, meat_target):
    """Cria o manto de queijo fundido drapeado com textura PBR de manchas de maçarico autênticas."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=36, y_subdivisions=20, size=1.0, location=(0, 0, 0.068))
    cheese = bpy.context.active_object
    cheese.name = "stage_gratin"
    cheese.dimensions = (0.22, 0.075, 1.0)
    cheese.scale.z = 1.0
    bpy.ops.object.transform_apply(scale=True)

    sw = cheese.modifiers.new("DrapeShrinkwrap", 'SHRINKWRAP')
    sw.target = meat_target
    sw.wrap_method = 'NEAREST_SURFACETEXTURE' if 'NEAREST_SURFACETEXTURE' in [e.identifier for e in sw.bl_rna.properties['wrap_method'].enum_items] else 'NEAREST_SURFACEPOINT'
    sw.offset = 0.005
    bpy.ops.object.modifier_apply(modifier="DrapeShrinkwrap")

    sol = cheese.modifiers.new("CheeseSolidify", 'SOLIDIFY')
    sol.thickness = 0.0045
    bpy.ops.object.modifier_apply(modifier="CheeseSolidify")

    sub = cheese.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    bpy.ops.object.shade_smooth()

    smart_uv_unwrap(cheese)

    mat = bpy.data.materials.new("stage_gratin_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.24
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.35

    img = load_texture_image(tex_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.35
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.95, 0.88, 0.65, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    cheese.data.materials.append(mat)
    return cheese

def create_garnishes():
    """Salpica cebolinha verde fresca e flor de sal."""
    mat_c = bpy.data.materials.new("Mat_Cebolinha_Verde")
    mat_c.use_nodes = True
    b_c = mat_c.node_tree.nodes.get("Principled BSDF")
    if b_c:
        b_c.inputs['Base Color'].default_value = (0.10, 0.44, 0.06, 1.0)
        b_c.inputs['Roughness'].default_value = 0.32

    mat_s = bpy.data.materials.new("Mat_Flor_De_Sal")
    mat_s.use_nodes = True
    b_s = mat_s.node_tree.nodes.get("Principled BSDF")
    if b_s:
        b_s.inputs['Base Color'].default_value = (0.98, 0.98, 0.99, 1.0)
        b_s.inputs['Roughness'].default_value = 0.12
        if 'Transmission Weight' in b_s.inputs:
            b_s.inputs['Transmission Weight'].default_value = 0.70

    random.seed(99)
    for i in range(35):
        if i < 22:
            x = random.uniform(-0.085, 0.085)
            y = random.uniform(-0.022, 0.022)
            z = 0.064 + random.uniform(0.001, 0.004)
        else:
            x = random.uniform(-0.16, 0.14)
            y = random.choice([random.uniform(0.045, 0.075), random.uniform(-0.075, -0.045)])
            z = 0.002

        bpy.ops.mesh.primitive_cylinder_add(radius=0.0024, depth=0.0014, vertices=8, location=(x, y, z))
        c = bpy.context.active_object
        c.rotation_euler = (random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), random.uniform(0, math.pi))
        c.data.materials.append(mat_c)
        bpy.ops.object.shade_smooth()

    for i in range(20):
        x = random.uniform(-0.15, 0.15)
        y = random.uniform(-0.08, 0.08)
        z = 0.002
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.0016, subdivisions=1, location=(x, y, z))
        s = bpy.context.active_object
        s.rotation_euler = (random.uniform(0, 2), random.uniform(0, 2), random.uniform(0, 2))
        s.data.materials.append(mat_s)

def setup_hero_camera_and_lighting(render_path):
    """Configura a câmera com TRACK_TO (sem distorções de ângulo) e iluminação de gastropub."""
    # 1. Target no centro do sanduíche
    target = bpy.data.objects.new("CameraTarget", None)
    bpy.context.collection.objects.link(target)
    target.location = (0, 0, 0.045)

    # 2. Câmera Hero 3/4 perfeitamente nivelada
    bpy.ops.object.camera_add(location=(0.08, -0.42, 0.28))
    cam = bpy.context.active_object
    cam.name = "Hero_Camera_PBR"
    cam.data.lens = 65

    track = cam.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'
    bpy.context.scene.camera = cam

    # 3. Key Light dourada 3200K
    bpy.ops.object.light_add(type='SPOT', radius=0.20, location=(0.25, -0.35, 0.40))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 90.0
    key.data.color = (1.0, 0.94, 0.84)
    key.data.spot_size = math.radians(55)
    key.data.spot_blend = 0.50

    # 4. Rim Light Âmbar Maçarico (recorte no queijo e na casca)
    bpy.ops.object.light_add(type='POINT', radius=0.06, location=(-0.25, 0.22, 0.20))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = 120.0
    rim.data.color = (1.0, 0.45, 0.08)

    # 5. Soft Fill
    bpy.ops.object.light_add(type='POINT', radius=0.40, location=(0.20, 0.30, 0.22))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = 30.0
    fill.data.color = (0.90, 0.86, 0.82)

    # 6. Fundo escuro de gastropub acolhedor
    world = bpy.context.scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.04, 0.035, 0.03, 1.0)
        bg.inputs['Strength'].default_value = 0.8

    # Resolução
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.context.scene.render.filepath = render_path

    if 'CYCLES' in bpy.context.preferences.addons:
        bpy.context.scene.render.engine = 'CYCLES'
        bpy.context.scene.cycles.samples = 64
        bpy.context.scene.cycles.use_denoising = True
    else:
        bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'BLENDER_EEVEE_NEXT') else 'BLENDER_EEVEE'

    bpy.ops.render.render(write_still=True)
    print(f">> Render PBR Masterpiece salvo em: {render_path}")

def main():
    print("=====================================================")
    print(">> Executando Pass 4: PBR Masterpiece...")
    clean_scene()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    concepts_dir = os.path.join(project_root, "public", "assets", "concepts")

    tex_wood = os.path.join(concepts_dir, "texture_dark_wood.jpg")
    tex_bread = os.path.join(concepts_dir, "texture_bread_crust.jpg")
    tex_meat = os.path.join(concepts_dir, "texture_costela_meat.jpg")
    tex_cheese = os.path.join(concepts_dir, "texture_cheese_torch.jpg")

    board = create_board_with_pbr_wood(tex_wood)
    bread = create_bread_with_pbr_crust(tex_bread)
    ribs_empty, meat_base = create_costela_with_pbr_meat(tex_meat)
    cheese = create_cheese_with_pbr_torch(tex_cheese, meat_base)
    create_garnishes()

    render_file = os.path.join(concepts_dir, "candidate_render_pass4.png")
    setup_hero_camera_and_lighting(render_file)
    print(">> PASS 4 CONCLUÍDO COM SUCESSO!")
    print("=====================================================")

if __name__ == "__main__":
    main()
