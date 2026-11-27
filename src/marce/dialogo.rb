# marcê — janela (UI::HtmlDialog) e ponte com a interface em JavaScript
module ArqLais
  module Marce
    module Dialogo
      @dlg = nil unless instance_variable_defined?(:@dlg)
      @ctx = {} unless instance_variable_defined?(:@ctx)

      module_function

      def abrir_novo(model)
        vol = Volume.ler(model)
        ctx = { modo: 'novo', volume: vol }
        msg = { 'tipo' => 'init', 'modo' => 'novo', 'versao' => VERSAO, 'padroes' => Exportar.ler_padroes }
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
        msg = msg.merge('projeto' => ler_projeto(Sketchup.active_model))
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
          dialog_title: 'marcê · marcenaria paramétrica',
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
            enviar('tipo' => 'gerado', 'ok' => true, 'msg' => txt, 'relatorio' => dados['relatorio'] ? true : false, 'imagens' => imagens)
          rescue StandardError => e
            puts "marcê: #{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
            enviar('tipo' => 'gerado', 'ok' => false, 'msg' => "Não foi possível gerar: #{e.message}")
          end
        end

        d.add_action_callback('detectarCuba') do |_c, j|
          dados = Util.ler_json(j)
          model = Sketchup.active_model
          t = nil
          if @ctx[:grupo] && @ctx[:grupo].valid?
            t = @ctx[:grupo].transformation
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
            caminho = Exportar.salvar_relatorio(Sketchup.active_model, dados['html'], dados['nome'])
            enviar('tipo' => 'salvo', 'msg' => "Relatório salvo em #{caminho}")
          rescue StandardError => e
            enviar('tipo' => 'aviso', 'msg' => "Não foi possível salvar o relatório: #{e.message}")
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
            model.start_operation('marcê: dados do projeto', true)
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
