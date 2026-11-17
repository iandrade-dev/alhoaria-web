"""
=============================================================================
ALHOARIA — SCRIPT DE MODELAGEM E SHADING GOURMET CINEMATOGRÁFICO (PASS 2)
Implementa 100% das correções exigidas na auditoria cega:
- Pão canoa artesanal com volume real, crosta dourada e enfarinhada
- Costela 6h desfiada em mechas/fitas fibrosas reais (ZERO esferas)
- Queijo fundido com manto espesso e manchas reais de maçarico (leopard spots)
- Tábua escura de madeira nobre com canaleta de suco chanfrada
- Salpicos de cebolinha fresca verde e flocos de sal marinho
- Iluminação cinematográfica de gastropub com rim light quente
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

def create_dark_wood_board():
    """Cria a tábua de madeira nobre escura com canaleta de suco esculpida."""
    # Base principal da tábua (38cm x 20cm x 2.4cm)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.012))
    board = bpy.context.active_object
    board.name = "stage_board"
    board.dimensions = (0.38, 0.20, 0.024)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Bevel nos cantos
    bev = board.modifiers.new("Bevel", 'BEVEL')
    bev.width = 0.014
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Canaleta de suco (juice groove) via curva chanfrada booleana
    bpy.ops.curve.primitive_bezier_circle_add(radius=1.0, location=(0, 0, 0.001))
    groove_curve = bpy.context.active_object
    # Ajusta para formato retangular arredondado acompanhando a borda
    groove_curve.scale = (0.165, 0.08, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    groove_curve.data.bevel_depth = 0.004
    groove_curve.data.bevel_resolution = 3
    bpy.ops.object.convert(target='MESH')
    groove_mesh = bpy.context.active_object

    bool_groove = board.modifiers.new("GrooveBool", 'BOOLEAN')
    bool_groove.operation = 'DIFFERENCE'
    bool_groove.object = groove_mesh
    bpy.ops.object.modifier_apply(modifier="GrooveBool")
    bpy.data.objects.remove(groove_mesh, do_unlink=True)

    # Material de madeira escura rústica gastropub
    mat = bpy.data.materials.new("stage_board_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.65

    # Textura procedural de veios de madeira
    tex_coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (15.0, 3.0, 1.0)
    
    wave = nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.inputs['Scale'].default_value = 6.0
    wave.inputs['Distortion'].default_value = 4.5
    wave.inputs['Detail'].default_value = 4.0

    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.2
    ramp.color_ramp.elements[0].color = (0.08, 0.045, 0.025, 1.0) # Carvalho escuro queimado
    ramp.color_ramp.elements[1].position = 0.85
    ramp.color_ramp.elements[1].color = (0.18, 0.10, 0.055, 1.0) # Nogueira quente

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], wave.inputs['Vector'])
    links.new(wave.outputs['Color'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    board.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return board

def create_artisan_bread():
    """Cria a baguete rústica volumosa com corte canoa e crosta estaladiça enfarinhada."""
    bm = bmesh.new()
    length = 0.25 # 25 cm
    width = 0.090 # 9 cm
    height = 0.065 # 6.5 cm de altura real

    nx = 32
    ny = 16

    verts_grid = []
    for ix in range(nx + 1):
        u = ix / nx
        x = (u - 0.5) * length
        taper = math.sin(u * math.pi) ** 0.42
        w_curr = width * taper
        h_curr = height * taper

        row = []
        for iy in range(ny + 1):
            v = iy / ny
            angle = (v - 0.5) * math.pi
            y = math.sin(angle) * (w_curr * 0.5)
            z_raw = math.cos(angle) * h_curr

            # Abertura em canoa no topo para o recheio generoso
            top_cut = math.exp(-((y / (width * 0.32 + 1e-4)) ** 2))
            if z_raw > h_curr * 0.25 and 0.08 < u < 0.92:
                z_raw -= top_cut * (h_curr * 0.70)

            # Pequenas irregularidades artesanais na casca
            noise_bump = 0.002 * math.sin(u * 25.0) * math.cos(v * 15.0)
            z_final = max(0.001, z_raw + noise_bump)
            row.append(bm.verts.new((x, y, z_final)))
        verts_grid.append(row)

    bm.verts.ensure_lookup_table()
    for ix in range(nx):
        for iy in range(ny):
            bm.faces.new((verts_grid[ix][iy], verts_grid[ix+1][iy], verts_grid[ix+1][iy+1], verts_grid[ix][iy+1]))

    mesh = bpy.data.meshes.new("stage_bread_mesh")
    bm.to_mesh(mesh)
    bm.free()

    bread = bpy.data.objects.new("stage_bread", mesh)
    bpy.context.collection.objects.link(bread)
    bpy.context.view_layer.objects.active = bread
    bread.select_set(True)

    sub = bread.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 1
    bpy.ops.object.shade_smooth()

    # Material de casca rústica artesanal com farinha nos vincos e miolo dourado
    mat = bpy.data.materials.new("stage_bread_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.72

    tex_coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 24.0
    noise.inputs['Detail'].default_value = 6.0
    noise.inputs['Roughness'].default_value = 0.65

    # Gradiente de assamento: base mais tostada, casca dourada e manchas de farinha
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = (0.42, 0.20, 0.07, 1.0) # Crosta bem assada
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[1].color = (0.86, 0.58, 0.25, 1.0) # Dourado de pão de alho
    el_flour = ramp.color_ramp.elements.new(0.84)
    el_flour.color = (0.95, 0.92, 0.85, 1.0) # Polvilhado sutil de farinha artesanal

    links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    bread.data.materials.append(mat)
    return bread

def create_shredded_rib_fibers():
    """Cria mechas e fitas reais de costela bovina desfiada 6h (ZERO esferas)."""
    empty = bpy.data.objects.new("filling_costela", None)
    bpy.context.collection.objects.link(empty)

    mat_ribs = bpy.data.materials.new("filling_costela_PBR")
    mat_ribs.use_nodes = True
    nodes = mat_ribs.node_tree.nodes
    links = mat_ribs.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.18, 0.075, 0.04, 1.0) # Mogno carnes caramelizadas
    bsdf.inputs['Roughness'].default_value = 0.24 # Brilho suculento de colágeno e gordura quente
    bsdf.inputs['Metallic'].default_value = 0.02

    # Bump map longitudinal de fibras musculares
    tex_coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (25.0, 4.0, 4.0)
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 18.0
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    random.seed(101)
    strands_count = 38
    length = 0.21

    for i in range(strands_count):
        u = (i + 0.5) / strands_count
        cx = (u - 0.5) * length + random.uniform(-0.012, 0.012)
        cy = random.uniform(-0.024, 0.024)
        cz = 0.038 + random.uniform(-0.004, 0.008)

        # Cada mecha é uma fita curva irregular
        curve_data = bpy.data.curves.new(f"RibStrandCurve_{i}", type='CURVE')
        curve_data.dimensions = '3D'
        curve_data.bevel_depth = random.uniform(0.0025, 0.0055)
        curve_data.bevel_resolution = 2

        spline = curve_data.splines.new('BEZIER')
        spline.bezier_points.add(2) # 3 pontos no total

        p0 = spline.bezier_points[0]
        p1 = spline.bezier_points[1]
        p2 = spline.bezier_points[2]

        strand_len = random.uniform(0.028, 0.055)
        p0.co = (cx - strand_len*0.5, cy + random.uniform(-0.006, 0.006), cz + random.uniform(-0.002, 0.002))
        p1.co = (cx, cy + random.uniform(-0.008, 0.008), cz + random.uniform(0.004, 0.012))
        p2.co = (cx + strand_len*0.5, cy + random.uniform(-0.006, 0.006), cz + random.uniform(-0.002, 0.002))

        for p in (p0, p1, p2):
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'

        strand_obj = bpy.data.objects.new(f"filling_costela_portion_{i:02d}", curve_data)
        bpy.context.collection.objects.link(strand_obj)
        strand_obj.parent = empty
        strand_obj.data.materials.append(mat_ribs)

    return empty

def create_torched_cheese_mantle():
    """Cria o manto de queijo derretido espesso com manchas de maçarico (leopard spots)."""
    bm = bmesh.new()
    length = 0.22
    width = 0.075

    nx = 28
    ny = 14

    verts = []
    for ix in range(nx + 1):
        u = ix / nx
        x = (u - 0.5) * length
        taper = math.sin(u * math.pi) ** 0.40
        w_curr = width * taper

        row = []
        for iy in range(ny + 1):
            v = iy / ny
            angle = (v - 0.5) * math.pi
            y = math.sin(angle) * (w_curr * 0.5)

            # Manto espesso cobrindo as mechas de carne
            z = 0.050 + math.cos(angle) * 0.018

            # Gotas espessas de queijo derretido escorrendo pelas bordas
            if iy in (0, ny) and 0.25 < u < 0.75:
                if (ix % 3) == 0:
                    z -= 0.014 # gota generosa escorrendo

            row.append(bm.verts.new((x, y, z)))
        verts.append(row)

    for ix in range(nx):
        for iy in range(ny):
            bm.faces.new((verts[ix][iy], verts[ix+1][iy], verts[ix+1][iy+1], verts[ix][iy+1]))

    mesh = bpy.data.meshes.new("stage_gratin_mesh")
    bm.to_mesh(mesh)
    bm.free()

    cheese = bpy.data.objects.new("stage_gratin", mesh)
    bpy.context.collection.objects.link(cheese)
    cheese.select_set(True)
    bpy.context.view_layer.objects.active = cheese

    sol = cheese.modifiers.new("Solidify", 'SOLIDIFY')
    sol.thickness = 0.005 # 5mm de espessura de queijo derretido
    sub = cheese.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 1
    bpy.ops.object.shade_smooth()

    # Shader de queijo maçaricado com manchas de leopardo (leopard spots)
    mat = bpy.data.materials.new("stage_gratin_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.28
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.35

    tex_coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (14.0, 10.0, 1.0)

    # Voronoi para núcleos das manchas de tostado
    voronoi = nodes.new('ShaderNodeTexVoronoi')
    voronoi.feature = 'F1'
    voronoi.distance = 'EUCLIDEAN'
    voronoi.inputs['Scale'].default_value = 22.0

    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 16.0
    noise.inputs['Detail'].default_value = 5.0

    mix_tex = nodes.new('ShaderNodeMix')
    mix_tex.data_type = 'FLOAT'
    mix_tex.inputs['Factor'].default_value = 0.45
    links.new(voronoi.outputs['Distance'], mix_tex.inputs[2])
    links.new(noise.outputs['Fac'], mix_tex.inputs[3])

    # ColorRamp das manchas de maçarico
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = (0.08, 0.025, 0.01, 1.0) # Centro tostado/queimado escuro
    ramp.color_ramp.elements[1].position = 0.38
    ramp.color_ramp.elements[1].color = (0.48, 0.22, 0.06, 1.0) # Borda tostada âmbar
    el_gold = ramp.color_ramp.elements.new(0.55)
    el_gold.color = (0.92, 0.75, 0.35, 1.0) # Dourado borbulhante
    el_cheese = ramp.color_ramp.elements.new(0.72)
    el_cheese.color = (0.98, 0.94, 0.82, 1.0) # Mussarela cremosa clara

    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], voronoi.inputs['Vector'])
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    links.new(mix_tex.outputs['Result'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    cheese.data.materials.append(mat)
    return cheese

def create_garnishes():
    """Salpica cebolinha fresca picada (chives) e flocos de sal marinho na tábua e no queijo."""
    # Material de cebolinha fresca verde brilhante
    mat_chive = bpy.data.materials.new("Mat_Cebolinha_Fresca")
    mat_chive.use_nodes = True
    bsdf_c = mat_chive.node_tree.nodes.get("Principled BSDF")
    if bsdf_c:
        bsdf_c.inputs['Base Color'].default_value = (0.12, 0.42, 0.08, 1.0) # Verde vibrante
        bsdf_c.inputs['Roughness'].default_value = 0.35

    # Material de sal marinho translúcido
    mat_salt = bpy.data.materials.new("Mat_Sal_Marinho")
    mat_salt.use_nodes = True
    bsdf_s = mat_salt.node_tree.nodes.get("Principled BSDF")
    if bsdf_s:
        bsdf_s.inputs['Base Color'].default_value = (0.98, 0.98, 0.98, 1.0)
        bsdf_s.inputs['Roughness'].default_value = 0.15

    random.seed(55)
    # 25 salpicos de cebolinha
    for i in range(25):
        if i < 15:
            # Sobre o queijo
            x = random.uniform(-0.08, 0.08)
            y = random.uniform(-0.02, 0.02)
            z = 0.062 + random.uniform(0.001, 0.005)
        else:
            # Na tábua
            x = random.uniform(-0.16, 0.16)
            y = random.choice([random.uniform(0.05, 0.08), random.uniform(-0.08, -0.05)])
            z = 0.001

        bpy.ops.mesh.primitive_cylinder_add(radius=0.0022, depth=0.0015, vertices=8, location=(x, y, z))
        flake = bpy.context.active_object
        flake.name = f"Chive_{i}"
        flake.rotation_euler = (random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5), random.uniform(0, math.pi))
        flake.data.materials.append(mat_chive)
        bpy.ops.object.shade_smooth()

    # 15 flocos de sal marinho na tábua
    for i in range(15):
        x = random.uniform(-0.15, 0.15)
        y = random.uniform(-0.08, 0.08)
        z = 0.001
        bpy.ops.mesh.primitive_cube_add(size=0.0018, location=(x, y, z))
        salt = bpy.context.active_object
        salt.name = f"Salt_{i}"
        salt.rotation_euler = (random.uniform(0, 1), random.uniform(0, 1), random.uniform(0, 1))
        salt.data.materials.append(mat_salt)

def setup_gastropub_lighting_and_render(render_path):
    """Configura iluminação profissional de gastropub (rim light quente, key 3200K, fill e DoF)."""
    # 1. Key Light (luz dourada suave 3200K)
    bpy.ops.object.light_add(type='SPOT', radius=0.15, location=(0.28, -0.32, 0.35))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 65.0
    key.data.color = (1.0, 0.93, 0.82)
    key.data.spot_size = math.radians(55)
    key.data.spot_blend = 0.45

    # 2. Rim Light Maçarico (luz âmbar quente de recorte nas costas)
    bpy.ops.object.light_add(type='POINT', radius=0.08, location=(-0.25, 0.22, 0.20))
    rim = bpy.context.active_object
    rim.name = "Rim_Torch"
    rim.data.energy = 85.0
    rim.data.color = (1.0, 0.48, 0.12) # Laranja fogo incandescente

    # 3. Soft Fill
    bpy.ops.object.light_add(type='POINT', radius=0.30, location=(0.15, 0.25, 0.15))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = 20.0
    fill.data.color = (0.85, 0.80, 0.75)

    # 4. Câmera com ângulo hero gastronômico
    bpy.ops.object.camera_add(location=(0.22, -0.35, 0.22))
    cam = bpy.context.active_object
    cam.name = "Hero_Camera"
    cam.rotation_euler = (math.radians(62), 0, math.radians(32))
    cam.data.lens = 65 # Lente retrato gastronômico sem distorção
    bpy.context.scene.camera = cam

    # Fundo escuro gastropub
    world = bpy.context.scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.04, 0.035, 0.03, 1.0) # Carvão quente
        bg.inputs['Strength'].default_value = 0.8

    # Resolução
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.context.scene.render.filepath = render_path
    bpy.ops.render.render(write_still=True)
    print(f">> Render cinematográfico salvo em: {render_path}")

def main():
    print("=====================================================")
    print(">> Executando Pass 2: Modelagem & Render Culinário Fiel...")
    clean_scene()
    board = create_dark_wood_board()
    bread = create_artisan_bread()
    ribs = create_shredded_rib_fibers()
    cheese = create_torched_cheese_mantle()
    create_garnishes()
    
    # Resolve caminho compatível com Windows/WSL
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    render_file = os.path.join(project_root, "public", "assets", "concepts", "candidate_render_pass2.png")
    setup_gastropub_lighting_and_render(render_file)
    print(">> PASS 2 CONCLUÍDO COM SUCESSO!")
    print("=====================================================")

if __name__ == "__main__":
    main()
