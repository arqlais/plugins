# Teste do lado Ruby do marcê com a API simulada (test/sketchup_stub.rb).
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
%w[util materiais volume construtor abrir_fechar].each { |f| require File.join(RAIZ, 'src', 'marce', f) }

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
    assert_equal 'marcê · volumes', inst.layer.name
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
    # gaveta interna fica dentro do gavetão
    interna = nil
    achar = lambda { |ents| ents.each { |e| next unless e.is_a?(Sketchup::Group); interna = e if e.name.start_with?('Gaveta interna'); achar.call(e.entities) } }
    achar.call(grupo.entities)
    refute_nil interna
    refute grupo.entities.include?(interna), 'gaveta interna deve estar aninhada'
    # atributos para editar depois
    spec = JSON.parse(grupo.get_attribute('marce', 'spec'))
    assert_equal 3087, spec['L']
    assert_equal [:start, 'marcê: gerar móvel'], @model.ops.first
    assert_equal [:commit], @model.ops.last
    # materiais com textura de veio
    mat = @model.materials['marcê · Arauco Carvalho']
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
    M::AbrirFechar.alternar(porta)
    assert porta.get_attribute('marce', 'aberto')
    refute_equal Geom::Transformation.new.to_a, porta.transformation.to_a
    M::AbrirFechar.alternar(porta)
    refute porta.get_attribute('marce', 'aberto')
    porta.transformation.to_a.zip(Geom::Transformation.new.to_a).each { |a, b| assert_in_delta b, a, 1e-9 }
    M::AbrirFechar.todos(grupo, true)
    gav = grupo.entities.find { |e| e.is_a?(Sketchup::Group) && e.get_attribute('marce', 'mov_tipo') == 'corre' }
    assert_operator gav.transformation.m[1][3], :<, 0, 'gaveta deve correr para a frente (-y)'
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
