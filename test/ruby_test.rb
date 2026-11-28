# Teste do lado Ruby da planê.mob com a API simulada (test/sketchup_stub.rb).
# Gera as peças com o motor JS real (node) e constrói no "modelo" simulado.
# Uso: ruby test/ruby_test.rb
require_relative 'sketchup_stub'
require 'minitest/autorun'

RAIZ = File.expand_path('..', __dir__)

module ArqLais
  module Marce
    VERSAO = 'teste'.freeze
    PASTA = File.join(RAIZ, 'src', 'marce')
    PASTA_UI = File.join(PASTA, 'ui')
    DICT = 'marce'.freeze
  end
end
%w[util materiais volume biblioteca construtor abrir_fechar exportar autoteste].each { |f| require File.join(RAIZ, 'src', 'marce', f) }

def dados_do_motor(cenario)
  js = <<~JS
    const E = require(#{File.join(RAIZ, 'src/marce/ui/engine.js').inspect});
    let s = E.specPadrao('balcao');
    s.L = 3087; s.D = 580; s.H = 776; s.base.tipo = 'suspenso';
    s.cuba.ativa = true; s.cuba.centro = 900;
    s.colunas = E.autoColunas(s);
    s.colunas[0].secoes = [E.novaSecao('temperos')]; s.colunas[0].largura = 250;
    s.colunas[3].secoes = [E.novaSecao('gavetas', { itens: [{ tipo: 'interna' }, { tipo: 'gaveta' }, { tipo: 'gaveta' }] })];
    s.colunas[5].secoes = [E.novaSecao('lixeira')];
    if (#{cenario.inspect} === 'arco') { s = E.specPadrao('personalizado'); s.composicao = 'espelho_arco'; s.colunas = E.autoColunas(s); }
    const m = E.calcular(s);
    process.stdout.write(JSON.stringify({ spec: s, relatorio: false, modelo: { pecas: m.pecas, conjuntos: m.conjuntos, dims: m.dims, resumo: m.resumo }, lista: E.listaDePecas(m.pecas, s.materiais) }));
  JS
  JSON.parse(IO.popen(['node', '-e', js], &:read))
end

class TesteMarce < Minitest::Test
  def teardown
    aninhadas = Sketchup.active_model.ops.select { |o| o[0] == :aninhada }
    assert_empty aninhadas, 'operação aberta dentro de outra'
  end

  M = ArqLais::Marce

  def setup
    Sketchup.reset!
    @model = Sketchup.active_model
  end

  def volume_girado
    d = @model.definitions.add('Volume')
    pts = [[0, 0, 0], [3087, 0, 0], [3087, 580, 0], [0, 580, 0]].map { |q| Geom::Point3d.new(q[0].mm, q[1].mm, q[2].mm) }
    d.entities.add_face(pts).pushpull(776.mm)
    # girado 90° e deslocado; a câmera está em -y, então a frente deve ser o lado voltado para -y do mundo
    t = Geom::Transformation.translation([1000.mm, 2000.mm, 100.mm]) * Geom::Transformation.rotation(Geom::Point3d.new(0, 0, 0), Geom::Vector3d.new(0, 0, 1), 180.degrees)
    inst = @model.entities.add_instance(d, t)
    @model.selection << inst
    inst
  end

  def test_leitura_do_volume
    volume_girado
    v = M::Volume.ler(@model)
    refute_nil v
    assert_in_delta 3087, v[:L], 0.5
    assert_in_delta 580, v[:D], 0.5
    assert_in_delta 776, v[:H], 0.5
    assert_in_delta 100, v[:elevacao], 0.5
    # eixo y aponta para o fundo (para longe da câmera, que está em -y)
    assert_operator v[:yaxis].y, :>, 0.9
    # destro: x * y = z para cima
    assert_operator (v[:xaxis] * v[:yaxis]).z, :>, 0.9
    assert_equal 'balcao', M::Volume.tipo_sugerido(v)
  end

  def test_gera_movel_completo
    inst = volume_girado
    v = M::Volume.ler(@model)
    dados = dados_do_motor('balcao')
    grupo, erros = M::Construtor.gerar(@model, dados, { ancora: v, volume: inst })
    assert_equal 0, erros
    assert inst.hidden?, 'o volume deve ficar escondido'
    assert_equal 'planê.mob · volumes', inst.layer.name
    # todas as peças criadas (diretamente ou dentro de conjuntos)
    total = 0
    conj = 0
    contar = lambda do |ents|
      ents.each do |e|
        if e.is_a?(Sketchup::Group)
          conj += 1
          contar.call(e.entities)
        else
          total += 1
        end
      end
    end
    contar.call(grupo.entities)
    assert_equal dados['modelo']['pecas'].length, total
    assert_equal dados['modelo']['conjuntos'].length, conj
    # gaveta interna: presa no móvel (mesmo nível do gavetão) e dependente dele
    interna = grupo.entities.find { |e| e.is_a?(Sketchup::Group) && e.name.start_with?('Gaveta interna') }
    refute_nil interna
    gavetao = grupo.entities.find { |e| e.is_a?(Sketchup::Group) && e.get_attribute('marce', 'mov_id') == interna.get_attribute('marce', 'mov_requer') }
    refute_nil gavetao, 'interna aponta para o gavetão'
    M::AbrirFechar.alternar(interna)
    assert M::AbrirFechar.aberto?(gavetao), 'abrir a interna abre o gavetão junto'
    assert M::AbrirFechar.aberto?(interna)
    M::AbrirFechar.alternar(gavetao)
    refute M::AbrirFechar.aberto?(interna), 'fechar o gavetão fecha a interna'
    refute M::AbrirFechar.aberto?(gavetao)
    # atributos para editar depois
    spec = JSON.parse(grupo.get_attribute('marce', 'spec'))
    assert_equal 3087, spec['L']
    assert_equal [:start, 'planê.mob: gerar móvel'], @model.ops.first
    assert_equal [:commit], @model.ops.last
    # materiais com textura de veio
    mat = @model.materials['planê.mob · Arauco Carvalho']
    refute_nil mat
    refute_nil mat.texture
    # definições reaproveitadas (portas iguais compartilham a mesma)
    assert_operator @model.definitions.length, :<, total
  end

  def test_abrir_fechar
    inst = volume_girado
    v = M::Volume.ler(@model)
    grupo, = M::Construtor.gerar(@model, dados_do_motor('balcao'), { ancora: v, volume: inst })
    porta = grupo.entities.find { |e| e.is_a?(Sketchup::Group) && e.get_attribute('marce', 'mov_tipo') == 'giro' }
    refute_nil porta
    refute M::AbrirFechar.aberto?(porta)
    M::AbrirFechar.alternar(porta)
    assert M::AbrirFechar.aberto?(porta), 'abre'
    M::AbrirFechar.alternar(porta)
    refute M::AbrirFechar.aberto?(porta), 'fecha de volta exatamente na posição original'
    porta.transformation.to_a.zip(Geom::Transformation.new.to_a).each { |a, b| assert_in_delta b, a, 1e-9 }
    # nada é gravado durante a animação (Ctrl+Z não fica com passos soltos)
    assert_nil porta.get_attribute('marce', 'aberto')
    M::AbrirFechar.todos(grupo, true)
    gav = grupo.entities.find { |e| e.is_a?(Sketchup::Group) && e.get_attribute('marce', 'mov_tipo') == 'corre' }
    assert_operator gav.transformation.m[1][3], :<, 0, 'gaveta deve correr para a frente (-y)'
    M::AbrirFechar.todos(grupo, false)
    refute M::AbrirFechar.aberto?(gav)
  end

  def test_contorno_da_ferramenta_no_lugar_certo
    inst = volume_girado
    v = M::Volume.ler(@model)
    grupo, = M::Construtor.gerar(@model, dados_do_motor('balcao'), { ancora: v, volume: inst })
    porta = grupo.entities.find { |e| e.is_a?(Sketchup::Group) && e.get_attribute('marce', 'mov_tipo') == 'giro' }
    def porta.bounds
      bb = Geom::BoundingBox.new
      entities.each { |e| bb.add(e.bounds) }
      bb
    end
    f = M::AbrirFechar::Ferramenta.new
    f.activate
    f.instance_variable_set(:@alvo, porta)
    f.instance_variable_set(:@tr, grupo.transformation)
    ext = f.getExtents
    refute ext.empty?, 'informa a área do desenho (não some no zoom)'
    # o contorno fica sobre o móvel no mundo (perto do volume), não na origem
    assert_operator ext.min.x.to_mm, :<, 1000 + 1
    assert_operator ext.max.x.to_mm, :>, -2087 - 1
    assert_operator ext.min.y.to_mm, :>, 1420 - 700
  end

  def test_volume_dentro_de_grupo_em_edicao
    inst = volume_girado
    # simula: o volume está dentro de um grupo aberto, deslocado 5 m em x
    grupo_aberto = Struct.new(:transformation).new(Geom::Transformation.translation([5000.mm, 0, 0]))
    @model.active_path = [grupo_aberto]
    v = M::Volume.ler(@model)
    assert_nil @model.active_path, 'fecha a edição do grupo antes de gerar'
    assert_in_delta(-2087 + 5000, v[:origem].x.to_mm, 0.5)
    assert_in_delta 3087, v[:L], 0.5
    refute inst.nil?
  end

  def test_botao_direito_nao_mexe_no_modelo
    volume_girado
    @model.active_path = [Object.new]
    assert M::Volume.provavel?(@model)
    refute_nil @model.active_path, 'só confere, sem fechar a edição'
  end

  def test_animacao_com_erro_nao_trava
    inst = volume_girado
    v = M::Volume.ler(@model)
    grupo, = M::Construtor.gerar(@model, dados_do_motor('balcao'), { ancora: v, volume: inst })
    porta = grupo.entities.find { |e| e.is_a?(Sketchup::Group) && e.get_attribute('marce', 'mov_tipo') == 'giro' }
    def porta.move!(_t); raise 'modelo fechado'; end
    M::AbrirFechar.alternar(porta)
    assert_empty M::AbrirFechar.instance_variable_get(:@animando), 'libera a porta mesmo com erro'
  end

  def test_falha_antes_de_comecar_nao_desfaz_outra_operacao
    assert_raises(RuntimeError) { M::Construtor.gerar(@model, { 'spec' => {}, 'modelo' => { 'pecas' => [] } }, {}) }
    refute @model.ops.include?([:abort]), 'não chama abort sem start'
  end

  def test_lista_do_projeto_com_atributo_corrompido
    g = @model.entities.add_group
    g.set_attribute('marce', 'spec', '{}')
    g.set_attribute('marce', 'lista', '{"quebrado": 1}')
    salvo = nil
    M::Exportar.singleton_class.send(:define_method, :salvar_csv) { |csv, _n| salvo = csv; '/tmp/x.csv' }
    M::Exportar.lista_do_projeto(@model)
    refute_nil salvo, 'exporta mesmo com um móvel corrompido'
  end

  def test_editar_nao_deixa_componentes_velhos
    inst = volume_girado
    v = M::Volume.ler(@model)
    grupo, = M::Construtor.gerar(@model, dados_do_motor('balcao'), { ancora: v, volume: inst })
    n1 = @model.definitions.length
    3.times { M::Construtor.gerar(@model, dados_do_motor('balcao'), { grupo: grupo }) }
    assert_equal n1, @model.definitions.length, 'regenerar 3x não acumula definições'
  end

  def test_edicao_regenera_no_mesmo_grupo
    inst = volume_girado
    v = M::Volume.ler(@model)
    grupo, = M::Construtor.gerar(@model, dados_do_motor('balcao'), { ancora: v, volume: inst })
    t0 = grupo.transformation.to_a
    grupo2, = M::Construtor.gerar(@model, dados_do_motor('arco'), { grupo: grupo })
    assert_same grupo, grupo2
    assert_equal t0, grupo2.transformation.to_a
    assert_equal 'Móvel personalizado', grupo2.name
  end

  def test_detecta_cuba
    inst = volume_girado
    v = M::Volume.ler(@model)
    t = M::Volume.transformacao(v)
    cd = @model.definitions.add('Cuba inox 50x40')
    cd.entities.add_face([[0, 0, 0], [500, 0, 0], [500, 400, 0], [0, 400, 0]].map { |q| Geom::Point3d.new(q[0].mm, q[1].mm, 0) }).pushpull(200.mm)
    # cuba alinhada ao móvel: canto em x = 650, y = 100 (local) -> centro em 900 mm
    @model.entities.add_instance(cd, t * Geom::Transformation.translation([650.mm, 100.mm, 600.mm]))
    cuba = M::Volume.detectar_cuba(@model, t, v[:L], v[:D], v[:H])
    refute_nil cuba, 'a cuba deveria ser encontrada'
    assert_equal 900, cuba['centro']
    assert_equal 500, cuba['largura']
    assert_equal 400, cuba['profundidade']
    refute inst.nil?
  end
end

class TesteAutoteste < Minitest::Test
  M = ArqLais::Marce
  def setup
    Sketchup.reset!
    @model = Sketchup.active_model
  end

  def test_autoteste_confere_um_movel_e_desfaz
    dados = dados_do_motor('video').merge('nome' => 'cozinha')
    r = M::Autoteste.rodar_caso(dados)
    falhas = r['itens'].reject { |i| i['ok'] }
    assert_empty falhas.map { |i| "#{i['nome']}: #{i['detalhe']}" }, 'autoteste aponta falha num móvel correto'
    assert_equal [:abort], @model.ops.last, 'autoteste desfaz tudo no fim'
    refute @model.ops.include?([:commit]), 'nada fica gravado no modelo'
    assert_empty @model.ops.select { |o| o[0] == :aninhada }, 'nenhuma operação aberta dentro de outra'
  end

  def test_autoteste_ambiente
    amb = M::Autoteste.ambiente
    assert amb['itens'].find { |i| i['nome'] == 'arquivos da janela' }['ok'], 'arquivos da janela presentes'
  end
end

class TestePranchaViva < Minitest::Test
  M = ArqLais::Marce
  def setup
    Sketchup.reset!
    @model = Sketchup.active_model
  end

  def test_relatorio_ligado_ao_movel_e_atualizado
    dados = dados_do_motor('video')
    grupo, = M::Construtor.gerar(@model, dados, {})
    html = "<!doctype html><html><head></head><body>x</body></html>"
    caminho = M::Exportar.salvar_relatorio(@model, html, 'Relatorio - Teste Laís', { 'spec' => dados['spec'] }, grupo, abrir: false)
    arq = caminho.sub(/\.html\z/, '.dados.js')
    assert File.exist?(arq), 'grava o arquivo de dados ao lado'
    assert_includes File.read(caminho, encoding: 'UTF-8'), 'MarceRelatorio.vigiar(', 'prancha passa a acompanhar o arquivo'
    assert_equal caminho, grupo.get_attribute('marce', 'relatorio'), 'móvel lembra da prancha'
    selo1 = File.read(arq, encoding: 'UTF-8')[/"selo":"(\d+)"/, 1]
    sleep 0.01
    assert M::Exportar.atualizar_prancha(@model, grupo, capturar: false), 'atualiza a prancha'
    selo2 = File.read(arq, encoding: 'UTF-8')[/"selo":"(\d+)"/, 1]
    refute_equal selo1, selo2, 'dados novos com selo novo'
    assert_includes File.read(arq, encoding: 'UTF-8'), 'MarceRelatorio.receberDados('
    assert_empty @model.ops.select { |o| o[0] == :aninhada }
  ensure
    [caminho, arq].compact.each { |f| File.delete(f) if File.exist?(f) }
  end

  def test_sem_relatorio_nao_atualiza
    grupo, = M::Construtor.gerar(@model, dados_do_motor('video'), {})
    assert_nil M::Exportar.atualizar_prancha(@model, grupo, capturar: false)
  end
end

class TesteCorredica < Minitest::Test
  M = ArqLais::Marce
  def setup
    Sketchup.reset!
    @model = Sketchup.active_model
  end

  def test_intermediario_anda_a_metade_com_a_gaveta
    grupo, = M::Construtor.gerar(@model, dados_do_motor('video'), {})
    gav = grupo.entities.find { |e| e.is_a?(Sketchup::Group) && e.name.start_with?('Gaveta ') }
    refute_nil gav
    meio = gav.entities.find { |e| e.is_a?(Sketchup::Group) && e.get_attribute('marce', 'mov_segue') }
    refute_nil meio, 'perfil intermediário fica dentro da gaveta, como seguidor'
    M::AbrirFechar.alternar(gav)
    dg = gav.transformation.to_a[13]
    dm = meio.transformation.to_a[13]
    assert_operator dg, :<, 0, 'gaveta abre para a frente'
    assert_in_delta(-dg / 2.0, dm, 0.02 * dg.abs, 'intermediário volta a metade (anda metade do curso no total)')
    M::AbrirFechar.alternar(gav)
    assert_in_delta 0, meio.transformation.to_a[13], 1e-9, 'fecha junto'
  end
end

# encaixe das ferragens da biblioteca (.skp) na caixa calculada pelo motor
class TesteBiblioteca < Minitest::Test
  include ArqLais::Marce
  def caixa_mm(bounds, tr)
    bb = Geom::BoundingBox.new
    8.times { |i| bb.add(tr.aplicar(bounds.corner(i))) }
    [[bb.min.x, bb.max.x], [bb.min.y, bb.max.y], [bb.min.z, bb.max.z]].map { |a, b| [a.to_mm.round(1), b.to_mm.round(1)] }
  end
  def det(tr)
    m = tr.m
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  end
  def bounds(min, tam)
    bb = Geom::BoundingBox.new
    bb.add(Geom::Point3d.new(*min.map(&:mm)), Geom::Point3d.new(*min.zip(tam).map { |a, b| (a + b).mm }))
    bb
  end

  def test_corredica_esticada_no_comprimento
    # modelo do fabricante deitado no eixo x (350 de comprimento), fora da origem
    b = bounds([5, -3, 2], [350, 12.7, 45])
    [false, true].each do |virar|
      tr = Biblioteca.encaixe(b, [12.5, 400, 45], 'encaixe' => 'esticar', 'longo' => 'y', 'virar' => virar)
      cx = caixa_mm(b, tr)
      assert_equal [0.0, 400.0], cx[1], 'comprimento esticado para 400 no eixo y'
      assert_equal [0.0, 45.0], cx[2]
      assert_in_delta 12.7, cx[0][1] - cx[0][0], 0.05, 'espessura real'
      assert_in_delta 6.25, (cx[0][0] + cx[0][1]) / 2, 0.05, 'centralizada na folga'
      assert det(tr) > 0, 'nunca espelha o componente'
    end
  end

  def test_puxador_tamanho_real_centralizado
    b = bounds([0, 0, 0], [28, 160, 12])
    tr = Biblioteca.encaixe(b, [300, 28, 12], 'encaixe' => 'real', 'longo' => 'x')
    cx = caixa_mm(b, tr)
    assert_equal [70.0, 230.0], cx[0], 'comprimento real (160) no meio dos 300'
    assert det(tr) > 0
  end

  def test_kit_apoiado_na_base
    b = bounds([0, 0, 0], [180, 450, 600])
    tr = Biblioteca.encaixe(b, [200, 470, 700], 'encaixe' => 'real', 'apoiar' => 'z')
    cx = caixa_mm(b, tr)
    assert_equal 0.0, cx[2][0], 'apoiado embaixo'
    assert_in_delta 600, cx[2][1], 0.05
    assert_in_delta 10, cx[0][0], 0.05
  end
end

# a corrediça do fabricante funciona: cada perfil vai para o seu lugar
class TesteFerragemFunciona < Minitest::Test
  include ArqLais::Marce
  def trilho(nome, x0, x1)
    d = Sketchup.active_model.definitions.add(nome)
    d.entities.bb.add(Geom::Point3d.new(x0.mm, 0, 0), Geom::Point3d.new(x1.mm, 350.mm, 45.mm))
    d
  end
  def montar
    defi = Sketchup.active_model.definitions.add('corrediça do fabricante')
    [['fixo', 0, 6.4], ['meio', 1.6, 9], ['interno', 3.6, 12.7]].shuffle.each do |n, a, b|
      t = trilho(n, a, b)
      defi.entities.add_instance(t, Geom::Transformation.new)
      defi.entities.bb.add(t.bounds)
    end
    defi
  end
  def nomes(ents); ents.itens.select { |e| e.is_a?(Sketchup::ComponentInstance) }.map { |e| e.definition.name }; end

  def test_lado_esquerdo_e_direito
    [['min', %w[fixo meio interno]], ['max', %w[interno meio fixo]]].each do |parede, (raizN, meioN, movelN)|
      raiz = Sketchup.active_model.entities.add_group.entities
      g_movel = Sketchup.active_model.entities.add_group
      g_meio = Sketchup.active_model.entities.add_group
      mv = { 'tipo' => 'trilho', 'eixo' => 'x', 'parede' => parede, 'movel' => 'C1', 'meio' => 'C2', 'id' => 'b1' }
      Biblioteca.colocar_partes(montar, Geom::Transformation.new, mv, raiz, { 'C1' => g_movel, 'C2' => g_meio }, raiz)
      assert_equal [raizN], nomes(raiz), "#{parede}: perfil junto da lateral fica no móvel"
      assert_equal [meioN], nomes(g_meio.entities), "#{parede}: intermediário anda a metade"
      assert_equal [movelN], nomes(g_movel.entities), "#{parede}: perfil interno sai com a gaveta"
    end
  end

  def test_boneco_de_escala_fica_de_fora
    defi = montar
    helen = Sketchup.active_model.definitions.add('Helen')
    helen.entities.bb.add(Geom::Point3d.new(0, 0, 0), Geom::Point3d.new(400.mm, 300.mm, 1700.mm))
    defi.entities.add_instance(helen, Geom::Transformation.new)
    assert_equal 3, Biblioteca.partes_de(defi).count { |e| Biblioteca.parte_util?(e) }
  end
end

# encaixe da dobradiça do fabricante pelo caneco (qualquer posição do bloco)
class TesteDobradicaBloco < Minitest::Test
  include ArqLais::Marce
  def test_caneco_vai_para_o_furo_e_braco_para_a_lateral
    # bloco desenhado "deitado": caneco em (10, 20, 5) olhando para +z, braço indo para +y
    an = { centro: Geom::Point3d.new(10.mm, 20.mm, 5.mm), normal: Geom::Vector3d.new(0, 0, 1), braco: Geom::Vector3d.new(0, 1, 0) }
    alvo = Geom::Point3d.new(100.mm, 0, 900.mm)
    [-1, 1].each do |sinal|
      tr = Biblioteca.encaixe_dobradica(an, alvo, sinal)
      c = tr.aplicar(an[:centro])
      assert_in_delta 100, c.x.to_mm, 0.01
      assert_in_delta 0, c.y.to_mm, 0.01
      assert_in_delta 900, c.z.to_mm, 0.01
      # ponto 10 mm na direção do caneco (normal) vai para dentro do móvel (+y)
      q = tr.aplicar(Geom::Point3d.new(10.mm, 20.mm, 15.mm))
      assert_in_delta 10, q.y.to_mm, 0.01
      # ponto no braço vai para o lado da dobradiça
      w = tr.aplicar(Geom::Point3d.new(10.mm, 50.mm, 5.mm))
      assert_in_delta 100 + sinal * 30, w.x.to_mm, 0.01
    end
  end
end
