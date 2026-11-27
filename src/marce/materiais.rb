# marcê — materiais e etiquetas (tags) do SketchUp
module ArqLais
  module Marce
    module Materiais
      PREFIXO = 'marcê · '.freeze

      FIXOS = {
        'metal' => ['Metal escovado', [154, 158, 163], 1.0],
        'aramado' => ['Aramado cromado', [195, 199, 204], 1.0],
        'espelho' => ['Espelho', [188, 211, 220], 0.85],
        'pedra' => ['Pedra', [220, 217, 210], 1.0],
        'plastico' => ['Plástico grafite', [91, 91, 91], 1.0],
        'vidro' => ['Vidro canelado', [207, 221, 226], 0.55]
      }.freeze

      TEMP_LED = { 2700 => [255, 207, 138], 3000 => [255, 217, 160], 4000 => [255, 241, 214], 6000 => [238, 244, 255] }.freeze

      TAGS = {
        'caixa' => 'marcê · caixaria',
        'frente' => 'marcê · frentes',
        'fundo' => 'marcê · fundos',
        'gaveta' => 'marcê · gavetas',
        'ferragem' => 'marcê · ferragens',
        'rodape' => 'marcê · rodapé e roda-teto',
        'pedra' => 'marcê · tampo',
        'led' => 'marcê · iluminação'
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
        if FIXOS.key?(chave)
          nome, rgb, alpha = FIXOS[chave]
          m = mats[PREFIXO + nome] || mats.add(PREFIXO + nome)
          m.color = Sketchup::Color.new(*rgb)
          m.alpha = alpha if alpha < 1.0
          return cache[chave] = m
        end
        info = (spec['materiais'] || {})[chave] || {}
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
            m.texture.size = larg.mm if m.texture
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

      def tag(model, grupo, cache)
        nome = TAGS[grupo] || 'marcê'
        cache[nome] ||= (model.layers[nome] || model.layers.add(nome))
      end
    end
  end
end
