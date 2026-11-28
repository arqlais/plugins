# planê.mob — relatório, CSV, lista do projeto, imagens do modelo e padrões
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
          dir = File.join(File.dirname(model.path), 'marce-relatorios')
        end
        Dir.mkdir(dir) unless File.directory?(dir)
        dir
      rescue StandardError
        Sketchup.temp_dir
      end

      # troca <script data-marce="x.js" src="x.js"> pelo conteúdo (o relatório abre sozinho)
      def embutir_scripts(html)
        html.gsub(%r{<script data-marce="([a-z]+\.js)" src="[a-z]+\.js"></script>}) do
          arq = File.join(PASTA_UI, Regexp.last_match(1))
          codigo = File.exist?(arq) ? File.read(arq, encoding: 'UTF-8') : ''
          '<script>' + codigo.gsub(%r{</script}i, '<\\/script') + '</script>'
        end
      end

      # grava o relatório (editor de pranchas) e um arquivo de dados ao lado: a prancha aberta no
      # navegador confere esse arquivo e se redesenha quando o móvel muda
      def salvar_relatorio(model, html, nome, dados = nil, grupo = nil, abrir: true)
        caminho = File.join(pasta_relatorios(model), Util.nome_arquivo(nome.to_s.sub(/\.html?\z/i, '')) + '.html')
        arq_dados = File.basename(caminho, '.html') + '.dados.js'
        selo = escrever_dados(caminho, dados) if dados.is_a?(Hash)
        vigia = selo ? "<script>MarceRelatorio.vigiar(#{Util.json(arq_dados)}, #{Util.json(selo)});</script>" : ''
        html = embutir_scripts(html.to_s.sub('/*MARCE_FONTES*/') { css_fontes }).sub(%r{</body>\s*</html>\s*\z}) { vigia + '</body></html>' }
        File.open(caminho, 'wb') { |f| f.write(html) }
        if grupo && grupo.valid?
          model.start_operation('planê.mob: ligar relatório', true, false, true)
          grupo.set_attribute(DICT, 'relatorio', caminho)
          model.commit_operation
        end
        Util.abrir_no_navegador(caminho) if abrir
        caminho
      end

      def escrever_dados(caminho_html, dados)
        selo = Time.now.strftime('%Y%m%d%H%M%S%L')
        arq = File.join(File.dirname(caminho_html), File.basename(caminho_html, '.html') + '.dados.js')
        corpo = Util.json(dados.merge('selo' => selo)).gsub('</', '<\\/')
        File.open(arq, 'wb') { |f| f.write("MarceRelatorio.receberDados(#{corpo});\n") }
        selo
      end

      # o móvel mudou: regrava os dados (com fotos novas) e a prancha aberta se atualiza sozinha
      def atualizar_prancha(model, grupo, capturar: true)
        return nil unless grupo && grupo.valid?
        caminho = grupo.get_attribute(DICT, 'relatorio').to_s
        return nil if caminho.empty? || !File.exist?(caminho)
        spec = Util.ler_json(grupo.get_attribute(DICT, 'spec') || '{}') || {}
        imagens = capturar ? capturar_imagens(model, grupo) : nil
        dados = {
          'spec' => spec, 'imagens' => imagens, 'versao' => VERSAO, 'prancha' => spec['prancha'] || {},
          'projeto' => Util.ler_json(model.get_attribute(DICT, 'projeto') || '{}') || {},
          'escritorio' => (ler_padroes || {})['escritorio'] || {},
          'arquivo' => File.basename(model.path.to_s)
        }
        escrever_dados(caminho, dados)
        caminho
      rescue StandardError => e
        puts "planê.mob: não foi possível atualizar a prancha: #{e.message}"
        nil
      end

      def salvar_csv(csv, nome)
        caminho = UI.savepanel('Salvar lista de peças', '', nome.to_s.empty? ? 'Lista de pecas.csv' : nome.to_s)
        return nil unless caminho
        caminho += '.csv' unless caminho =~ /\.csv\z/i
        File.open(caminho, 'wb') { |f| f.write(csv.to_s) }
        caminho
      end

      # Soma as peças de todos os móveis da planê.mob do modelo
      def lista_do_projeto(model)
        moveis = Util.moveis_do_modelo(model)
        if moveis.empty?
          UI.messagebox('Nenhum móvel da planê.mob encontrado no modelo.')
          return
        end
        linhas = []
        moveis.each do |m|
          nome_movel = m.name.to_s.empty? ? 'Móvel' : m.name.to_s
          lista = Util.ler_json(m.get_attribute(DICT, 'lista'))
          next unless lista.is_a?(Array)
          lista.each { |l| linhas << l.merge('movel' => nome_movel) if l.is_a?(Hash) }
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
      def capturar_imagens(model, movel, operacao: true)
        # só no nível do modelo (dentro de outro grupo a câmera e o isolamento sairiam errados;
        # nesse caso o relatório usa a perspectiva desenhada pela própria planê.mob)
        return {} unless movel && movel.valid? && model.entities.include?(movel)
        view = model.active_view
        cam = view.camera
        salva = { eye: cam.eye, target: cam.target, up: cam.up, persp: cam.perspective?, fov: (cam.perspective? ? cam.fov : nil), height: (cam.perspective? ? nil : cam.height) }
        imagens = {}
        originais = nil
        camada = model.layers[Materiais::TAGS['frente']]
        camada_p = model.layers[Materiais::TAGS['pedra']]
        vis = [camada && camada.visible?, camada_p && camada_p.visible?]
        model.start_operation('planê.mob: captura', true) if operacao
        begin
          mapa = capturar_mapa(model, view, movel)
          imagens['mapa'] = mapa if mapa
          # isola: esconde o resto do primeiro nível (desfeito no abort)
          model.entities.each { |e| e.hidden = true if e != movel && e.respond_to?(:hidden=) && !e.hidden? }
          bb = movel.bounds
          c = bb.center
          diag = bb.diagonal
          t = movel.transformation
          xa = t.xaxis
          ya = t.yaxis
          frente = ya.reverse
          # isométrica em projeção paralela (como a vista "Iso" do SketchUp): olha de frente-esquerda-cima,
          # a 35,26° do chão. Fechada e aberta usam a MESMA câmera, enquadrada com tudo aberto.
          xh = Geom::Vector3d.new(xa.x, xa.y, 0)
          yh = Geom::Vector3d.new(ya.x, ya.y, 0)
          xh = Geom::Vector3d.new(1, 0, 0) if xh.length < 1e-6
          yh = Geom::Vector3d.new(0, 1, 0) if yh.length < 1e-6
          xh.normalize!
          yh.normalize!
          dir = Geom::Vector3d.new(-xh.x - yh.x, -xh.y - yh.y, 1.0)
          olho = c.offset(dir, diag * 3)
          view.camera = Sketchup::Camera.new(olho, c, Geom::Vector3d.new(0, 0, 1), false)
          movs = AbrirFechar.conjuntos(movel)
          if movs.empty?
            view.zoom(movel)
          else
            originais = movs.map { |g| [g, g.transformation] }
            movs.each { |g| g.transformation = AbrirFechar.movimento(g, 1.0) * AbrirFechar.base(g) }
            view.zoom(movel)
            imagens['aberto'] = capturar(view, 'aberto')
            originais.each { |g, tr| g.transformation = tr if g.valid? }
          end
          imagens['iso'] = capturar(view, 'iso')
          # vista superior inclinada sem frentes (mostra o interior)
          camada.visible = false if camada
          camada_p.visible = false if camada_p
          olho2 = c.offset(frente, diag * 0.6).offset(Geom::Vector3d.new(0, 0, 1), diag * 1.4)
          view.camera = Sketchup::Camera.new(olho2, c, ya, true, 30)
          view.zoom(movel)
          imagens['topo'] = capturar(view, 'topo')
        rescue StandardError => e
          puts "planê.mob: falha ao capturar imagens: #{e.message}"
        ensure
          model.abort_operation if operacao
          (originais || []).each { |g, tr| g.transformation = tr if g.valid? && !AbrirFechar.mesma?(g.transformation, tr) }
          camada.visible = vis[0] if camada && camada.valid?
          camada_p.visible = vis[1] if camada_p && camada_p.valid?
          novo = Sketchup::Camera.new(salva[:eye], salva[:target], salva[:up], salva[:persp])
          novo.fov = salva[:fov] if salva[:fov]
          novo.height = salva[:height] if salva[:height]
          view.camera = novo
        end
        imagens
      end

      # Próximo código livre (M01, M02...) entre os móveis da planê.mob no modelo
      def proximo_codigo(model)
        usados = Util.moveis_do_modelo(model).map do |g|
          (Util.ler_json(g.get_attribute(DICT, 'spec') || '{}') || {})['codigo'].to_s
        rescue StandardError
          ''
        end
        n = 1
        n += 1 while usados.include?(format('M%02d', n))
        format('M%02d', n)
      end

      # Planta de marcenaria: o modelo visto de cima (ortogonal) e a posição de cada móvel da planê.mob
      # (cantos projetados na imagem, de 0 a 1). O relatório desenha os códigos por cima.
      def capturar_mapa(model, view, atual)
        moveis = Util.moveis_do_modelo(model).select { |g| model.entities.include?(g) }
        return nil if moveis.empty?
        bb = model.bounds
        c = bb.center
        olho = Geom::Point3d.new(c.x, c.y, bb.max.z + bb.diagonal)
        cam = Sketchup::Camera.new(olho, c, Geom::Vector3d.new(0, 1, 0), false)
        view.camera = cam
        view.zoom_extents
        vw = view.vpwidth.to_f
        vh = view.vpheight.to_f
        return nil if vw < 10 || vh < 10
        larg = 1600
        alt = (larg * vh / vw).round
        img = capturar(view, 'mapa', larg, alt)
        return nil unless img
        itens = moveis.map do |g|
          spec = Util.ler_json(g.get_attribute(DICT, 'spec') || '{}') || {}
          b = g.bounds
          cantos = [0, 1, 3, 2].map do |i|
            sc = view.screen_coords(b.corner(i))
            [(sc.x / vw).round(4), (sc.y / vh).round(4)]
          end
          { 'codigo' => spec['codigo'].to_s, 'nome' => (spec['nome'] || g.name).to_s, 'cantos' => cantos, 'atual' => g == atual }
        end
        { 'img' => img, 'w' => larg, 'h' => alt, 'itens' => itens }
      rescue StandardError => e
        puts "planê.mob: planta de marcenaria não capturada: #{e.message}"
        nil
      end

      def capturar(view, nome, largura = 1400, altura = nil)
        view.refresh if view.respond_to?(:refresh)
        if altura.nil?
          vw = view.respond_to?(:vpwidth) ? view.vpwidth.to_f : 0
          vh = view.respond_to?(:vpheight) ? view.vpheight.to_f : 0
          altura = vw > 10 && vh > 10 ? (largura * vh / vw).round : 900
        end
        # JPEG comprimido: a foto fica várias vezes menor que PNG e não pesa na janela nem no relatório
        arq = File.join(Sketchup.temp_dir, "marce_#{nome}_#{Time.now.to_i}.jpg")
        ok = view.write_image(filename: arq, width: largura, height: altura, antialias: true, compression: 0.85)
        return nil unless ok && File.exist?(arq)
        dados = 'data:image/jpeg;base64,' + Util.base64(File.binread(arq))
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
