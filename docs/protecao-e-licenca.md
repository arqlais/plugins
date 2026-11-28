# planê.mob · estabilidade, proteção contra cópia e licença

## 1. Estabilidade (não travar, não fechar o SketchUp)

Feito:

- Cada geração roda numa única operação: se der erro no meio, nada fica pela metade (o volume volta).
- Peças iguais viram o mesmo componente (definição reaproveitada), então o arquivo não incha.
- Animação de abrir/fechar protegida: nunca fica presa, mesmo fechando o modelo no meio.
- Fotos do relatório em JPEG comprimido (antes PNG): a janela recebe bem menos dados.
- Modo leve (aba Detalhes): ferragens simplificadas para projetos grandes; a planê.mob sugere sozinha acima de 600 peças.
- Autoteste dentro do SketchUp confere 27 móveis e desfaz tudo; a simulação dos testes acusa operação aberta dentro de outra (causa comum de dados corrompidos).

Próximos passos:

- Medir no SketchUp real o tempo de geração dos maiores móveis (autoteste já mostra os milissegundos) e ajustar o que passar de 2 s.
- Gerar móveis muito grandes em partes, deixando o SketchUp respirar entre elas.
- Registro de erros em arquivo (pasta de configurações) para mandar junto quando algo falhar.

## 2. Proteção contra cópia

Nenhuma proteção é 100%, mas o conjunto abaixo deixa caro e trabalhoso copiar:

1. **Código Ruby criptografado (.rbe)** pelo serviço oficial da Trimble ("Extension Signing", com a opção de criptografar). O código fica ilegível e o SketchUp só carrega se a assinatura bater. Precisa de uma conta de desenvolvedora (gratuita) no Extension Warehouse.
2. **Código da janela (JavaScript) minificado e ofuscado** no empacotamento.
3. **Licença verificada na abertura** (abaixo): sem licença válida, o plugin abre só em modo de demonstração (sem gerar no modelo, ou com marca d'água nas pranchas).

## 3. Licença por máquina

- Cada licença tem um número de máquinas (1, 2, 3...), conforme o plano.
- **Ativação:** a pessoa entra com a conta da planê. O plugin manda uma identificação da máquina (um código gerado a partir do Windows, sem dados pessoais) para a planê. O servidor registra a máquina até o limite da licença e devolve um "passe" assinado digitalmente, com validade (por exemplo, 30 dias).
- **Sem internet:** o plugin confere a assinatura do passe sozinho e funciona até ele vencer (mais alguns dias de carência). Com internet, renova sozinho.
- **Painel da dona (na planê):** ver as licenças e as máquinas ativadas, liberar troca de computador, revogar.
- **Trocar de computador:** a pessoa desativa no computador antigo, ou pede no painel.

## 4. O que preciso para fazer

1. Conta de desenvolvedora na Trimble (Extension Warehouse), para assinar e criptografar o plugin.
2. Os planos e preços: quantas máquinas em cada plano, teste grátis, se vem junto no plano completo da planê.
3. Ok para criar na planê (Supabase) a tabela de licenças e a função que ativa as máquinas.
