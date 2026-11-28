# marcê · roteiro de teste por etapas

O objetivo é garantir que o plugin funciona de verdade no SketchUp antes de avançar. Cada etapa só começa depois que a anterior está ok. Quando algo falhar, anote o passo e mande a mensagem de erro (ou o resultado do autoteste).

## Etapa 1 · instalação e autoteste

1. Aperte **Atualizar marcê** (barra ou menu Extensões → marcê). Deve aparecer o aviso "marcê atualizado" com as novidades.
2. Abra um arquivo **novo** (ou salve o seu antes; o autoteste desfaz tudo, mas é bom ter cópia).
3. **Extensões → marcê → Autoteste**. Espere terminar (de 1 a 3 minutos).
4. Se aparecer "tudo certo", siga para a etapa 2. Se houver falhas, clique em **copiar resultado** e cole na conversa.
5. Confira depois do autoteste: o modelo continua vazio (nada sobrou) e o Ctrl+Z não traz móveis de teste.

## Etapa 2 · o fluxo do dia a dia

1. Desenhe uma caixa (retângulo + empurrar/puxar) do tamanho do móvel e transforme em grupo. Selecione.
2. **Novo móvel**: a janela abre com as medidas da caixa e o tipo sugerido (balcão, aéreo, torre...).
3. Troque o tipo, as colunas e as faixas; clique numa frente da prévia para editar a coluna. A prévia, a planta, o 3D e as peças atualizam juntos.
4. **Gerar**: o móvel aparece exatamente no lugar da caixa (que fica escondida na tag "marcê · volumes").
5. Gire a câmera e dê zoom: nada pisca, nada some.
6. **Abrir/fechar portas e gavetas**: clique em portas, gavetas, porta-temperos e lixeira. Elas abrem com animação e voltam ao lugar exato. A gaveta interna abre junto com o gavetão.
7. Selecione o móvel → **Editar móvel**: mude algo e atualize. O móvel muda no mesmo lugar; o Painel de Componentes não acumula peças velhas.
8. **Ctrl+Z** depois de gerar e depois de editar: volta um passo por vez, sem deixar peças soltas.
9. **Relatório**: abre o editor de pranchas no navegador com as fotos do móvel (fechado, aberto e interior).
10. **Lista de peças do projeto (CSV)**: abre no Excel/Planilhas com acentos certos.

## Etapa 3 · cada recurso em projeto real

Use um projeto real (cozinha, dormitório, banheiro) e confira:

- Cozinha com cuba (detecção da cuba pelo nome do componente), porta-temperos, lixeira, gavetão com interna, torre quente e torre de geladeira.
- Aéreo com basculante, ripado, vidro e LED.
- Roupeiro com cabideiro, gaveteiro interno, maleiro e roda-teto.
- Portas embutidas e sobrepostas, todos os puxadores, corrediça telescópica e oculta.
- Materiais: troque o MDF das frentes e da caixaria; confira o veio vertical/horizontal no SketchUp.
- Plugin de render: os materiais e a luz do LED aparecem certos.

## Etapa 4 · pranchas e site

Só depois das etapas 1 a 3: carimbos, editor de pranchas e integração com a planê.
