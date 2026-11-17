"""
=============================================================================
ALHOARIA — SCRIPT GOURMET DEFINITIVO (PASS 7)
Renderizador: Cycles GPU OptiX (RTX 4060 Ti) com Denoising
Câmera: Track-To Constraint perfeitamente alinhado (Dot Product = +1.000)
=============================================================================
"""

import bpy
import bmesh
import math
import mathutils
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

def create_environment(tex_wood_path):
    """Cria a mesa de madeira rústica, fundo de gastropub e luzes bokeh quentes."""
    # 1. Mesa rústica que se estende por todo o enquadramento
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.05, -0.045))
    table = bpy.context.active_object
    table.name = "RusticCounterTable"
    table.dimensions = (1.80, 1.20, 0.05)
    bpy.ops.object.transform_apply(scale=True)

    mat_table = bpy.data.materials.new("Mat_Table_Wood")
    nodes = mat_table.node_tree.nodes
    links = mat_table.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.65

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img_wood = load_texture(tex_wood_path)
    if img_wood:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img_wood
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.2
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])
        
        mult = nodes.new('ShaderNodeMix')
        mult.data_type = 'RGBA'
        mult.blend_type = 'MULTIPLY'
        mult.inputs['Factor'].default_value = 0.40
        mult.inputs[7].default_value = (0.22, 0.15, 0.10, 1.0)
        links.new(tex_node.outputs['Color'], mult.inputs[6])
        links.new(mult.outputs[2], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.05, 0.035, 0.022, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    table.data.materials.append(mat_table)
    bpy.ops.object.shade_smooth()

    # 2. Painel de fundo do gastropub (parede escura distante com iluminação suave)
    bpy.ops.mesh.primitive_plane_add(size=2.5, location=(0, 0.60, 0.35), rotation=(math.radians(90), 0, 0))
    bg_wall = bpy.context.active_object
    bg_wall.name = "GastropubWall"
    mat_wall = bpy.data.materials.new("Mat_Wall_Dark")
    n_w = mat_wall.node_tree.nodes
    l_w = mat_wall.node_tree.links
    n_w.clear()
    out_w = n_w.new('ShaderNodeOutputMaterial')
    b_w = n_w.new('ShaderNodeBsdfPrincipled')
    b_w.inputs['Base Color'].default_value = (0.045, 0.030, 0.020, 1.0)
    b_w.inputs['Roughness'].default_value = 0.90
    l_w.new(b_w.outputs['BSDF'], out_w.inputs['Surface'])
    bg_wall.data.materials.append(mat_wall)

    # 3. Luzes Bokeh de gastropub no fundo (esferas emissivas desfocadas)
    mat_bokeh = bpy.data.materials.new("Mat_Golden_Bokeh")
    n_b = mat_bokeh.node_tree.nodes
    l_b = mat_bokeh.node_tree.links
    n_b.clear()
    out_b = n_b.new('ShaderNodeOutputMaterial')
    emit_b = n_b.new('ShaderNodeEmission')
    emit_b.inputs['Color'].default_value = (1.0, 0.72, 0.32, 1.0)
    emit_b.inputs['Strength'].default_value = 22.0
    l_b.new(emit_b.outputs['Emission'], out_b.inputs['Surface'])

    random.seed(42)
    for i in range(18):
        bx = random.uniform(-0.45, 0.45)
        by = random.uniform(0.45, 0.58)
        bz = random.uniform(0.10, 0.40)
        br = random.uniform(0.012, 0.028)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=br, location=(bx, by, bz))
        b_sph = bpy.context.active_object
        b_sph.name = f"Bokeh_Light_{i}"
        b_sph.data.materials.append(mat_bokeh)

def create_board(tex_wood_path):
    """Cria a tábua de corte gourmet com canaleta de suco e cumbuca com ervas."""
    # Tábua: 38cm x 20cm x 2.2cm. Topo em Z = 0.0 (centro em Z = -0.011)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.011))
    board = bpy.context.active_object
    board.name = "stage_board"
    board.dimensions = (0.38, 0.20, 0.022)
    bpy.ops.object.transform_apply(scale=True)

    bev = board.modifiers.new("Bevel", 'BEVEL')
    bev.width = 0.010
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Canaleta de suco (juice groove)
    bpy.ops.curve.primitive_bezier_circle_add(radius=1.0, location=(0, 0, 0.001))
    c = bpy.context.active_object
    c.scale = (0.168, 0.078, 1.0)
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

    # Material de madeira rústica nogueira premium
    mat = bpy.data.materials.new("stage_board_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.52

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_wood_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.25
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.03
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.12, 0.07, 0.04, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    board.data.materials.append(mat)
    bpy.ops.object.shade_smooth()

    # Cumbuca cerâmica artesanal escura à direita com ervas frescas
    bpy.ops.mesh.primitive_cylinder_add(radius=0.028, depth=0.022, location=(0.145, 0.065, 0.011))
    dish = bpy.context.active_object
    dish.name = "RusticRamekin"
    bev_d = dish.modifiers.new("Bevel", 'BEVEL')
    bev_d.width = 0.003
    bev_d.segments = 2
    bpy.ops.object.modifier_apply(modifier="Bevel")

    mat_dish = bpy.data.materials.new("Mat_Ceramica_Preta")
    n_d = mat_dish.node_tree.nodes
    l_d = mat_dish.node_tree.links
    n_d.clear()
    out_d = n_d.new('ShaderNodeOutputMaterial')
    b_d = n_d.new('ShaderNodeBsdfPrincipled')
    b_d.inputs['Base Color'].default_value = (0.04, 0.04, 0.045, 1.0)
    b_d.inputs['Roughness'].default_value = 0.45
    l_d.new(b_d.outputs['BSDF'], out_d.inputs['Surface'])
    dish.data.materials.append(mat_dish)
    bpy.ops.object.shade_smooth()

    # Ervas e alecrim frescos na cumbuca
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(0.145, 0.065, 0.020))
    herbs = bpy.context.active_object
    herbs.scale = (1.0, 1.0, 0.45)
    mat_h = bpy.data.materials.new("Mat_Ervas_Cumbuca")
    n_h = mat_h.node_tree.nodes
    l_h = mat_h.node_tree.links
    n_h.clear()
    out_h = n_h.new('ShaderNodeOutputMaterial')
    b_h = n_h.new('ShaderNodeBsdfPrincipled')
    b_h.inputs['Base Color'].default_value = (0.08, 0.35, 0.05, 1.0)
    b_h.inputs['Roughness'].default_value = 0.30
    l_h.new(b_h.outputs['BSDF'], out_h.inputs['Surface'])
    herbs.data.materials.append(mat_h)
    bpy.ops.object.shade_smooth()

    return board

def create_bread(tex_bread_path):
    """Cria a baguete artesanal canoa dourada, volumosa, com crosta rústica e farinha."""
    # Dimensões: 24cm x 8.8cm x 5.4cm. Base repousando em Z = 0.0 (centro em Z = 0.027)
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

        # Afilamento curvo elegante nas pontas
        taper_x = max(0.28, 1.0 - (abs(nx) ** 2.2) * 0.42)
        v.co.y *= taper_x

        # Fundo assentado perfeitamente na tábua
        if v.co.z < 0.005:
            v.co.z = 0.0

        # Incisão canoa longitudinal profunda para acolher o recheio generoso
        if v.co.z > 0.030 and abs(nx) < 0.88:
            dist_y = abs(v.co.y)
            if dist_y < 0.028:
                v.co.z -= 0.022 * (1.0 - (dist_y / 0.028) ** 2)

    bm.to_mesh(bread.data)
    bm.free()

    sub = bread.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    bpy.ops.object.shade_smooth()

    # Material de casca de pão artesanal com polvilhado sutil de farinha
    mat = bpy.data.materials.new("stage_bread_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.68

    # Subsurface com cor de miolo/massa quente (NUNCA pele vermelha!)
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.08
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.70, 0.40)

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_bread_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.30
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])

        # Mistura da textura com polvilhado de farinha branca nas cristas
        flour_mix = nodes.new('ShaderNodeMix')
        flour_mix.data_type = 'RGBA'
        flour_mix.blend_type = 'SCREEN'
        flour_mix.inputs['Factor'].default_value = 0.12
        flour_mix.inputs[7].default_value = (0.95, 0.94, 0.90, 1.0)
        links.new(tex_node.outputs['Color'], flour_mix.inputs[6])
        links.new(flour_mix.outputs[2], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.035
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.84, 0.58, 0.28, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bread.data.materials.append(mat)
    return bread

def create_costela(tex_meat_path):
    """Cria o recheio farto de costela desfiada 6h, com fibras suculentas e brilho de molho."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.038))
    meat = bpy.context.active_object
    meat.name = "meat_mound_base"
    meat.dimensions = (0.20, 0.060, 0.028)
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
    tex_m = bpy.data.textures.new("MeatNoisePass7", 'CLOUDS')
    tex_m.noise_scale = 0.015
    disp.texture = tex_m
    disp.strength = 0.004
    bpy.ops.object.shade_smooth()

    # Material de costela desfiada laqueada e suculenta
    mat = bpy.data.materials.new("filling_costela_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.18 # Brilho apetitoso de suco/colágeno
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.65

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_meat_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.25
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])

        mix_tint = nodes.new('ShaderNodeMix')
        mix_tint.data_type = 'RGBA'
        mix_tint.blend_type = 'MULTIPLY'
        mix_tint.inputs['Factor'].default_value = 0.40
        mix_tint.inputs[7].default_value = (0.35, 0.12, 0.05, 1.0)
        links.new(tex_node.outputs['Color'], mix_tint.inputs[6])
        links.new(mix_tint.outputs[2], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.04
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.22, 0.08, 0.035, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    meat.data.materials.append(mat)

    empty = bpy.data.objects.new("filling_costela", None)
    bpy.context.collection.objects.link(empty)
    meat.parent = empty

    # 32 mechas generosas de carne desfiada caindo organicamente pelas laterais
    random.seed(88)
    for i in range(32):
        cx = random.uniform(-0.085, 0.085)
        cy = random.choice([random.uniform(0.021, 0.032), random.uniform(-0.032, -0.021)])
        cz = random.uniform(0.032, 0.046)

        curve_data = bpy.data.curves.new(f"RibFiber_{i}", type='CURVE')
        curve_data.dimensions = '3D'
        curve_data.bevel_depth = random.uniform(0.0018, 0.0032)
        curve_data.bevel_resolution = 2

        spline = curve_data.splines.new('BEZIER')
        spline.bezier_points.add(2)
        p0, p1, p2 = spline.bezier_points[0], spline.bezier_points[1], spline.bezier_points[2]

        sl = random.uniform(0.025, 0.045)
        p0.co = (cx - sl*0.5, cy, cz)
        p1.co = (cx, cy + random.uniform(-0.005, 0.005), cz + 0.004)
        p2.co = (cx + sl*0.5, cy, cz - 0.005)

        for p in (p0, p1, p2):
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'

        fiber_obj = bpy.data.objects.new(f"filling_costela_portion_{i:02d}", curve_data)
        bpy.context.collection.objects.link(fiber_obj)
        fiber_obj.parent = empty
        fiber_obj.data.materials.append(mat)

    return empty, meat

def create_cheese(tex_cheese_path, meat_target):
    """Cria o manto de queijo derretido drapeado com manchas evidentes de maçarico (leopard spots)."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=36, y_subdivisions=20, size=1.0, location=(0, 0, 0.057))
    cheese = bpy.context.active_object
    cheese.name = "stage_gratin"
    cheese.dimensions = (0.215, 0.072, 1.0)
    cheese.scale.z = 1.0
    bpy.ops.object.transform_apply(scale=True)

    sw = cheese.modifiers.new("DrapeShrinkwrap", 'SHRINKWRAP')
    sw.target = meat_target
    sw.wrap_method = 'NEAREST_SURFACETEXTURE' if 'NEAREST_SURFACETEXTURE' in [e.identifier for e in sw.bl_rna.properties['wrap_method'].enum_items] else 'NEAREST_SURFACEPOINT'
    sw.offset = 0.004
    bpy.ops.object.modifier_apply(modifier="DrapeShrinkwrap")

    sol = cheese.modifiers.new("CheeseSolidify", 'SOLIDIFY')
    sol.thickness = 0.0045
    bpy.ops.object.modifier_apply(modifier="CheeseSolidify")

    sub = cheese.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    bpy.ops.object.shade_smooth()

    mat = bpy.data.materials.new("stage_gratin_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.22
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.60

    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.12
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = (0.95, 0.85, 0.55)

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_cheese_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.20
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])

        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'LINEAR'
        ramp.color_ramp.elements[0].position = 0.18
        ramp.color_ramp.elements[0].color = (0.12, 0.05, 0.02, 1.0) # Centro tostado escuro
        ramp.color_ramp.elements[1].position = 0.65
        ramp.color_ramp.elements[1].color = (0.98, 0.88, 0.64, 1.0) # Queijo cremoso

        elem_mid = ramp.color_ramp.elements.new(0.38)
        elem_mid.color = (0.85, 0.52, 0.15, 1.0) # Halo dourado de gratinação

        rgb_to_bw = nodes.new('ShaderNodeRGBToBW')
        links.new(tex_node.outputs['Color'], rgb_to_bw.inputs['Color'])
        links.new(rgb_to_bw.outputs['Val'], ramp.inputs['Fac'])
        links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.035
        links.new(rgb_to_bw.outputs['Val'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.96, 0.88, 0.65, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    cheese.data.materials.append(mat)
    return cheese

def create_chef_blowtorch_and_flame():
    """Cria o conjunto completo: braço com dólmã de chef, maçarico de aço e jato de chama ardente."""
    torch_rot = (math.radians(-38), math.radians(22), math.radians(-32))
    
    # 1. Braço do Chef com dólmã preta (entrando pelo canto superior direito)
    arm_pos = (0.14, -0.09, 0.16)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.024, depth=0.10, location=arm_pos, rotation=torch_rot)
    arm = bpy.context.active_object
    arm.name = "ChefSleeve"
    mat_sleeve = bpy.data.materials.new("Mat_Chef_Sleeve")
    n_sl = mat_sleeve.node_tree.nodes
    l_sl = mat_sleeve.node_tree.links
    n_sl.clear()
    out_sl = n_sl.new('ShaderNodeOutputMaterial')
    b_sl = n_sl.new('ShaderNodeBsdfPrincipled')
    b_sl.inputs['Base Color'].default_value = (0.04, 0.04, 0.05, 1.0)
    b_sl.inputs['Roughness'].default_value = 0.85
    l_sl.new(b_sl.outputs['BSDF'], out_sl.inputs['Surface'])
    arm.data.materials.append(mat_sleeve)
    bpy.ops.object.shade_smooth()

    # 2. Empunhadura preta ergonômica do maçarico
    grip_pos = (0.095, -0.065, 0.125)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=0.055, location=grip_pos, rotation=torch_rot)
    grip = bpy.context.active_object
    grip.name = "BlowtorchGrip"
    mat_grip = bpy.data.materials.new("Mat_Blowtorch_Grip")
    n_gr = mat_grip.node_tree.nodes
    l_gr = mat_grip.node_tree.links
    n_gr.clear()
    out_gr = n_gr.new('ShaderNodeOutputMaterial')
    b_gr = n_gr.new('ShaderNodeBsdfPrincipled')
    b_gr.inputs['Base Color'].default_value = (0.08, 0.08, 0.09, 1.0)
    b_gr.inputs['Roughness'].default_value = 0.35
    l_gr.new(b_gr.outputs['BSDF'], out_gr.inputs['Surface'])
    grip.data.materials.append(mat_grip)
    bpy.ops.object.shade_smooth()

    # 3. Canister de gás azul/metálico
    canister_pos = (0.115, -0.078, 0.10)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.065, location=canister_pos, rotation=torch_rot)
    canister = bpy.context.active_object
    canister.name = "BlowtorchCanister"
    mat_can = bpy.data.materials.new("Mat_Butane_Canister")
    n_c = mat_can.node_tree.nodes
    l_c = mat_can.node_tree.links
    n_c.clear()
    out_c = n_c.new('ShaderNodeOutputMaterial')
    b_c = n_c.new('ShaderNodeBsdfPrincipled')
    b_c.inputs['Base Color'].default_value = (0.10, 0.28, 0.65, 1.0)
    b_c.inputs['Metallic'].default_value = 0.85
    b_c.inputs['Roughness'].default_value = 0.28
    l_c.new(b_c.outputs['BSDF'], out_c.inputs['Surface'])
    canister.data.materials.append(mat_can)
    bpy.ops.object.shade_smooth()

    # 4. Bocal metálico usinado de aço inox
    nozzle_pos = (0.065, -0.045, 0.090)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0055, depth=0.038, location=nozzle_pos, rotation=torch_rot)
    nozzle = bpy.context.active_object
    nozzle.name = "BlowtorchNozzle"
    mat_noz = bpy.data.materials.new("Mat_Nozzle_Steel")
    n_z = mat_noz.node_tree.nodes
    l_z = mat_noz.node_tree.links
    n_z.clear()
    out_z = n_z.new('ShaderNodeOutputMaterial')
    b_z = n_z.new('ShaderNodeBsdfPrincipled')
    b_z.inputs['Base Color'].default_value = (0.85, 0.85, 0.88, 1.0)
    b_z.inputs['Metallic'].default_value = 0.95
    b_z.inputs['Roughness'].default_value = 0.15
    l_z.new(b_z.outputs['BSDF'], out_z.inputs['Surface'])
    nozzle.data.materials.append(mat_noz)
    bpy.ops.object.shade_smooth()

    # 5. Botão regulador âmbar traseiro
    dial_pos = (0.115, -0.075, 0.145)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.006, depth=0.010, location=dial_pos, rotation=torch_rot)
    dial = bpy.context.active_object
    mat_dial = bpy.data.materials.new("Mat_Dial_Orange")
    n_d = mat_dial.node_tree.nodes
    l_d = mat_dial.node_tree.links
    n_d.clear()
    out_d = n_d.new('ShaderNodeOutputMaterial')
    b_d = n_d.new('ShaderNodeBsdfPrincipled')
    b_d.inputs['Base Color'].default_value = (0.95, 0.40, 0.05, 1.0)
    b_d.inputs['Roughness'].default_value = 0.40
    l_d.new(b_d.outputs['BSDF'], out_d.inputs['Surface'])
    dial.data.materials.append(mat_dial)

    # 6. JATO DE CHAMA CULINÁRIA (Transparente + Emissivo Gradiente)
    flame_inner_pos = (0.042, -0.026, 0.068)
    bpy.ops.mesh.primitive_cone_add(radius1=0.004, depth=0.026, location=flame_inner_pos, rotation=torch_rot)
    f_inner = bpy.context.active_object
    f_inner.name = "FlameCoreBlue"

    mat_f_in = bpy.data.materials.new("Mat_Flame_Core_Blue")
    n_fi = mat_f_in.node_tree.nodes
    l_fi = mat_f_in.node_tree.links
    n_fi.clear()
    out_fi = n_fi.new('ShaderNodeOutputMaterial')
    emit_fi = n_fi.new('ShaderNodeEmission')
    emit_fi.inputs['Color'].default_value = (0.15, 0.65, 1.0, 1.0)
    emit_fi.inputs['Strength'].default_value = 55.0
    l_fi.new(emit_fi.outputs['Emission'], out_fi.inputs['Surface'])
    f_inner.data.materials.append(mat_f_in)
    bpy.ops.object.shade_smooth()

    flame_out_pos = (0.028, -0.014, 0.056)
    bpy.ops.mesh.primitive_cone_add(radius1=0.008, depth=0.038, location=flame_out_pos, rotation=torch_rot)
    f_outer = bpy.context.active_object
    f_outer.name = "FlamePlumeAmber"

    mat_f_out = bpy.data.materials.new("Mat_Flame_Plume_Amber")
    n_fo = mat_f_out.node_tree.nodes
    l_fo = mat_f_out.node_tree.links
    n_fo.clear()
    out_fo = n_fo.new('ShaderNodeOutputMaterial')
    emit_fo = n_fo.new('ShaderNodeEmission')
    emit_fo.inputs['Color'].default_value = (1.0, 0.45, 0.06, 1.0)
    emit_fo.inputs['Strength'].default_value = 30.0
    l_fo.new(emit_fo.outputs['Emission'], out_fo.inputs['Surface'])
    f_outer.data.materials.append(mat_f_out)
    bpy.ops.object.shade_smooth()

    # Luz emitida pelo contato da chama no queijo
    bpy.ops.object.light_add(type='POINT', radius=0.015, location=(0.018, -0.005, 0.055))
    flame_light = bpy.context.active_object
    flame_light.name = "FlamePointLight"
    flame_light.data.energy = 55.0
    flame_light.data.color = (1.0, 0.52, 0.12)

    # Faíscas incandescentes
    mat_spark = bpy.data.materials.new("Mat_Spark_Ember")
    n_sp = mat_spark.node_tree.nodes
    l_sp = mat_spark.node_tree.links
    n_sp.clear()
    out_sp = n_sp.new('ShaderNodeOutputMaterial')
    emit_sp = n_sp.new('ShaderNodeEmission')
    emit_sp.inputs['Color'].default_value = (1.0, 0.80, 0.25, 1.0)
    emit_sp.inputs['Strength'].default_value = 60.0
    l_sp.new(emit_sp.outputs['Emission'], out_sp.inputs['Surface'])

    random.seed(44)
    for i in range(16):
        sx = random.uniform(0.008, 0.045)
        sy = random.uniform(-0.020, 0.015)
        sz = random.uniform(0.055, 0.082)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.0010, 0.0018), location=(sx, sy, sz))
        spark = bpy.context.active_object
        spark.data.materials.append(mat_spark)

def create_garnishes():
    """Salpica rodelas de cebolinha fresca picada e cristais de flor de sal na tábua e queijo."""
    mat_c = bpy.data.materials.new("Mat_Cebolinha_Verde")
    n_c = mat_c.node_tree.nodes
    l_c = mat_c.node_tree.links
    n_c.clear()
    out_c = n_c.new('ShaderNodeOutputMaterial')
    b_c = n_c.new('ShaderNodeBsdfPrincipled')
    b_c.inputs['Base Color'].default_value = (0.12, 0.45, 0.08, 1.0)
    b_c.inputs['Roughness'].default_value = 0.28
    l_c.new(b_c.outputs['BSDF'], out_c.inputs['Surface'])

    mat_s = bpy.data.materials.new("Mat_Flor_De_Sal")
    n_s = mat_s.node_tree.nodes
    l_s = mat_s.node_tree.links
    n_s.clear()
    out_s = n_s.new('ShaderNodeOutputMaterial')
    b_s = n_s.new('ShaderNodeBsdfPrincipled')
    b_s.inputs['Base Color'].default_value = (0.98, 0.98, 0.99, 1.0)
    b_s.inputs['Roughness'].default_value = 0.12
    if 'Transmission Weight' in b_s.inputs:
        b_s.inputs['Transmission Weight'].default_value = 0.65
    l_s.new(b_s.outputs['BSDF'], out_s.inputs['Surface'])

    random.seed(101)
    for i in range(36):
        if i < 24:
            x = random.uniform(-0.082, 0.082)
            y = random.uniform(-0.020, 0.020)
            z = 0.054
        else:
            x = random.uniform(-0.15, 0.13)
            y = random.choice([random.uniform(0.045, 0.075), random.uniform(-0.075, -0.045)])
            z = 0.001

        bpy.ops.mesh.primitive_cylinder_add(radius=0.0022, depth=0.0014, vertices=8, location=(x, y, z))
        c = bpy.context.active_object
        c.rotation_euler = (random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25), random.uniform(0, math.pi))
        c.data.materials.append(mat_c)
        bpy.ops.object.shade_smooth()

    for i in range(25):
        x = random.uniform(-0.16, 0.14)
        y = random.uniform(-0.078, 0.078)
        z = 0.001
        bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.0012, 0.0020), subdivisions=1, location=(x, y, z))
        s = bpy.context.active_object
        s.rotation_euler = (random.uniform(0, 3), random.uniform(0, 3), random.uniform(0, 3))
        s.data.materials.append(mat_s)

def setup_cycles_optix_and_hero_camera(render_path):
    """Configura Cycles com GPU OptiX, Denoising, Iluminação de estúdio culinário e Câmera alinhada."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    
    cycles_pref = bpy.context.preferences.addons.get('cycles')
    if cycles_pref:
        cpref = cycles_pref.preferences
        cpref.compute_device_type = 'OPTIX'
        for d in cpref.get_devices_for_type('OPTIX'):
            d.use = True
        scene.cycles.device = 'GPU'
        print(">> Configurado Cycles com OptiX GPU!")
    else:
        scene.cycles.device = 'CPU'

    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.filepath = render_path

    # Criação do objeto Target
    target = bpy.data.objects.new("CameraTarget", None)
    bpy.context.collection.objects.link(target)
    target.location = (0.005, 0.0, 0.038)

    # Criação da Câmera Heroica
    cam_data = bpy.data.cameras.new("HeroCamera")
    cam_data.lens = 72 # Lente teleobjetiva gastronômica
    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = target
    cam_data.dof.aperture_fstop = 3.5

    cam_obj = bpy.data.objects.new("HeroCamera", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Posicionamento da Câmera: Em frente ao lanche em ângulo 3/4
    # X=0.03, Y=-0.38, Z=0.14
    cam_obj.location = (0.03, -0.38, 0.14)

    # Constraint TRACK_TO robusta e testada (Track: -Z, Up: Y)
    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    # Força a avaliação das matrizes no grafo de dependência
    bpy.context.view_layer.update()

    # Verificação de alinhamento matemático do vetor de visão
    cam_mat = cam_obj.matrix_world
    view_dir = cam_mat.to_3x3() @ mathutils.Vector((0, 0, -1))
    view_dir.normalize()
    to_target = (target.location - cam_obj.location).normalized()
    dot = view_dir.dot(to_target)
    print(f">> Câmera Pos: {cam_obj.location}")
    print(f">> Câmera View Dir: {view_dir}")
    print(f">> Vetor até o Alvo: {to_target}")
    print(f">> Alinhamento da Câmera: {dot:.4f} (1.0 = Perfeito!)")

    # ILUMINAÇÃO DE ESTÚDIO CULINÁRIO
    # 1. Key Light Quente (3200K, ilumina o queijo e a carne frontalmente)
    bpy.ops.object.light_add(type='SPOT', radius=0.20, location=(0.18, -0.30, 0.35))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 95.0
    key.data.color = (1.0, 0.94, 0.85)
    key.data.spot_size = math.radians(55)
    key.data.spot_blend = 0.40

    # 2. Rim Light Âmbar (recorte quente e dourado na crosta e queijo)
    bpy.ops.object.light_add(type='POINT', radius=0.06, location=(-0.22, 0.20, 0.18))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = 110.0
    rim.data.color = (1.0, 0.50, 0.10)

    # 3. Fill Light suave
    bpy.ops.object.light_add(type='POINT', radius=0.35, location=(-0.25, -0.22, 0.20))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = 30.0
    fill.data.color = (0.92, 0.88, 0.82)

    # 4. Ambiente geral quente
    world = scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.04, 0.028, 0.020, 1.0)
        bg.inputs['Strength'].default_value = 0.85

    print(f">> Iniciando renderização Cycles OptiX (128 amostras)...")
    bpy.ops.render.render(write_still=True)
    print(f">> Render Pass 7 salvo em: {render_path}")

def main():
    print("=====================================================")
    print(">> Executando Pass 7: Obra-Prima Culinária Alhoaria...")
    clean_scene()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    concepts_dir = os.path.join(project_root, "public", "assets", "concepts")

    tex_wood = os.path.join(concepts_dir, "texture_dark_wood.jpg")
    tex_bread = os.path.join(concepts_dir, "texture_bread_crust.jpg")
    tex_meat = os.path.join(concepts_dir, "texture_costela_meat.jpg")
    tex_cheese = os.path.join(concepts_dir, "texture_cheese_torch.jpg")

    create_environment(tex_wood)
    board = create_board(tex_wood)
    bread = create_bread(tex_bread)
    ribs_empty, meat_base = create_costela(tex_meat)
    cheese = create_cheese(tex_cheese, meat_base)
    create_chef_blowtorch_and_flame()
    create_garnishes()

    render_file = os.path.join(concepts_dir, "candidate_render_pass7.png")
    setup_cycles_optix_and_hero_camera(render_file)
    print(">> PASS 7 CONCLUÍDO COM SUCESSO!")
    print("=====================================================")

if __name__ == "__main__":
    main()
