# planê.mob — versão instalada (lida pelo atualizador; troque aqui a cada lançamento)
module ArqLais
  module Marce
    remove_const(:VERSAO) if const_defined?(:VERSAO, false)
    VERSAO = '1.21.0'.freeze
  end
end
