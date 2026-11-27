# Teste do atualizador do marcê (sem rede: as "downloads" vêm dos arquivos do repositório)
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
    t = self
    A.singleton_class.send(:define_method, :recarregar) { t.instance_variable_set(:@recarregou, t.instance_variable_get(:@recarregou) + 1) }
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
    res = nil
    A.instalar(achado) { |ok, msg| res = [ok, msg] }
    assert res[0], res[1]
    assert_equal 1, Sketchup.instalados.length
    assert_equal File.size(File.join(RAIZ_A, 'dist', 'marce.rbz')), Sketchup.instalados.last[1]
    assert_equal 1, @recarregou
  end

  def test_recusa_arquivo_corrompido
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
