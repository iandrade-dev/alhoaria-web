"""
=============================================================================
ALHOARIA — SCRIPT GOURMET DEFINITIVO MASTERPIECE (PASS 9)
Integra:
1. Mão do Chef oficial (alhoaria-mao-chef.glb) segurando o maçarico culinário
2. Baguete artesanal canoa volumosa (5.4cm altura) com textura PBR e UVs perfeitas
3. Costela 6h desfiada suculenta com mechas e brilho de molho
4. Queijo derretido drapeado com manchas reais de maçarico (leopard spots)
5. Jato de chama azul/laranja com emissão dinâmica e fagulhas
6. Tábua com canaleta de gordura, cumbuca de cerâmica com ervas, sal e cebolinha
7. Fundo de gastropub com bokeh dourado cinematográfico
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
    """Bancada de madeira rústica, fundo escuro de gastropub e bokeh dourado."""
    # 1. Bancada rústica grande
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.06, -0.045))
    table = bpy.context.active_object
    table.name = "RusticCounterTable"
    table.dimensions = (2.20, 1.40, 0.05)
    bpy.ops.object.transform_apply(scale=True)

    mat_table = bpy.data.materials.new("Mat_Table_Wood")
    n = mat_table.node_tree.nodes
    l = mat_table.node_tree.links
    n.clear()
    out = n.new('ShaderNodeOutputMaterial')
    bsdf = n.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.65

    tex_coord = n.new('ShaderNodeTexCoord')
    img_wood = load_texture(tex_wood_path)
    if img_wood:
        tex_node = n.new('ShaderNodeTexImage')
        tex_node.image = img_wood
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.25
        l.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])

        mult = n.new('ShaderNodeMix')
        mult.data_type = 'RGBA'
        mult.blend_type = 'MULTIPLY'
        mult.inputs['Factor'].default_value = 0.45
        mult.inputs[7].default_value = (0.22, 0.15, 0.10, 1.0)
        l.new(tex_node.outputs['Color'], mult.inputs[6])
        l.new(mult.outputs[2], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.05, 0.035, 0.022, 1.0)

    l.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    table.data.materials.append(mat_table)
    bpy.ops.object.shade_smooth()

    # 2. Parede escura de gastropub no fundo (Y = 0.65m)
    bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0, 0.65, 0.40), rotation=(math.radians(90), 0, 0))
    wall = bpy.context.active_object
    wall.name = "GastropubWall"
    mat_wall = bpy.data.materials.new("Mat_Gastropub_Wall")
    nw = mat_wall.node_tree.nodes
    lw = mat_wall.node_tree.links
    nw.clear()
    out_w = nw.new('ShaderNodeOutputMaterial')
    bw = nw.new('ShaderNodeBsdfPrincipled')
    bw.inputs['Base Color'].default_value = (0.035, 0.022, 0.015, 1.0)
    bw.inputs['Roughness'].default_value = 0.95
    lw.new(bw.outputs['BSDF'], out_w.inputs['Surface'])
    wall.data.materials.append(mat_wall)

    # 3. Luzes Bokeh de gastropub suspensas no fundo
    mat_bokeh = bpy.data.materials.new("Mat_Golden_Bokeh")
    nb = mat_bokeh.node_tree.nodes
    lb = mat_bokeh.node_tree.links
    nb.clear()
    out_b = nb.new('ShaderNodeOutputMaterial')
    emit_b = nb.new('ShaderNodeEmission')
    emit_b.inputs['Color'].default_value = (1.0, 0.72, 0.30, 1.0)
    emit_b.inputs['Strength'].default_value = 24.0
    lb.new(emit_b.outputs['Emission'], out_b.inputs['Surface'])

    random.seed(42)
    for i in range(22):
        bx = random.uniform(-0.55, 0.40)
        by = random.uniform(0.48, 0.62)
        bz = random.uniform(0.12, 0.45)
        br = random.uniform(0.012, 0.028)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=br, location=(bx, by, bz))
        b_sph = bpy.context.active_object
        b_sph.name = f"Bokeh_Light_{i}"
        b_sph.data.materials.append(mat_bokeh)

def create_board(tex_wood_path):
    """Cria a tábua de corte de nogueira escura com canaleta de suco e cumbuca com ervas."""
    # Dimensões: 38cm x 22cm x 2.2cm. Topo em Z = 0.0 (centro em Z = -0.011)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.011))
    board = bpy.context.active_object
    board.name = "stage_board"
    board.dimensions = (0.38, 0.22, 0.022)
    bpy.ops.object.transform_apply(scale=True)

    bev = board.modifiers.new("Bevel", 'BEVEL')
    bev.width = 0.008
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Canaleta de suco (juice groove)
    bpy.ops.curve.primitive_bezier_circle_add(radius=1.0, location=(0, 0, 0.001))
    c = bpy.context.active_object
    c.scale = (0.170, 0.090, 1.0)
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

    # UV Smart Project
    bpy.context.view_layer.objects.active = board
    board.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')

    mat = bpy.data.materials.new("stage_board_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.50

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_wood_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_coord.outputs['UV'], tex_node.inputs['Vector'])

        mult = nodes.new('ShaderNodeMix')
        mult.data_type = 'RGBA'
        mult.blend_type = 'MULTIPLY'
        mult.inputs['Factor'].default_value = 0.35
        mult.inputs[7].default_value = (0.35, 0.22, 0.15, 1.0)
        links.new(tex_node.outputs['Color'], mult.inputs[6])
        links.new(mult.outputs[2], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.025
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.12, 0.07, 0.04, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    board.data.materials.append(mat)
    bpy.ops.object.shade_smooth()

    # Cumbuca cerâmica artesanal à direita (no enquadramento)
    dish_loc = (0.135, 0.050, 0.011)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.026, depth=0.022, location=dish_loc)
    dish = bpy.context.active_object
    dish.name = "RusticRamekin"
    bev_d = dish.modifiers.new("Bevel", 'BEVEL')
    bev_d.width = 0.003
    bev_d.segments = 2
    bpy.ops.object.modifier_apply(modifier="Bevel")

    mat_dish = bpy.data.materials.new("Mat_Ceramica_Preta")
    nd = mat_dish.node_tree.nodes
    ld = mat_dish.node_tree.links
    nd.clear()
    out_d = nd.new('ShaderNodeOutputMaterial')
    bd = nd.new('ShaderNodeBsdfPrincipled')
    bd.inputs['Base Color'].default_value = (0.04, 0.04, 0.045, 1.0)
    bd.inputs['Roughness'].default_value = 0.50
    ld.new(bd.outputs['BSDF'], out_d.inputs['Surface'])
    dish.data.materials.append(mat_dish)
    bpy.ops.object.shade_smooth()

    # Ervas e alecrim frescos na cumbuca
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.020, location=(dish_loc[0], dish_loc[1], dish_loc[2] + 0.008))
    herbs = bpy.context.active_object
    herbs.scale = (1.0, 1.0, 0.45)
    mat_h = bpy.data.materials.new("Mat_Ervas_Cumbuca")
    nh = mat_h.node_tree.nodes
    lh = mat_h.node_tree.links
    nh.clear()
    out_h = nh.new('ShaderNodeOutputMaterial')
    bh = nh.new('ShaderNodeBsdfPrincipled')
    bh.inputs['Base Color'].default_value = (0.08, 0.35, 0.05, 1.0)
    bh.inputs['Roughness'].default_value = 0.30
    lh.new(bh.outputs['BSDF'], out_h.inputs['Surface'])
    herbs.data.materials.append(mat_h)
    bpy.ops.object.shade_smooth()

    return board

def create_bread(tex_bread_path):
    """Cria a baguete artesanal canoa volumosa (5.4cm altura) com projeção de textura cilíndrica perfeita."""
    # Malha esferoidal de alta resolução
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.044, location=(0, 0, 0.027))
    bread = bpy.context.active_object
    bread.name = "stage_bread"
    bread.scale = (2.75, 1.0, 0.62) # 24cm de comprimento, 8.8cm de largura, 5.4cm de altura
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(bread.data)
    for v in bm.verts:
        nx = v.co.x / 0.12
        ny = v.co.y / 0.044

        # Afilamento elegante nas duas pontas
        taper = max(0.20, 1.0 - (abs(nx) ** 2.2) * 0.40)
        v.co.y *= taper
        v.co.z *= taper

        # Fundo assentado perfeitamente na tábua
        if v.co.z < 0.003:
            v.co.z = 0.001

        # Incisão canoa para o recheio de costela
        if v.co.z > 0.022 and abs(nx) < 0.82:
            dist_y = abs(v.co.y)
            if dist_y < 0.028:
                v.co.z -= 0.022 * (1.0 - (dist_y / 0.028) ** 2)

    bm.to_mesh(bread.data)
    bm.free()

    sub = bread.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 1
    bpy.ops.object.shade_smooth()

    # UV Unwrap: Mapeamento cilíndrico analítico perfeito (sem costuras ou distorções)
    bm = bmesh.new()
    bm.from_mesh(bread.data)
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            u = (loop.vert.co.x + 0.12) / 0.24
            angle = math.atan2(loop.vert.co.z - 0.027, loop.vert.co.y)
            v = (angle + math.pi) / (2 * math.pi)
            loop[uv_layer].uv = (u, v)
    bm.to_mesh(bread.data)
    bm.free()

    mat = bpy.data.materials.new("stage_bread_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.65

    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.08
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.70, 0.40)

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_bread_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_coord.outputs['UV'], tex_node.inputs['Vector'])

        # Realce da crosta dourada e farinha
        mix_gold = nodes.new('ShaderNodeMix')
        mix_gold.data_type = 'RGBA'
        mix_gold.blend_type = 'MULTIPLY'
        mix_gold.inputs['Factor'].default_value = 0.30
        mix_gold.inputs[7].default_value = (0.92, 0.65, 0.35, 1.0)
        links.new(tex_node.outputs['Color'], mix_gold.inputs[6])

        mix_flour = nodes.new('ShaderNodeMix')
        mix_flour.data_type = 'RGBA'
        mix_flour.blend_type = 'SCREEN'
        mix_flour.inputs['Factor'].default_value = 0.12
        mix_flour.inputs[7].default_value = (0.98, 0.96, 0.92, 1.0)
        links.new(mix_gold.outputs[2], mix_flour.inputs[6])
        links.new(mix_flour.outputs[2], bsdf.inputs['Base Color'])

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
    """Cria o recheio de costela desfiada 6h farto, suculento e laqueado."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.038))
    meat = bpy.context.active_object
    meat.name = "meat_mound_base"
    meat.dimensions = (0.19, 0.058, 0.026)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(meat.data)
    for v in bm.verts:
        nx = abs(v.co.x) / 0.095
        v.co.y *= max(0.35, 1.0 - (nx ** 2) * 0.50)
    bm.to_mesh(meat.data)
    bm.free()

    sub = meat.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2

    disp = meat.modifiers.new("MeatRoughness", 'DISPLACE')
    tex_m = bpy.data.textures.new("MeatNoisePass9", 'CLOUDS')
    tex_m.noise_scale = 0.012
    disp.texture = tex_m
    disp.strength = 0.005
    bpy.ops.object.shade_smooth()

    # UV Unwrap
    bpy.context.view_layer.objects.active = meat
    meat.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')

    mat = bpy.data.materials.new("filling_costela_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.18
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.65

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_meat_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_coord.outputs['UV'], tex_node.inputs['Vector'])

        mix_tint = nodes.new('ShaderNodeMix')
        mix_tint.data_type = 'RGBA'
        mix_tint.blend_type = 'MULTIPLY'
        mix_tint.inputs['Factor'].default_value = 0.45
        mix_tint.inputs[7].default_value = (0.28, 0.10, 0.04, 1.0)
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

    return empty, meat

def create_cheese(tex_cheese_path, meat_target):
    """Cria o manto de queijo fundido drapeado com manchas ricas de maçarico (leopard spots)."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=42, y_subdivisions=24, size=1.0, location=(0, 0, 0.056))
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
    sol.thickness = 0.0045
    bpy.ops.object.modifier_apply(modifier="CheeseSolidify")

    sub = cheese.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    bpy.ops.object.shade_smooth()

    # UV Unwrap: Projeção planar superior analítica perfeita para manchas de maçarico
    bm = bmesh.new()
    bm.from_mesh(cheese.data)
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        for loop in face.loops:
            u = (loop.vert.co.x + 0.105) / 0.21
            v = (loop.vert.co.y + 0.035) / 0.070
            loop[uv_layer].uv = (u, v)
    bm.to_mesh(cheese.data)
    bm.free()

    mat = bpy.data.materials.new("stage_gratin_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.24
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.60

    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.10
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = (0.95, 0.85, 0.55)

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_cheese_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_coord.outputs['UV'], tex_node.inputs['Vector'])

        mix_cheese = nodes.new('ShaderNodeMix')
        mix_cheese.data_type = 'RGBA'
        mix_cheese.blend_type = 'MULTIPLY'
        mix_cheese.inputs['Factor'].default_value = 0.35
        mix_cheese.inputs[7].default_value = (0.96, 0.88, 0.65, 1.0)
        links.new(tex_node.outputs['Color'], mix_cheese.inputs[6])
        links.new(mix_cheese.outputs[2], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.035
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.95, 0.86, 0.60, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    cheese.data.materials.append(mat)
    return cheese

def setup_chef_hand_and_torch(hand_glb_path):
    """Importa o modelo 3D da mão do chef com dólmã preta e conecta ao maçarico culinário."""
    torch_rot = (math.radians(-32), math.radians(16), math.radians(-25))
    
    # Importa a mão do chef modelada (alhoaria-mao-chef.glb)
    if os.path.exists(hand_glb_path):
        bpy.ops.import_scene.gltf(filepath=hand_glb_path)
        hand_root = bpy.data.objects.get("chef_hand_root")
        if hand_root:
            # Posiciona a mão segurando o maçarico no canto superior direito
            hand_root.location = (0.115, -0.045, 0.155)
            hand_root.rotation_euler = (math.radians(-25), math.radians(20), math.radians(-30))
            hand_root.scale = (1.1, 1.1, 1.1)
    
    # Empunhadura e maçarico
    grip_pos = (0.090, -0.040, 0.130)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.013, depth=0.060, location=grip_pos, rotation=torch_rot)
    grip = bpy.context.active_object
    grip.name = "BlowtorchGrip"
    mat_grip = bpy.data.materials.new("Mat_Blowtorch_Grip")
    ng = mat_grip.node_tree.nodes
    lg = mat_grip.node_tree.links
    ng.clear()
    out_g = ng.new('ShaderNodeOutputMaterial')
    bg = ng.new('ShaderNodeBsdfPrincipled')
    bg.inputs['Base Color'].default_value = (0.07, 0.07, 0.08, 1.0)
    bg.inputs['Roughness'].default_value = 0.35
    lg.new(bg.outputs['BSDF'], out_g.inputs['Surface'])
    grip.data.materials.append(mat_grip)
    bpy.ops.object.shade_smooth()

    # Canister de gás azul/metálico
    canister_pos = (0.108, -0.052, 0.105)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.068, location=canister_pos, rotation=torch_rot)
    canister = bpy.context.active_object
    canister.name = "BlowtorchCanister"
    mat_can = bpy.data.materials.new("Mat_Butane_Canister")
    nc = mat_can.node_tree.nodes
    lc = mat_can.node_tree.links
    nc.clear()
    out_c = nc.new('ShaderNodeOutputMaterial')
    bc = nc.new('ShaderNodeBsdfPrincipled')
    bc.inputs['Base Color'].default_value = (0.10, 0.28, 0.65, 1.0)
    bc.inputs['Metallic'].default_value = 0.85
    bc.inputs['Roughness'].default_value = 0.28
    lc.new(bc.outputs['BSDF'], out_c.inputs['Surface'])
    canister.data.materials.append(mat_can)
    bpy.ops.object.shade_smooth()

    # Bocal metálico de aço inox
    nozzle_pos = (0.062, -0.024, 0.092)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0055, depth=0.040, location=nozzle_pos, rotation=torch_rot)
    nozzle = bpy.context.active_object
    nozzle.name = "BlowtorchNozzle"
    mat_noz = bpy.data.materials.new("Mat_Nozzle_Steel")
    nz = mat_noz.node_tree.nodes
    lz = mat_noz.node_tree.links
    nz.clear()
    out_z = nz.new('ShaderNodeOutputMaterial')
    bz = nz.new('ShaderNodeBsdfPrincipled')
    bz.inputs['Base Color'].default_value = (0.85, 0.85, 0.88, 1.0)
    bz.inputs['Metallic'].default_value = 0.95
    bz.inputs['Roughness'].default_value = 0.15
    lz.new(bz.outputs['BSDF'], out_z.inputs['Surface'])
    nozzle.data.materials.append(mat_noz)
    bpy.ops.object.shade_smooth()

    # JATO DE CHAMA CULINÁRIA (Cone emissivo)
    flame_inner_pos = (0.038, -0.008, 0.068)
    bpy.ops.mesh.primitive_cone_add(radius1=0.0045, depth=0.028, location=flame_inner_pos, rotation=torch_rot)
    f_inner = bpy.context.active_object
    f_inner.name = "FlameCoreBlue"
    mat_f_in = bpy.data.materials.new("Mat_Flame_Core_Blue")
    nfi = mat_f_in.node_tree.nodes
    lfi = mat_f_in.node_tree.links
    nfi.clear()
    out_fi = nfi.new('ShaderNodeOutputMaterial')
    emit_fi = nfi.new('ShaderNodeEmission')
    emit_fi.inputs['Color'].default_value = (0.15, 0.65, 1.0, 1.0)
    emit_fi.inputs['Strength'].default_value = 50.0
    lfi.new(emit_fi.outputs['Emission'], out_fi.inputs['Surface'])
    f_inner.data.materials.append(mat_f_in)
    bpy.ops.object.shade_smooth()

    flame_out_pos = (0.024, 0.002, 0.056)
    bpy.ops.mesh.primitive_cone_add(radius1=0.0085, depth=0.038, location=flame_out_pos, rotation=torch_rot)
    f_outer = bpy.context.active_object
    f_outer.name = "FlamePlumeAmber"
    mat_f_out = bpy.data.materials.new("Mat_Flame_Plume_Amber")
    nfo = mat_f_out.node_tree.nodes
    lfo = mat_f_out.node_tree.links
    nfo.clear()
    out_fo = nfo.new('ShaderNodeOutputMaterial')
    emit_fo = nfo.new('ShaderNodeEmission')
    emit_fo.inputs['Color'].default_value = (1.0, 0.45, 0.06, 1.0)
    emit_fo.inputs['Strength'].default_value = 28.0
    lfo.new(emit_fo.outputs['Emission'], out_fo.inputs['Surface'])
    f_outer.data.materials.append(mat_f_out)
    bpy.ops.object.shade_smooth()

    # Luz emitida pelo contato da chama no queijo
    bpy.ops.object.light_add(type='POINT', radius=0.015, location=(0.015, 0.005, 0.055))
    flame_light = bpy.context.active_object
    flame_light.name = "FlamePointLight"
    flame_light.data.energy = 50.0
    flame_light.data.color = (1.0, 0.52, 0.12)

    # Faíscas incandescentes
    mat_spark = bpy.data.materials.new("Mat_Spark_Ember")
    nsp = mat_spark.node_tree.nodes
    lsp = mat_spark.node_tree.links
    nsp.clear()
    out_sp = nsp.new('ShaderNodeOutputMaterial')
    emit_sp = nsp.new('ShaderNodeEmission')
    emit_sp.inputs['Color'].default_value = (1.0, 0.82, 0.25, 1.0)
    emit_sp.inputs['Strength'].default_value = 55.0
    lsp.new(emit_sp.outputs['Emission'], out_sp.inputs['Surface'])

    random.seed(44)
    for i in range(16):
        sx = random.uniform(0.005, 0.040)
        sy = random.uniform(-0.015, 0.015)
        sz = random.uniform(0.054, 0.078)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.0008, 0.0016), location=(sx, sy, sz))
        spark = bpy.context.active_object
        spark.data.materials.append(mat_spark)

def create_garnishes():
    """Salpica cebolinha fresca picada e flor de sal na tábua e queijo."""
    mat_c = bpy.data.materials.new("Mat_Cebolinha_Verde")
    nc = mat_c.node_tree.nodes
    lc = mat_c.node_tree.links
    nc.clear()
    out_c = nc.new('ShaderNodeOutputMaterial')
    bc = nc.new('ShaderNodeBsdfPrincipled')
    bc.inputs['Base Color'].default_value = (0.10, 0.45, 0.07, 1.0)
    bc.inputs['Roughness'].default_value = 0.28
    lc.new(bc.outputs['BSDF'], out_c.inputs['Surface'])

    mat_s = bpy.data.materials.new("Mat_Flor_De_Sal")
    ns = mat_s.node_tree.nodes
    ls = mat_s.node_tree.links
    ns.clear()
    out_s = ns.new('ShaderNodeOutputMaterial')
    bs = ns.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Base Color'].default_value = (0.98, 0.98, 0.99, 1.0)
    bs.inputs['Roughness'].default_value = 0.12
    if 'Transmission Weight' in bs.inputs:
        bs.inputs['Transmission Weight'].default_value = 0.65
    ls.new(bs.outputs['BSDF'], out_s.inputs['Surface'])

    random.seed(101)
    for i in range(32):
        if i < 20:
            x = random.uniform(-0.078, 0.078)
            y = random.uniform(-0.018, 0.018)
            z = 0.053
        else:
            x = random.uniform(-0.14, 0.12)
            y = random.choice([random.uniform(0.045, 0.070), random.uniform(-0.070, -0.045)])
            z = 0.001

        bpy.ops.mesh.primitive_cylinder_add(radius=0.0020, depth=0.0012, vertices=8, location=(x, y, z))
        c = bpy.context.active_object
        c.rotation_euler = (random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2), random.uniform(0, math.pi))
        c.data.materials.append(mat_c)
        bpy.ops.object.shade_smooth()

    for i in range(22):
        x = random.uniform(-0.15, 0.13)
        y = random.uniform(-0.075, 0.075)
        z = 0.001
        bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.0012, 0.0018), subdivisions=1, location=(x, y, z))
        s = bpy.context.active_object
        s.rotation_euler = (random.uniform(0, 3), random.uniform(0, 3), random.uniform(0, 3))
        s.data.materials.append(mat_s)

def setup_cycles_optix_and_hero_camera(render_path):
    """Configura Cycles OptiX, Denoising, Iluminação de 3 pontos culinária e Câmera Heroica 3/4."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'

    cycles_pref = bpy.context.preferences.addons.get('cycles')
    if cycles_pref:
        cpref = cycles_pref.preferences
        cpref.compute_device_type = 'OPTIX'
        for d in cpref.get_devices_for_type('OPTIX'):
            d.use = True
        scene.cycles.device = 'GPU'
        print(">> Cycles OptiX GPU habilitado!")
    else:
        scene.cycles.device = 'CPU'

    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.filepath = render_path

    # Alvo da câmera no centro do sanduíche
    target = bpy.data.objects.new("CameraTarget", None)
    bpy.context.collection.objects.link(target)
    target.location = (0.010, 0.0, 0.035)

    # Câmera Heroica 3/4 (~25 graus de elevação, lente 54mm para capturar toda a composição com respiro)
    cam_data = bpy.data.cameras.new("HeroCamera")
    cam_data.lens = 54
    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = target
    cam_data.dof.aperture_fstop = 8.0 # Sanduíche nítido de ponta a ponta

    cam_obj = bpy.data.objects.new("HeroCamera", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Posicionamento da câmera: X=0.035, Y=-0.36, Z=0.170 (elevação ~25°, 3/4 frontal)
    cam_obj.location = (0.035, -0.36, 0.170)

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    bpy.context.view_layer.update()

    # ILUMINAÇÃO DE ESTÚDIO CULINÁRIO
    # 1. Key Light Quente (frontal superior direita)
    bpy.ops.object.light_add(type='SPOT', radius=0.25, location=(0.18, -0.28, 0.35))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 85.0
    key.data.color = (1.0, 0.94, 0.85)
    key.data.spot_size = math.radians(55)
    key.data.spot_blend = 0.40

    # 2. Rim Light Âmbar (recorte quente nas costas do pão)
    bpy.ops.object.light_add(type='POINT', radius=0.08, location=(-0.20, 0.20, 0.20))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = 95.0
    rim.data.color = (1.0, 0.50, 0.10)

    # 3. Fill Light suave
    bpy.ops.object.light_add(type='POINT', radius=0.40, location=(-0.25, -0.20, 0.20))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = 28.0
    fill.data.color = (0.92, 0.88, 0.82)

    # 4. Luz ambiente quente
    world = scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.04, 0.028, 0.020, 1.0)
        bg.inputs['Strength'].default_value = 0.85

    print(f">> Iniciando renderização Cycles OptiX (128 amostras)...")
    bpy.ops.render.render(write_still=True)
    print(f">> Render Pass 9 salvo em: {render_path}")

def main():
    print("=====================================================")
    print(">> Executando Pass 9: Obra-Prima Culinária Alhoaria...")
    clean_scene()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    concepts_dir = os.path.join(project_root, "public", "assets", "concepts")
    models_dir = os.path.join(project_root, "public", "assets", "models")

    tex_wood = os.path.join(concepts_dir, "texture_dark_wood.jpg")
    tex_bread = os.path.join(concepts_dir, "texture_bread_crust.jpg")
    tex_meat = os.path.join(concepts_dir, "texture_costela_meat.jpg")
    tex_cheese = os.path.join(concepts_dir, "texture_cheese_torch.jpg")
    hand_glb = os.path.join(models_dir, "alhoaria-mao-chef.glb")

    create_environment(tex_wood)
    board = create_board(tex_wood)
    bread = create_bread(tex_bread)
    ribs_empty, meat_base = create_costela(tex_meat)
    cheese = create_cheese(tex_cheese, meat_base)
    setup_chef_hand_and_torch(hand_glb)
    create_garnishes()

    render_file = os.path.join(concepts_dir, "candidate_render_pass9.png")
    setup_cycles_optix_and_hero_camera(render_file)
    print(">> PASS 9 CONCLUÍDO COM SUCESSO!")
    print("=====================================================")

if __name__ == "__main__":
    main()
