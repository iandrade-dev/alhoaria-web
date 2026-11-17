"""
ALHOARIA 3D PRODUCTION PIPELINE - PASS 15 (PURE 3D GOURMET RENDER)
Render 100% 3D procedural puro, sem colagens de fotos.
Geometria esculpida, mechas 3D de costela, queijo com leopard-spots procedurais,
mão estilizada, maçarico com chama e iluminação de estúdio gastronômico.
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

def create_environment(hdri_path):
    world = bpy.context.scene.world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputWorld')
    bg = nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.40
    bg.inputs['Color'].default_value = (0.015, 0.010, 0.008, 1.0) # Escuridão acolhedora de gastropub

    if os.path.exists(hdri_path):
        env_img = bpy.data.images.load(hdri_path)
        env = nodes.new('ShaderNodeTexEnvironment')
        env.image = env_img
        links.new(env.outputs['Color'], bg.inputs['Color'])
    
    links.new(bg.outputs['Background'], out.inputs['Surface'])

    # Parede de fundo escura de tijolos à meia luz
    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0, 0.60, 0.25))
    wall = bpy.context.active_object
    wall.rotation_euler = (math.radians(90), 0, 0)
    mat_wall = bpy.data.materials.new("Mat_Pub_Wall")
    mat_wall.use_nodes = True
    nw = mat_wall.node_tree.nodes
    lw = mat_wall.node_tree.links
    nw.clear()
    out_w = nw.new('ShaderNodeOutputMaterial')
    bs_w = nw.new('ShaderNodeBsdfPrincipled')
    bs_w.inputs['Base Color'].default_value = (0.03, 0.018, 0.012, 1.0)
    bs_w.inputs['Roughness'].default_value = 0.92
    lw.new(bs_w.outputs['BSDF'], out_w.inputs['Surface'])
    wall.data.materials.append(mat_wall)

    # Pontos de luz âmbar fora de foco no fundo (bokeh de restaurante)
    bokeh_coords = [(-0.40, 0.50, 0.30), (-0.15, 0.55, 0.36), (0.22, 0.52, 0.32), (0.46, 0.48, 0.28)]
    for i, bc in enumerate(bokeh_coords):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.030, location=bc)
        sph = bpy.context.active_object
        mat_b = bpy.data.materials.new(f"Mat_Bokeh_Point_{i}")
        mat_b.use_nodes = True
        nb = mat_b.node_tree.nodes
        lb = mat_b.node_tree.links
        nb.clear()
        out_b = nb.new('ShaderNodeOutputMaterial')
        emit_b = nb.new('ShaderNodeEmission')
        emit_b.inputs['Color'].default_value = (1.0, 0.60, 0.15, 1.0)
        emit_b.inputs['Strength'].default_value = 10.0
        lb.new(emit_b.outputs['Emission'], out_b.inputs['Surface'])
        sph.data.materials.append(mat_b)

def create_table_and_board():
    """Tábua de corte estilizada com madeira nobre e canaleta esculpida."""
    # 1. Bancada de apoio
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.0, -0.018))
    table = bpy.context.active_object
    table.dimensions = (1.80, 1.00, 0.035)
    bpy.ops.object.transform_apply(scale=True)
    mat_table = bpy.data.materials.new("Mat_Table_Dark")
    mat_table.use_nodes = True
    nt = mat_table.node_tree.nodes
    lt = mat_table.node_tree.links
    nt.clear()
    out_t = nt.new('ShaderNodeOutputMaterial')
    bs_t = nt.new('ShaderNodeBsdfPrincipled')
    bs_t.inputs['Base Color'].default_value = (0.04, 0.025, 0.015, 1.0)
    bs_t.inputs['Roughness'].default_value = 0.55
    lt.new(bs_t.outputs['BSDF'], out_t.inputs['Surface'])
    table.data.materials.append(mat_table)
    bpy.ops.object.shade_smooth()

    # 2. Tábua de corte rústica esculpida em 3D (38cm x 22cm x 2.4cm)
    board_top_z = 0.024
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.01, 0.0, board_top_z * 0.50))
    board = bpy.context.active_object
    board.name = "stage_board"
    board.dimensions = (0.38, 0.22, board_top_z)
    bpy.ops.object.transform_apply(scale=True)

    # Chanfros arredondados
    bev = board.modifiers.new("BevelEdges", 'BEVEL')
    bev.width = 0.014
    bev.segments = 5
    bpy.ops.object.modifier_apply(modifier="BevelEdges")

    # Canaleta entalhada em 3D (Juice groove)
    # Criamos um cutter para esculpir a canaleta via booleana
    bpy.ops.curve.primitive_bezier_circle_add(radius=1.0, location=(0.01, 0.0, board_top_z))
    curve = bpy.context.active_object
    curve.scale = (0.165, 0.090, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    curve.data.bevel_depth = 0.0055
    curve.data.bevel_resolution = 4
    bpy.ops.object.convert(target='MESH')
    cutter = bpy.context.active_object

    bool_mod = board.modifiers.new("GrooveCut", 'BOOLEAN')
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object = cutter
    bpy.ops.object.modifier_apply(modifier="GrooveCut")
    bpy.data.objects.remove(cutter, do_unlink=True)

    # Material procedural de madeira escura nobre (nogueira carbonizada / carvalho defumado)
    mat_board = bpy.data.materials.new("Mat_Smoked_Walnut_3D")
    mat_board.use_nodes = True
    nb = mat_board.node_tree.nodes
    lb = mat_board.node_tree.links
    nb.clear()
    out_b = nb.new('ShaderNodeOutputMaterial')
    bs_b = nb.new('ShaderNodeBsdfPrincipled')
    bs_b.inputs['Roughness'].default_value = 0.42

    # Veios procedurais de madeira
    tex_coord = nb.new('ShaderNodeTexCoord')
    mapping = nb.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1.5, 12.0, 1.5)
    lb.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])

    noise_wood = nb.new('ShaderNodeTexNoise')
    noise_wood.inputs['Scale'].default_value = 8.0
    noise_wood.inputs['Detail'].default_value = 6.0
    noise_wood.inputs['Roughness'].default_value = 0.65
    lb.new(mapping.outputs['Vector'], noise_wood.inputs['Vector'])

    ramp_wood = nb.new('ShaderNodeValToRGB')
    ramp_wood.color_ramp.elements[0].position = 0.25
    ramp_wood.color_ramp.elements[0].color = (0.05, 0.03, 0.018, 1.0) # Carvalho carbonizado escuro
    ramp_wood.color_ramp.elements[1].position = 0.85
    ramp_wood.color_ramp.elements[1].color = (0.14, 0.08, 0.045, 1.0) # Nogueira nobre
    lb.new(noise_wood.outputs['Fac'], ramp_wood.inputs['Fac'])
    lb.new(ramp_wood.outputs['Color'], bs_b.inputs['Base Color'])

    bump_wood = nb.new('ShaderNodeBump')
    bump_wood.inputs['Strength'].default_value = 0.025
    lb.new(noise_wood.outputs['Fac'], bump_wood.inputs['Height'])
    lb.new(bump_wood.outputs['Normal'], bs_b.inputs['Normal'])

    lb.new(bs_b.outputs['BSDF'], out_b.inputs['Surface'])
    board.data.materials.append(mat_board)
    bpy.ops.object.shade_smooth()

    return board, board_top_z

def create_baguette_3d(board_top_z):
    """
    Constrói a baguete artesanal 100% esculpida em 3D:
    - 48 anéis longitudinais, 32 radiais
    - Corte em canoa profundo e alargado
    - Fissuras e cortes diagonais de lâmina de padeiro (scoring)
    - Shader procedural puro de crosta dourada, farinha e miolo
    """
    loaf_len = 0.255   # 25.5 cm
    loaf_width = 0.084 # 8.4 cm
    loaf_height = 0.058 # 5.8 cm
    center_z = board_top_z + loaf_height * 0.48

    bm = bmesh.new()
    num_x = 48
    num_circ = 32

    verts_grid = []
    for ix in range(num_x):
        u = ix / (num_x - 1)
        x = (u - 0.5) * loaf_len
        nx = (u - 0.5) * 2.0 # -1.0 a +1.0

        # Taper orgânico suave nas duas pontas da baguete
        taper = max(0.20, (1.0 - (abs(nx) ** 2.4)) ** 0.38)
        ring = []
        for ic in range(num_circ):
            theta = (ic / num_circ) * 2.0 * math.pi
            ry = math.sin(theta) * (loaf_width * 0.50) * taper
            rz = math.cos(theta) * (loaf_height * 0.50) * taper

            vz = center_z + rz
            vy = ry

            # Aplainamento sólido da base na tábua
            if vz < board_top_z + 0.002:
                vz = board_top_z + 0.001

            # Abertura canoa generosa
            if abs(nx) < 0.85 and vz > center_z:
                norm_y = abs(vy) / (loaf_width * 0.50 * taper)
                if norm_y < 0.88:
                    cavity = (1.0 - norm_y ** 2.2) * 0.020
                    vz -= cavity

            # Cortes diagonais de lâmina de padeiro (scoring)
            if vz > center_z:
                # 4 cortes diagonais ao longo da baguete
                diag = (x * 18.0) + (vy * 12.0)
                score_notch = math.sin(diag)
                if score_notch > 0.82 and abs(nx) < 0.75:
                    vz -= 0.0025 * (score_notch - 0.82) * 5.0

            v = bm.verts.new((x, vy, vz))
            ring.append(v)
        verts_grid.append(ring)

    # Faces quadrangulares
    for ix in range(num_x - 1):
        for ic in range(num_circ):
            next_ic = (ic + 1) % num_circ
            v0 = verts_grid[ix][ic]
            v1 = verts_grid[ix + 1][ic]
            v2 = verts_grid[ix + 1][next_ic]
            v3 = verts_grid[ix][next_ic]
            bm.faces.new((v0, v1, v2, v3))

    # Pontas arredondadas
    tip_start = bm.verts.new((-loaf_len * 0.50, 0, center_z))
    for ic in range(num_circ):
        next_ic = (ic + 1) % num_circ
        bm.faces.new((tip_start, verts_grid[0][next_ic], verts_grid[0][ic]))

    tip_end = bm.verts.new((loaf_len * 0.50, 0, center_z))
    for ic in range(num_circ):
        next_ic = (ic + 1) % num_circ
        bm.faces.new((tip_end, verts_grid[-1][ic], verts_grid[-1][next_ic]))

    # Coordenadas UV cilíndricas sem distorções
    uv_layer = bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        for loop in face.loops:
            vx = loop.vert.co.x
            vy = loop.vert.co.y
            vz = loop.vert.co.z - center_z
            u_coord = (vx / loaf_len) + 0.50
            v_coord = (math.atan2(vy, vz) / (2.0 * math.pi)) + 0.50
            loop[uv_layer].uv = (u_coord, v_coord)

    bread_mesh = bpy.data.meshes.new("stage_bread_mesh")
    bm.to_mesh(bread_mesh)
    bm.free()

    bread = bpy.data.objects.new("stage_bread", bread_mesh)
    bpy.context.collection.objects.link(bread)
    bpy.context.view_layer.objects.active = bread

    sub = bread.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 1
    disp = bread.modifiers.new("CrustDisplace", 'DISPLACE')
    tex_d = bpy.data.textures.new("BaguetteNoise", 'CLOUDS')
    tex_d.noise_scale = 0.009
    disp.texture = tex_d
    disp.strength = 0.0022
    bpy.ops.object.shade_smooth()

    # SHADER PROCEDURAL PURO DE BAGUETE GOURMET (SEM FOTO)
    mat_bread = bpy.data.materials.new("Mat_Baguette_Procedural")
    mat_bread.use_nodes = True
    nodes = mat_bread.node_tree.nodes
    links = mat_bread.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.58
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.15
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.65, 0.35)

    tex_coord = nodes.new('ShaderNodeTexCoord')

    # Gradiente de assamento do forno: crosta dourada e bem assada
    noise_crust = nodes.new('ShaderNodeTexNoise')
    noise_crust.inputs['Scale'].default_value = 22.0
    noise_crust.inputs['Detail'].default_value = 6.0
    noise_crust.inputs['Roughness'].default_value = 0.60
    links.new(tex_coord.outputs['Object'], noise_crust.inputs['Vector'])

    ramp_bake = nodes.new('ShaderNodeValToRGB')
    ramp_bake.color_ramp.elements[0].position = 0.20
    ramp_bake.color_ramp.elements[0].color = (0.35, 0.16, 0.05, 1.0) # Castanho dourado de forno
    ramp_bake.color_ramp.elements[1].position = 0.75
    ramp_bake.color_ramp.elements[1].color = (0.84, 0.52, 0.22, 1.0) # Dourado apetitoso da casca
    links.new(noise_crust.outputs['Fac'], ramp_bake.inputs['Fac'])
    links.new(ramp_bake.outputs['Color'], bsdf.inputs['Base Color'])

    bump_crust = nodes.new('ShaderNodeBump')
    bump_crust.inputs['Strength'].default_value = 0.045
    links.new(noise_crust.outputs['Fac'], bump_crust.inputs['Height'])
    links.new(bump_crust.outputs['Normal'], bsdf.inputs['Normal'])

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bread.data.materials.append(mat_bread)

    return bread, center_z

def create_costela_3d(center_z):
    """
    Constrói a costela bovina 6h desfiada 100% 3D:
    - Base ondulada e suculenta
    - 64 mechas e fios de costela desfiada transbordando pelas bordas
    - Shader procedural de carne braseada escura com brilho de molho laqueado
    """
    meat_z = center_z + 0.012

    # Miolo da carne
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, meat_z))
    core = bpy.context.active_object
    core.name = "meat_core"
    core.dimensions = (0.215, 0.072, 0.026)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(core.data)
    for v in bm.verts:
        nx = abs(v.co.x) / 0.108
        v.co.y *= max(0.40, 1.0 - (nx ** 2.2) * 0.45)
    bm.to_mesh(core.data)
    bm.free()

    sub = core.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    disp = core.modifiers.new("MeatRoughness", 'DISPLACE')
    tex_m = bpy.data.textures.new("CostelaNoise", 'CLOUDS')
    tex_m.noise_scale = 0.006
    disp.texture = tex_m
    disp.strength = 0.0055
    bpy.ops.object.shade_smooth()

    # SHADER PROCEDURAL PURO DE COSTELA DESFIADA 6H (MOLHO LAQUEADO)
    mat_meat = bpy.data.materials.new("Mat_Costela_Procedural_3D")
    mat_meat.use_nodes = True
    nodes = mat_meat.node_tree.nodes
    links = mat_meat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.22 # Brilho suculento de molho e colágeno derretido
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.70

    tex_coord = nodes.new('ShaderNodeTexCoord')
    noise_fiber = nodes.new('ShaderNodeTexNoise')
    noise_fiber.inputs['Scale'].default_value = 60.0
    noise_fiber.inputs['Detail'].default_value = 8.0
    noise_fiber.inputs['Roughness'].default_value = 0.75
    links.new(tex_coord.outputs['Object'], noise_fiber.inputs['Vector'])

    ramp_meat = nodes.new('ShaderNodeValToRGB')
    ramp_meat.color_ramp.elements[0].position = 0.20
    ramp_meat.color_ramp.elements[0].color = (0.16, 0.05, 0.02, 1.0) # Marrom braseado profundo
    ramp_meat.color_ramp.elements[1].position = 0.80
    ramp_meat.color_ramp.elements[1].color = (0.35, 0.12, 0.045, 1.0) # Mechas suculentas avermelhadas
    links.new(noise_fiber.outputs['Fac'], ramp_meat.inputs['Fac'])
    links.new(ramp_meat.outputs['Color'], bsdf.inputs['Base Color'])

    bump_fiber = nodes.new('ShaderNodeBump')
    bump_fiber.inputs['Strength'].default_value = 0.08
    links.new(noise_fiber.outputs['Fac'], bump_fiber.inputs['Height'])
    links.new(bump_fiber.outputs['Normal'], bsdf.inputs['Normal'])

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    core.data.materials.append(mat_meat)

    # Empty pai
    empty_ribs = bpy.data.objects.new("filling_costela", None)
    bpy.context.collection.objects.link(empty_ribs)
    core.parent = empty_ribs

    # 110 MECHAS ORGÂNICAS DE COSTELA DESFIADA SUAVE E FINA
    random.seed(42)
    for i in range(110):
        cx = random.uniform(-0.105, 0.105)
        side = 1.0 if (i % 2 == 0) else -1.0
        cy = side * random.uniform(0.022, 0.038)
        cz = meat_z + random.uniform(-0.004, 0.008)

        curve_data = bpy.data.curves.new(f"CostelaFiber_{i}", type='CURVE')
        curve_data.dimensions = '3D'
        curve_data.bevel_depth = random.uniform(0.0008, 0.0015) # Fibras finas desfiadas
        curve_data.bevel_resolution = 2

        spline = curve_data.splines.new('BEZIER')
        spline.bezier_points.add(2)
        p0, p1, p2 = spline.bezier_points[0], spline.bezier_points[1], spline.bezier_points[2]

        length = random.uniform(0.020, 0.040)
        p0.co = (cx - length * 0.45, cy, cz)
        p1.co = (cx, cy + side * random.uniform(0.002, 0.007), cz + 0.002)
        p2.co = (cx + length * 0.45, cy + side * random.uniform(0.004, 0.012), cz - 0.005)

        for p in (p0, p1, p2):
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'

        fiber_obj = bpy.data.objects.new(f"filling_fiber_{i:02d}", curve_data)
        bpy.context.collection.objects.link(fiber_obj)
        fiber_obj.parent = empty_ribs
        fiber_obj.data.materials.append(mat_meat)

    return empty_ribs, core, meat_z

def create_melted_cheese_3d(meat_z, meat_core):
    """
    Manto de queijo fundido 100% 3D drapeado sobre a carne com:
    - Ondulações e gotas (drips) escorrendo pelas bordas
    - Manchas autênticas de maçarico (leopard-spots) geradas proceduralmente
    - Brilho de óleo derretido e Subsurface Scattering cremoso
    """
    cheese_z = meat_z + 0.014
    # Malha drapeada: 19.5cm comprimento, 5.2cm largura
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=42, y_subdivisions=24, size=1.0, location=(0, 0, cheese_z))
    cheese = bpy.context.active_object
    cheese.name = "stage_gratin"
    cheese.dimensions = (0.195, 0.052, 1.0)
    cheese.scale.z = 1.0
    bpy.ops.object.transform_apply(scale=True)

    # Ondulações nas bordas (línguas de queijo derretido escorrendo)
    bm = bmesh.new()
    bm.from_mesh(cheese.data)
    for v in bm.verts:
        edge_y = abs(v.co.y) / 0.026
        if edge_y > 0.65:
            drip = math.sin(v.co.x * 60.0) * 0.006 + math.cos(v.co.x * 30.0) * 0.004
            v.co.y += math.copysign(drip, v.co.y)
            v.co.z -= abs(drip) * 0.85
    bm.to_mesh(cheese.data)
    bm.free()

    sw = cheese.modifiers.new("CheeseDrape", 'SHRINKWRAP')
    sw.target = meat_core
    sw.wrap_method = 'NEAREST_SURFACEPOINT'
    sw.offset = 0.003
    bpy.ops.object.modifier_apply(modifier="CheeseDrape")

    sol = cheese.modifiers.new("CheeseThickness", 'SOLIDIFY')
    sol.thickness = 0.0038
    bpy.ops.object.modifier_apply(modifier="CheeseThickness")

    sub = cheese.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2
    bpy.ops.object.shade_smooth()

    # SHADER PROCEDURAL DE QUEIJO COM TOSTADO DE MAÇARICO (LEOPARD SPOTS)
    mat_cheese = bpy.data.materials.new("Mat_Cheese_Gratin_Procedural")
    mat_cheese.use_nodes = True
    nodes = mat_cheese.node_tree.nodes
    links = mat_cheese.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.18 # Queijo derretido reluzente de gordura
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.65
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.22
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.85, 0.50)

    tex_coord = nodes.new('ShaderNodeTexCoord')

    # Voronoi de escala natural para manchas bolhosas de tostado de maçarico (8mm a 15mm)
    voronoi_char = nodes.new('ShaderNodeTexVoronoi')
    voronoi_char.feature = 'F1'
    voronoi_char.distance = 'EUCLIDEAN'
    voronoi_char.inputs['Scale'].default_value = 16.0
    links.new(tex_coord.outputs['Object'], voronoi_char.inputs['Vector'])

    noise_distort = nodes.new('ShaderNodeTexNoise')
    noise_distort.inputs['Scale'].default_value = 12.0
    links.new(tex_coord.outputs['Object'], noise_distort.inputs['Vector'])

    mix_spots = nodes.new('ShaderNodeMix')
    mix_spots.data_type = 'FLOAT'
    mix_spots.inputs['Factor'].default_value = 0.30
    links.new(voronoi_char.outputs['Distance'], mix_spots.inputs[2])
    links.new(noise_distort.outputs['Fac'], mix_spots.inputs[3])

    # ColorRamp para mapear o queijo: Base creme -> Caramelo dourado -> Marrom escuro tostado
    ramp_cheese = nodes.new('ShaderNodeValToRGB')
    ramp_cheese.color_ramp.elements[0].position = 0.18
    ramp_cheese.color_ramp.elements[0].color = (0.10, 0.04, 0.015, 1.0) # Centro tostado/carbonizado de maçarico
    ramp_cheese.color_ramp.elements.new(0.36)
    ramp_cheese.color_ramp.elements[1].color = (0.75, 0.44, 0.12, 1.0) # Borda caramelizada âmbar
    ramp_cheese.color_ramp.elements[2].position = 0.62
    ramp_cheese.color_ramp.elements[2].color = (0.96, 0.91, 0.75, 1.0) # Queijo derretido cremoso
    links.new(mix_spots.outputs[0], ramp_cheese.inputs['Fac'])
    links.new(ramp_cheese.outputs['Color'], bsdf.inputs['Base Color'])

    bump_cheese = nodes.new('ShaderNodeBump')
    bump_cheese.inputs['Strength'].default_value = 0.05
    links.new(mix_spots.outputs[0], bump_cheese.inputs['Height'])
    links.new(bump_cheese.outputs['Normal'], bsdf.inputs['Normal'])

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    cheese.data.materials.append(mat_cheese)
    links.new(mix_spots.outputs[0], bump_cheese.inputs['Height'])
    links.new(bump_cheese.outputs['Normal'], bsdf.inputs['Normal'])

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    cheese.data.materials.append(mat_cheese)

    return cheese, cheese_z

def create_chef_hand_and_blowtorch(cheese_z, hand_glb_path):
    """
    Constrói a mão do chef e o maçarico culinário profissional com enquadramento perfeito
    no canto superior direito, com bocal de inox e chama viva.
    """
    # Alvo da chama no queijo
    flame_target = mathutils.Vector((0.045, -0.005, cheese_z + 0.004))
    # Bocal do maçarico recuado e elevado
    torch_nozzle_pos = mathutils.Vector((0.115, -0.020, cheese_z + 0.075))

    v_dir = flame_target - torch_nozzle_pos
    rot_quat = v_dir.to_track_quat('-Z', 'Y')
    rot_euler = rot_quat.to_euler()

    torch_root = bpy.data.objects.new("chef_blowtorch_assembly", None)
    bpy.context.collection.objects.link(torch_root)

    # 1. Bocal de aço inox
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0065, depth=0.042, location=torch_nozzle_pos)
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
    bs_s.inputs['Base Color'].default_value = (0.88, 0.88, 0.90, 1.0)
    bs_s.inputs['Metallic'].default_value = 0.95
    bs_s.inputs['Roughness'].default_value = 0.12
    ls.new(bs_s.outputs['BSDF'], out_s.inputs['Surface'])
    nozzle.data.materials.append(mat_steel)
    bpy.ops.object.shade_smooth()

    # 2. Corpo do maçarico
    body_pos = torch_nozzle_pos + (-v_dir.normalized() * 0.040)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.048, location=body_pos)
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
    bs_b.inputs['Base Color'].default_value = (0.05, 0.05, 0.06, 1.0)
    bs_b.inputs['Roughness'].default_value = 0.35
    lb.new(bs_b.outputs['BSDF'], out_b.inputs['Surface'])
    body.data.materials.append(mat_body)
    bpy.ops.object.shade_smooth()

    # 3. Gatilho / botão de ignição laranja vibrante (assinatura do concept)
    orange_pos = body_pos + mathutils.Vector((0.009, -0.012, 0.016))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0075, depth=0.014, location=orange_pos)
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
    bs_o.inputs['Base Color'].default_value = (0.95, 0.38, 0.05, 1.0)
    bs_o.inputs['Roughness'].default_value = 0.30
    lo.new(bs_o.outputs['BSDF'], out_o.inputs['Surface'])
    knob.data.materials.append(mat_orange)
    bpy.ops.object.shade_smooth()

    # 4. Canister vertical metálico sob a mão
    canister_pos = body_pos + mathutils.Vector((0.018, -0.010, -0.065))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.020, depth=0.090, location=canister_pos)
    canister = bpy.context.active_object
    canister.name = "TorchCanister"
    canister.parent = torch_root
    canister.data.materials.append(mat_body)
    bpy.ops.object.shade_smooth()

    # 5. Mão humana estilizada do Chef segurando a empunhadura
    if os.path.exists(hand_glb_path):
        try:
            bpy.ops.import_scene.gltf(filepath=hand_glb_path)
            hand_obj = bpy.data.objects.get("chef_hand")
            cuff_obj = bpy.data.objects.get("chef_glove_cuff")
            root_obj = bpy.data.objects.get("chef_hand_root")
            if hand_obj:
                hand_target_pos = canister_pos + mathutils.Vector((-0.012, -0.018, 0.025))
                if root_obj:
                    root_obj.location = hand_target_pos
                    root_obj.rotation_euler = (math.radians(-32), math.radians(16), math.radians(-38))
                    root_obj.scale = (0.88, 0.88, 0.88)

                # Tom de pele humana acolhedor com Subsurface Scattering
                mat_skin = bpy.data.materials.new("Mat_Chef_Skin")
                mat_skin.use_nodes = True
                nsk = mat_skin.node_tree.nodes
                lsk = mat_skin.node_tree.links
                nsk.clear()
                out_sk = nsk.new('ShaderNodeOutputMaterial')
                bs_sk = nsk.new('ShaderNodeBsdfPrincipled')
                bs_sk.inputs['Base Color'].default_value = (0.86, 0.62, 0.48, 1.0)
                bs_sk.inputs['Roughness'].default_value = 0.38
                if 'Subsurface Weight' in bs_sk.inputs:
                    bs_sk.inputs['Subsurface Weight'].default_value = 0.28
                if 'Subsurface Radius' in bs_sk.inputs:
                    bs_sk.inputs['Subsurface Radius'].default_value = (1.0, 0.55, 0.30)
                lsk.new(bs_sk.outputs['BSDF'], out_sk.inputs['Surface'])
                hand_obj.data.materials.clear()
                hand_obj.data.materials.append(mat_skin)

                if cuff_obj:
                    mat_cuff = bpy.data.materials.new("Mat_Chef_Jacket")
                    mat_cuff.use_nodes = True
                    ncuf = mat_cuff.node_tree.nodes
                    lcuf = mat_cuff.node_tree.links
                    ncuf.clear()
                    out_cuf = ncuf.new('ShaderNodeOutputMaterial')
                    bs_cuf = ncuf.new('ShaderNodeBsdfPrincipled')
                    bs_cuf.inputs['Base Color'].default_value = (0.04, 0.04, 0.045, 1.0)
                    bs_cuf.inputs['Roughness'].default_value = 0.85
                    lcuf.new(bs_cuf.outputs['BSDF'], out_cuf.inputs['Surface'])
                    cuff_obj.data.materials.clear()
                    cuff_obj.data.materials.append(mat_cuff)
        except Exception as e:
            print(f">> Aviso importando mão: {e}")

    # Braço e dólmã entrando pelo canto superior direito
    arm_pos = canister_pos + mathutils.Vector((0.075, -0.045, 0.095))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.20, location=arm_pos)
    arm = bpy.context.active_object
    arm.name = "ChefArmJacket"
    arm.rotation_euler = (math.radians(-38), math.radians(22), math.radians(-32))
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

    # 6. CHAMA CULINÁRIA VOLUMÉTRICA EMISSIVA
    flame_vec = flame_target - torch_nozzle_pos
    flame_dist = flame_vec.length

    # Cone azul interno (gás butano sob pressão)
    blue_center = torch_nozzle_pos + (flame_vec * 0.28)
    bpy.ops.mesh.primitive_cone_add(radius1=0.0035, radius2=0.001, depth=flame_dist * 0.40, location=blue_center)
    f_blue = bpy.context.active_object
    f_blue.rotation_euler = rot_euler
    mat_fblue = bpy.data.materials.new("Mat_Flame_Blue")
    mat_fblue.use_nodes = True
    nfb = mat_fblue.node_tree.nodes
    lfb = mat_fblue.node_tree.links
    nfb.clear()
    out_fb = nfb.new('ShaderNodeOutputMaterial')
    emit_fb = nfb.new('ShaderNodeEmission')
    emit_fb.inputs['Color'].default_value = (0.15, 0.65, 1.0, 1.0)
    emit_fb.inputs['Strength'].default_value = 8.0
    lfb.new(emit_fb.outputs['Emission'], out_fb.inputs['Surface'])
    f_blue.data.materials.append(mat_fblue)
    bpy.ops.object.shade_smooth()

    # Labareda dourada/laranja tocando o queijo
    amber_center = torch_nozzle_pos + (flame_vec * 0.68)
    bpy.ops.mesh.primitive_cone_add(radius1=0.008, radius2=0.002, depth=flame_dist * 0.60, location=amber_center)
    f_amber = bpy.context.active_object
    f_amber.rotation_euler = rot_euler
    mat_famber = bpy.data.materials.new("Mat_Flame_Amber")
    mat_famber.use_nodes = True
    nfa = mat_famber.node_tree.nodes
    lfa = mat_famber.node_tree.links
    nfa.clear()
    out_fa = nfa.new('ShaderNodeOutputMaterial')
    emit_fa = nfa.new('ShaderNodeEmission')
    emit_fa.inputs['Color'].default_value = (1.0, 0.48, 0.05, 1.0)
    emit_fa.inputs['Strength'].default_value = 4.5
    lfa.new(emit_fa.outputs['Emission'], out_fa.inputs['Surface'])
    f_amber.data.materials.append(mat_famber)
    bpy.ops.object.shade_smooth()

    # Ponto de luz de contato da chama
    bpy.ops.object.light_add(type='POINT', radius=0.035, location=flame_target + mathutils.Vector((0, 0, 0.016)))
    flame_light = bpy.context.active_object
    flame_light.name = "FlameContactLight"
    flame_light.data.energy = 9.0
    flame_light.data.color = (1.0, 0.60, 0.16)

    # Faíscas incandescentes flutuando
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
        sx = flame_target[0] + random.uniform(-0.05, 0.08)
        sy = flame_target[1] + random.uniform(-0.04, 0.04)
        sz = flame_target[2] + random.uniform(0.015, 0.085)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.0012, 0.0022), location=(sx, sy, sz))
        sp = bpy.context.active_object
        sp.data.materials.append(mat_spark)

def create_props_and_garnishes(board_top_z, cheese_z):
    """Cumbuca de cerâmica rústica com ervas frescas, flor de sal e salsinha picada."""
    ramekin_pos = (0.150, 0.038, board_top_z + 0.009)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.027, depth=0.018, location=ramekin_pos)
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
    bs_r.inputs['Base Color'].default_value = (0.22, 0.18, 0.15, 1.0)
    bs_r.inputs['Roughness'].default_value = 0.65
    lr.new(bs_r.outputs['BSDF'], out_r.inputs['Surface'])
    ram.data.materials.append(mat_ram)
    bpy.ops.object.shade_smooth()

    # Ervas frescas na cumbuca
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.023, location=(ramekin_pos[0], ramekin_pos[1], ramekin_pos[2] + 0.007))
    herbs = bpy.context.active_object
    herbs.scale = (1.0, 1.0, 0.40)
    mat_h = bpy.data.materials.new("Mat_Herbs_Green")
    mat_h.use_nodes = True
    nh = mat_h.node_tree.nodes
    lh = mat_h.node_tree.links
    nh.clear()
    out_h = nh.new('ShaderNodeOutputMaterial')
    bs_h = nh.new('ShaderNodeBsdfPrincipled')
    bs_h.inputs['Base Color'].default_value = (0.07, 0.38, 0.05, 1.0)
    bs_h.inputs['Roughness'].default_value = 0.35
    lh.new(bs_h.outputs['BSDF'], out_h.inputs['Surface'])
    herbs.data.materials.append(mat_h)
    bpy.ops.object.shade_smooth()

    # Salsinha fresca picada salpicada
    mat_flake = bpy.data.materials.new("Mat_Chive_Flakes")
    mat_flake.use_nodes = True
    nf = mat_flake.node_tree.nodes
    lf = mat_flake.node_tree.links
    nf.clear()
    out_f = nf.new('ShaderNodeOutputMaterial')
    bs_f = nf.new('ShaderNodeBsdfPrincipled')
    bs_f.inputs['Base Color'].default_value = (0.09, 0.44, 0.07, 1.0)
    bs_f.inputs['Roughness'].default_value = 0.30
    lf.new(bs_f.outputs['BSDF'], out_f.inputs['Surface'])

    # Flor de sal
    mat_salt = bpy.data.materials.new("Mat_Sea_Salt")
    mat_salt.use_nodes = True
    ns = mat_salt.node_tree.nodes
    ls = mat_salt.node_tree.links
    ns.clear()
    out_s = ns.new('ShaderNodeOutputMaterial')
    bs_s = ns.new('ShaderNodeBsdfPrincipled')
    bs_s.inputs['Base Color'].default_value = (0.97, 0.97, 0.99, 1.0)
    bs_s.inputs['Roughness'].default_value = 0.15
    if 'Transmission Weight' in bs_s.inputs:
        bs_s.inputs['Transmission Weight'].default_value = 0.60
    ls.new(bs_s.outputs['BSDF'], out_s.inputs['Surface'])

    random.seed(55)
    for i in range(24):
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

    for i in range(14):
        sx = random.uniform(0.12, 0.16)
        sy = random.uniform(-0.05, -0.01)
        sz = board_top_z + 0.001
        bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.0010, 0.0016), subdivisions=1, location=(sx, sy, sz))
        salt = bpy.context.active_object
        salt.data.materials.append(mat_salt)

def setup_camera_and_lighting(render_path, center_z, samples=128):
    """Câmera heroica cinematográfica 56mm e iluminação de estúdio gastronômico."""
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

    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1376
    scene.render.resolution_y = 768
    scene.render.filepath = render_path

    target = bpy.data.objects.new("HeroCameraTarget", None)
    bpy.context.collection.objects.link(target)
    target.location = (0.010, 0.0, center_z + 0.008)

    # Câmera Heroica (54mm, recuo balanceado para enquadrar lanche, tábua, cumbuca e maçarico)
    cam_data = bpy.data.cameras.new("HeroCamera")
    cam_data.lens = 54.0
    cam_data.sensor_width = 36.0
    cam_data.sensor_height = 36.0 * (768 / 1376)
    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = target
    cam_data.dof.aperture_fstop = 3.8

    cam_obj = bpy.data.objects.new("HeroCamera", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Posicionamento exato: elevação ~13.5°, Y = -0.48m, Z = center_z + 0.115m
    cam_obj.location = (0.010, -0.48, center_z + 0.115)

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    bpy.context.view_layer.update()

    # ILUMINAÇÃO DE ESTÚDIO GASTRONÔMICO
    # 1. Key Light Quente (frontal superior esquerda)
    bpy.ops.object.light_add(type='SPOT', radius=0.25, location=(-0.24, -0.36, center_z + 0.32))
    key = bpy.context.active_object
    key.name = "Key_Warm_Spot"
    key.data.energy = 50.0
    key.data.color = (1.0, 0.93, 0.84)
    key.data.spot_size = math.radians(65)
    key.data.spot_blend = 0.50

    # 2. Rim Light Dourada (traseira esquerda, contorno de silhueta)
    bpy.ops.object.light_add(type='POINT', radius=0.10, location=(-0.25, 0.22, center_z + 0.18))
    rim = bpy.context.active_object
    rim.name = "Rim_Golden_Back"
    rim.data.energy = 65.0
    rim.data.color = (1.0, 0.55, 0.12)

    # 3. Fill Light suave
    bpy.ops.object.light_add(type='POINT', radius=0.40, location=(0.12, -0.38, center_z + 0.20))
    fill = bpy.context.active_object
    fill.name = "Fill_Soft_Warm"
    fill.data.energy = 16.0
    fill.data.color = (0.95, 0.88, 0.80)

    print(f">> Iniciando render Cycles OptiX ({samples} samples)...")
    bpy.ops.render.render(write_still=True)
    print(f">> Render salvo em: {render_path}")

def main():
    print("=====================================================")
    print(">> ALHOARIA PASS 15: RENDER 3D PURO (SEM FOTOS)...")
    clean_scene()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    concepts_dir = os.path.join(project_root, "public", "assets", "concepts")
    models_dir = os.path.join(project_root, "public", "assets", "models")
    poly_dir = os.path.join(script_dir, "assets", "polyhaven")

    hdri_path = os.path.join(poly_dir, "warm_restaurant_night_1k.hdr")
    hand_glb = os.path.join(models_dir, "alhoaria-mao-chef.glb")

    create_environment(hdri_path)
    board, board_top_z = create_table_and_board()
    bread, center_z = create_baguette_3d(board_top_z)
    ribs, core, meat_z = create_costela_3d(center_z)
    cheese, cheese_z = create_melted_cheese_3d(meat_z, core)
    create_chef_hand_and_blowtorch(cheese_z, hand_glb)
    create_props_and_garnishes(board_top_z, cheese_z)

    render_out = os.path.join(concepts_dir, "candidate_render_pass15.png")
    setup_camera_and_lighting(render_out, center_z, samples=128)
    print(">> PASS 15 CONCLUÍDO COM SUCESSO!")
    print("=====================================================")

if __name__ == "__main__":
    main()
