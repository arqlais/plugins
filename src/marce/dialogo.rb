# planê.mob — janela (UI::HtmlDialog) e ponte com a interface em JavaScript
module ArqLais
  module Marce
    module Dialogo
      @dlg = nil unless instance_variable_defined?(:@dlg)
      @ctx = {} unless instance_variable_defined?(:@ctx)

      module_function

      def abrir_novo(model)
        vol = Volume.ler(model)
        ctx = { modo: 'novo', volume: vol }
        msg = { 'tipo' => 'init', 'modo' => 'novo', 'versao' => VERSAO, 'padroes' => Exportar.ler_padroes, 'codigo' => Exportar.proximo_codigo(model) }
        if vol
          msg['volume'] = { 'L' => vol[:L].round(1), 'D' => vol[:D].round(1), 'H' => vol[:H].round(1),
                            'elevacao' => vol[:elevacao].round, 'tipoSugerido' => Volume.tipo_sugerido(vol) }
          cuba = Volume.detectar_cuba(model, Volume.transformacao(vol), vol[:L], vol[:D], vol[:H])
          msg['cuba'] = cuba if cuba
        end
        mostrar(ctx, msg)
      end

      def abrir_edicao(grupo, relatorio: false)
        spec = Util.ler_json(grupo.get_attribute(DICT, 'spec'))
        msg = { 'tipo' => 'init', 'modo' => 'editar', 'versao' => VERSAO, 'spec' => spec, 'padroes' => Exportar.ler_padroes }
        rel = grupo.get_attribute(DICT, 'relatorio').to_s
        msg['prancha'] = rel if !rel.empty? && File.exist?(rel)
        if relatorio
          msg['acao'] = 'relatorio'
          msg['imagens'] = Exportar.capturar_imagens(Sketchup.active_model, grupo)
        end
        mostrar({ modo: 'editar', grupo: grupo }, msg)
      end

      def ler_projeto(model)
        Util.ler_json(model.get_attribute(DICT, 'projeto') || '{}')
      end

      def mostrar(ctx, msg)
        msg = msg.merge('projeto' => ler_projeto(Sketchup.active_model), 'arquivo' => File.basename(Sketchup.active_model.path.to_s))
        novidades = Aviso.nao_vistas
        unless novidades.empty?
          msg = msg.merge('novidades' => novidades)
          Aviso.marcar_vista
        end
        @ctx = ctx
        @msg_init = msg
        if @dlg && @dlg.visible?
          enviar(msg)
          @dlg.bring_to_front
          return
        end
        @dlg = criar
        @dlg.show
      end

      def criar
        d = UI::HtmlDialog.new(
          dialog_title: 'planê.mob · marcenaria paramétrica',
          preferences_key: 'ArqLais_Marce_Janela',
          scrollable: false, resizable: true,
          width: 1400, height: 880, min_width: 980, min_height: 620,
          style: UI::HtmlDialog::STYLE_DIALOG
        )
        d.set_file(File.join(PASTA_UI, 'index.html'))

        d.add_action_callback('pronto') { |_c, _j| enviar(@msg_init) if @msg_init }

        d.add_action_callback('cancelar') { |_c, _j| d.close }

        d.add_action_callback('gerar') do |_c, j|
          dados = Util.ler_json(j)
          model = Sketchup.active_model
          begin
            # fecha edições de grupo abertas: o móvel é sempre gerado no nível do modelo
            guarda = 0
            while model.active_path && !model.active_path.empty? && guarda < 20
              model.close_active
              guarda += 1
            end
            alvo = if @ctx[:modo] == 'editar' && @ctx[:grupo] && @ctx[:grupo].valid?
                     { grupo: @ctx[:grupo] }
                   else
                     vol = @ctx[:volume]
                     vol && vol[:entidade] && !vol[:entidade].valid? ? { ancora: vol } : { ancora: vol, volume: vol && vol[:entidade] }
                   end
            grupo, erros = Construtor.gerar(model, dados, alvo)
            @ctx = { modo: 'editar', grupo: grupo, volume: @ctx[:volume] }
            model.selection.clear
            model.selection.add(grupo)
            imagens = dados['relatorio'] ? Exportar.capturar_imagens(model, grupo) : nil
            txt = erros.zero? ? 'Móvel gerado no modelo' : "Móvel gerado (#{erros} peça(s) com problema — veja o Console Ruby)"
            # móvel com relatório já salvo: a prancha aberta no navegador se atualiza sozinha
            prancha = !dados['relatorio'] && Exportar.atualizar_prancha(model, grupo)
            txt += ' · prancha atualizada' if prancha
            enviar('tipo' => 'gerado', 'ok' => true, 'msg' => txt, 'relatorio' => dados['relatorio'] ? true : false, 'imagens' => imagens)
          rescue StandardError => e
            puts "planê.mob: #{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
            enviar('tipo' => 'gerado', 'ok' => false, 'msg' => "Não foi possível gerar: #{e.message}")
          end
        end

        d.add_action_callback('detectarCuba') do |_c, j|
          dados = Util.ler_json(j)
          model = Sketchup.active_model
          t = nil
          if @ctx[:grupo] && @ctx[:grupo].valid?
            t = Util.transformacao_mundo(@ctx[:grupo])
          elsif @ctx[:volume]
            t = Volume.transformacao(@ctx[:volume])
          end
          if t
            spec_h = (dados['H'] || (@ctx[:volume] && @ctx[:volume][:H]) || 900).to_f
            cuba = Volume.detectar_cuba(model, t, dados['L'].to_f, dados['D'].to_f, spec_h)
            enviar('tipo' => 'cuba', 'cuba' => cuba, 'msg' => cuba ? nil : 'Nenhuma cuba encontrada sobre o volume (o nome do componente precisa conter "cuba" ou "pia").')
          else
            enviar('tipo' => 'cuba', 'cuba' => nil, 'msg' => 'Selecione um volume no modelo para detectar a cuba.')
          end
        end

        d.add_action_callback('salvarRelatorio') do |_c, j|
          dados = Util.ler_json(j)
          begin
            grupo = @ctx && @ctx[:grupo] && @ctx[:grupo].valid? ? @ctx[:grupo] : nil
            caminho = Exportar.salvar_relatorio(Sketchup.active_model, dados['html'], dados['nome'], dados['dados'], grupo, abrir: false)
            @ultima_prancha = caminho
            enviar('tipo' => 'pranchaSalva', 'caminho' => caminho, 'ligada' => grupo ? true : false)
          rescue StandardError => e
            enviar('tipo' => 'aviso', 'msg' => "Não foi possível salvar o relatório: #{e.message}")
          end
        end

        # ---------------- minha biblioteca de ferragens (.skp)
        d.add_action_callback('bibListar') { |_c, _j| enviar('tipo' => 'biblioteca', 'itens' => Biblioteca.para_janela) }

        d.add_action_callback('bibAnexar') do |_c, j|
          dados = Util.ler_json(j)
          cat = dados['categoria']
          begin
            r = case dados['modo']
                when 'selecao' then Biblioteca.anexar_selecao(cat)
                when 'pasta'
                  dir = UI.select_directory(title: 'Pasta com os arquivos .skp das ferragens')
                  dir ? Biblioteca.anexar_pasta(dir, cat) : nil
                when 'partes' then Biblioteca.anexar_partes(dados['arquivo'].to_s, dados['indices'] || [], cat)
                else
                  arq = UI.openpanel('Escolha o arquivo do SketchUp da ferragem', '', 'SketchUp|*.skp||')
                  arq ? Biblioteca.anexar_arquivo(arq, cat) : nil
                end
            enviar('tipo' => 'biblioteca', 'itens' => Biblioteca.para_janela, 'anexo' => r) if r
          rescue StandardError => e
            puts "planê.mob: biblioteca: #{e.class}: #{e.message}"
            enviar('tipo' => 'aviso', 'msg' => "Não foi possível anexar: #{e.message}")
          end
        end

        # ---------------- minhas texturas (imagens)
        d.add_action_callback('texListar') { |_c, _j| enviar('tipo' => 'texturas', 'itens' => Texturas.para_janela) }

        d.add_action_callback('texAnexar') do |_c, j|
          dados = Util.ler_json(j)
          begin
            novos = dados['modo'] == 'pasta' ? Texturas.anexar_pasta : Texturas.anexar_arquivo
            enviar('tipo' => 'texturas', 'itens' => Texturas.para_janela, 'novos' => novos) if novos
          rescue StandardError => e
            enviar('tipo' => 'aviso', 'msg' => "Não foi possível anexar a textura: #{e.message}")
          end
        end

        d.add_action_callback('texEditar') do |_c, j|
          dados = Util.ler_json(j)
          Texturas.editar(dados)
          enviar('tipo' => 'texturas', 'itens' => Texturas.para_janela, 'silencioso' => dados['silencioso'] ? true : false)
        end

        d.add_action_callback('texRemover') do |_c, j|
          Texturas.remover(Util.ler_json(j)['id'])
          enviar('tipo' => 'texturas', 'itens' => Texturas.para_janela)
        end

        d.add_action_callback('bibEditar') do |_c, j|
          Biblioteca.editar(Util.ler_json(j))
          enviar('tipo' => 'biblioteca', 'itens' => Biblioteca.para_janela)
        end

        d.add_action_callback('bibRemover') do |_c, j|
          Biblioteca.remover(Util.ler_json(j)['id'])
          enviar('tipo' => 'biblioteca', 'itens' => Biblioteca.para_janela)
        end

        d.add_action_callback('pedirFotos') do |_c, _j|
          grupo = @ctx && @ctx[:grupo]
          imagens = nil
          begin
            imagens = Exportar.capturar_imagens(Sketchup.active_model, grupo) if grupo && grupo.valid?
          rescue StandardError => e
            puts "planê.mob: fotos do relatório: #{e.message}"
          end
          enviar('tipo' => 'fotos', 'imagens' => imagens)
        end

        d.add_action_callback('abrirPrancha') do |_c, _j|
          grupo = @ctx && @ctx[:grupo]
          caminho = grupo && grupo.valid? ? grupo.get_attribute(DICT, 'relatorio').to_s : ''
          caminho = @ultima_prancha.to_s if caminho.empty? || !File.exist?(caminho)
          if !caminho.empty? && File.exist?(caminho)
            Util.abrir_no_navegador(caminho)
          else
            enviar('tipo' => 'aviso', 'msg' => 'Ainda não há prancha salva para este móvel.')
          end
        end

        d.add_action_callback('atualizarPrancha') do |_c, _j|
          grupo = @ctx && @ctx[:grupo]
          caminho = grupo && grupo.valid? ? Exportar.atualizar_prancha(Sketchup.active_model, grupo) : nil
          if caminho
            enviar('tipo' => 'salvo', 'msg' => 'Prancha atualizada: a página aberta no navegador se redesenha sozinha.')
          else
            enviar('tipo' => 'aviso', 'msg' => 'Este móvel ainda não tem prancha salva: gere o relatório uma vez para ligar a prancha ao móvel.')
          end
        end

        d.add_action_callback('salvarCsv') do |_c, j|
          dados = Util.ler_json(j)
          caminho = Exportar.salvar_csv(dados['csv'], dados['nome'])
          enviar('tipo' => 'salvo', 'msg' => "Lista salva em #{caminho}") if caminho
        end

        d.add_action_callback('salvarProjeto') do |_c, j|
          dados = Util.ler_json(j)
          model = Sketchup.active_model
          if dados['projeto'].is_a?(Hash)
            model.start_operation('planê.mob: dados do projeto', true, false, true) # transparente: não vira passo do Ctrl+Z
            model.set_attribute(DICT, 'projeto', Util.json(dados['projeto']))
            model.commit_operation
          end
        end

        d.add_action_callback('salvarPadroes') do |_c, j|
          dados = Util.ler_json(j)
          Exportar.salvar_padroes(dados['padroes'])
        end

        d.add_action_callback('verificarAtualizacao') do |_c, _j|
          Atualizar.verificar do |info, erro|
            if info
              enviar('tipo' => 'atualizacao', 'atual' => VERSAO, 'versao' => info['versao'], 'nova' => info['nova'], 'notas' => info['notas'] || [])
            else
              enviar('tipo' => 'atualizacao', 'atual' => VERSAO, 'erro' => erro.to_s)
            end
          end
        end

        d.add_action_callback('atualizar') do |_c, j|
          dados = Util.ler_json(j)
          Atualizar.verificar do |info, erro|
            if info.nil? || !info['nova']
              enviar('tipo' => 'aviso', 'msg' => info ? "Você já está na versão mais nova (#{VERSAO})." : "Não foi possível verificar: #{erro}")
              next
            end
            enviar('tipo' => 'aviso', 'msg' => "Baixando a versão #{info['versao']}…")
            Atualizar.instalar(info) do |ok, msg|
              if ok
                # reabre a janela com a versão nova mantendo o que estava na tela
                ctx = @ctx
                init = (@msg_init || {}).merge('spec' => dados['spec'], 'modo' => ctx[:modo] || 'novo', 'versao' => VERSAO, 'avisoAtualizado' => msg)
                init.delete('acao')
                @dlg.close if @dlg
                @dlg = nil
                UI.start_timer(0.3, false) { Dialogo.mostrar(ctx, init) }
              else
                enviar('tipo' => 'aviso', 'msg' => msg)
              end
            end
          end
        end

        d.set_on_closed { @dlg = nil if @dlg.equal?(d) }
        d
      end

      def enviar(msg)
        return unless @dlg
        @dlg.execute_script("App.receber(#{Util.json(msg)})")
      end
    end
  end
end
