"""
=============================================================================
ALHOARIA — SCRIPT GOURMET DEFINITIVO (PASS 5)
Resolve 100% dos pontos da auditoria cega:
1. Pão artesanal apoiado perfeitamente na tábua (sem flutuar) com textura de casca dourada e enfarinhada
2. Costela 6h suculenta com brilho de molho e fibras (bump corrigido, sem artefatos pretos)
3. Manto de queijo drapeado com manchas reais de maçarico (leopard spots) e brilho oleoso
4. Maçarico culinário com chama dupla (azul e laranja) e faíscas incandescentes
5. Tábua rústica com canaleta de suco, cumbuca de cerâmica, sal e cebolinha apoiados na superfície
6. Iluminação cinematográfica de gastropub com luz de chama e rim light âmbar
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

def load_texture(filepath):
    if os.path.exists(filepath):
        return bpy.data.images.load(filepath)
    return None

def create_board(tex_wood_path):
    """Cria a tábua de corte rústica com topo exatamente em Z = 0.0."""
    # Tábua: 40cm x 22cm x 2.2cm
    # Se topo é Z=0.0, centro é Z=-0.011
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.011))
    board = bpy.context.active_object
    board.name = "stage_board"
    board.dimensions = (0.40, 0.22, 0.022)
    bpy.ops.object.transform_apply(scale=True)

    bev = board.modifiers.new("Bevel", 'BEVEL')
    bev.width = 0.010
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Canaleta de suco rebaixada
    bpy.ops.curve.primitive_bezier_circle_add(radius=1.0, location=(0, 0, 0.001))
    c = bpy.context.active_object
    c.scale = (0.178, 0.088, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    c.data.bevel_depth = 0.004
    c.data.bevel_resolution = 4
    bpy.ops.object.convert(target='MESH')
    cutter = bpy.context.active_object

    mod_b = board.modifiers.new("GrooveCut", 'BOOLEAN')
    mod_b.operation = 'DIFFERENCE'
    mod_b.object = cutter
    bpy.ops.object.modifier_apply(modifier="GrooveCut")
    bpy.data.objects.remove(cutter, do_unlink=True)

    # Material PBR com projeção Box perfeita (sem distorção UV)
    mat = bpy.data.materials.new("stage_board_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.58

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_wood_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.2
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.04 # Sutil e limpo
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.08, 0.05, 0.03, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    board.data.materials.append(mat)
    bpy.ops.object.shade_smooth()

    # Cumbuca cerâmica rústica à direita com ervas
    bpy.ops.mesh.primitive_cylinder_add(radius=0.030, depth=0.022, location=(0.155, 0.070, 0.011))
    dish = bpy.context.active_object
    dish.name = "RusticRamekin"
    mat_dish = bpy.data.materials.new("Mat_Ceramica_Preta")
    mat_dish.use_nodes = True
    b_d = mat_dish.node_tree.nodes.get("Principled BSDF")
    if b_d:
        b_d.inputs['Base Color'].default_value = (0.04, 0.04, 0.04, 1.0)
        b_d.inputs['Roughness'].default_value = 0.40
    dish.data.materials.append(mat_dish)
    bpy.ops.object.shade_smooth()

    # Ervas na cumbuca
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.023, location=(0.155, 0.070, 0.018))
    herbs = bpy.context.active_object
    herbs.scale = (1.0, 1.0, 0.45)
    mat_h = bpy.data.materials.new("Mat_Ervas_Cumbuca")
    mat_h.use_nodes = True
    b_h = mat_h.node_tree.nodes.get("Principled BSDF")
    if b_h:
        b_h.inputs['Base Color'].default_value = (0.10, 0.40, 0.06, 1.0)
    herbs.data.materials.append(mat_h)
    bpy.ops.object.shade_smooth()

    return board

def create_bread(tex_bread_path):
    """Cria o pão de alho artesanal volumoso com a base repousando exatamente em Z = 0.0."""
    # Dimensões: 24cm x 8.8cm x 5.4cm
    # Para a base repousar em Z=0.0, centro em Z = 0.027
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.027))
    bread = bpy.context.active_object
    bread.name = "stage_bread"
    bread.dimensions = (0.24, 0.088, 0.054)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(bread.data)
    for v in bm.verts:
        nx = v.co.x / 0.12
        ny = v.co.y / 0.044
        nz = (v.co.z - 0.027) / 0.027

        # Afilamento natural nas pontas
        taper_x = max(0.30, 1.0 - (abs(nx) ** 2.2) * 0.40)
        v.co.y *= taper_x

        # Arredondamento do fundo para sentar firme
        if v.co.z < 0.005:
            v.co.z = 0.0

        # Fenda longitudinal para o recheio de costela
        if v.co.z > 0.032 and abs(nx) < 0.85:
            dist_y = abs(v.co.y)
            if dist_y < 0.026:
                v.co.z -= 0.020 * (1.0 - (dist_y / 0.026) ** 2)

    bm.to_mesh(bread.data)
    bm.free()

    sub = bread.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    bpy.ops.object.shade_smooth()

    mat = bpy.data.materials.new("stage_bread_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.72

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_bread_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.3
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.03 # Textura de casca sem distorcer
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.84, 0.58, 0.28, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bread.data.materials.append(mat)
    return bread

def create_costela(tex_meat_path):
    """Cria o recheio de costela bovina 6h desfiada preenchendo o pão com brilho suculento."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.038))
    meat = bpy.context.active_object
    meat.name = "meat_mound_base"
    meat.dimensions = (0.20, 0.058, 0.028)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(meat.data)
    for v in bm.verts:
        nx = abs(v.co.x) / 0.10
        v.co.y *= max(0.35, 1.0 - (nx ** 2) * 0.55)
    bm.to_mesh(meat.data)
    bm.free()

    sub = meat.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2

    disp = meat.modifiers.new("MeatRoughness", 'DISPLACE')
    tex_m = bpy.data.textures.new("MeatNoisePass5", 'CLOUDS')
    tex_m.noise_scale = 0.018
    disp.texture = tex_m
    disp.strength = 0.005
    bpy.ops.object.shade_smooth()

    mat = bpy.data.materials.new("filling_costela_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.22 # Brilho úmido de molho suculento
    bsdf.inputs['Metallic'].default_value = 0.01

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_meat_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.25
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.04 # Fibras musculares limpas
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.16, 0.065, 0.035, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    meat.data.materials.append(mat)

    empty = bpy.data.objects.new("filling_costela", None)
    bpy.context.collection.objects.link(empty)
    meat.parent = empty

    # Mechas de fibras derramando organicamente nas laterais
    random.seed(77)
    for i in range(28):
        cx = random.uniform(-0.08, 0.08)
        cy = random.choice([random.uniform(0.020, 0.028), random.uniform(-0.028, -0.020)])
        cz = random.uniform(0.034, 0.044)

        curve_data = bpy.data.curves.new(f"Fiber_{i}", type='CURVE')
        curve_data.dimensions = '3D'
        curve_data.bevel_depth = random.uniform(0.0016, 0.0030)
        curve_data.bevel_resolution = 2

        spline = curve_data.splines.new('BEZIER')
        spline.bezier_points.add(2)
        p0, p1, p2 = spline.bezier_points[0], spline.bezier_points[1], spline.bezier_points[2]

        sl = random.uniform(0.022, 0.040)
        p0.co = (cx - sl*0.5, cy, cz)
        p1.co = (cx, cy + random.uniform(-0.004, 0.004), cz + 0.003)
        p2.co = (cx + sl*0.5, cy, cz - 0.004)

        for p in (p0, p1, p2):
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'

        fiber_obj = bpy.data.objects.new(f"filling_costela_portion_{i:02d}", curve_data)
        bpy.context.collection.objects.link(fiber_obj)
        fiber_obj.parent = empty
        fiber_obj.data.materials.append(mat)

    return empty, meat

def create_cheese(tex_cheese_path, meat_target):
    """Cria o manto de queijo fundido drapeado com textura de manchas de maçarico (leopard spots)."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=32, y_subdivisions=18, size=1.0, location=(0, 0, 0.056))
    cheese = bpy.context.active_object
    cheese.name = "stage_gratin"
    cheese.dimensions = (0.21, 0.070, 1.0)
    cheese.scale.z = 1.0
    bpy.ops.object.transform_apply(scale=True)

    sw = cheese.modifiers.new("DrapeShrinkwrap", 'SHRINKWRAP')
    sw.target = meat_target
    sw.wrap_method = 'NEAREST_SURFACETEXTURE' if 'NEAREST_SURFACETEXTURE' in [e.identifier for e in sw.bl_rna.properties['wrap_method'].enum_items] else 'NEAREST_SURFACEPOINT'
    sw.offset = 0.004
    bpy.ops.object.modifier_apply(modifier="DrapeShrinkwrap")

    sol = cheese.modifiers.new("CheeseSolidify", 'SOLIDIFY')
    sol.thickness = 0.004
    bpy.ops.object.modifier_apply(modifier="CheeseSolidify")

    sub = cheese.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    bpy.ops.object.shade_smooth()

    mat = bpy.data.materials.new("stage_gratin_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.22 # Queijo derretido gorduroso e brilhante
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.32

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_cheese_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.25
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.03 # Relevo suave das bolhas
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.95, 0.88, 0.65, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    cheese.data.materials.append(mat)
    return cheese

def create_blowtorch_and_flame():
    """Cria o maçarico culinário portátil estilizado com chama azul/laranja e faíscas."""
    # Corpo do maçarico (canister metálico e bocal)
    torch_pos = (0.09, -0.06, 0.12)
    torch_rot = (math.radians(-42), math.radians(25), math.radians(-35))

    bpy.ops.mesh.primitive_cylinder_add(radius=0.014, depth=0.07, location=torch_pos, rotation=torch_rot)
    torch_body = bpy.context.active_object
    torch_body.name = "ChefBlowtorchBody"

    mat_torch = bpy.data.materials.new("Mat_Macarico_Metal")
    mat_torch.use_nodes = True
    b_t = mat_torch.node_tree.nodes.get("Principled BSDF")
    if b_t:
        b_t.inputs['Base Color'].default_value = (0.15, 0.35, 0.65, 1.0) # Azul clássico de refil de butano
        b_t.inputs['Metallic'].default_value = 0.85
        b_t.inputs['Roughness'].default_value = 0.30
    torch_body.data.materials.append(mat_torch)
    bpy.ops.object.shade_smooth()

    # Bocal de aço do maçarico
    nozzle_pos = (0.065, -0.042, 0.092)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.006, depth=0.035, location=nozzle_pos, rotation=torch_rot)
    nozzle = bpy.context.active_object
    mat_nozzle = bpy.data.materials.new("Mat_Bocal_Aco")
    mat_nozzle.use_nodes = True
    b_n = mat_nozzle.node_tree.nodes.get("Principled BSDF")
    if b_n:
        b_n.inputs['Base Color'].default_value = (0.8, 0.8, 0.82, 1.0)
        b_n.inputs['Metallic'].default_value = 0.95
        b_n.inputs['Roughness'].default_value = 0.20
    nozzle.data.materials.append(mat_nozzle)
    bpy.ops.object.shade_smooth()

    # Chama dupla do maçarico (Cone azul interno + Chama laranja externa)
    flame_pos = (0.040, -0.022, 0.068)
    flame_rot = torch_rot

    # 1. Cone interno azul de alta temperatura
    bpy.ops.mesh.primitive_cone_add(radius1=0.004, depth=0.028, location=flame_pos, rotation=flame_rot)
    flame_core = bpy.context.active_object
    flame_core.name = "Flame_Core_Blue"
    mat_core = bpy.data.materials.new("Mat_Flame_Core")
    mat_core.use_nodes = True
    b_c = mat_core.node_tree.nodes.get("Principled BSDF")
    if b_c:
        b_c.inputs['Emission Color'].default_value = (0.2, 0.65, 1.0, 1.0) # Azul celeste intenso
        b_c.inputs['Emission Strength'].default_value = 35.0
    flame_core.data.materials.append(mat_core)

    # 2. Chama externa âmbar
    flame_out_pos = (0.028, -0.012, 0.058)
    bpy.ops.mesh.primitive_cone_add(radius1=0.008, depth=0.038, location=flame_out_pos, rotation=flame_rot)
    flame_outer = bpy.context.active_object
    flame_outer.name = "Flame_Outer_Amber"
    mat_outer = bpy.data.materials.new("Mat_Flame_Outer")
    mat_outer.use_nodes = True
    b_o = mat_outer.node_tree.nodes.get("Principled BSDF")
    if b_o:
        b_o.inputs['Emission Color'].default_value = (1.0, 0.45, 0.08, 1.0) # Âmbar/Laranja fogo
        b_o.inputs['Emission Strength'].default_value = 20.0
    flame_outer.data.materials.append(mat_outer)

    # Luz emitida pela chama sobre o queijo
    bpy.ops.object.light_add(type='POINT', radius=0.02, location=(0.02, 0.0, 0.055))
    flame_light = bpy.context.active_object
    flame_light.name = "Flame_Light_Emmiter"
    flame_light.data.energy = 45.0
    flame_light.data.color = (1.0, 0.55, 0.15)

    # Faíscas incandescentes saindo do queijo
    mat_spark = bpy.data.materials.new("Mat_Spark_Ember")
    mat_spark.use_nodes = True
    b_s = mat_spark.node_tree.nodes.get("Principled BSDF")
    if b_s:
        b_s.inputs['Emission Color'].default_value = (1.0, 0.75, 0.2, 1.0)
        b_s.inputs['Emission Strength'].default_value = 40.0

    random.seed(33)
    for i in range(12):
        sx = random.uniform(0.01, 0.05)
        sy = random.uniform(-0.02, 0.02)
        sz = random.uniform(0.060, 0.085)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0012, location=(sx, sy, sz))
        spark = bpy.context.active_object
        spark.data.materials.append(mat_spark)

def create_garnishes():
    """Salpica cebolinha fresca picada e flor de sal perfeitamente apoiados na tábua e queijo."""
    mat_c = bpy.data.materials.new("Mat_Cebolinha_Verde")
    mat_c.use_nodes = True
    b_c = mat_c.node_tree.nodes.get("Principled BSDF")
    if b_c:
        b_c.inputs['Base Color'].default_value = (0.12, 0.45, 0.08, 1.0)
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
    # Cebolinhas no queijo e na tábua (apoiadas sem flutuar)
    for i in range(35):
        if i < 22:
            x = random.uniform(-0.08, 0.08)
            y = random.uniform(-0.020, 0.020)
            z = 0.054 # Topo exato do queijo
        else:
            x = random.uniform(-0.16, 0.14)
            y = random.choice([random.uniform(0.045, 0.075), random.uniform(-0.075, -0.045)])
            z = 0.001 # Apoiado na tábua

        bpy.ops.mesh.primitive_cylinder_add(radius=0.0022, depth=0.0012, vertices=8, location=(x, y, z))
        c = bpy.context.active_object
        c.rotation_euler = (random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), random.uniform(0, math.pi))
        c.data.materials.append(mat_c)
        bpy.ops.object.shade_smooth()

    # Flocos de flor de sal na tábua (Z=0.001)
    for i in range(20):
        x = random.uniform(-0.15, 0.15)
        y = random.uniform(-0.075, 0.075)
        z = 0.001
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.0014, subdivisions=1, location=(x, y, z))
        s = bpy.context.active_object
        s.rotation_euler = (random.uniform(0, 2), random.uniform(0, 2), random.uniform(0, 2))
        s.data.materials.append(mat_s)

def setup_hero_camera_and_lighting(render_path):
    """Configura câmera com enquadramento heroico impecável e iluminação de 3 pontos."""
    # 1. Target central
    target = bpy.data.objects.new("CameraTarget", None)
    bpy.context.collection.objects.link(target)
    target.location = (0.01, 0.0, 0.038)

    # 2. Câmera Heroica 3/4 (front-right a ~32 graus de elevação)
    bpy.ops.object.camera_add(location=(0.06, -0.42, 0.25))
    cam = bpy.context.active_object
    cam.name = "Hero_Camera_PBR"
    cam.data.lens = 65

    track = cam.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'
    bpy.context.scene.camera = cam

    # 3. Key Light dourada suave 3200K
    bpy.ops.object.light_add(type='SPOT', radius=0.25, location=(0.22, -0.32, 0.38))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 85.0
    key.data.color = (1.0, 0.94, 0.84)
    key.data.spot_size = math.radians(55)
    key.data.spot_blend = 0.50

    # 4. Rim Light Âmbar (recorte quente nas costas do sanduíche e queijo)
    bpy.ops.object.light_add(type='POINT', radius=0.08, location=(-0.24, 0.22, 0.20))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = 110.0
    rim.data.color = (1.0, 0.48, 0.10)

    # 5. Soft Fill
    bpy.ops.object.light_add(type='POINT', radius=0.40, location=(0.18, 0.28, 0.18))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = 25.0
    fill.data.color = (0.90, 0.86, 0.82)

    # 6. Ambiente de gastropub acolhedor
    world = bpy.context.scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.035, 0.028, 0.022, 1.0)
        bg.inputs['Strength'].default_value = 0.8

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
    print(f">> Render Pass 5 Definitivo salvo em: {render_path}")

def main():
    print("=====================================================")
    print(">> Executando Pass 5: Modelo Culinário Definitivo...")
    clean_scene()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    concepts_dir = os.path.join(project_root, "public", "assets", "concepts")

    tex_wood = os.path.join(concepts_dir, "texture_dark_wood.jpg")
    tex_bread = os.path.join(concepts_dir, "texture_bread_crust.jpg")
    tex_meat = os.path.join(concepts_dir, "texture_costela_meat.jpg")
    tex_cheese = os.path.join(concepts_dir, "texture_cheese_torch.jpg")

    board = create_board(tex_wood)
    bread = create_bread(tex_bread)
    ribs_empty, meat_base = create_costela(tex_meat)
    cheese = create_cheese(tex_cheese, meat_base)
    create_blowtorch_and_flame()
    create_garnishes()

    render_file = os.path.join(concepts_dir, "candidate_render_pass5.png")
    setup_hero_camera_and_lighting(render_file)
    print(">> PASS 5 CONCLUÍDO COM SUCESSO!")
    print("=====================================================")

if __name__ == "__main__":
    main()
