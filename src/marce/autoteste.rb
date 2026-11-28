# planê.mob — autoteste dentro do SketchUp
#
# Extensões → planê.mob → Autoteste. A janela (ui/autoteste.html) calcula vários móveis com o
# motor e manda um por vez; aqui cada um é gerado de verdade no modelo, conferido (peças,
# portas e gavetas, faces, medidas, materiais, etiquetas, abrir/fechar, edição) e tudo é
# desfeito no fim (abort_operation): o modelo da usuária volta exatamente como estava.
module ArqLais
  module Marce
    module Autoteste
      module_function

      def abrir
        if @dlg && @dlg.visible?
          @dlg.bring_to_front
          return
        end
        d = UI::HtmlDialog.new(
          dialog_title: 'planê.mob · autoteste',
          preferences_key: 'ArqLais_Marce_Autoteste',
          scrollable: true, resizable: true,
          width: 820, height: 820, min_width: 620, min_height: 520,
          style: UI::HtmlDialog::STYLE_DIALOG
        )
        d.set_file(File.join(PASTA_UI, 'autoteste.html'))
        d.add_action_callback('pronto') { |_c, _j| d.execute_script("Auto.iniciar(#{Util.json(ambiente)})") }
        d.add_action_callback('caso') do |_c, j|
          r = rodar_caso(Util.ler_json(j) || {})
          d.execute_script("Auto.resultado(#{Util.json(r)})")
        end
        d.add_action_callback('relatorio') do |_c, j|
          r = testar_relatorio(Util.ler_json(j) || {})
          d.execute_script("Auto.resultado(#{Util.json(r)})")
        end
        d.add_action_callback('salvar') do |_c, j|
          caminho = salvar_texto((Util.ler_json(j) || {})['texto'].to_s)
          d.execute_script("Auto.salvo(#{Util.json(caminho.to_s)})")
        end
        d.add_action_callback('fechar') { |_c, _j| d.close }
        d.set_on_closed { @dlg = nil if @dlg.equal?(d) }
        @dlg = d
        d.show
      end

      # ------------------------------------------------------------ ambiente
      def ambiente
        itens = []
        ok = ->(nome, cond, det = nil) { itens << { 'nome' => nome, 'ok' => cond ? true : false, 'detalhe' => det.to_s } }
        ok.call("SketchUp #{Sketchup.version}", Sketchup.version.to_i >= 17, 'Ruby ' + RUBY_VERSION)
        faltam = %w[index.html app.js engine.js render.js report.js detalhes.js nesting.js catalogo.js ajuda.js ilustra.js style.css autoteste.html].reject { |f| File.exist?(File.join(PASTA_UI, f)) }
        ok.call('arquivos da janela', faltam.empty?, faltam.empty? ? 'todos presentes' : 'faltam: ' + faltam.join(', '))
        tex = %w[veio_v.png veio_h.png veio_carvalho_v.jpg veio_catedral_v.jpg veio_nogueira_v.jpg veio_linear_v.jpg].reject { |f| File.exist?(File.join(PASTA, 'texturas', f)) }
        ok.call('texturas de veio', tex.empty?, tex.empty? ? 'ok' : 'faltam: ' + tex.join(', '))
        begin
          teste = File.join(Util.pasta_usuario, 'autoteste.tmp')
          File.write(teste, 'ok')
          File.delete(teste)
          ok.call('pasta de configurações gravável', true, Util.pasta_usuario)
        rescue StandardError => e
          ok.call('pasta de configurações gravável', false, e.message)
        end
        begin
          arq = File.join(Sketchup.temp_dir, "marce_autoteste_#{Time.now.to_i}.png")
          gravou = Sketchup.active_model.active_view.write_image(filename: arq, width: 64, height: 48, antialias: false, transparent: false)
          ok.call('captura de imagem da vista', gravou && File.exist?(arq), gravou ? 'ok' : 'write_image não gravou')
          File.delete(arq) if File.exist?(arq)
        rescue StandardError => e
          ok.call('captura de imagem da vista', false, e.message)
        end
        ok.call('download para atualização', defined?(Sketchup::Http::Request) ? true : false, defined?(Sketchup::Http::Request) ? 'Sketchup::Http disponível' : 'sem Sketchup::Http (usa Net::HTTP)')
        fab = Biblioteca.itens.count { |i| i['origem'] == 'fabrica' }
        ok.call('ferragens da planê.mob na biblioteca', !Biblioteca.fabrica_pendente?, Biblioteca.fabrica_pendente? ? 'ainda não baixadas: abra a etapa Ferragens com internet' : "#{fab} ferragens")
        ok.call("versão da planê.mob #{VERSAO}", true, PASTA)
        { 'versao' => VERSAO, 'itens' => itens }
      end

      # ------------------------------------------------------------ um móvel
      def rodar_caso(dados)
        nome = dados['nome'].to_s
        res = []
        ok = ->(n, cond, det = nil) { res << { 'nome' => n, 'ok' => cond ? true : false, 'detalhe' => det.to_s } }
        model = Sketchup.active_model
        pecas = dados.dig('modelo', 'pecas') || []
        conjs = dados.dig('modelo', 'conjuntos') || []
        spec = dados['spec'] || {}
        t0 = Time.now
        model.start_operation('planê.mob: autoteste', true)
        begin
          grupo, erros = Construtor.gerar(model, dados, {}, operacao: false)
          ok.call('gera o móvel no modelo', grupo && grupo.valid?, "#{pecas.length} peças em #{((Time.now - t0) * 1000).round} ms")
          ok.call('nenhuma peça falhou ao desenhar', erros.to_i.zero?, erros.to_i.zero? ? 'ok' : "#{erros} peça(s) com erro (veja o Console Ruby)")

          inst = []
          movs = []
          andar = lambda do |ents|
            ents.each do |e|
              if e.is_a?(Sketchup::ComponentInstance) then inst << e
              elsif e.is_a?(Sketchup::Group)
                movs << e if AbrirFechar.movel?(e)
                andar.call(e.entities)
              end
            end
          end
          andar.call(Util.entidades_de(grupo))
          ok.call('cada peça virou um componente', inst.length == pecas.length, "#{inst.length} de #{pecas.length}")
          ok.call('portas, gavetas e aramados como grupos móveis', movs.length == conjs.length, "#{movs.length} de #{conjs.length}")

          sem_face = inst.select { |i| i.definition.entities.grep(Sketchup::Face).length < 3 }.map { |i| i.definition.name }.uniq
          ok.call('todas as peças têm faces', sem_face.empty?, sem_face.empty? ? 'ok' : sem_face.first(4).join(', '))
          if inst.first.respond_to?(:manifold?)
            nao_solidas = inst.reject(&:manifold?).map { |i| i.definition.name }.uniq
            ok.call('peças sólidas (fechadas)', nao_solidas.empty?, nao_solidas.empty? ? 'ok' : nao_solidas.first(4).join(', '))
          end
          sem_mat = inst.count { |i| i.material.nil? && i.definition.entities.grep(Sketchup::Face).all? { |f| f.material.nil? } }
          ok.call('todas as peças com material', sem_mat.zero?, sem_mat.zero? ? 'ok' : "#{sem_mat} sem material")
          sem_tag = inst.count { |i| i.layer.nil? || i.layer == model.layers[0] }
          ok.call('todas as peças com etiqueta (tag)', sem_tag.zero?, sem_tag.zero? ? 'ok' : "#{sem_tag} na Untagged")

          bb = Geom::BoundingBox.new
          inst.each { |i| bb.add(i.bounds) } # coordenadas locais do grupo do móvel
          l = bb.width.to_mm
          pf = bb.height.to_mm
          a = bb.depth.to_mm
          lim = ->(v, alvo, mais) { v >= alvo.to_f - 2 && v <= alvo.to_f + mais }
          med = format('%.0f × %.0f × %.0f mm (pedido %d × %d × %d)', l, pf, a, spec['L'].to_i, spec['D'].to_i, spec['H'].to_i)
          ok.call('medidas do móvel conferem', lim.call(l, spec['L'], 160) && lim.call(pf, spec['D'], 220) && lim.call(a, spec['H'], 80), med)

          AbrirFechar.todos(grupo, true, operacao: false)
          abertos = movs.count { |g| AbrirFechar.aberto?(g) }
          ok.call('abrir tudo abre todas as portas e gavetas', abertos == movs.length, "#{abertos} de #{movs.length}")
          AbrirFechar.todos(grupo, false, operacao: false)
          fechados = movs.count { |g| !AbrirFechar.aberto?(g) }
          ok.call('fechar tudo volta cada peça ao lugar exato', fechados == movs.length, "#{fechados} de #{movs.length}")

          n_defs = model.definitions.length
          2.times { Construtor.gerar(model, dados, { grupo: grupo }, operacao: false) }
          ok.call('editar 2× não acumula componentes velhos', model.definitions.length == n_defs, "#{n_defs} → #{model.definitions.length}")
          spec_salvo = Util.ler_json(grupo.get_attribute(DICT, 'spec') || '{}') || {}
          ok.call('dados do móvel gravados para editar depois', spec_salvo['L'].to_i == spec['L'].to_i, spec_salvo.empty? ? 'sem atributo spec' : 'ok')

          if dados['captura'] && model.entities.include?(grupo)
            imgs = Exportar.capturar_imagens(model, grupo, operacao: false)
            faltam = %w[iso aberto topo].reject { |k| imgs[k].is_a?(String) && imgs[k].start_with?('data:image/') }
            ok.call('fotos do móvel para o relatório (fechado, aberto, interior)', faltam.empty?, faltam.empty? ? 'ok' : 'faltou: ' + faltam.join(', '))
          end
        rescue StandardError => e
          ok.call('erro durante o teste', false, "#{e.class}: #{e.message} · #{(e.backtrace || []).first(2).join(' · ')}")
        ensure
          model.abort_operation
        end
        { 'nome' => nome, 'itens' => res }
      end

      # ------------------------------------------------------------ relatório
      def testar_relatorio(dados)
        res = []
        ok = ->(n, cond, det = nil) { res << { 'nome' => n, 'ok' => cond ? true : false, 'detalhe' => det.to_s } }
        html = dados['html'].to_s
        begin
          final = Exportar.embutir_scripts(html.sub('/*MARCE_FONTES*/') { Exportar.css_fontes })
          ok.call('scripts embutidos no relatório', final !~ /<script data-marce=/ && final.include?('MarceRelatorio'), "#{(final.bytesize / 1024.0).round} KB")
          ok.call('fontes embutidas no relatório', final.include?('font/woff2;base64') || final.include?('woff2;base64'), 'Poppins e The Seasons')
          caminho = File.join(Sketchup.temp_dir, 'marce_autoteste_relatorio.html')
          File.open(caminho, 'wb') { |f| f.write(final) }
          ok.call('relatório gravado em disco', File.size?(caminho).to_i > 50_000, caminho)
          File.delete(caminho) if File.exist?(caminho)
          csv = dados['csv'].to_s
          caminho2 = File.join(Sketchup.temp_dir, 'marce_autoteste_lista.csv')
          File.open(caminho2, 'wb') { |f| f.write(csv) }
          ok.call('lista de peças (CSV) gravada', File.size?(caminho2).to_i > 200 && csv.start_with?('Nº;Peça'), "#{csv.lines.length} linhas")
          File.delete(caminho2) if File.exist?(caminho2)
        rescue StandardError => e
          ok.call('erro no relatório', false, "#{e.class}: #{e.message}")
        end
        { 'nome' => 'relatório e lista de peças', 'itens' => res }
      end

      def salvar_texto(texto)
        dir = Exportar.pasta_relatorios(Sketchup.active_model)
        caminho = File.join(dir, "marce-autoteste-#{Time.now.strftime('%Y%m%d-%H%M')}.txt")
        File.open(caminho, 'wb') { |f| f.write(texto) }
        caminho
      rescue StandardError => e
        "não foi possível salvar: #{e.message}"
      end
    end
  end
end
