# marcê — utilidades
module ArqLais
  module Marce
    module Util
      module_function

      # Móvel do marcê na seleção (grupo/componente com o dicionário 'marce' e spec)
      def movel_selecionado(model)
        return nil unless model
        model.selection.each do |e|
          m = movel_de(e)
          return m if m
        end
        nil
      end

      def movel_de(e)
        return nil unless e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
        return e if e.get_attribute(DICT, 'spec')
        nil
      end

      def entidades_de(e)
        e.is_a?(Sketchup::Group) ? e.entities : e.definition.entities
      end

      def definicao_de(e)
        e.respond_to?(:definition) ? e.definition : e.entities.parent
      end

      # Todos os móveis do marcê no modelo (primeiro nível e dentro de grupos)
      def moveis_do_modelo(model)
        out = []
        visitar = lambda do |ents, nivel|
          ents.each do |e|
            next unless e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
            if e.get_attribute(DICT, 'spec')
              out << e
            elsif nivel < 3
              visitar.call(entidades_de(e), nivel + 1)
            end
          end
        end
        visitar.call(model.entities, 0)
        out
      end

      def mm(valor)
        valor.to_f.mm
      end

      def para_mm(len)
        len.to_f.to_mm
      end

      def base64(bytes)
        [bytes].pack('m0')
      end

      def pasta_usuario
        base = ENV['APPDATA'] || File.join(Dir.home, 'Library', 'Application Support')
        base = Dir.home unless File.directory?(base)
        dir = File.join(base, 'marce')
        Dir.mkdir(dir) unless File.directory?(dir)
        dir
      rescue StandardError
        Sketchup.temp_dir
      end

      def nome_arquivo(texto)
        t = texto.to_s.unicode_normalize(:nfd).gsub(/[̀-ͯ]/, '')
        t = t.gsub(/[^A-Za-z0-9 _.\-]+/, '_').strip
        t.empty? ? 'movel' : t
      end

      def json(obj)
        JSON.generate(obj)
      end

      def ler_json(str)
        JSON.parse(str.to_s)
      rescue JSON::ParserError
        {}
      end

      # posição do grupo/componente no modelo, somando os grupos em volta
      def transformacao_mundo(ent)
        t = ent.transformation
        pai = ent.parent
        guarda = 0
        while pai.is_a?(Sketchup::ComponentDefinition) && (inst = pai.instances.first) && guarda < 20
          t = inst.transformation * t
          pai = inst.parent
          guarda += 1
        end
        t
      end

      def abrir_no_navegador(caminho)
        if Sketchup.respond_to?(:platform) && Sketchup.platform == :platform_win
          # o Windows recebe o caminho como texto Unicode: não codifica acentos (só # % ?)
          c = caminho.to_s.tr('\\', '/').gsub('%', '%25').gsub('#', '%23').gsub('?', '%3F')
          return UI.openURL(c.start_with?('//') ? 'file:' + c : 'file:///' + c)
        end
        partes = caminho.to_s.tr('\\', '/').sub(%r{\A/+}, '').split('/')
        seguras = partes.each_with_index.map do |p, i|
          next p if i.zero? && p =~ /\A[A-Za-z]:\z/ # letra do disco no Windows
          p.bytes.map { |b| (b.chr =~ /[A-Za-z0-9._~\-]/) ? b.chr : format('%%%02X', b) }.join
        end
        UI.openURL('file:///' + seguras.join('/'))
      end
    end
  end
end
