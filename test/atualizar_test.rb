# Teste do atualizador da planê.mob (sem rede: as "downloads" vêm dos arquivos do repositório)
require_relative 'sketchup_stub'
require 'minitest/autorun'
require 'digest'

RAIZ_A = File.expand_path('..', __dir__)
module ArqLais
  module Marce
    PASTA = File.join(RAIZ_A, 'src', 'marce') unless const_defined?(:PASTA, false)
    DICT = 'marce'.freeze unless const_defined?(:DICT, false)
  end
end
load File.join(RAIZ_A, 'src', 'marce', 'versao.rb')
require File.join(RAIZ_A, 'src', 'marce', 'atualizar')

class TesteAtualizar < Minitest::Test
  A = ArqLais::Marce::Atualizar

  def servidor(versao_json)
    A.singleton_class.send(:define_method, :baixar) do |endereco, binario: false, &bloco|
      if endereco.include?('versao.json')
        endereco.include?('/main/') ? bloco.call(nil, 'HTTP 404') : bloco.call(versao_json, nil)
      else
        bloco.call(File.binread(File.join(RAIZ_A, 'dist', 'marce.rbz')), nil)
      end
    end
  end

  def setup
    @recarregou = 0
    @versao_nova = nil
    t = self
    A.singleton_class.send(:define_method, :recarregar) do
      t.instance_variable_set(:@recarregou, t.instance_variable_get(:@recarregou) + 1)
      nova = t.instance_variable_get(:@versao_nova)
      if nova
        ArqLais::Marce.send(:remove_const, :VERSAO)
        ArqLais::Marce.const_set(:VERSAO, nova)
      end
    end
  end

  def teardown
    load File.join(RAIZ_A, 'src', 'marce', 'versao.rb')
  end

  def test_compara_versoes
    assert A.versao_maior?('1.10.0', '1.9.2')
    refute A.versao_maior?('1.1.0', '1.1.0')
    refute A.versao_maior?('lixo', '1.0.0')
  end

  def test_manifesto_do_repositorio_bate_com_o_pacote
    info = JSON.parse(File.read(File.join(RAIZ_A, 'versao.json')))
    assert_equal ArqLais::Marce::VERSAO, info['versao']
    assert_equal Digest::SHA256.hexdigest(File.binread(File.join(RAIZ_A, 'dist', 'marce.rbz'))), info['sha256']
    refute_empty info['notas']
  end

  def test_encontra_versao_nova_e_instala
    manifesto = JSON.parse(File.read(File.join(RAIZ_A, 'versao.json')))
    manifesto['versao'] = '9.0.0'
    servidor(JSON.generate(manifesto))
    achado = nil
    A.verificar { |info, _e| achado = info }
    assert achado['nova']
    assert_equal 'claude/elegant-archimedes-k2hbjw', achado['ramo']
    @versao_nova = '9.0.0' # a recarga traz a versão nova
    antes = Sketchup.instalados.length
    res = nil
    A.instalar(achado) { |ok, msg| res = [ok, msg] }
    assert res[0], res[1]
    assert_equal antes + 1, Sketchup.instalados.length
    assert_equal File.size(File.join(RAIZ_A, 'dist', 'marce.rbz')), Sketchup.instalados.last[1]
    assert_equal 1, @recarregou
  end

  def test_avisa_quando_a_instalacao_nao_troca_a_versao
    manifesto = JSON.parse(File.read(File.join(RAIZ_A, 'versao.json')))
    manifesto['versao'] = '9.0.0'
    servidor(JSON.generate(manifesto))
    achado = nil
    A.verificar { |info, _e| achado = info }
    res = nil
    A.instalar(achado) { |ok, msg| res = [ok, msg] } # recarga não muda a versão
    refute res[0], 'não diz "atualizado" se a versão continuou a mesma'
    assert_match(/não terminou/, res[1])
  end

  def test_recusa_arquivo_corrompido
    A.singleton_class.send(:define_method, :baixar_net) { |_u, _b, &bl| bl.call('lixo', nil) }
    manifesto = JSON.parse(File.read(File.join(RAIZ_A, 'versao.json')))
    manifesto['versao'] = '9.0.0'
    manifesto['sha256'] = '0' * 64
    servidor(JSON.generate(manifesto))
    achado = nil
    A.verificar { |info, _e| achado = info }
    antes = Sketchup.instalados.length
    res = nil
    A.instalar(achado) { |ok, msg| res = [ok, msg] }
    refute res[0]
    assert_match(/incompleto/, res[1])
    assert_equal antes, Sketchup.instalados.length
  end

  def test_mesma_versao_nao_e_nova
    servidor(File.read(File.join(RAIZ_A, 'versao.json')))
    achado = nil
    A.verificar { |info, _e| achado = info }
    refute achado['nova']
  end
end

require File.join(RAIZ_A, 'src', 'marce', 'util')
require File.join(RAIZ_A, 'src', 'marce', 'aviso')
class TesteAviso < Minitest::Test
  AV = ArqLais::Marce::Aviso

  def test_novidades_por_versao_vista
    Sketchup.write_default('ArqLais_Marce', 'versao_vista', '')
    assert_equal [ArqLais::Marce::VERSAO], AV.nao_vistas.map { |v| v['versao'] }, 'primeira instalação mostra só a atual'
    Sketchup.write_default('ArqLais_Marce', 'versao_vista', '1.0.0')
    vistas = AV.nao_vistas.map { |v| v['versao'] }
    assert_includes vistas, ArqLais::Marce::VERSAO
    refute_includes vistas, '1.0.0'
    AV.marcar_vista
    assert_empty AV.nao_vistas, 'depois de ver, não mostra de novo'
  end

  def test_html_dos_dois_avisos
    disp = AV.html(:disponivel, 'versao' => '9.0.0', 'atual' => '1.2.0', 'versoes' => [{ 'versao' => '9.0.0', 'notas' => ['Coisa nova <b>'] }])
    assert_includes disp, 'atualizar agora'
    assert_includes disp, 'Coisa nova &lt;b&gt;'
    feito = AV.html(:atualizado, 'versao' => '1.2.0', 'versoes' => AV.todas_novidades.first(2))
    assert_includes feito, 'entendi'
    File.write(File.join(Dir.tmpdir, 'aviso_disp.html'), disp)
    File.write(File.join(Dir.tmpdir, 'aviso_feito.html'), feito)
  end
end
