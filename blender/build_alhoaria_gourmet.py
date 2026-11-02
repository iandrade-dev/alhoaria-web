"""
=============================================================================
ALHOARIA — SCRIPT DE MODELAGEM GOURMET 3D (BLENDER 5.x)
Projeto: Autêntico Pão de Alho Recheado — "A Bancada do Chef"
Formato: Baguete artesanal canoa (24cm) + Costela 6h desfiada + Queijo Maçaricado
Compatível: Blender 4.x / 5.x LTS
=============================================================================
"""

import bpy
import bmesh
import math
import random
import os
import sys

def clean_scene():
    """Remove todos os objetos, malhas, materiais e luzes anteriores."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)

def create_pbr_material(name, base_color, roughness=0.5, metallic=0.0, subsurface=0.0, normal_noise=False, noise_scale=20.0):
    """Cria um material PBR limpo compatível com glTF 2.0 e Three.js."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    output.location = (600, 0)

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (200, 0)
    bsdf.inputs['Base Color'].default_value = base_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic

    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = subsurface
    elif 'Subsurface' in bsdf.inputs:
        bsdf.inputs['Subsurface'].default_value = subsurface

    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def create_cheese_torched_material(name="Mat_Queijo_Macaricado"):
    """Cria o material de queijo fundido com manchas queimadas de maçarico assáveis em glTF."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    output.location = (700, 0)

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (350, 0)
    bsdf.inputs['Roughness'].default_value = 0.32
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.22

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-600, 0)

    noise = nodes.new(type='ShaderNodeTexNoise')
    noise.location = (-400, 0)
    noise.inputs['Scale'].default_value = 16.0
    noise.inputs['Detail'].default_value = 5.0
    noise.inputs['Roughness'].default_value = 0.65

    ramp = nodes.new(type='ShaderNodeValToRGB')
    ramp.location = (-150, 0)
    # Posição 0: queijo dourado derretido (#F8E298)
    ramp.color_ramp.elements[0].position = 0.40
    ramp.color_ramp.elements[0].color = (0.97, 0.88, 0.59, 1.0)
    # Posição 1: manchas tostadas escuras de maçarico (#261005)
    ramp.color_ramp.elements[1].position = 0.68
    ramp.color_ramp.elements[1].color = (0.15, 0.06, 0.02, 1.0)

    links.new(tex_coord.outputs['Generated'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def build_cutting_board():
    """Constrói a tábua de madeira rústica alongada com alça ergonômica (stage_board)."""
    # Corpo principal da tábua
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    board = bpy.context.active_object
    board.name = "stage_board"
    # Escala: 36cm x 17cm x 1.8cm
    board.dimensions = (0.36, 0.17, 0.018)
    board.location = (0, 0, -0.009)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Bevel modifier nos cantos
    bev = board.modifiers.new(name="Bevel", type='BEVEL')
    bev.width = 0.012
    bev.segments = 4
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Alça lateral da tábua
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.21, 0, -0.009))
    handle = bpy.context.active_object
    handle.dimensions = (0.07, 0.05, 0.018)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    bev_h = handle.modifiers.new(name="Bevel", type='BEVEL')
    bev_h.width = 0.008
    bev_h.segments = 3
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Furo na alça
    bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=0.04, location=(-0.21, 0, -0.009))
    hole = bpy.context.active_object

    bool_mod = handle.modifiers.new(name="HoleBool", type='BOOLEAN')
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object = hole
    bpy.ops.object.modifier_apply(modifier="HoleBool")
    bpy.data.objects.remove(hole, do_unlink=True)

    # Une a alça com a tábua
    bpy.ops.object.select_all(action='DESELECT')
    board.select_set(True)
    handle.select_set(True)
    bpy.context.view_layer.objects.active = board
    bpy.ops.object.join()

    bpy.ops.object.shade_smooth()
    mat_board = create_pbr_material("stage_board_PBR", (0.22, 0.13, 0.08, 1.0), roughness=0.75)
    board.data.materials.append(mat_board)
    return board

def build_artisan_baguette_boat():
    """Constrói a baguete rústica de pão de alho alongada com abertura em canoa (stage_bread)."""
    # Inicia com uma malha quad bem estruturada
    bm = bmesh.new()
    
    length = 0.24  # 24 cm
    width = 0.085  # 8.5 cm
    height = 0.055 # 5.5 cm
    
    segments_x = 24
    segments_y = 12
    
    # Gera a superfície externa da baguete
    verts_grid = []
    for ix in range(segments_x + 1):
        u = ix / segments_x # 0 a 1
        x = (u - 0.5) * length
        
        # Fator de afilamento nas pontas (arredondado natural)
        taper = math.sin(u * math.pi) ** 0.45
        w_curr = width * taper
        h_curr = height * taper
        
        row = []
        for iy in range(segments_y + 1):
            v = iy / segments_y # 0 a 1
            angle = (v - 0.5) * math.pi
            
            y = math.sin(angle) * (w_curr * 0.5)
            # Arco inferior e abertura superior
            z_norm = math.cos(angle)
            z = z_norm * h_curr
            
            # Corte em canoa no topo (vale de abertura para o recheio)
            top_cavity = math.exp(-((y / (width * 0.35 + 1e-4)) ** 2))
            if z > h_curr * 0.2:
                z = z - (top_cavity * h_curr * 0.65)
            
            row.append(bm.verts.new((x, y, max(0.002, z))))
        verts_grid.append(row)
        
    bm.verts.ensure_lookup_table()
    
    # Conecta as faces
    for ix in range(segments_x):
        for iy in range(segments_y):
            v1 = verts_grid[ix][iy]
            v2 = verts_grid[ix+1][iy]
            v3 = verts_grid[ix+1][iy+1]
            v4 = verts_grid[ix][iy+1]
            bm.faces.new((v1, v2, v3, v4))
            
    mesh = bpy.data.meshes.new("stage_bread_mesh")
    bm.to_mesh(mesh)
    bm.free()
    
    bread = bpy.data.objects.new("stage_bread", mesh)
    bpy.context.collection.objects.link(bread)
    bpy.context.view_layer.objects.active = bread
    bread.select_set(True)
    
    # Subsurf modifier para suavidade orgânica
    sub = bread.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    
    # Displace sutil para textura rústica artesanal
    disp = bread.modifiers.new(name="Displace", type='DISPLACE')
    tex_disp = bpy.data.textures.new("BreadNoise", type='CLOUDS')
    tex_disp.noise_scale = 0.08
    disp.texture = tex_disp
    disp.strength = 0.003
    
    bpy.ops.object.shade_smooth()
    mat_bread = create_pbr_material("stage_bread_PBR", (0.84, 0.58, 0.28, 1.0), roughness=0.68, subsurface=0.10)
    bread.data.materials.append(mat_bread)
    return bread

def build_garlic_and_cream_layers():
    """Constrói as camadas de pasta de alho (stage_garlic) e creme de queijo (stage_cream)."""
    # Pasta de alho no fundo da canoa
    bm_g = bmesh.new()
    length = 0.20
    width = 0.052
    
    verts = []
    for ix in range(16):
        u = ix / 15.0
        x = (u - 0.5) * length
        taper = math.sin(u * math.pi) ** 0.5
        row = []
        for iy in range(6):
            v = iy / 5.0
            y = (v - 0.5) * width * taper
            z = 0.022 + 0.003 * math.sin(u * math.pi * 3) + 0.002 * math.cos(v * math.pi * 2)
            row.append(bm_g.verts.new((x, y, z)))
        verts.append(row)
        
    for ix in range(15):
        for iy in range(5):
            bm_g.faces.new((verts[ix][iy], verts[ix+1][iy], verts[ix+1][iy+1], verts[ix][iy+1]))
            
    mesh_g = bpy.data.meshes.new("stage_garlic_mesh")
    bm_g.to_mesh(mesh_g)
    bm_g.free()
    
    garlic = bpy.data.objects.new("stage_garlic", mesh_g)
    bpy.context.collection.objects.link(garlic)
    mat_garlic = create_pbr_material("stage_garlic_PBR", (0.95, 0.89, 0.72, 1.0), roughness=0.28)
    garlic.data.materials.append(mat_garlic)
    garlic.select_set(True)
    bpy.context.view_layer.objects.active = garlic
    bpy.ops.object.shade_smooth()

    # Creme da casa (catupiry artesanal)
    bm_c = bmesh.new()
    verts_c = []
    for ix in range(16):
        u = ix / 15.0
        x = (u - 0.5) * length
        taper = math.sin(u * math.pi) ** 0.5
        row = []
        for iy in range(6):
            v = iy / 5.0
            y = (v - 0.5) * (width * 0.95) * taper
            z = 0.026 + 0.004 * math.sin(u * math.pi * 4) + 0.002 * math.sin(v * math.pi * 3)
            row.append(bm_c.verts.new((x, y, z)))
        verts_c.append(row)
        
    for ix in range(15):
        for iy in range(5):
            bm_c.faces.new((verts_c[ix][iy], verts_c[ix+1][iy], verts_c[ix+1][iy+1], verts_c[ix][iy+1]))
            
    mesh_c = bpy.data.meshes.new("stage_cream_mesh")
    bm_c.to_mesh(mesh_c)
    bm_c.free()
    
    cream = bpy.data.objects.new("stage_cream", mesh_c)
    bpy.context.collection.objects.link(cream)
    mat_cream = create_pbr_material("stage_cream_PBR", (0.98, 0.96, 0.88, 1.0), roughness=0.32, subsurface=0.20)
    cream.data.materials.append(mat_cream)
    cream.select_set(True)
    bpy.context.view_layer.objects.active = cream
    bpy.ops.object.shade_smooth()

    return garlic, cream

def build_fillings():
    """Constrói os grupos de recheio (costela desfiada 6h, frango, alcatra, brócolis e pork)."""
    random.seed(42)
    
    fillings_config = {
        "filling_costela": {"color": (0.16, 0.07, 0.04, 1.0), "roughness": 0.26, "count": 18, "scale": (0.028, 0.018, 0.016)},
        "filling_frango": {"color": (0.82, 0.62, 0.38, 1.0), "roughness": 0.45, "count": 16, "scale": (0.026, 0.020, 0.015)},
        "filling_alcatra": {"color": (0.24, 0.11, 0.07, 1.0), "roughness": 0.30, "count": 18, "scale": (0.025, 0.017, 0.014)},
        "filling_brocolis": {"color": (0.22, 0.42, 0.16, 1.0), "roughness": 0.60, "count": 16, "scale": (0.022, 0.022, 0.018)},
        "filling_pork": {"color": (0.32, 0.15, 0.09, 1.0), "roughness": 0.32, "count": 18, "scale": (0.027, 0.018, 0.015)}
    }
    
    for group_name, cfg in fillings_config.items():
        empty = bpy.data.objects.new(group_name, None)
        bpy.context.collection.objects.link(empty)
        empty.location = (0, 0, 0)
        
        mat = create_pbr_material(f"{group_name}_PBR", cfg["color"], roughness=cfg["roughness"])
        
        length = 0.20
        for i in range(cfg["count"]):
            u = (i + 0.5) / cfg["count"]
            x = (u - 0.5) * length + random.uniform(-0.008, 0.008)
            taper = math.sin(u * math.pi) ** 0.5
            y = random.uniform(-0.022, 0.022) * taper
            z = 0.038 + random.uniform(-0.003, 0.006)
            
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.012, location=(x, y, z))
            chunk = bpy.context.active_object
            chunk.name = f"{group_name}_portion_{i:02d}"
            chunk.parent = empty
            
            # Escala e distorção para parecer mecha de carne / alimento real
            sx = cfg["scale"][0] * random.uniform(0.85, 1.35)
            sy = cfg["scale"][1] * random.uniform(0.85, 1.25)
            sz = cfg["scale"][2] * random.uniform(0.80, 1.20)
            chunk.scale = (sx / 0.012, sy / 0.012, sz / 0.012)
            chunk.rotation_euler = (random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), random.uniform(-0.5, 0.5))
            
            bpy.ops.object.shade_smooth()
            chunk.data.materials.append(mat)

def build_gratinated_cheese_mantle():
    """Constrói o manto de queijo fundido com manchas tostadas de maçarico (stage_gratin)."""
    bm = bmesh.new()
    length = 0.21
    width = 0.065
    
    segments_x = 22
    segments_y = 12
    
    verts = []
    for ix in range(segments_x + 1):
        u = ix / segments_x
        x = (u - 0.5) * length
        taper = math.sin(u * math.pi) ** 0.45
        w_curr = width * taper
        
        row = []
        for iy in range(segments_y + 1):
            v = iy / segments_y
            angle = (v - 0.5) * math.pi
            y = math.sin(angle) * (w_curr * 0.5)
            
            # Arco curvado sobre o recheio
            z_curve = math.cos(angle)
            z = 0.046 + (z_curve * 0.016)
            
            # Pequenas ondulações de derretimento
            z += 0.002 * math.sin(u * math.pi * 6) * math.cos(v * math.pi * 4)
            
            # Gotas escorrendo nas bordas exteriores
            if iy in (0, segments_y) and 0.2 < u < 0.8:
                if (ix % 4) == 0:
                    z -= 0.010 # gota escorrendo
                    
            row.append(bm.verts.new((x, y, z)))
        verts.append(row)
        
    for ix in range(segments_x):
        for iy in range(segments_y):
            bm.faces.new((verts[ix][iy], verts[ix+1][iy], verts[ix+1][iy+1], verts[ix][iy+1]))
            
    mesh = bpy.data.meshes.new("stage_gratin_mesh")
    bm.to_mesh(mesh)
    bm.free()
    
    cheese = bpy.data.objects.new("stage_gratin", mesh)
    bpy.context.collection.objects.link(cheese)
    bpy.context.view_layer.objects.active = cheese
    cheese.select_set(True)
    
    # Solidify para dar espessura de queijo derretido
    sol = cheese.modifiers.new(name="Solidify", type='SOLIDIFY')
    sol.thickness = 0.004
    
    sub = cheese.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    
    bpy.ops.object.shade_smooth()
    mat_cheese = create_cheese_torched_material("stage_gratin_PBR")
    cheese.data.materials.append(mat_cheese)
    return cheese

def export_draco_glb(output_path):
    """Exporta toda a cena para um arquivo GLB compactado com Draco."""
    # Seleciona todos os objetos a serem exportados
    bpy.ops.object.select_all(action='SELECT')
    
    print(f">> Exportando GLB com Draco para: {output_path}")
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_image_format='AUTO'
    )
    print(">> Exportação concluída com sucesso!")

def main():
    print("=====================================================")
    print(">> Iniciando construção 3D Gourmet Alhoaria...")
    clean_scene()
    
    board = build_cutting_board()
    bread = build_artisan_baguette_boat()
    garlic, cream = build_garlic_and_cream_layers()
    build_fillings()
    gratin = build_gratinated_cheese_mantle()
    
    # Determina caminho de saída
    out_file = None
    if "--" in sys.argv:
        idx = sys.argv.index("--")
        if idx + 1 < len(sys.argv):
            out_file = sys.argv[idx + 1]
            
    if not out_file:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(script_dir, ".."))
        out_file = os.path.join(project_root, "public", "assets", "models", "alhoaria-ingredientes.glb")
        
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    export_draco_glb(out_file)
    print(">> MODELO 3D GOURMET ALHOARIA CONSTRUÍDO E EXPORTADO!")
    print("=====================================================")

if __name__ == "__main__":
    main()
