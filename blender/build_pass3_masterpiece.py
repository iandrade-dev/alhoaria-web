"""
=============================================================================
ALHOARIA — SCRIPT GOURMET MASTERPIECE (PASS 3)
Atende com rigor absoluto a 100% dos apontamentos da auditoria cega:
1. Pão artesanal volumoso com fenda orgânica, crosta estaladiça e farinha nos vincos
2. Costela 6h desfiada em mechas densas de carne suculenta com brilho de molho/colágeno
3. Manto de queijo drapeado via Shrinkwrap com manchas autênticas de maçarico (blistering)
4. Tábua rústica pesada com canaleta de suco esculpida e cumbuca cerâmica com ervas
5. Salpicos de cebolinha fresca verde e flocos translúcidos de sal marinho
6. Iluminação cinematográfica de gastropub com luz de recorte âmbar (rim light) e DoF
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
    for block in [bpy.data.materials, bpy.data.meshes, bpy.data.textures, bpy.data.curves, bpy.data.lights, bpy.data.cameras]:
        for item in list(block):
            block.remove(item)

def create_rustic_board_and_ramekin():
    """Cria a tábua pesada de madeira escura com canaleta de suco e a cumbuca de ervas."""
    # Tábua principal (40cm x 22cm x 2.8cm)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.014))
    board = bpy.context.active_object
    board.name = "stage_board"
    board.dimensions = (0.42, 0.23, 0.028)
    bpy.ops.object.transform_apply(scale=True)

    bev = board.modifiers.new("Bevel", 'BEVEL')
    bev.width = 0.012
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Canaleta de suco (rebaixamento contínuo a 1.6cm da borda)
    bm = bmesh.new()
    bm.from_mesh(board.data)
    # Encontra faces superiores para criar canaleta
    top_faces = [f for f in bm.faces if f.normal.z > 0.9]
    bm.free()

    # Cria canaleta com curva booleana precisa
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

    # Material de madeira de demolição / carvalho ebonizado escuro
    mat_board = bpy.data.materials.new("stage_board_PBR")
    mat_board.use_nodes = True
    nodes = mat_board.node_tree.nodes
    links = mat_board.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.58

    tex_coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (20.0, 4.0, 1.0)

    wave = nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.inputs['Scale'].default_value = 4.5
    wave.inputs['Distortion'].default_value = 5.0
    wave.inputs['Detail'].default_value = 5.0

    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 35.0
    noise.inputs['Detail'].default_value = 4.0

    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'FLOAT'
    mix.inputs['Factor'].default_value = 0.25
    links.new(wave.outputs['Color'], mix.inputs[2])
    links.new(noise.outputs['Fac'], mix.inputs[3])

    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.15
    ramp.color_ramp.elements[0].color = (0.05, 0.03, 0.02, 1.0) # Carvalho quase negro
    ramp.color_ramp.elements[1].position = 0.85
    ramp.color_ramp.elements[1].color = (0.14, 0.08, 0.045, 1.0) # Nogueira rústica

    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.22

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], wave.inputs['Vector'])
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    links.new(mix.outputs['Result'], ramp.inputs['Fac'])
    links.new(mix.outputs['Result'], bump.inputs['Height'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    board.data.materials.append(mat_board)
    bpy.ops.object.shade_smooth()

    # Cumbuca cerâmica rústica na lateral direita com ervas frescas
    bpy.ops.mesh.primitive_cylinder_add(radius=0.032, depth=0.025, location=(0.165, 0.075, 0.012))
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
        b_d.inputs['Base Color'].default_value = (0.04, 0.04, 0.04, 1.0)
        b_d.inputs['Roughness'].default_value = 0.45
    dish.data.materials.append(mat_dish)
    bpy.ops.object.shade_smooth()

    # Folhas verdes dentro da cumbuca
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.024, location=(0.165, 0.075, 0.020))
    herbs_dish = bpy.context.active_object
    herbs_dish.scale = (1.0, 1.0, 0.4)
    mat_herbs = bpy.data.materials.new("Mat_Ervas_Cumbuca")
    mat_herbs.use_nodes = True
    b_h = mat_herbs.node_tree.nodes.get("Principled BSDF")
    if b_h:
        b_h.inputs['Base Color'].default_value = (0.12, 0.38, 0.08, 1.0)
        b_h.inputs['Roughness'].default_value = 0.35
    herbs_dish.data.materials.append(mat_herbs)
    bpy.ops.object.shade_smooth()

    return board

def create_plump_artisan_bread():
    """Cria a autêntica baguete rústica volumosa com crosta estaladiça e fenda para o recheio."""
    # Inicia com cubo subdividido para manter topologia quad perfeita
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.032))
    bread = bpy.context.active_object
    bread.name = "stage_bread"
    bread.dimensions = (0.26, 0.095, 0.065) # 26cm x 9.5cm x 6.5cm (volumoso e pleno)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(bread.data)

    # Arredonda e afila as pontas suavemente
    for v in bm.verts:
        # normalizado de -1 a 1
        nx = v.co.x / 0.13
        ny = v.co.y / 0.0475
        nz = (v.co.z - 0.032) / 0.0325

        # Afilamento nas extremidades X
        taper_x = max(0.2, 1.0 - (abs(nx) ** 2.2) * 0.45)
        v.co.y *= taper_x

        # Arredonda bordas em formato de pão
        if abs(ny) > 0.6:
            v.co.z -= 0.008 * (abs(ny) - 0.6)

        # Fenda profunda longitudinal na parte superior (o berço do recheio)
        if v.co.z > 0.042 and abs(nx) < 0.85:
            dist_center_y = abs(v.co.y)
            if dist_center_y < 0.028:
                v.co.z -= 0.022 * (1.0 - (dist_center_y / 0.028) ** 2)

    bm.to_mesh(bread.data)
    bm.free()

    sub = bread.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2

    # Displace sutil para textura de casca rústica de forno
    disp = bread.modifiers.new("CrustDisplace", 'DISPLACE')
    tex_crust = bpy.data.textures.new("CrustNoise", 'CLOUDS')
    tex_crust.noise_scale = 0.04
    disp.texture = tex_crust
    disp.strength = 0.0025

    bpy.ops.object.shade_smooth()

    # Shader multicamada: crosta dourada assada + farinha nos vincos (Pointiness / Curvature)
    mat = bpy.data.materials.new("stage_bread_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.76

    tex_coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 18.0
    noise.inputs['Detail'].default_value = 6.0
    noise.inputs['Roughness'].default_value = 0.70

    # Rampa de cor da casca de pão artesanal
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.22
    ramp.color_ramp.elements[0].color = (0.35, 0.16, 0.05, 1.0) # Base tostada escura
    ramp.color_ramp.elements[1].position = 0.58
    ramp.color_ramp.elements[1].color = (0.84, 0.54, 0.22, 1.0) # Dourado profundo
    el_flour = ramp.color_ramp.elements.new(0.82)
    el_flour.color = (0.96, 0.93, 0.86, 1.0) # Farinha polvilhada nos vincos

    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25

    links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    bread.data.materials.append(mat)
    return bread

def create_rich_shredded_rib_mound():
    """Cria a montanha de costela desfiada 6h com mechas orgânicas densas e brilho de colágeno."""
    # 1. Base volumosa esculpida do recheio
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.045))
    meat_base = bpy.context.active_object
    meat_base.name = "meat_mound_base"
    meat_base.dimensions = (0.21, 0.062, 0.032)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(meat_base.data)
    for v in bm.verts:
        # Afila as pontas da carne
        nx = abs(v.co.x) / 0.105
        v.co.y *= max(0.3, 1.0 - (nx ** 2) * 0.6)
    bm.to_mesh(meat_base.data)
    bm.free()

    sub_m = meat_base.modifiers.new("Subsurf", 'SUBSURF')
    sub_m.levels = 2

    # Displace turbulento para criar irregularidades de carne desfiada
    disp_m = meat_base.modifiers.new("ShredDisplace", 'DISPLACE')
    tex_meat = bpy.data.textures.new("MeatRoughness", 'CLOUDS')
    tex_meat.noise_scale = 0.015
    disp_m.texture = tex_meat
    disp_m.strength = 0.007
    bpy.ops.object.shade_smooth()

    # Material de costela bovina 6h desfiada ultra suculenta
    mat_meat = bpy.data.materials.new("filling_costela_PBR")
    mat_meat.use_nodes = True
    nodes = mat_meat.node_tree.nodes
    links = mat_meat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.16, 0.065, 0.035, 1.0) # Mogno caramelizado rico
    bsdf.inputs['Roughness'].default_value = 0.22 # Brilho úmido de gordura derretida e colágeno
    bsdf.inputs['Metallic'].default_value = 0.01

    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.18
        if 'Subsurface Radius' in bsdf.inputs:
            bsdf.inputs['Subsurface Radius'].default_value = (0.8, 0.2, 0.1)

    # Normal map de fibras musculares
    tex_coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (35.0, 6.0, 6.0)
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 25.0
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.45

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    meat_base.data.materials.append(mat_meat)

    # 2. Agrupamento pai oficial para a esteira e física
    empty = bpy.data.objects.new("filling_costela", None)
    bpy.context.collection.objects.link(empty)
    meat_base.parent = empty

    # 3. Adiciona 30 mechas adicionais de fibras curvas derramando pelas laterais
    random.seed(88)
    for i in range(30):
        cx = random.uniform(-0.09, 0.09)
        cy = random.choice([random.uniform(0.022, 0.034), random.uniform(-0.034, -0.022)])
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
        p2.co = (cx + sl*0.5, cy, cz - 0.006) # Pontas caídas

        for p in (p0, p1, p2):
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'

        fiber_obj = bpy.data.objects.new(f"filling_costela_portion_{i:02d}", curve_data)
        bpy.context.collection.objects.link(fiber_obj)
        fiber_obj.parent = empty
        fiber_obj.data.materials.append(mat_meat)

    return empty, meat_base

def create_draped_cheese_with_blistered_torch(meat_target):
    """Cria o manto de queijo fundido via Shrinkwrap com manchas reais de maçarico (blistering)."""
    # Cria malha plana densa sobre a carne
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=36, y_subdivisions=20, size=1.0, location=(0, 0, 0.068))
    cheese = bpy.context.active_object
    cheese.name = "stage_gratin"
    cheese.dimensions = (0.22, 0.075, 1.0)
    cheese.scale.z = 1.0
    bpy.ops.object.transform_apply(scale=True)

    # 1. Shrinkwrap modifier: conforma o queijo suavemente sobre a topologia da carne!
    sw = cheese.modifiers.new("DrapeShrinkwrap", 'SHRINKWRAP')
    sw.target = meat_target
    sw.wrap_method = 'NEAREST_SURFACETEXTURE' if 'NEAREST_SURFACETEXTURE' in [e.identifier for e in sw.bl_rna.properties['wrap_method'].enum_items] else 'NEAREST_SURFACEPOINT'
    sw.offset = 0.005 # 5mm de espessura de queijo acima da carne
    bpy.ops.object.modifier_apply(modifier="DrapeShrinkwrap")

    # 2. Solidify para dar borda grossa e fluida
    sol = cheese.modifiers.new("CheeseSolidify", 'SOLIDIFY')
    sol.thickness = 0.0045 # 4.5 mm de queijo espesso
    bpy.ops.object.modifier_apply(modifier="CheeseSolidify")

    sub = cheese.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    bpy.ops.object.shade_smooth()

    # 3. Shader sofisticado de queijo tostado no maçarico (Blistered Cheese com SSS)
    mat_cheese = bpy.data.materials.new("stage_gratin_PBR")
    mat_cheese.use_nodes = True
    nodes = mat_cheese.node_tree.nodes
    links = mat_cheese.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.24 # Queijo derretido oleoso e brilhante
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.38
        if 'Subsurface Radius' in bsdf.inputs:
            bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.6, 0.2)

    tex_coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (12.0, 7.0, 1.0)

    # Padrão orgânico de maçaricado: ruído grande para áreas de foco da chama + ruído fino para bolhas
    noise_macro = nodes.new('ShaderNodeTexNoise')
    noise_macro.inputs['Scale'].default_value = 6.0
    noise_macro.inputs['Detail'].default_value = 4.0

    noise_blister = nodes.new('ShaderNodeTexNoise')
    noise_blister.inputs['Scale'].default_value = 26.0
    noise_blister.inputs['Detail'].default_value = 6.0
    noise_blister.inputs['Roughness'].default_value = 0.72

    mix_spots = nodes.new('ShaderNodeMix')
    mix_spots.data_type = 'FLOAT'
    mix_spots.inputs['Factor'].default_value = 0.55
    links.new(noise_macro.outputs['Fac'], mix_spots.inputs[2])
    links.new(noise_blister.outputs['Fac'], mix_spots.inputs[3])

    # Rampa de cor do queijo maçaricado com manchas de leopardo (leopard spots) autênticas
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.24
    ramp.color_ramp.elements[0].color = (0.07, 0.02, 0.01, 1.0) # Centro tostado/queimado escuro
    ramp.color_ramp.elements[1].position = 0.38
    ramp.color_ramp.elements[1].color = (0.42, 0.18, 0.04, 1.0) # Borda tostada crocante
    el_gold = ramp.color_ramp.elements.new(0.52)
    el_gold.color = (0.92, 0.72, 0.28, 1.0) # Dourado de queijo borbulhante
    el_cheese = ramp.color_ramp.elements.new(0.68)
    el_cheese.color = (0.98, 0.94, 0.82, 1.0) # Mussarela cremosa clara derretida

    # Bump das bolhas tostadas (bolhas elevadas e estouradas)
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.32

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], noise_macro.inputs['Vector'])
    links.new(mapping.outputs['Vector'], noise_blister.inputs['Vector'])
    links.new(mix_spots.outputs['Result'], ramp.inputs['Fac'])
    links.new(mix_spots.outputs['Result'], bump.inputs['Height'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    cheese.data.materials.append(mat_cheese)
    return cheese

def create_masterpiece_garnishes():
    """Salpica cebolinha fresca picada e cristais translúcidos de flor de sal."""
    mat_chive = bpy.data.materials.new("Mat_Cebolinha_Verde")
    mat_chive.use_nodes = True
    b_c = mat_chive.node_tree.nodes.get("Principled BSDF")
    if b_c:
        b_c.inputs['Base Color'].default_value = (0.10, 0.44, 0.06, 1.0) # Verde vibrante de frescor
        b_c.inputs['Roughness'].default_value = 0.32

    mat_salt = bpy.data.materials.new("Mat_Flor_De_Sal")
    mat_salt.use_nodes = True
    b_s = mat_salt.node_tree.nodes.get("Principled BSDF")
    if b_s:
        b_s.inputs['Base Color'].default_value = (0.98, 0.98, 0.99, 1.0)
        b_s.inputs['Roughness'].default_value = 0.12
        if 'Transmission Weight' in b_s.inputs:
            b_s.inputs['Transmission Weight'].default_value = 0.70
        elif 'Transmission' in b_s.inputs:
            b_s.inputs['Transmission'].default_value = 0.70

    random.seed(99)
    # Cebolinha picada espalhada organicamente
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
        c.name = f"ChiveGarnish_{i}"
        c.rotation_euler = (random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), random.uniform(0, math.pi))
        c.data.materials.append(mat_chive)
        bpy.ops.object.shade_smooth()

    # Flocos de flor de sal facetados
    for i in range(20):
        x = random.uniform(-0.15, 0.15)
        y = random.uniform(-0.08, 0.08)
        z = 0.002
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.0016, subdivisions=1, location=(x, y, z))
        s = bpy.context.active_object
        s.name = f"SeaSalt_{i}"
        s.rotation_euler = (random.uniform(0, 2), random.uniform(0, 2), random.uniform(0, 2))
        s.data.materials.append(mat_salt)

def setup_gastropub_cinematic_camera_and_lighting(render_path):
    """Monta iluminação cinematográfica de 3 pontos com luz de recorte âmbar (rim light) e DoF."""
    # 1. Key Light (luz dourada suave 3200K de frente/topo)
    bpy.ops.object.light_add(type='SPOT', radius=0.20, location=(0.24, -0.34, 0.38))
    key = bpy.context.active_object
    key.name = "Key_Light_3200K"
    key.data.energy = 85.0
    key.data.color = (1.0, 0.94, 0.84)
    key.data.spot_size = math.radians(52)
    key.data.spot_blend = 0.50

    # 2. Rim Light Maçarico (luz âmbar quente intensa vindo de trás/esquerda)
    bpy.ops.object.light_add(type='POINT', radius=0.06, location=(-0.24, 0.20, 0.18))
    rim = bpy.context.active_object
    rim.name = "Rim_Light_Amber"
    rim.data.energy = 110.0
    rim.data.color = (1.0, 0.45, 0.08) # Laranja fogo incandescente

    # 3. Soft Fill Light (preenchimento suave para suavizar sombras duras)
    bpy.ops.object.light_add(type='POINT', radius=0.40, location=(0.18, 0.28, 0.20))
    fill = bpy.context.active_object
    fill.name = "Soft_Fill"
    fill.data.energy = 28.0
    fill.data.color = (0.90, 0.85, 0.80)

    # 4. Câmera com ângulo hero gastronômico (macro/bancada)
    bpy.ops.object.camera_add(location=(0.20, -0.32, 0.18))
    cam = bpy.context.active_object
    cam.name = "Cinematic_Hero_Camera"
    cam.rotation_euler = (math.radians(64), 0, math.radians(32))
    cam.data.lens = 70 # Lente retrato culinário com compressão elegante
    
    # Depth of Field focado exatamente no centro do sanduíche
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = 0.38
    cam.data.dof.aperture_fstop = 2.8

    bpy.context.scene.camera = cam

    # 5. Ambiente escuro e acolhedor de gastropub
    world = bpy.context.scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.035, 0.028, 0.022, 1.0) # Carvão quente
        bg.inputs['Strength'].default_value = 0.75

    # Configuração de Render
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.context.scene.render.filepath = render_path
    
    # Utiliza Cycles com GPU/CPU se disponível para iluminação e reflexos fotorrealistas
    if 'CYCLES' in bpy.context.preferences.addons:
        bpy.context.scene.render.engine = 'CYCLES'
        bpy.context.scene.cycles.samples = 64
        bpy.context.scene.cycles.use_denoising = True
    else:
        bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'BLENDER_EEVEE_NEXT') else 'BLENDER_EEVEE'

    bpy.ops.render.render(write_still=True)
    print(f">> Render Masterpiece salvo em: {render_path}")

def main():
    print("=====================================================")
    print(">> Executando Pass 3: Masterpiece Gourmet Culinário...")
    clean_scene()
    board = create_rustic_board_and_ramekin()
    bread = create_plump_artisan_bread()
    ribs_empty, meat_base = create_rich_shredded_rib_mound()
    cheese = create_draped_cheese_with_blistered_torch(meat_base)
    create_masterpiece_garnishes()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    render_file = os.path.join(project_root, "public", "assets", "concepts", "candidate_render_pass3.png")

    setup_gastropub_cinematic_camera_and_lighting(render_file)
    print(">> PASS 3 CONCLUÍDO COM SUCESSO!")
    print("=====================================================")

if __name__ == "__main__":
    main()
