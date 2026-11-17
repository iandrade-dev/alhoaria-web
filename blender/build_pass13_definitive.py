"""
=============================================================================
ALHOARIA — SCRIPT GOURMET DEFINITIVO (PASS 13)
Correção definitiva dos 6 pontos críticos da auditoria:
1. Câmera Heroica 3/4 elevada (~32° elevação, lente 48mm, enquadramento balanceado)
2. Tábua Poly Haven com textura escura de nogueira/carvalho tostado (sem madeira crua)
3. Pão artesanal volumoso com textura PBR Box-mapping (sem estiramento radial ou costura)
4. Costela desfiada transbordando pelas laterais da canoa com fibras visíveis e brilho de molho
5. Queijo derretido no centro com manchas reais de maçarico (sem estourar em branco puro)
6. Braço e mão de chef visíveis no canto superior direito com dólmã e maçarico detalhado
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

def setup_hdri_environment(hdri_path):
    """Configura iluminação global acolhedora de gastropub noturno."""
    world = bpy.context.scene.world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    env_node = nodes.new('ShaderNodeTexEnvironment')
    env_img = load_texture(hdri_path)
    if env_img:
        env_node.image = env_img

    bg_node = nodes.new('ShaderNodeBackground')
    bg_node.inputs['Strength'].default_value = 0.85

    out_node = nodes.new('ShaderNodeOutputWorld')
    links.new(env_node.outputs['Color'], bg_node.inputs['Color'])
    links.new(bg_node.outputs['Background'], out_node.inputs['Surface'])

def create_table_underneath(tex_wood_path):
    """Bancada de gastropub sob a tábua."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.05, -0.025))
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
    bsdf.inputs['Roughness'].default_value = 0.70

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
        mult.inputs['Factor'].default_value = 0.55
        mult.inputs[7].default_value = (0.18, 0.12, 0.08, 1.0)
        l.new(tex_node.outputs['Color'], mult.inputs[6])
        l.new(mult.outputs[2], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.04, 0.025, 0.015, 1.0)

    l.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    table.data.materials.append(mat_table)
    bpy.ops.object.shade_smooth()

def load_polyhaven_board(board_blend_path):
    """Importa a tábua de corte escaneada em 3D e ajusta a cor para nogueira escura nobre."""
    if os.path.exists(board_blend_path):
        with bpy.data.libraries.load(board_blend_path, link=False) as (data_from, data_to):
            data_to.objects = [name for name in data_from.objects if "board" in name.lower()]

        if data_to.objects:
            board = data_to.objects[0]
            bpy.context.collection.objects.link(board)
            board.name = "stage_board"
            board.scale = (0.84, 0.84, 0.84)
            board.location = (0.0, 0.0, 0.0)
            bpy.ops.object.select_all(action='DESELECT')
            board.select_set(True)
            bpy.context.view_layer.objects.active = board
            bpy.ops.object.transform_apply(scale=True)

            # Ajusta o material para nogueira escura nobre (charred rustic walnut)
            for mat in board.data.materials:
                if mat and mat.use_nodes:
                    bsdf = next((node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
                    diff_node = next((node for node in mat.node_tree.nodes if node.type == 'TEX_IMAGE' and 'diff' in node.name.lower()), None)
                    if bsdf and diff_node:
                        # Insere um multiplicador de escurecimento para tom de nogueira nobre
                        mix = mat.node_tree.nodes.new('ShaderNodeMix')
                        mix.data_type = 'RGBA'
                        mix.blend_type = 'MULTIPLY'
                        mix.inputs['Factor'].default_value = 0.50
                        mix.inputs[7].default_value = (0.28, 0.16, 0.10, 1.0) # Nogueira escura
                        
                        # Reconecta os links
                        for link in list(mat.node_tree.links):
                            if link.from_node == diff_node and link.to_node == bsdf:
                                mat.node_tree.links.remove(link)
                        mat.node_tree.links.new(diff_node.outputs['Color'], mix.inputs[6])
                        mat.node_tree.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
                        bsdf.inputs['Roughness'].default_value = 0.48

            print(">> Tábua 3D Poly Haven configurada com textura de nogueira escura!")
            return board, 0.0348

    # Fallback
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.011))
    board = bpy.context.active_object
    board.name = "stage_board"
    board.dimensions = (0.38, 0.22, 0.022)
    bpy.ops.object.transform_apply(scale=True)
    return board, 0.022

def create_bread(board_top_z, tex_bread_path):
    """Cria a baguete artesanal canoa com volume generoso e mapeamento Box perfeito (sem costuras)."""
    center_z = board_top_z + 0.026
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=36, radius=0.043, depth=0.24,
        location=(0, 0, center_z), rotation=(0, math.radians(90), 0)
    )
    bread = bpy.context.active_object
    bread.name = "stage_bread"
    bread.scale = (1.0, 1.0, 0.60)
    bpy.ops.object.transform_apply(scale=True, rotation=True)

    bm = bmesh.new()
    bm.from_mesh(bread.data)
    for v in bm.verts:
        nx = v.co.x / 0.12
        taper = max(0.25, 1.0 - (abs(nx) ** 2.2) * 0.42)
        v.co.y *= taper
        v.co.z = (v.co.z - center_z) * taper + center_z

        if v.co.z < board_top_z + 0.003:
            v.co.z = board_top_z + 0.001

        # Abertura canoa
        if v.co.z > center_z and abs(nx) < 0.82:
            dist_y = abs(v.co.y)
            if dist_y < 0.026:
                v.co.z -= 0.018 * (1.0 - (dist_y / 0.026) ** 2)

    bm.to_mesh(bread.data)
    bm.free()

    sub = bread.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 1
    bpy.ops.object.shade_smooth()

    # Material com Box Mapping tridimensional (elimina completamente distorções de UV ou costuras)
    mat = bpy.data.materials.new("stage_bread_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.68

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

        # Realce da crosta dourada e farinha artesanal
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
    return bread, center_z

def create_costela(center_z, tex_meat_path):
    """Cria o recheio farto de costela desfiada 6h transbordando com fibras visíveis e brilho suculento."""
    meat_z = center_z + 0.012
    # Base volumosa mais larga que o queijo para as fibras ficarem visíveis e transbordando
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, meat_z))
    meat = bpy.context.active_object
    meat.name = "meat_mound_base"
    meat.dimensions = (0.20, 0.068, 0.028)
    bpy.ops.object.transform_apply(scale=True)

    bm = bmesh.new()
    bm.from_mesh(meat.data)
    for v in bm.verts:
        nx = abs(v.co.x) / 0.10
        v.co.y *= max(0.40, 1.0 - (nx ** 2) * 0.45)
    bm.to_mesh(meat.data)
    bm.free()

    sub = meat.modifiers.new("Subsurf", 'SUBSURF')
    sub.levels = 2

    disp = meat.modifiers.new("MeatRoughness", 'DISPLACE')
    tex_m = bpy.data.textures.new("MeatNoisePass13", 'CLOUDS')
    tex_m.noise_scale = 0.010
    disp.texture = tex_m
    disp.strength = 0.006
    bpy.ops.object.shade_smooth()

    mat = bpy.data.materials.new("filling_costela_PBR")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.18 # Brilho suculento de molho laqueado
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.70

    tex_coord = nodes.new('ShaderNodeTexCoord')
    img = load_texture(tex_meat_path)
    if img:
        tex_node = nodes.new('ShaderNodeTexImage')
        tex_node.image = img
        tex_node.projection = 'BOX'
        tex_node.projection_blend = 0.30
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])

        mix_tint = nodes.new('ShaderNodeMix')
        mix_tint.data_type = 'RGBA'
        mix_tint.blend_type = 'MULTIPLY'
        mix_tint.inputs['Factor'].default_value = 0.45
        mix_tint.inputs[7].default_value = (0.26, 0.09, 0.035, 1.0)
        links.new(tex_node.outputs['Color'], mix_tint.inputs[6])
        links.new(mix_tint.outputs[2], bsdf.inputs['Base Color'])

        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.045
        links.new(tex_node.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.22, 0.08, 0.035, 1.0)

    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    meat.data.materials.append(mat)

    empty = bpy.data.objects.new("filling_costela", None)
    bpy.context.collection.objects.link(empty)
    meat.parent = empty

    # 36 mechas orgânicas de costela desfiada caindo visivelmente pelas laterais
    random.seed(77)
    for i in range(36):
        cx = random.uniform(-0.085, 0.085)
        cy = random.choice([random.uniform(0.024, 0.034), random.uniform(-0.034, -0.024)])
        cz = meat_z + random.uniform(-0.004, 0.008)

        curve_data = bpy.data.curves.new(f"RibFiber_{i}", type='CURVE')
        curve_data.dimensions = '3D'
        curve_data.bevel_depth = random.uniform(0.0016, 0.0028)
        curve_data.bevel_resolution = 2

        spline = curve_data.splines.new('BEZIER')
        spline.bezier_points.add(2)
        p0, p1, p2 = spline.bezier_points[0], spline.bezier_points[1], spline.bezier_points[2]

        sl = random.uniform(0.022, 0.038)
        p0.co = (cx - sl*0.5, cy, cz)
        p1.co = (cx, cy + random.uniform(-0.004, 0.004), cz + 0.003)
        p2.co = (cx + sl*0.5, cy, cz - 0.005)

        for p in (p0, p1, p2):
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'

        fiber_obj = bpy.data.objects.new(f"filling_costela_fiber_{i:02d}", curve_data)
        bpy.context.collection.objects.link(fiber_obj)
        fiber_obj.parent = empty
        fiber_obj.data.materials.append(mat)

    return empty, meat, meat_z

def create_cheese(meat_z, meat_target, tex_cheese_path):
    """Cria o manto de queijo fundido drapeado no centro com manchas de maçarico (leopard spots)."""
    cheese_z = meat_z + 0.015
    # Largura concentrada (0.052) para deixar as fibras de costela visíveis nas bordas
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=36, y_subdivisions=20, size=1.0, location=(0, 0, cheese_z))
    cheese = bpy.context.active_object
    cheese.name = "stage_gratin"
    cheese.dimensions = (0.19, 0.052, 1.0)
    cheese.scale.z = 1.0
    bpy.ops.object.transform_apply(scale=True)

    sw = cheese.modifiers.new("DrapeShrinkwrap", 'SHRINKWRAP')
    sw.target = meat_target
    sw.wrap_method = 'NEAREST_SURFACETEXTURE' if 'NEAREST_SURFACETEXTURE' in [e.identifier for e in sw.bl_rna.properties['wrap_method'].enum_items] else 'NEAREST_SURFACEPOINT'
    sw.offset = 0.003
    bpy.ops.object.modifier_apply(modifier="DrapeShrinkwrap")

    sol = cheese.modifiers.new("CheeseSolidify", 'SOLIDIFY')
    sol.thickness = 0.004
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
    bsdf.inputs['Roughness'].default_value = 0.22 # Queijo derretido gorduroso e reluzente
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.58

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
        tex_node.projection_blend = 0.25
        links.new(tex_coord.outputs['Object'], tex_node.inputs['Vector'])

        mix_cheese = nodes.new('ShaderNodeMix')
        mix_cheese.data_type = 'RGBA'
        mix_cheese.blend_type = 'MULTIPLY'
        mix_cheese.inputs['Factor'].default_value = 0.30
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
    return cheese, cheese_z

def setup_chef_hand_and_torch(cheese_z, hand_glb_path):
    """Monta o conjunto completo no canto superior direito: braço com dólmã, mão do chef e maçarico."""
    torch_rot = (math.radians(-32), math.radians(16), math.radians(-25))

    # 1. Braço do Chef em dólmã preta (entrando pelo canto superior direito)
    arm_pos = (0.135, -0.055, cheese_z + 0.135)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.024, depth=0.12, location=arm_pos, rotation=torch_rot)
    arm = bpy.context.active_object
    arm.name = "ChefArmSleeve"
    mat_sleeve = bpy.data.materials.new("Mat_Chef_Sleeve")
    ns = mat_sleeve.node_tree.nodes
    ls = mat_sleeve.node_tree.links
    ns.clear()
    out_s = ns.new('ShaderNodeOutputMaterial')
    bs = ns.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Base Color'].default_value = (0.05, 0.05, 0.06, 1.0)
    bs.inputs['Roughness'].default_value = 0.85
    ls.new(bs.outputs['BSDF'], out_s.inputs['Surface'])
    arm.data.materials.append(mat_sleeve)
    bpy.ops.object.shade_smooth()

    # 2. Mão do Chef importada com luva de nitrilo preta iluminada
    if os.path.exists(hand_glb_path):
        bpy.ops.import_scene.gltf(filepath=hand_glb_path)
        hand_root = bpy.data.objects.get("chef_hand_root")
        if hand_root:
            hand_root.location = (0.115, -0.045, cheese_z + 0.10)
            hand_root.rotation_euler = (math.radians(-25), math.radians(20), math.radians(-30))
            hand_root.scale = (1.1, 1.1, 1.1)

            # Ajusta os materiais da luva para não sumirem no fundo preto
            for obj in [bpy.data.objects.get("chef_hand"), bpy.data.objects.get("chef_glove_cuff")]:
                if obj and obj.data.materials:
                    for m in obj.data.materials:
                        if m and m.use_nodes:
                            b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                            if b:
                                b.inputs['Base Color'].default_value = (0.10, 0.10, 0.12, 1.0)
                                b.inputs['Roughness'].default_value = 0.35

    # 3. Empunhadura ergonômica do maçarico
    grip_pos = (0.090, -0.040, cheese_z + 0.075)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.013, depth=0.060, location=grip_pos, rotation=torch_rot)
    grip = bpy.context.active_object
    grip.name = "BlowtorchGrip"
    mat_grip = bpy.data.materials.new("Mat_Blowtorch_Grip")
    ng = mat_grip.node_tree.nodes
    lg = mat_grip.node_tree.links
    ng.clear()
    out_g = ng.new('ShaderNodeOutputMaterial')
    bg = ng.new('ShaderNodeBsdfPrincipled')
    bg.inputs['Base Color'].default_value = (0.08, 0.08, 0.09, 1.0)
    bg.inputs['Roughness'].default_value = 0.35
    lg.new(bg.outputs['BSDF'], out_g.inputs['Surface'])
    grip.data.materials.append(mat_grip)
    bpy.ops.object.shade_smooth()

    # 4. Canister de gás azul clássico
    canister_pos = (0.108, -0.052, cheese_z + 0.050)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.068, location=canister_pos, rotation=torch_rot)
    canister = bpy.context.active_object
    canister.name = "BlowtorchCanister"
    mat_can = bpy.data.materials.new("Mat_Butane_Canister")
    nc = mat_can.node_tree.nodes
    lc = mat_can.node_tree.links
    nc.clear()
    out_c = nc.new('ShaderNodeOutputMaterial')
    bc = nc.new('ShaderNodeBsdfPrincipled')
    bc.inputs['Base Color'].default_value = (0.12, 0.32, 0.70, 1.0) # Azul clássico de refil de butano
    bc.inputs['Metallic'].default_value = 0.85
    bc.inputs['Roughness'].default_value = 0.28
    lc.new(bc.outputs['BSDF'], out_c.inputs['Surface'])
    canister.data.materials.append(mat_can)
    bpy.ops.object.shade_smooth()

    # 5. Bocal usinado de aço inox
    nozzle_pos = (0.062, -0.024, cheese_z + 0.037)
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

    # 6. JATO DE CHAMA CULINÁRIA (Cone emissivo)
    flame_inner_pos = (0.038, -0.008, cheese_z + 0.013)
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
    emit_fi.inputs['Strength'].default_value = 35.0
    lfi.new(emit_fi.outputs['Emission'], out_fi.inputs['Surface'])
    f_inner.data.materials.append(mat_f_in)
    bpy.ops.object.shade_smooth()

    flame_out_pos = (0.024, 0.002, cheese_z + 0.001)
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
    emit_fo.inputs['Strength'].default_value = 20.0
    lfo.new(emit_fo.outputs['Emission'], out_fo.inputs['Surface'])
    f_outer.data.materials.append(mat_f_out)
    bpy.ops.object.shade_smooth()

    # Luz suave de contato da chama (5W para não estourar em branco puro)
    bpy.ops.object.light_add(type='POINT', radius=0.025, location=(0.015, 0.005, cheese_z + 0.020))
    flame_light = bpy.context.active_object
    flame_light.name = "FlamePointLight"
    flame_light.data.energy = 5.0
    flame_light.data.color = (1.0, 0.55, 0.15)

    # Faíscas incandescentes
    mat_spark = bpy.data.materials.new("Mat_Spark_Ember")
    nsp = mat_spark.node_tree.nodes
    lsp = mat_spark.node_tree.links
    nsp.clear()
    out_sp = nsp.new('ShaderNodeOutputMaterial')
    emit_sp = nsp.new('ShaderNodeEmission')
    emit_sp.inputs['Color'].default_value = (1.0, 0.82, 0.25, 1.0)
    emit_sp.inputs['Strength'].default_value = 45.0
    lsp.new(emit_sp.outputs['Emission'], out_sp.inputs['Surface'])

    random.seed(44)
    for i in range(14):
        sx = random.uniform(0.005, 0.038)
        sy = random.uniform(-0.015, 0.015)
        sz = random.uniform(cheese_z + 0.005, cheese_z + 0.025)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.0008, 0.0014), location=(sx, sy, sz))
        spark = bpy.context.active_object
        spark.data.materials.append(mat_spark)

def create_props_and_garnishes(board_top_z, cheese_z):
    """Cria a cumbuca de cerâmica com alecrim, cebolinha fresca e flor de sal."""
    dish_loc = (0.135, 0.045, board_top_z + 0.011)
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
    bd.inputs['Base Color'].default_value = (0.05, 0.05, 0.055, 1.0)
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

    # Cebolinha fresca picada apoiada na superfície
    mat_c = bpy.data.materials.new("Mat_Cebolinha_Verde")
    nc = mat_c.node_tree.nodes
    lc = mat_c.node_tree.links
    nc.clear()
    out_c = nc.new('ShaderNodeOutputMaterial')
    bc = nc.new('ShaderNodeBsdfPrincipled')
    bc.inputs['Base Color'].default_value = (0.10, 0.45, 0.07, 1.0)
    bc.inputs['Roughness'].default_value = 0.28
    lc.new(bc.outputs['BSDF'], out_c.inputs['Surface'])

    # Flor de sal marinho
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
    for i in range(28):
        if i < 18:
            x = random.uniform(-0.075, 0.075)
            y = random.uniform(-0.016, 0.016)
            z = cheese_z + 0.002
        else:
            x = random.uniform(-0.13, 0.11)
            y = random.choice([random.uniform(0.045, 0.065), random.uniform(-0.065, -0.045)])
            z = board_top_z + 0.001

        bpy.ops.mesh.primitive_cylinder_add(radius=0.0018, depth=0.0010, vertices=8, location=(x, y, z))
        c = bpy.context.active_object
        c.rotation_euler = (random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2), random.uniform(0, math.pi))
        c.data.materials.append(mat_c)
        bpy.ops.object.shade_smooth()

    for i in range(18):
        x = random.uniform(-0.14, 0.12)
        y = random.uniform(-0.065, 0.065)
        z = board_top_z + 0.001
        bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.0010, 0.0016), subdivisions=1, location=(x, y, z))
        s = bpy.context.active_object
        s.rotation_euler = (random.uniform(0, 3), random.uniform(0, 3), random.uniform(0, 3))
        s.data.materials.append(mat_s)

def setup_cycles_optix_and_hero_camera(render_path, center_z):
    """Configura Cycles OptiX, Câmera Heroica 3/4 a ~32° e Iluminação de estúdio gastronômico."""
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
    scene.render.resolution_x = 1376
    scene.render.resolution_y = 768
    scene.render.filepath = render_path

    # Alvo da câmera no centro do lanche
    target = bpy.data.objects.new("CameraTarget", None)
    bpy.context.collection.objects.link(target)
    target.location = (0.010, 0.0, center_z + 0.005)

    # Câmera Heroica 3/4 (~32 graus de elevação para enquadramento culinário majestoso)
    cam_data = bpy.data.cameras.new("HeroCamera")
    cam_data.lens = 48 # Campo de visão ideal para enquadrar lanche, tábua, cumbuca e mão do chef
    cam_data.sensor_width = 36.0
    cam_data.sensor_height = 36.0 * (768 / 1376)
    cam_data.dof.use_dof = True
    cam_data.dof.focus_object = target
    cam_data.dof.aperture_fstop = 7.0

    cam_obj = bpy.data.objects.new("HeroCamera", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Posicionamento da câmera: X=0.045, Y=-0.35, Z=center_z + 0.22 (elevação ~32°, 3/4 frontal)
    cam_obj.location = (0.045, -0.35, center_z + 0.22)

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    bpy.context.view_layer.update()

    # ILUMINAÇÃO DE ESTÚDIO GASTRONÔMICO (suave e equilibrada)
    # 1. Key Light Quente (frontal superior direita)
    bpy.ops.object.light_add(type='SPOT', radius=0.35, location=(0.18, -0.28, center_z + 0.35))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 50.0
    key.data.color = (1.0, 0.94, 0.85)
    key.data.spot_size = math.radians(60)
    key.data.spot_blend = 0.45

    # 2. Rim Light Âmbar (recorte dourado na crosta e queijo)
    bpy.ops.object.light_add(type='POINT', radius=0.12, location=(-0.20, 0.20, center_z + 0.18))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = 65.0
    rim.data.color = (1.0, 0.52, 0.12)

    # 3. Fill Light suave
    bpy.ops.object.light_add(type='POINT', radius=0.45, location=(-0.25, -0.20, center_z + 0.18))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = 18.0
    fill.data.color = (0.92, 0.88, 0.82)

    print(f">> Iniciando renderização Cycles OptiX Pass 13 (128 amostras)...")
    bpy.ops.render.render(write_still=True)
    print(f">> Render Pass 13 salvo em: {render_path}")

def main():
    print("=====================================================")
    print(">> Executando Pass 13: Obra-Prima Culinária Alhoaria...")
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

    setup_hdri_environment(hdri_path)
    create_table_underneath(tex_wood)
    board, board_top_z = load_polyhaven_board(board_blend)
    bread, center_z = create_bread(board_top_z, tex_bread)
    ribs_empty, meat_base, meat_z = create_costela(center_z, tex_meat)
    cheese, cheese_z = create_cheese(meat_z, meat_base, tex_cheese)
    setup_chef_hand_and_torch(cheese_z, hand_glb)
    create_props_and_garnishes(board_top_z, cheese_z)

    render_file = os.path.join(concepts_dir, "candidate_render_pass13.png")
    setup_cycles_optix_and_hero_camera(render_file, center_z)
    print(">> PASS 13 CONCLUÍDO COM SUCESSO!")
    print("=====================================================")

if __name__ == "__main__":
    main()
