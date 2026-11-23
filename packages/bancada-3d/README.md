# Bancada 3D

`@cardapios/bancada-3d` oferece a sessão WebXR, os controles de órbita e as curvas de animação.
Cada site monta sua cena, configura o enquadramento e fornece receitas, modelos e dados de pedido.
O pacote usa a mesma instância de Three.js que o site.

O Alhoaria usa o workspace local. O Strawberry instala a versão empacotada de uma release do
Alhoaria no GitHub, com integridade registrada no `package-lock.json`.

Para publicar uma versão, atualize a versão no pacote e na dependência do Alhoaria, rode `npm install`
e valide os dois sites. Gere o arquivo com `npm pack --workspace @cardapios/bancada-3d`.
Anexe o `.tgz` à release `bancada-3d-v<versão>` do commit dessa versão. Atualize a dependência
do Strawberry para a nova URL da release e registre o novo lockfile.
