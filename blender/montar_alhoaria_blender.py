"""
=============================================================================
ALHOARIA — SCRIPT OFICIAL BLENDER (MODELAGEM E MONTAGEM AO VIVO)
Projeto: Pão de Alho Recheado de Costela 6h Gratinado no Maçarico
Compatível: Blender 4.x / 5.x
Autor: Igor Andrade (@iandradedev) para Alhoaria (@alhoaria)
=============================================================================
Instruções:
1. Abra o Blender 5.2 no Windows
2. Vá na aba "Scripting" no topo
3. Clique em "New" (Novo), cole este código e clique no botão Play (▶) "Run Script"
4. Veja o sanduíche ser modelado, texturizado e iluminado ao vivo na sua Viewport!
=============================================================================
"""

import bpy
import math
import random

def reset_scene():
    """Limpa objetos antigos para construir a cena do zero."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def create_material(name, base_color, roughness=0.5, subsurface=0.0, subsurface_color=(1, 1, 1, 1), metallic=0.0, emission_color=(0, 0, 0, 1), emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = base_color
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Subsurface Weight" in bsdf.inputs:
            bsdf.inputs["Subsurface Weight"].default_value = subsurface
        elif "Subsurface" in bsdf.inputs:
            bsdf.inputs["Subsurface"].default_value = subsurface
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission_color
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength

    return mat

def create_cheese_torch_material():
    """Cria o material de queijo artesanal com manchas tostadas de maçarico."""
    mat = bpy.data.materials.new(name="Mat_Queijo_Macaricado")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_out.location = (600, 0)

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (300, 0)
    bsdf.inputs["Roughness"].default_value = 0.38
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = 0.25
        if "Subsurface Radius" in bsdf.inputs:
            bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.4, 0.1)
    elif "Subsurface" in bsdf.inputs:
        bsdf.inputs["Subsurface"].default_value = 0.25

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-600, 0)

    noise = nodes.new(type='ShaderNodeTexNoise')
    noise.location = (-400, 0)
    noise.inputs["Scale"].default_value = 12.0
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.7

    ramp = nodes.new(type='ShaderNodeValToRGB')
    ramp.location = (-150, 0)
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (0.94, 0.78, 0.37, 1.0)
    ramp.color_ramp.elements[1].position = 0.68
    ramp.color_ramp.elements[1].color = (0.15, 0.06, 0.02, 1.0)

    links.new(tex_coord.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], node_out.inputs["Surface"])

    return mat

def build_alhoaria_sandwich():
    """Monta ao vivo todas as camadas do sanduíche de pão de alho no Blender."""
    print(">> Iniciando montagem ao vivo do Pão de Alho Alhoaria...")
    reset_scene()

    # 1. TÁBUA DE MADEIRA RÚSTICA
    bpy.ops.mesh.primitive_cylinder_add(radius=1.8, depth=0.15, vertices=48, location=(0, 0, -0.075))
    board = bpy.context.active_object
    board.name = "01_Tabua_Madeira_Rustica"
    bpy.ops.object.shade_smooth()
    mat_board = create_material("Mat_Madeira_Tabua", (0.24, 0.15, 0.11, 1.0), roughness=0.82)
    board.data.materials.append(mat_board)

    # 2. PÃO DE ALHO (BASE CROCANTE)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.05, depth=0.32, vertices=36, location=(0, 0, 0.16))
    bun_bottom = bpy.context.active_object
    bun_bottom.name = "02_Pao_Alho_Base"
    bpy.ops.object.shade_smooth()
    mat_bun = create_material("Mat_Pao_Dourado", (0.83, 0.61, 0.29, 1.0), roughness=0.65, subsurface=0.15)
    bun_bottom.data.materials.append(mat_bun)

    bevel_bun = bun_bottom.modifiers.new(name="Bevel", type='BEVEL')
    bevel_bun.width = 0.04
    bevel_bun.segments = 3

    # 3. CREME DE PASTA DE ALHO DA CASA
    bpy.ops.mesh.primitive_torus_add(major_radius=0.98, minor_radius=0.07, major_segments=40, minor_segments=16, location=(0, 0, 0.32))
    garlic_paste = bpy.context.active_object
    garlic_paste.name = "03_Pasta_Alho_Artesanal"
    bpy.ops.object.shade_smooth()
    mat_garlic = create_material("Mat_Pasta_Alho", (0.98, 0.94, 0.82, 1.0), roughness=0.25)
    garlic_paste.data.materials.append(mat_garlic)

    # 4. COSTELA BOVINA DESFIADA 6 HORAS
    bpy.ops.mesh.primitive_cylinder_add(radius=1.1, depth=0.40, vertices=32, location=(0, 0, 0.50))
    ribs = bpy.context.active_object
    ribs.name = "04_Costela_Bovina_6h_Desfiada"
    bpy.ops.object.shade_smooth()
    mat_ribs = create_material("Mat_Costela_6h", (0.16, 0.08, 0.05, 1.0), roughness=0.75, metallic=0.08)
    ribs.data.materials.append(mat_ribs)

    mat_chunk = create_material("Mat_Carne_Pedaco", (0.22, 0.10, 0.06, 1.0), roughness=0.7)
    for i in range(16):
        angle = (i / 16.0) * math.pi * 2 + random.uniform(-0.1, 0.1)
        r = 1.08 + random.uniform(0.02, 0.10)
        z = 0.48 + random.uniform(-0.06, 0.06)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, segments=8, ring_count=8, location=(math.cos(angle)*r, math.sin(angle)*r, z))
        chunk = bpy.context.active_object
        chunk.name = f"Costela_Fragmento_{i}"
        chunk.scale = (1.5, 0.7, 1.1)
        bpy.ops.object.shade_smooth()
        chunk.data.materials.append(mat_chunk)

    # 5. COBERTURA DE QUEIJO GRATINADO NO MAÇARICO
    bpy.ops.mesh.primitive_cylinder_add(radius=1.18, depth=0.12, vertices=36, location=(0, 0, 0.72))
    cheese = bpy.context.active_object
    cheese.name = "05_Queijo_Gratinado_Macarico"
    bpy.ops.object.shade_smooth()
    mat_cheese_torch = create_cheese_torch_material()
    cheese.data.materials.append(mat_cheese_torch)

    for i in range(8):
        angle = (i / 8.0) * math.pi * 2 + random.uniform(-0.2, 0.2)
        drip_len = random.uniform(0.22, 0.35)
        r = 1.14
        bpy.ops.mesh.primitive_cone_add(radius1=0.10, depth=drip_len, vertices=12, location=(math.cos(angle)*r, math.sin(angle)*r, 0.68 - drip_len/2))
        drip = bpy.context.active_object
        drip.name = f"Queijo_Escorrendo_{i}"
        drip.rotation_euler = (math.pi, 0, 0)
        bpy.ops.object.shade_smooth()
        drip.data.materials.append(mat_cheese_torch)

    # 6. PÃO TOPO COM GERGELIM
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.1, segments=36, ring_count=20, location=(0, 0, 0.76))
    bun_top = bpy.context.active_object
    bun_top.name = "06_Pao_Alho_Topo"
    bun_top.scale = (1.0, 1.0, 0.65)
    bpy.ops.object.shade_smooth()
    bun_top.data.materials.append(mat_bun)

    mat_sesame = create_material("Mat_Gergelim", (0.96, 0.92, 0.84, 1.0), roughness=0.45)
    for i in range(60):
        theta = random.uniform(0, math.pi * 2)
        phi = random.uniform(0.1, 0.65)
        r = 1.10
        x = r * math.sin(phi) * math.cos(theta)
        y = r * math.sin(phi) * math.sin(theta)
        z = 0.76 + (r * math.cos(phi) * 0.65)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.024, segments=6, ring_count=6, location=(x, y, z))
        seed = bpy.context.active_object
        seed.name = f"Gergelim_{i}"
        seed.scale = (1.4, 0.6, 1.8)
        bpy.ops.object.shade_smooth()
        seed.data.materials.append(mat_sesame)

    # 7. ILUMINAÇÃO DE ESTÚDIO (3200K + RIM LIGHT MAÇARICO)
    bpy.ops.object.light_add(type='SPOT', radius=0.25, location=(2.6, -3.0, 3.8))
    key_light = bpy.context.active_object
    key_light.name = "Luz_Key_3200K"
    key_light.data.energy = 450
    key_light.data.color = (1.0, 0.92, 0.81)
    key_light.data.spot_size = math.radians(55)
    key_light.data.spot_blend = 0.5

    bpy.ops.object.light_add(type='POINT', radius=0.15, location=(-2.4, 2.2, 1.5))
    torch_rim = bpy.context.active_object
    torch_rim.name = "Luz_Rim_Macarico_Laranja"
    torch_rim.data.energy = 280
    torch_rim.data.color = (1.0, 0.42, 0.10)

    bpy.ops.object.light_add(type='POINT', radius=0.3, location=(1.8, 2.0, 0.8))
    fill_light = bpy.context.active_object
    fill_light.name = "Luz_Fill_Queijo"
    fill_light.data.energy = 90
    fill_light.data.color = (0.95, 0.78, 0.38)

    # 8. CÂMERA
    bpy.ops.object.camera_add(location=(0, -4.2, 2.4))
    cam = bpy.context.active_object
    cam.name = "Camera_Hero_Alhoaria"
    cam.rotation_euler = (math.radians(65), 0, 0)
    cam.data.lens = 55
    bpy.context.scene.camera = cam

    # 9. ENGINE
    bpy.context.scene.render.engine = 'CYCLES' if 'CYCLES' in bpy.context.preferences.addons else 'BLENDER_EEVEE_NEXT'
    bpy.context.scene.render.resolution_x = 1920
    bpy.context.scene.render.resolution_y = 1080

    print(">> SUCESSO! O Pão de Alho Recheado de Costela 6h da Alhoaria foi montado!")

if __name__ == "__main__":
    build_alhoaria_sandwich()
