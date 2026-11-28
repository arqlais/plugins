# planê.mob — materiais e etiquetas (tags) do SketchUp
module ArqLais
  module Marce
    module Materiais
      PREFIXO = 'planê.mob · '.freeze

      FIXOS = {
        'metal' => ['Metal escovado', [154, 158, 163], 1.0],
        'aramado' => ['Aramado cromado', [195, 199, 204], 1.0],
        'espelho' => ['Espelho', [188, 211, 220], 0.85],
        'pedra' => ['Pedra', [220, 217, 210], 1.0],
        'plastico' => ['Plástico grafite', [91, 91, 91], 1.0],
        'vidro' => ['Vidro canelado', [207, 221, 226], 0.55]
      }.freeze

      # vidros das portas (cor aproximada; alpha < 1 deixa ver o interior)
      VIDROS = {
        'canelado' => ['Vidro canelado', [207, 221, 226], 0.55], 'incolor' => ['Vidro incolor', [220, 235, 240], 0.35],
        'fume' => ['Vidro fumê', [127, 136, 145], 0.6], 'bronze' => ['Vidro bronze', [160, 140, 124], 0.6],
        'reflecta' => ['Vidro reflecta prata', [170, 180, 186], 0.85], 'jateado' => ['Vidro jateado', [230, 236, 238], 0.8],
        'espelho' => ['Espelho', [188, 211, 220], 0.95]
      }.freeze
      TELA_PADRAO = { 'nome' => 'Palhinha natural', 'marca' => 'Tela', 'cor' => '#d8c39a' }.freeze

      TEMP_LED = { 2700 => [255, 207, 138], 3000 => [255, 217, 160], 4000 => [255, 241, 214], 6000 => [238, 244, 255] }.freeze

      TAGS = {
        'caixa' => 'planê.mob · caixaria',
        'frente' => 'planê.mob · frentes',
        'fundo' => 'planê.mob · fundos',
        'gaveta' => 'planê.mob · gavetas',
        'ferragem' => 'planê.mob · ferragens',
        'rodape' => 'planê.mob · rodapé e roda-teto',
        'pedra' => 'planê.mob · tampo',
        'led' => 'planê.mob · iluminação'
      }.freeze

      module_function

      def hex_para_rgb(hex)
        h = hex.to_s.delete('#')
        h = h.chars.map { |c| c * 2 }.join if h.length == 3
        n = h.to_i(16)
        [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      end

      def textura_veio(horizontal)
        f = File.join(PASTA, 'texturas', horizontal ? 'veio_h.png' : 'veio_v.png')
        File.exist?(f) ? f : nil
      end

      # Material do SketchUp para uma chave do spec (frente, caixa, caixaInterna, fundo, gaveta, fundoGaveta)
      def para(model, spec, chave, cache)
        return cache[chave] if cache.key?(chave)
        mats = model.materials
        if chave == 'led'
          temp = (spec.dig('led', 'temperatura') || 4000).to_i
          m = mats[PREFIXO + "LED #{temp}K"] || mats.add(PREFIXO + "LED #{temp}K")
          m.color = Sketchup::Color.new(*(TEMP_LED[temp] || TEMP_LED[4000]))
          return cache[chave] = m
        end
        if chave.to_s.start_with?('vidro_') # vidro escolhido folha a folha (porta de correr)
          nome, rgb, alpha = VIDROS[chave.to_s.sub('vidro_', '')] || VIDROS['incolor']
          m = mats[PREFIXO + nome] || mats.add(PREFIXO + nome)
          m.color = Sketchup::Color.new(*rgb)
          m.alpha = alpha if alpha < 1.0
          return cache[chave] = m
        end
        if FIXOS.key?(chave)
          nome, rgb, alpha = chave == 'vidro' ? (VIDROS[spec.dig('frentes', 'vidro').to_s] || VIDROS['canelado']) : FIXOS[chave]
          m = mats[PREFIXO + nome] || mats.add(PREFIXO + nome)
          m.color = Sketchup::Color.new(*rgb)
          m.alpha = alpha if alpha < 1.0
          return cache[chave] = m
        end
        info = (spec['materiais'] || {})[chave] || {}
        info = TELA_PADRAO if chave == 'tela' && info.empty?
        textura = info['textura'] ? Texturas.caminho(info['textura']) : nil
        return cache[chave] = material_textura(mats, info, textura) if textura
        marca = info['marca'].to_s
        nome = PREFIXO + (marca.empty? || marca == 'Genérico' ? '' : "#{marca} ") + info['nome'].to_s
        horizontal = chave == 'frente' && spec.dig('frentes', 'veio') == 'horizontal'
        nome += ' (veio horizontal)' if info['veio'] && horizontal
        m = mats[nome] || mats.add(nome)
        cor = Sketchup::Color.new(*hex_para_rgb(info['cor'] || '#cccccc'))
        tex = info['veio'] ? textura_veio(horizontal) : nil
        if tex
          begin
            unless m.texture
              m.texture = tex
            end
            larg = (info['texturaLargura'] || 1200).to_f
            m.texture.size = larg.mm if m.texture && (chave == 'frente' || !m.get_attribute(DICT, 'veio_ajustado'))
            m.set_attribute(DICT, 'veio_ajustado', true) if chave == 'frente'
            m.color = cor
            m.colorize_type = Sketchup::Material::COLORIZE_TINT if m.respond_to?(:colorize_type=)
          rescue StandardError
            m.color = cor
          end
        else
          m.texture = nil if m.texture
          m.color = cor
        end
        cache[chave] = m
      end

      # textura própria (imagem anexada pela usuária): sem tingir, no tamanho real informado
      def material_textura(mats, info, arquivo)
        nome = PREFIXO + 'textura · ' + info['nome'].to_s
        m = mats[nome] || mats.add(nome)
        begin
          m.texture = arquivo unless m.texture && m.get_attribute(DICT, 'textura_arquivo') == arquivo
          m.set_attribute(DICT, 'textura_arquivo', arquivo)
          m.texture.size = (info['texturaLargura'] || 1200).to_f.mm if m.texture
          m.colorize_type = Sketchup::Material::COLORIZE_SHIFT if m.respond_to?(:colorize_type=)
        rescue StandardError
          m.color = Sketchup::Color.new(*hex_para_rgb(info['cor'] || '#cccccc'))
        end
        m
      end

      def tag(model, grupo, cache)
        nome = TAGS[grupo] || 'planê.mob'
        cache[nome] ||= (model.layers[nome] || model.layers.add(nome))
      end
    end
  end
end
