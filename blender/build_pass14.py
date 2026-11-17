"""
ALHOARIA 3D PRODUCTION PIPELINE - PASS 14
Precision alignment with approved concept art (alhoaria_pao_de_alho_3d_stylized.jpg).
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

def load_img(path):
    if os.path.exists(path):
        return bpy.data.images.load(path)
    return None

def create_environment(hdri_path):
    world = bpy.context.scene.world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputWorld')
    bg = nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.50 # Fundo escuro e intimista como o concept
    bg.inputs['Color'].default_value = (0.02, 0.015, 0.01, 1.0) # Tom escuro de base

    img = load_img(hdri_path)
    if img:
        env = nodes.new('ShaderNodeTexEnvironment')
        env.image = img
        links.new(env.outputs['Color'], bg.inputs['Color'])
    
    links.new(bg.outputs['Background'], out.inputs['Surface'])

    # Parede de fundo de pub escuro com bokeh suave
    bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0, 0.55, 0.25))
    wall = bpy.context.active_object
    wall.rotation_euler = (math.radians(90), 0, 0)
    mat_wall = bpy.data.materials.new("Mat_Pub_Wall")
    nw = mat_wall.node_tree.nodes
    lw = mat_wall.node_tree.links
    nw.clear()
    out_w = nw.new('ShaderNodeOutputMaterial')
    bsdf_w = nw.new('ShaderNodeBsdfPrincipled')
    bsdf_w.inputs['Base Color'].default_value = (0.04, 0.02, 0.015, 1.0) # Tijolo rústico escuro
    bsdf_w.inputs['Roughness'].default_value = 0.90
    lw.new(bsdf_w.outputs['BSDF'], out_w.inputs['Surface'])
    wall.data.materials.append(mat_wall)

    # 4 Lâmpadas quentes fora de foco no fundo (criando o bokeh do concept)
    bokeh_locs = [(-0.35, 0.48, 0.28), (-0.12, 0.52, 0.35), (0.18, 0.50, 0.32), (0.42, 0.48, 0.26)]
    for idx, bloc in enumerate(bokeh_locs):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.025, location=bloc)
        b_sph = bpy.context.active_object
        mat_b = bpy.data.materials.new(f"Mat_Bokeh_{idx}")
        nb = mat_b.node_tree.nodes
        lb = mat_b.node_tree.links
        nb.clear()
        out_b = nb.new('ShaderNodeOutputMaterial')
        emit_b = nb.new('ShaderNodeEmission')
        emit_b.inputs['Color'].default_value = (1.0, 0.65, 0.18, 1.0)
        emit_b.inputs['Strength'].default_value = 8.0
        lb.new(emit_b.outputs['Emission'], out_b.inputs['Surface'])
        b_sph.data.materials.append(mat_b)

def create_table_and_board(board_blend_path, tex_wood_path):
    """Mesa e tábua de corte escura com canaleta conforme o concept."""
    # 1. Bancada de madeira escura sob a tábua
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.0, -0.015))
    table = bpy.context.active_object
    table.name = "CounterTable"
    table.dimensions = (1.60, 0.90, 0.03)
    bpy.ops.object.transform_apply(scale=True)

    mat_table = bpy.data.materials.new("Mat_Table_Dark")
    nt = mat_table.node_tree.nodes
    lt = mat_table.node_tree.links
    nt.clear()
    out_t = nt.new('ShaderNodeOutputMaterial')
    bsdf_t = nt.new('ShaderNodeBsdfPrincipled')
    bsdf_t.inputs['Base Color'].default_value = (0.05, 0.03, 0.02, 1.0)
    bsdf_t.inputs['Roughness'].default_value = 0.60
    lt.new(bsdf_t.outputs['BSDF'], out_t.inputs['Surface'])
    table.data.materials.append(mat_table)
    bpy.ops.object.shade_smooth()

    # 2. Tábua de corte: carvalho escuro / nogueira carbonizada com canaleta (juice groove)
    # Importa da Poly Haven ou constrói modelo rústico escurecido
    board_top_z = 0.025
    board_loaded = False
    if os.path.exists(board_blend_path):
        try:
            with bpy.data.libraries.load(board_blend_path, link=False) as (df, dt):
                dt.objects = [n for n in df.objects if "board" in n.lower()]
            if dt.objects:
                board = dt.objects[0]
                bpy.context.collection.objects.link(board)
                board.name = "stage_board"
                board.scale = (0.86, 0.86, 0.86)
                board.location = (0.0, 0.01, 0.0)
                bpy.ops.object.select_all(action='DESELECT')
                board.select_set(True)
                bpy.context.view_layer.objects.active = board
                bpy.ops.object.transform_apply(scale=True)

                # Ajusta os materiais para nogueira carbonizada escura
                for mat in board.data.materials:
                    if mat and mat.use_nodes:
                        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                        if bsdf:
                            # Acha o link do Base Color
                            bc_links = [l for l in mat.node_tree.links if l.to_socket == bsdf.inputs['Base Color']]
                            if bc_links:
                                src_socket = bc_links[0].from_socket
                                mat.node_tree.links.remove(bc_links[0])
                                mix = mat.node_tree.nodes.new('ShaderNodeMix')
                                mix.data_type = 'RGBA'
                                mix.blend_type = 'MULTIPLY'
                                mix.inputs['Factor'].default_value = 0.82
                                mix.inputs[7].default_value = (0.12, 0.08, 0.05, 1.0) # Carvalho carbonizado escuro
                                mat.node_tree.links.new(src_socket, mix.inputs[6])
                                mat.node_tree.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
                            else:
                                bsdf.inputs['Base Color'].default_value = (0.08, 0.05, 0.03, 1.0)
                            bsdf.inputs['Roughness'].default_value = 0.45
                board_top_z = 0.0348
                board_loaded = True
                print(">> Tábua Poly Haven escurecida com sucesso!")
        except Exception as e:
            print(f">> Erro ao carregar tábua Poly Haven: {e}")

    if not board_loaded:
        # Cria tábua de corte escura com canaleta chanfrada
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.01, 0.0125))
        board = bpy.context.active_object
        board.name = "stage_board"
        board.dimensions = (0.36, 0.22, 0.025)
        bpy.ops.object.transform_apply(scale=True)
        bev = board.modifiers.new("BoardBevel", 'BEVEL')
        bev.width = 0.012
        bev.segments = 4
        bpy.ops.object.modifier_apply(modifier="BoardBevel")

        mat_b = bpy.data.materials.new("Mat_Rustic_Board")
        nb = mat_b.node_tree.nodes
        lb = mat_b.node_tree.links
        nb.clear()
        out_b = nb.new('ShaderNodeOutputMaterial')
        bsdf_b = nb.new('ShaderNodeBsdfPrincipled')
        bsdf_b.inputs['Base Color'].default_value = (0.10, 0.07, 0.045, 1.0) # Nogueira escura
        bsdf_b.inputs['Roughness'].default_value = 0.45
        lb.new(bsdf_b.outputs['BSDF'], out_b.inputs['Surface'])
        board.data.materials.append(mat_b)
        board_top_z = 0.025

    return board, board_top_z

def create_artisanal_baguette(board_top_z, tex_bread_path):
    """
    Constrói a baguete artesanal canoa com malha segmentada (42 segmentos longitudinais),
    abertura em V, e mapeamento UV contínuo.
    """
    loaf_len = 0.250   # 25 cm de comprimento
    loaf_width = 0.078 # 7.8 cm de largura
    loaf_height = 0.052 # 5.2 cm de altura total
    center_z = board_top_z + loaf_height * 0.50

    # Cria grid cilíndrico altamente segmentado
    # 42 anéis ao longo de X, 24 vértices ao redor da circunferência
    bm = bmesh.new()
    num_x = 44
    num_circ = 28

    verts_grid = []
    for ix in range(num_x):
        u = ix / (num_x - 1)
        x = (u - 0.5) * loaf_len
        nx = (u - 0.5) * 2.0 # -1.0 a +1.0

        # Taper orgânico nas duas pontas da baguete
        taper = max(0.18, (1.0 - (abs(nx) ** 2.2)) ** 0.40)
        ring = []
        for ic in range(num_circ):
            theta = (ic / num_circ) * 2.0 * math.pi
            # Elipse da seção transversal
            ry = math.sin(theta) * (loaf_width * 0.50) * taper
            rz = math.cos(theta) * (loaf_height * 0.50) * taper

            vz = center_z + rz
            vy = ry

            # Aplainamento da base para apoiar firmemente na tábua
            if vz < board_top_z + 0.002:
                vz = board_top_z + 0.001

            # Abertura em canoa na parte superior para abrigar a costela
            # Abertura entre x = -0.10 e +0.10
            if abs(nx) < 0.85 and vz > center_z:
                dist_center_y = abs(vy) / (loaf_width * 0.50 * taper)
                if dist_center_y < 0.85:
                    depth_factor = (1.0 - dist_center_y ** 2) * 0.016
                    vz -= depth_factor

            v = bm.verts.new((x, vy, vz))
            ring.append(v)
        verts_grid.append(ring)

    # Cria as faces quadrangulares
    for ix in range(num_x - 1):
        for ic in range(num_circ):
            next_ic = (ic + 1) % num_circ
            v0 = verts_grid[ix][ic]
            v1 = verts_grid[ix + 1][ic]
            v2 = verts_grid[ix + 1][next_ic]
            v3 = verts_grid[ix][next_ic]
            bm.faces.new((v0, v1, v2, v3))

    # Fecha as pontas com polígonos
    tip_start = bm.verts.new((-loaf_len * 0.50, 0, center_z))
    for ic in range(num_circ):
        next_ic = (ic + 1) % num_circ
        bm.faces.new((tip_start, verts_grid[0][next_ic], verts_grid[0][ic]))

    tip_end = bm.verts.new((loaf_len * 0.50, 0, center_z))
    for ic in range(num_circ):
        next_ic = (ic + 1) % num_circ
        bm.faces.new((tip_end, verts_grid[-1][ic], verts_grid[-1][next_ic]))

    # Gera coordenadas UV cilíndricas perfeitas
    uv_layer = bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        for loop in face.loops:
            vx = loop.vert.co.x
            vy = loop.vert.co.y
            vz = loop.vert.co.z - center_z
            u_coord = (vx / loaf_len) + 0.50
            angle = math.atan2(vy, vz) # -pi a +pi
            v_coord = (angle / (2.0 * math.pi)) + 0.50
            loop[uv_layer].uv = (u_coord * 1.5, v_coord)

    bread_mesh = bpy.data.meshes.new("stage_bread_mesh")
    bm.to_mesh(bread_mesh)
    bm.free()

    bread = bpy.data.objects.new("stage_bread", bread_mesh)
    bpy.context.collection.objects.link(bread)
    bpy.context.view_layer.objects.active = bread

    # Modificador de suavização e micro-relevo de crosta
    sub = bread.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 1
    disp = bread.modifiers.new("CrustBumps", 'DISPLACE')
    tex_crust = bpy.data.textures.new("BreadCrustDisp", 'CLOUDS')
    tex_crust.noise_scale = 0.008
    disp.texture = tex_crust
    disp.strength = 0.002
    bpy.ops.object.shade_smooth()

    # Material PBR com a textura real de crosta dourada
    mat = bpy.data.materials.new("Mat_Artisanal_Bread")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.62
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.10
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.70, 0.35)

    img = load_img(tex_bread_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_coord = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (2.0, 2.0, 2.0)
        links.new(tex_coord.outputs['UV'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], tex_node.inputs['Vector'])

        # Multiplica por tom dourado para garantir a cor de forno artesanal
        mix_gold = nodes.new('ShaderNodeMix')
        mix_gold.data_type = 'RGBA'
        mix_gold.blend_type = 'MULTIPLY'
        mix_gold.inputs['Factor'].default_value = 0.40
        mix_gold.inputs[7].default_value = (0.95, 0.65, 0.32, 1.0) # Dourado de forno
        links.new(tex_node.outputs['Color'], mix_gold.inputs[6])
        links.new(mix_gold.outputs[2], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.04
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.86, 0.58, 0.28, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bread.data.materials.append(mat)

    return bread, center_z

def create_costela_filling(center_z, tex_meat_path):
    """
    Constrói a costela bovina 6h desfiada farta, com malha base enrugada
    e mechas de fibras brilhantes de molho laqueado transbordando pelas bordas.
    """
    meat_z = center_z + 0.010
    # Base volumosa preenchendo a canoa
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.0, meat_z))
    meat_core = bpy.context.active_object
    meat_core.name = "meat_core"
    meat_core.dimensions = (0.21, 0.065, 0.024)
    bpy.ops.object.transform_apply(scale=True)

    # Deforma o miolo da carne
    bm = bmesh.new()
    bm.from_mesh(meat_core.data)
    for v in bm.verts:
        nx = abs(v.co.x) / 0.105
        v.co.y *= max(0.45, 1.0 - (nx ** 2.0) * 0.45)
    bm.to_mesh(meat_core.data)
    bm.free()

    sub = meat_core.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    disp = meat_core.modifiers.new("MeatRoughness", 'DISPLACE')
    tex_m = bpy.data.textures.new("MeatShredNoise", 'CLOUDS')
    tex_m.noise_scale = 0.007
    disp.texture = tex_m
    disp.strength = 0.005
    bpy.ops.object.shade_smooth()

    # Material de costela suculenta laqueada
    mat_meat = bpy.data.materials.new("Mat_Costela_PBR")
    mat_meat.use_nodes = True
    nodes = mat_meat.node_tree.nodes
    links = mat_meat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.24 # Brilho suculento de gordura e molho
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.65

    img = load_img(tex_meat_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_coord = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (3.5, 3.5, 3.5) # Fibras densas
        links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], tex_node.inputs['Vector'])

        mix_tint = nodes.new('ShaderNodeMix')
        mix_tint.data_type = 'RGBA'
        mix_tint.blend_type = 'MULTIPLY'
        mix_tint.inputs['Factor'].default_value = 0.50
        mix_tint.inputs[7].default_value = (0.28, 0.10, 0.04, 1.0) # Marrom braseado profundo
        links.new(tex_node.outputs['Color'], mix_tint.inputs[6])
        links.new(mix_tint.outputs[2], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.06
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.24, 0.09, 0.04, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    meat_core.data.materials.append(mat_meat)

    # Empty pai para o recheio
    filling_root = bpy.data.objects.new("filling_costela", None)
    bpy.context.collection.objects.link(filling_root)
    meat_core.parent = filling_root

    # Mechas orgânicas de costela desfiada transbordando pelas laterais
    random.seed(88)
    for i in range(48):
        cx = random.uniform(-0.095, 0.095)
        side = 1.0 if (i % 2 == 0) else -1.0
        cy = side * random.uniform(0.024, 0.035)
        cz = meat_z + random.uniform(-0.002, 0.007)

        curve = bpy.data.curves.new(f"CostelaFiber_{i}", type='CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = random.uniform(0.0018, 0.0028)
        curve.bevel_resolution = 2

        spline = curve.splines.new('BEZIER')
        spline.bezier_points.add(2)
        p0, p1, p2 = spline.bezier_points[0], spline.bezier_points[1], spline.bezier_points[2]

        length = random.uniform(0.025, 0.042)
        p0.co = (cx - length * 0.45, cy, cz)
        p1.co = (cx, cy + side * random.uniform(0.003, 0.008), cz + 0.002)
        p2.co = (cx + length * 0.45, cy + side * random.uniform(0.005, 0.012), cz - 0.006)

        for p in (p0, p1, p2):
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'

        f_obj = bpy.data.objects.new(f"filling_fiber_{i:02d}", curve)
        bpy.context.collection.objects.link(f_obj)
        f_obj.parent = filling_root
        f_obj.data.materials.append(mat_meat)

    return filling_root, meat_core, meat_z

def create_melted_cheese(meat_z, meat_core, tex_cheese_path):
    """
    Constrói a camada de queijo derretido drapeado com bordas recortadas (drips)
    e manchas de maçarico (leopard spots) autênticas conforme o concept.
    """
    cheese_z = meat_z + 0.012
    # Malha do queijo: 0.19m de comprimento, 0.054m de largura
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=24, size=1.0, location=(0, 0, cheese_z))
    cheese = bpy.context.active_object
    cheese.name = "stage_gratin"
    cheese.dimensions = (0.19, 0.054, 1.0)
    cheese.scale.z = 1.0
    bpy.ops.object.transform_apply(scale=True)

    # Ondulações nas bordas para formar línguas de queijo derretido escorrendo
    bm = bmesh.new()
    bm.from_mesh(cheese.data)
    for v in bm.verts:
        # Fator de borda Y
        edge_y = abs(v.co.y) / 0.027
        if edge_y > 0.65:
            # Drips periódicos ao longo de X
            drip = math.sin(v.co.x * 65.0) * 0.005 + math.cos(v.co.x * 32.0) * 0.003
            v.co.y += math.copysign(drip, v.co.y)
            v.co.z -= abs(drip) * 0.8
    bm.to_mesh(cheese.data)
    bm.free()

    # Shrinkwrap para assentar suavemente sobre a costela
    sw = cheese.modifiers.new("CheeseDrape", 'SHRINKWRAP')
    sw.target = meat_core
    sw.wrap_method = 'NEAREST_SURFACEPOINT'
    sw.offset = 0.0025
    bpy.ops.object.modifier_apply(modifier="CheeseDrape")

    sol = cheese.modifiers.new("CheeseThickness", 'SOLIDIFY')
    sol.thickness = 0.0035
    bpy.ops.object.modifier_apply(modifier="CheeseThickness")

    sub = cheese.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    bpy.ops.object.shade_smooth()

    # Gera UVs perfeitos para mapeamento do queijo tostado
    bpy.context.view_layer.objects.active = cheese
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.uv.smart_project(angle_limit=66.0)
    bpy.ops.object.mode_set(mode='OBJECT')

    mat_cheese = bpy.data.materials.new("Mat_Cheese_Gratin")
    mat_cheese.use_nodes = True
    nodes = mat_cheese.node_tree.nodes
    links = mat_cheese.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.20 # Queijo derretido reluzente de gordura
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.60
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.18
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = (0.95, 0.85, 0.55)

    img = load_img(tex_cheese_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_coord = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (2.2, 2.2, 2.2) # Manchas de maçarico do tamanho correto
        links.new(tex_coord.outputs['UV'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], tex_node.inputs['Vector'])

        # O queijo tostado no concept é dourado com manchas pretas/castanhas
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.04
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.95, 0.88, 0.65, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    cheese.data.materials.append(mat_cheese)

    return cheese, cheese_z

def create_chef_hand_and_blowtorch(cheese_z, hand_glb_path):
    """
    Constrói a presença do Chef e Maçarico exatamente como no Concept:
    - Braço com dólmã preta e botões duplos
    - Mão humana estilizada (pele tom pêssego) segurando a empunhadura
    - Maçarico profissional com gatilho laranja, bocal de aço inox
    - Chama viva apontada para o queijo com cone azul interno e chama laranja
    - Faíscas incandescentes flutuando
    """
    # Posição do ponto de contato da chama no queijo
    flame_target = mathutils.Vector((0.045, -0.005, cheese_z + 0.004))

    # Ângulo do maçarico: apontando diagonalmente de cima à direita para o queijo
    # Vetor de direção da chama: do maçarico para flame_target
    torch_nozzle_pos = mathutils.Vector((0.095, -0.025, cheese_z + 0.055))

    # 1. Bocal usinado de aço inox do maçarico
    # Orientado em direção a flame_target
    v_dir = flame_target - torch_nozzle_pos
    v_dir.normalize()
    rot_quat = v_dir.to_track_quat('-Z', 'Y')
    rot_euler = rot_quat.to_euler()

    # Grupo do Maçarico
    torch_root = bpy.data.objects.new("chef_blowtorch_assembly", None)
    bpy.context.collection.objects.link(torch_root)

    # Tubo de aço inox
    bpy.ops.mesh.primitive_cylinder_add(radius=0.006, depth=0.038, location=torch_nozzle_pos)
    nozzle = bpy.context.active_object
    nozzle.rotation_euler = rot_euler
    nozzle.name = "TorchNozzleSteel"
    nozzle.parent = torch_root
    mat_steel = bpy.data.materials.new("Mat_Torch_Steel")
    mat_steel.use_nodes = True
    ns = mat_steel.node_tree.nodes
    ls = mat_steel.node_tree.links
    ns.clear()
    out_s = ns.new('ShaderNodeOutputMaterial')
    bs_s = ns.new('ShaderNodeBsdfPrincipled')
    bs_s.inputs['Base Color'].default_value = (0.85, 0.85, 0.88, 1.0)
    bs_s.inputs['Metallic'].default_value = 0.95
    bs_s.inputs['Roughness'].default_value = 0.15
    ls.new(bs_s.outputs['BSDF'], out_s.inputs['Surface'])
    nozzle.data.materials.append(mat_steel)
    bpy.ops.object.shade_smooth()

    # Anel e corpo de ignição preto
    body_pos = torch_nozzle_pos + (-v_dir * 0.035)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.014, depth=0.045, location=body_pos)
    body = bpy.context.active_object
    body.rotation_euler = rot_euler
    body.name = "TorchBodyBlack"
    body.parent = torch_root
    mat_body = bpy.data.materials.new("Mat_Torch_Body")
    mat_body.use_nodes = True
    nb = mat_body.node_tree.nodes
    lb = mat_body.node_tree.links
    nb.clear()
    out_b = nb.new('ShaderNodeOutputMaterial')
    bs_b = nb.new('ShaderNodeBsdfPrincipled')
    bs_b.inputs['Base Color'].default_value = (0.06, 0.06, 0.07, 1.0) # Preto acetinado
    bs_b.inputs['Roughness'].default_value = 0.35
    lb.new(bs_b.outputs['BSDF'], out_b.inputs['Surface'])
    body.data.materials.append(mat_body)
    bpy.ops.object.shade_smooth()

    # Botão de ajuste laranja vibrante (assinatura visual do concept!)
    orange_pos = body_pos + mathutils.Vector((0.008, -0.012, 0.014))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.007, depth=0.012, location=orange_pos)
    knob = bpy.context.active_object
    knob.rotation_euler = rot_euler
    knob.name = "TorchOrangeKnob"
    knob.parent = torch_root
    mat_orange = bpy.data.materials.new("Mat_Torch_Orange")
    mat_orange.use_nodes = True
    no = mat_orange.node_tree.nodes
    lo = mat_orange.node_tree.links
    no.clear()
    out_o = no.new('ShaderNodeOutputMaterial')
    bs_o = no.new('ShaderNodeBsdfPrincipled')
    bs_o.inputs['Base Color'].default_value = (0.95, 0.38, 0.05, 1.0) # Laranja vibrante do concept
    bs_o.inputs['Roughness'].default_value = 0.30
    lo.new(bs_o.outputs['BSDF'], out_o.inputs['Surface'])
    knob.data.materials.append(mat_orange)
    bpy.ops.object.shade_smooth()

    # Canister de gás / empunhadura vertical sob o corpo
    canister_pos = body_pos + mathutils.Vector((0.015, -0.010, -0.055))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.080, location=canister_pos)
    canister = bpy.context.active_object
    canister.name = "TorchCanister"
    canister.parent = torch_root
    canister.data.materials.append(mat_body)
    bpy.ops.object.shade_smooth()

    # Colar de alumínio cromado entre corpo e refil
    collar_pos = body_pos + mathutils.Vector((0.010, -0.006, -0.020))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.020, depth=0.010, location=collar_pos)
    collar = bpy.context.active_object
    collar.name = "TorchCollarChrome"
    collar.parent = torch_root
    collar.data.materials.append(mat_steel)
    bpy.ops.object.shade_smooth()

    # 2. Mão do Chef estilizada segurando o maçarico
    # Importa ou modela a mão humana de tom pêssego
    hand_loaded = False
    if os.path.exists(hand_glb_path):
        try:
            bpy.ops.import_scene.gltf(filepath=hand_glb_path)
            hand_obj = bpy.data.objects.get("chef_hand")
            cuff_obj = bpy.data.objects.get("chef_glove_cuff")
            root_obj = bpy.data.objects.get("chef_hand_root")
            if hand_obj:
                hand_loaded = True
                # Posiciona a mão envolvendo a empunhadura do maçarico
                hand_target_pos = canister_pos + mathutils.Vector((-0.010, -0.015, 0.018))
                if root_obj:
                    root_obj.location = hand_target_pos
                    root_obj.rotation_euler = (math.radians(-35), math.radians(15), math.radians(-40))
                    root_obj.scale = (0.90, 0.90, 0.90)
                else:
                    hand_obj.location = hand_target_pos
                    hand_obj.rotation_euler = (math.radians(-35), math.radians(15), math.radians(-40))

                # Material da pele humana estilizada conforme o Concept!
                mat_skin = bpy.data.materials.new("Mat_Chef_Skin")
                mat_skin.use_nodes = True
                nsk = mat_skin.node_tree.nodes
                lsk = mat_skin.node_tree.links
                nsk.clear()
                out_sk = nsk.new('ShaderNodeOutputMaterial')
                bs_sk = nsk.new('ShaderNodeBsdfPrincipled')
                # Tom pêssego acolhedor de pele estilizada (como Overcooked/Pixar no concept)
                bs_sk.inputs['Base Color'].default_value = (0.86, 0.62, 0.48, 1.0)
                bs_sk.inputs['Roughness'].default_value = 0.40
                if 'Subsurface Weight' in bs_sk.inputs:
                    bs_sk.inputs['Subsurface Weight'].default_value = 0.25
                if 'Subsurface Radius' in bs_sk.inputs:
                    bs_sk.inputs['Subsurface Radius'].default_value = (1.0, 0.50, 0.30)
                lsk.new(bs_sk.outputs['BSDF'], out_sk.inputs['Surface'])
                hand_obj.data.materials.clear()
                hand_obj.data.materials.append(mat_skin)

                # Dólmã preta no punho
                if cuff_obj:
                    mat_cuff = bpy.data.materials.new("Mat_Chef_Jacket")
                    mat_cuff.use_nodes = True
                    ncuf = mat_cuff.node_tree.nodes
                    lcuf = mat_cuff.node_tree.links
                    ncuf.clear()
                    out_cuf = ncuf.new('ShaderNodeOutputMaterial')
                    bs_cuf = ncuf.new('ShaderNodeBsdfPrincipled')
                    bs_cuf.inputs['Base Color'].default_value = (0.04, 0.04, 0.045, 1.0) # Tecido preto
                    bs_cuf.inputs['Roughness'].default_value = 0.85
                    lcuf.new(bs_cuf.outputs['BSDF'], out_cuf.inputs['Surface'])
                    cuff_obj.data.materials.clear()
                    cuff_obj.data.materials.append(mat_cuff)
                print(">> Mão humana de chef posicionada com sucesso!")
        except Exception as e:
            print(f">> Erro ao posicionar mão de chef: {e}")

    # Braço e Manga da Dólmã entrando pelo canto superior direito
    arm_pos = canister_pos + mathutils.Vector((0.065, -0.045, 0.085))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.032, depth=0.18, location=arm_pos)
    arm = bpy.context.active_object
    arm.name = "ChefArmJacket"
    arm.rotation_euler = (math.radians(-42), math.radians(20), math.radians(-35))
    mat_arm = bpy.data.materials.new("Mat_Chef_Arm")
    mat_arm.use_nodes = True
    na = mat_arm.node_tree.nodes
    la = mat_arm.node_tree.links
    na.clear()
    out_a = na.new('ShaderNodeOutputMaterial')
    bs_a = na.new('ShaderNodeBsdfPrincipled')
    bs_a.inputs['Base Color'].default_value = (0.04, 0.04, 0.045, 1.0)
    bs_a.inputs['Roughness'].default_value = 0.85
    la.new(bs_a.outputs['BSDF'], out_a.inputs['Surface'])
    arm.data.materials.append(mat_arm)
    bpy.ops.object.shade_smooth()

    # 3. CHAMA CULINÁRIA VOLUMÉTRICA E EMISSIVA (Cone azul interno + Lamber labareda externa)
    # Posição intermediária da chama
    flame_vec = flame_target - torch_nozzle_pos
    flame_dist = flame_vec.length
    flame_center = torch_nozzle_pos + (flame_vec * 0.50)

    # Cone azul elétrico interno (base da chama de gás)
    blue_center = torch_nozzle_pos + (flame_vec * 0.30)
    bpy.ops.mesh.primitive_cone_add(radius1=0.005, radius2=0.001, depth=flame_dist * 0.45, location=blue_center)
    f_blue = bpy.context.active_object
    f_blue.rotation_euler = rot_euler
    f_blue.name = "FlameJetCoreBlue"
    mat_fblue = bpy.data.materials.new("Mat_Flame_Core_Blue")
    mat_fblue.use_nodes = True
    nfb = mat_fblue.node_tree.nodes
    lfb = mat_fblue.node_tree.links
    nfb.clear()
    out_fb = nfb.new('ShaderNodeOutputMaterial')
    emit_fb = nfb.new('ShaderNodeEmission')
    emit_fb.inputs['Color'].default_value = (0.15, 0.65, 1.0, 1.0) # Azul ciano elétrico
    emit_fb.inputs['Strength'].default_value = 45.0
    lfb.new(emit_fb.outputs['Emission'], out_fb.inputs['Surface'])
    f_blue.data.materials.append(mat_fblue)
    bpy.ops.object.shade_smooth()

    # Labareda dourada/laranja de combustão tocando o queijo
    amber_center = torch_nozzle_pos + (flame_vec * 0.70)
    bpy.ops.mesh.primitive_cone_add(radius1=0.012, radius2=0.004, depth=flame_dist * 0.65, location=amber_center)
    f_amber = bpy.context.active_object
    f_amber.rotation_euler = rot_euler
    f_amber.name = "FlamePlumeAmber"
    mat_famber = bpy.data.materials.new("Mat_Flame_Plume_Amber")
    mat_famber.use_nodes = True
    nfa = mat_famber.node_tree.nodes
    lfa = mat_famber.node_tree.links
    nfa.clear()
    out_fa = nfa.new('ShaderNodeOutputMaterial')
    emit_fa = nfa.new('ShaderNodeEmission')
    emit_fa.inputs['Color'].default_value = (1.0, 0.52, 0.08, 1.0) # Laranja incandescente
    emit_fa.inputs['Strength'].default_value = 25.0
    lfa.new(emit_fa.outputs['Emission'], out_fa.inputs['Surface'])
    f_amber.data.materials.append(mat_famber)
    bpy.ops.object.shade_smooth()

    # Luz de ponto de contato da chama iluminando o queijo e carne
    bpy.ops.object.light_add(type='POINT', radius=0.035, location=flame_target + mathutils.Vector((0, 0, 0.015)))
    flame_light = bpy.context.active_object
    flame_light.name = "FlameContactLight"
    flame_light.data.energy = 8.0
    flame_light.data.color = (1.0, 0.58, 0.15)

    # 4. Faíscas incandescentes flutuando no ar (bokeh de brasas como no concept)
    mat_spark = bpy.data.materials.new("Mat_Spark_Ember")
    mat_spark.use_nodes = True
    nsp = mat_spark.node_tree.nodes
    lsp = mat_spark.node_tree.links
    nsp.clear()
    out_sp = nsp.new('ShaderNodeOutputMaterial')
    emit_sp = nsp.new('ShaderNodeEmission')
    emit_sp.inputs['Color'].default_value = (1.0, 0.75, 0.20, 1.0)
    emit_sp.inputs['Strength'].default_value = 35.0
    lsp.new(emit_sp.outputs['Emission'], out_sp.inputs['Surface'])

    random.seed(99)
    for i in range(16):
        sx = flame_target[0] + random.uniform(-0.06, 0.08)
        sy = flame_target[1] + random.uniform(-0.04, 0.04)
        sz = flame_target[2] + random.uniform(0.01, 0.08)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.0012, 0.0022), location=(sx, sy, sz))
        sp = bpy.context.active_object
        sp.data.materials.append(mat_spark)

def create_props_and_garnishes(board_top_z, cheese_z):
    """Cumbuca de cerâmica com ervas frescas, flocos de sal e salsinha picada."""
    # Cumbuca de cerâmica rústica à direita
    ramekin_pos = (0.145, 0.040, board_top_z + 0.009)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.026, depth=0.018, location=ramekin_pos)
    ram = bpy.context.active_object
    ram.name = "RusticRamekinDish"
    bev = ram.modifiers.new("Bevel", 'BEVEL')
    bev.width = 0.003
    bev.segments = 3
    bpy.ops.object.modifier_apply(modifier="Bevel")

    mat_ram = bpy.data.materials.new("Mat_Ceramica_Ramekin")
    mat_ram.use_nodes = True
    nr = mat_ram.node_tree.nodes
    lr = mat_ram.node_tree.links
    nr.clear()
    out_r = nr.new('ShaderNodeOutputMaterial')
    bs_r = nr.new('ShaderNodeBsdfPrincipled')
    bs_r.inputs['Base Color'].default_value = (0.24, 0.20, 0.17, 1.0) # Cerâmica rústica
    bs_r.inputs['Roughness'].default_value = 0.65
    lr.new(bs_r.outputs['BSDF'], out_r.inputs['Surface'])
    ram.data.materials.append(mat_ram)
    bpy.ops.object.shade_smooth()

    # Ervas frescas picadas dentro da cumbuca
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=(ramekin_pos[0], ramekin_pos[1], ramekin_pos[2] + 0.007))
    herbs = bpy.context.active_object
    herbs.scale = (1.0, 1.0, 0.40)
    mat_h = bpy.data.materials.new("Mat_Herbs_Green")
    mat_h.use_nodes = True
    nh = mat_h.node_tree.nodes
    lh = mat_h.node_tree.links
    nh.clear()
    out_h = nh.new('ShaderNodeOutputMaterial')
    bs_h = nh.new('ShaderNodeBsdfPrincipled')
    bs_h.inputs['Base Color'].default_value = (0.08, 0.38, 0.06, 1.0)
    bs_h.inputs['Roughness'].default_value = 0.35
    lh.new(bs_h.outputs['BSDF'], out_h.inputs['Surface'])
    herbs.data.materials.append(mat_h)
    bpy.ops.object.shade_smooth()

    # Salsinha e cebolinha verde picada salpicada na tábua e no pão
    mat_flake = bpy.data.materials.new("Mat_Chive_Flakes")
    mat_flake.use_nodes = True
    nf = mat_flake.node_tree.nodes
    lf = mat_flake.node_tree.links
    nf.clear()
    out_f = nf.new('ShaderNodeOutputMaterial')
    bs_f = nf.new('ShaderNodeBsdfPrincipled')
    bs_f.inputs['Base Color'].default_value = (0.10, 0.45, 0.08, 1.0)
    bs_f.inputs['Roughness'].default_value = 0.30
    lf.new(bs_f.outputs['BSDF'], out_f.inputs['Surface'])

    # Flor de sal marinho
    mat_salt = bpy.data.materials.new("Mat_Sea_Salt")
    mat_salt.use_nodes = True
    ns = mat_salt.node_tree.nodes
    ls = mat_salt.node_tree.links
    ns.clear()
    out_s = ns.new('ShaderNodeOutputMaterial')
    bs_s = ns.new('ShaderNodeBsdfPrincipled')
    bs_s.inputs['Base Color'].default_value = (0.96, 0.96, 0.98, 1.0)
    bs_s.inputs['Roughness'].default_value = 0.15
    if 'Transmission Weight' in bs_s.inputs:
        bs_s.inputs['Transmission Weight'].default_value = 0.60
    ls.new(bs_s.outputs['BSDF'], out_s.inputs['Surface'])

    # Espalha folhinhas finas (pequenos discos achatados em vez de esferas!)
    random.seed(55)
    for i in range(24):
        # 16 no lanche, 8 na tábua
        if i < 16:
            fx = random.uniform(-0.08, 0.06)
            fy = random.uniform(-0.018, 0.018)
            fz = cheese_z + 0.003
        else:
            fx = random.uniform(-0.13, 0.13)
            fy = random.choice([random.uniform(0.045, 0.065), random.uniform(-0.065, -0.045)])
            fz = board_top_z + 0.001

        bpy.ops.mesh.primitive_cylinder_add(radius=0.0018, depth=0.0004, location=(fx, fy, fz))
        leaf = bpy.context.active_object
        leaf.rotation_euler = (random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), random.uniform(0, math.pi))
        leaf.data.materials.append(mat_flake)

    # Cristais de flor de sal na tábua
    for i in range(14):
        sx = random.uniform(0.12, 0.16)
        sy = random.uniform(-0.05, -0.01)
        sz = board_top_z + 0.001
        bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.0010, 0.0016), subdivisions=1, location=(sx, sy, sz))
        salt = bpy.context.active_object
        salt.data.materials.append(mat_salt)

def setup_hero_camera_and_lighting(render_path, center_z, fast_preview=False):
    """
    Câmera Heroica a 13° de elevação (eye-level cinematográfico)
    e Iluminação de Gastropub com Key, Rim e Fill lights.
    """
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'

    cycles_pref = bpy.context.preferences.addons.get('cycles')
    if cycles_pref:
        cpref = cycles_pref.preferences
        cpref.compute_device_type = 'OPTIX'
        for d in cpref.get_devices_for_type('OPTIX'):
            d.use = True
        scene.cycles.device = 'GPU'
    else:
        scene.cycles.device = 'CPU'

    scene.cycles.samples = 32 if fast_preview else 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1376
    scene.render.resolution_y = 768
    scene.render.filepath = render_path

    # Alvo da câmera no centro do lanche
    target = bpy.data.objects.new("HeroCameraTarget", None)
    bpy.context.collection.objects.link(target)
    target.location = (0.015, 0.0, center_z + 0.008)

    # Câmera Heroica cinematográfica (focal 56mm, elevação ~13 graus)
    cam_data = bpy.data.cameras.new("HeroCamera")
    cam_data.lens = 56.0
    cam_data.sensor_width = 36.0
    cam_data.sensor_height = 36.0 * (768 / 1376)
    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = target
    cam_data.dof.aperture_fstop = 4.0 # Desfoque suave no fundo (bokeh de pub)

    cam_obj = bpy.data.objects.new("HeroCamera", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Posicionamento exato: elevação ~13°, enquadramento horizontal perfeito
    # Y = -0.42, Z = center_z + 0.095 -> arctan(0.095 / 0.42) = 12.75 graus!
    cam_obj.location = (0.015, -0.42, center_z + 0.095)

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    bpy.context.view_layer.update()

    # ILUMINAÇÃO DE ESTÚDIO GASTRONÔMICO
    # 1. Key Light Quente (frontal-esquerda, destacando a crosta do pão e o recheio)
    bpy.ops.object.light_add(type='SPOT', radius=0.25, location=(-0.25, -0.32, center_z + 0.30))
    key = bpy.context.active_object
    key.name = "Key_Warm_Spot"
    key.data.energy = 45.0
    key.data.color = (1.0, 0.92, 0.82)
    key.data.spot_size = math.radians(65)
    key.data.spot_blend = 0.50

    # 2. Rim Light Dourada (traseira-esquerda, desenhando a silhueta da crosta e queijo)
    bpy.ops.object.light_add(type='POINT', radius=0.10, location=(-0.22, 0.22, center_z + 0.16))
    rim = bpy.context.active_object
    rim.name = "Rim_Golden_Back"
    rim.data.energy = 60.0
    rim.data.color = (1.0, 0.55, 0.12)

    # 3. Fill Light suave e acolhedora
    bpy.ops.object.light_add(type='POINT', radius=0.40, location=(0.10, -0.35, center_z + 0.18))
    fill = bpy.context.active_object
    fill.name = "Fill_Soft_Warm"
    fill.data.energy = 15.0
    fill.data.color = (0.95, 0.88, 0.80)

    print(f">> Renderizando ({scene.cycles.samples} samples)...")
    bpy.ops.render.render(write_still=True)
    print(f">> Render salvo em: {render_path}")

def run_pass(fast_preview=False):
    print("=====================================================")
    print(f">> ALHOARIA PASS 14 - {'PREVIEW' if fast_preview else 'FINAL'}")
    clean_scene()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    concepts_dir = os.path.join(project_root, "public", "assets", "concepts")
    models_dir = os.path.join(project_root, "public", "assets", "models")
    poly_dir = os.path.join(script_dir, "assets", "polyhaven")

    tex_wood = os.path.join(concepts_dir, "texture_dark_wood.jpg")
    tex_bread = os.path.join(concepts_dir, "texture_bread_crust.jpg")
    tex_meat = os.path.join(concepts_dir, "texture_costela_meat.jpg")
    tex_cheese = os.path.join(concepts_dir, "texture_cheese_torch.jpg")

    board_blend = os.path.join(poly_dir, "wooden_cutting_board_1k.blend")
    hdri_path = os.path.join(poly_dir, "warm_restaurant_night_1k.hdr")
    hand_glb = os.path.join(models_dir, "alhoaria-mao-chef.glb")

    create_environment(hdri_path)
    board, board_top_z = create_table_and_board(board_blend, tex_wood)
    bread, center_z = create_artisanal_baguette(board_top_z, tex_bread)
    filling, meat_core, meat_z = create_costela_filling(center_z, tex_meat)
    cheese, cheese_z = create_melted_cheese(meat_z, meat_core, tex_cheese)
    create_chef_hand_and_blowtorch(cheese_z, hand_glb)
    create_props_and_garnishes(board_top_z, cheese_z)

    render_out = os.path.join(concepts_dir, "candidate_render_pass14.png")
    setup_hero_camera_and_lighting(render_out, center_z, fast_preview=fast_preview)
    print(">> PASS 14 FINALIZADO COM SUCESSO!")
    print("=====================================================")

if __name__ == "__main__":
    import sys
    fast = "--fast" in sys.argv
    run_pass(fast_preview=fast)
