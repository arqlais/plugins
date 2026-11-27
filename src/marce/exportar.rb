# marcê — relatório, CSV, lista do projeto, imagens do modelo e padrões
module ArqLais
  module Marce
    module Exportar
      FONTES = [
        ['Poppins', 'normal', 400, 'poppins-400.woff2'],
        ['Poppins', 'normal', 500, 'poppins-500.woff2'],
        ['Poppins', 'normal', 600, 'poppins-600.woff2'],
        ['The Seasons', 'italic', 400, 'the-seasons-italic.woff2']
      ].freeze

      module_function

      # @font-face com as fontes embutidas (o relatório abre sozinho em qualquer lugar)
      def css_fontes
        FONTES.map do |fam, estilo, peso, arq|
          f = File.join(PASTA_UI, 'fonts', arq)
          next '' unless File.exist?(f)
          dados = Util.base64(File.binread(f))
          "@font-face{font-family:'#{fam}';font-style:#{estilo};font-weight:#{peso};src:url(data:font/woff2;base64,#{dados}) format('woff2')}"
        end.join
      end

      def pasta_relatorios(model)
        if model.path.to_s.empty?
          dir = File.join(Util.pasta_usuario, 'relatorios')
        else
          dir = File.join(File.dirname(model.path), 'marcê - relatórios')
        end
        Dir.mkdir(dir) unless File.directory?(dir)
        dir
      rescue StandardError
        Sketchup.temp_dir
      end

      def salvar_relatorio(model, html, nome)
        html = html.to_s.sub('/*MARCE_FONTES*/', css_fontes)
        caminho = File.join(pasta_relatorios(model), Util.nome_arquivo(nome.to_s.sub(/\.html?\z/i, '')) + '.html')
        File.open(caminho, 'wb') { |f| f.write(html) }
        Util.abrir_no_navegador(caminho)
        caminho
      end

      def salvar_csv(csv, nome)
        caminho = UI.savepanel('Salvar lista de peças', '', nome.to_s.empty? ? 'Lista de pecas.csv' : nome.to_s)
        return nil unless caminho
        caminho += '.csv' unless caminho =~ /\.csv\z/i
        File.open(caminho, 'wb') { |f| f.write(csv.to_s) }
        caminho
      end

      # Soma as peças de todos os móveis do marcê do modelo
      def lista_do_projeto(model)
        moveis = Util.moveis_do_modelo(model)
        if moveis.empty?
          UI.messagebox('Nenhum móvel do marcê encontrado no modelo.')
          return
        end
        linhas = []
        moveis.each do |m|
          nome_movel = m.name.to_s.empty? ? 'Móvel' : m.name.to_s
          (Util.ler_json(m.get_attribute(DICT, 'lista')) || []).each do |l|
            linhas << l.merge('movel' => nome_movel)
          end
        end
        sep = ';'
        esc = lambda do |v|
          s = v.is_a?(Float) ? v.round(1).to_s.tr('.', ',') : v.to_s
          s =~ /[;"\n]/ ? '"' + s.gsub('"', '""') + '"' : s
        end
        cab = ['Móvel', 'Peça', 'Qtd', 'Comprimento (mm)', 'Largura (mm)', 'Espessura (mm)', 'Material', 'Veio', 'Fita comp. (lados)', 'Fita larg. (lados)', 'Observações']
        out = [cab.join(sep)]
        linhas.each do |l|
          out << [l['movel'], l['nome'], l['qtd'], l['c'].to_f, l['l'].to_f, l['e'].to_f, l['material'], l['veio'] ? 'Sim' : 'Não', l['fitaC'], l['fitaL'], l['obs']].map { |v| esc.call(v) }.join(sep)
        end
        caminho = salvar_csv("﻿" + out.join("\r\n"), 'Lista de pecas do projeto.csv')
        UI.messagebox("Lista salva com #{linhas.length} linhas de #{moveis.length} móvel(is):\n#{caminho}") if caminho
      end

      # Imagens do móvel isolado para o relatório (perspectiva e vista superior sem frentes)
      def capturar_imagens(model, movel)
        view = model.active_view
        cam = view.camera
        salva = { eye: cam.eye, target: cam.target, up: cam.up, persp: cam.perspective?, fov: (cam.perspective? ? cam.fov : nil), height: (cam.perspective? ? nil : cam.height) }
        imagens = {}
        camada = model.layers[Materiais::TAGS['frente']]
        camada_p = model.layers[Materiais::TAGS['pedra']]
        vis = [camada && camada.visible?, camada_p && camada_p.visible?]
        model.start_operation('marcê: captura', true)
        begin
          # isola: esconde o resto do primeiro nível (desfeito no abort)
          model.entities.each { |e| e.hidden = true if e != movel && e.respond_to?(:hidden=) && !e.hidden? }
          bb = movel.bounds
          c = bb.center
          diag = bb.diagonal
          t = movel.transformation
          xa = t.xaxis
          ya = t.yaxis
          frente = ya.reverse
          olho = c.offset(frente, diag * 1.3).offset(xa.reverse, diag * 0.75).offset(Geom::Vector3d.new(0, 0, 1), diag * 0.75)
          view.camera = Sketchup::Camera.new(olho, c, Geom::Vector3d.new(0, 0, 1), true, 30)
          view.zoom(movel)
          imagens['iso'] = capturar(view, 'iso')
          # vista superior inclinada sem frentes (mostra o interior)
          camada.visible = false if camada
          camada_p.visible = false if camada_p
          olho2 = c.offset(frente, diag * 0.6).offset(Geom::Vector3d.new(0, 0, 1), diag * 1.4)
          view.camera = Sketchup::Camera.new(olho2, c, ya, true, 30)
          view.zoom(movel)
          imagens['topo'] = capturar(view, 'topo')
        rescue StandardError => e
          puts "marcê: falha ao capturar imagens: #{e.message}"
        ensure
          model.abort_operation
          camada.visible = vis[0] if camada && camada.valid?
          camada_p.visible = vis[1] if camada_p && camada_p.valid?
          novo = Sketchup::Camera.new(salva[:eye], salva[:target], salva[:up], salva[:persp])
          novo.fov = salva[:fov] if salva[:fov]
          novo.height = salva[:height] if salva[:height]
          view.camera = novo
        end
        imagens
      end

      def capturar(view, nome)
        arq = File.join(Sketchup.temp_dir, "marce_#{nome}_#{Time.now.to_i}.png")
        ok = view.write_image(filename: arq, width: 1400, height: 900, antialias: true, transparent: false)
        return nil unless ok && File.exist?(arq)
        dados = 'data:image/png;base64,' + Util.base64(File.binread(arq))
        File.delete(arq) rescue nil
        dados
      end

      # Padrões da usuária (materiais, puxador, chapa...) em arquivo JSON
      def arquivo_padroes
        File.join(Util.pasta_usuario, 'padroes.json')
      end

      def ler_padroes
        f = arquivo_padroes
        File.exist?(f) ? Util.ler_json(File.read(f, encoding: 'UTF-8')) : nil
      rescue StandardError
        nil
      end

      def salvar_padroes(padroes)
        File.open(arquivo_padroes, 'w:UTF-8') { |f| f.write(Util.json(padroes || {})) }
      end
    end
  end
end
