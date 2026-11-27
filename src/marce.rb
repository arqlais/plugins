# marcê — marcenaria paramétrica para SketchUp
# Carregador da extensão (fica na pasta Plugins junto com a pasta "marce").
require 'sketchup.rb'
require 'extensions.rb'

module ArqLais
  module Marce
    VERSAO = '1.0.0'.freeze
    NOME = 'marcê'.freeze
    PASTA = File.join(File.dirname(__FILE__), 'marce').freeze

    unless file_loaded?(__FILE__)
      ext = SketchupExtension.new('marcê · marcenaria paramétrica', File.join(PASTA, 'main'))
      ext.creator = 'Laís'
      ext.version = VERSAO
      ext.copyright = '© 2026 Laís · uso pessoal'
      ext.description = 'Gera marcenaria completa a partir de um volume: caixaria, portas, ' \
                        'gavetas, aramados, lixeira, nichos, ferragens, conferência técnica, ' \
                        'lista de peças e relatório executivo.'
      Sketchup.register_extension(ext, true)
      file_loaded(__FILE__)
    end
  end
end
