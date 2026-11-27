# marcê — janela (UI::HtmlDialog) e ponte com a interface em JavaScript
module ArqLais
  module Marce
    module Dialogo
      @dlg = nil
      @ctx = {}

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

      def mostrar(ctx, msg)
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
            alvo = if @ctx[:modo] == 'editar' && @ctx[:grupo] && @ctx[:grupo].valid?
                     { grupo: @ctx[:grupo] }
                   else
                     vol = @ctx[:volume]
                     vol && vol[:entidade] && !vol[:entidade].valid? ? { ancora: vol } : { ancora: vol, volume: vol && vol[:entidade] }
                   end
            grupo, erros = Construtor.gerar(model, dados, alvo)
            @ctx = { modo: 'editar', grupo: grupo }
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

        d.add_action_callback('salvarPadroes') do |_c, j|
          dados = Util.ler_json(j)
          Exportar.salvar_padroes(dados['padroes'])
        end

        d.set_on_closed { @dlg = nil }
        d
      end

      def enviar(msg)
        return unless @dlg
        @dlg.execute_script("App.receber(#{Util.json(msg)})")
      end
    end
  end
end
