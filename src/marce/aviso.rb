# marcê — avisos de atualização (janelinha no visual planê)
#   • "Tem versão nova" (atualizar agora / depois)
#   • "marcê atualizado" com as novidades, uma vez por versão
require 'json'

module ArqLais
  module Marce
    module Aviso
      CHAVE = 'ArqLais_Marce'.freeze
      @janela = nil unless instance_variable_defined?(:@janela)

      module_function

      # Lista de novidades empacotada (gerada do CHANGELOG.md)
      def todas_novidades
        f = File.join(PASTA, 'novidades.json')
        File.exist?(f) ? JSON.parse(File.read(f, encoding: 'UTF-8')) : []
      rescue StandardError
        []
      end

      # Novidades das versões que a pessoa ainda não viu
      def nao_vistas
        vista = Sketchup.read_default(CHAVE, 'versao_vista', '').to_s
        todas = todas_novidades
        return [] if vista == VERSAO
        return todas.first(1) if vista.empty? # primeira instalação: só a versão atual
        todas.select do |v|
          Gem::Version.new(v['versao']) > Gem::Version.new(vista) rescue false
        end
      end

      def marcar_vista
        Sketchup.write_default(CHAVE, 'versao_vista', VERSAO)
      end

      # Mostra "marcê atualizado" se houver novidade não vista. Retorna true se mostrou.
      def novidades_se_houver
        lista = nao_vistas
        marcar_vista
        return false if lista.empty?
        mostrar(:atualizado, 'versao' => VERSAO, 'versoes' => lista)
        true
      end

      def disponivel(info)
        mostrar(:disponivel, 'versao' => info['versao'], 'atual' => VERSAO, 'versoes' => [{ 'versao' => info['versao'], 'notas' => info['notas'] || [] }], 'info' => info)
      end

      def esc(t)
        t.to_s.gsub('&', '&amp;').gsub('<', '&lt;').gsub('>', '&gt;').gsub('"', '&quot;')
      end

      def html(tipo, dados)
        css = File.join(PASTA, 'ui', 'fonts')
        fonte = lambda do |arq|
          f = File.join(css, arq)
          File.exist?(f) ? "url(data:font/woff2;base64,#{Util.base64(File.binread(f))})" : 'local(Arial)'
        end
        lista = (dados['versoes'] || []).map do |v|
          itens = Array(v['notas']).map { |n| "<li>#{esc(n)}</li>" }.join
          "<div class='ver'><span class='tag'>versão #{esc(v['versao'])}</span><ul>#{itens}</ul></div>"
        end.join
        if tipo == :disponivel
          titulo = "tem versão <em>nova</em>"
          sub = "marcê #{esc(dados['versao'])} está disponível · você tem a #{esc(dados['atual'])}"
          botoes = "<button class='sec' onclick=\"sketchup.depois('')\">depois</button><button class='pri' id='bt' onclick=\"this.textContent='atualizando…';this.disabled=true;sketchup.atualizar('')\">atualizar agora</button>"
        else
          titulo = "marcê <em>atualizado</em>"
          sub = "você está na versão #{esc(dados['versao'])} · veja o que mudou"
          botoes = "<button class='pri' onclick=\"sketchup.fechar('')\">entendi</button>"
        end
        <<~HTML
          <!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
          @font-face{font-family:Poppins;font-weight:400;src:#{fonte.call('poppins-400.woff2')}}
          @font-face{font-family:Poppins;font-weight:600;src:#{fonte.call('poppins-600.woff2')}}
          @font-face{font-family:'The Seasons';font-style:italic;src:#{fonte.call('the-seasons-italic.woff2')}}
          *{box-sizing:border-box}body{margin:0;background:#f5f1ee;color:#3e4b57;font:13px/1.5 Poppins,'Segoe UI',sans-serif;height:100vh;display:flex;flex-direction:column}
          .topo{display:flex;align-items:center;gap:12px;padding:22px 26px 6px}
          .eyebrow{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:600;letter-spacing:.12em;color:#a88a80;margin:14px 26px 4px}.eyebrow:before{content:"";width:26px;height:1.5px;background:#a88a80}
          h1{margin:0 26px;font-size:24px;font-weight:600;letter-spacing:-.02em}h1 em{font-family:'The Seasons',Georgia,serif;font-style:italic;font-weight:400;color:#a88a80;font-size:1.12em}
          .sub{margin:4px 26px 14px;color:#8b939a}
          .lista{flex:1;overflow:auto;margin:0 26px;background:#fff;border:1px solid #ebe1dc;border-radius:18px;padding:6px 18px}
          .ver{padding:10px 0;border-top:1px solid #f1e9e5}.ver:first-child{border-top:0}
          .tag{display:inline-block;font-size:11px;font-weight:600;color:#a88a80;background:#f4e8e5;border-radius:99px;padding:1px 10px}
          ul{margin:8px 0 0;padding-left:18px}li{margin:3px 0}li::marker{color:#d6b3ab}
          .botoes{display:flex;justify-content:flex-end;gap:8px;padding:16px 26px 20px}
          button{border-radius:99px;padding:10px 20px;font:600 12.5px Poppins,sans-serif;cursor:pointer;border:1px solid #ebe1dc;background:#fff;color:#3e4b57}
          .pri{background:#3e4b57;border-color:#3e4b57;color:#fff;box-shadow:0 10px 24px -8px rgba(62,75,87,.45)}.pri:disabled{opacity:.5}
          .marca{font-weight:600;letter-spacing:-.03em}.marca i{font-style:normal;color:#d6b3ab}
          </style></head><body>
          <div class="topo"><svg viewBox="0 0 100 100" width="34" height="34"><rect width="100" height="100" rx="24" fill="#3e4b57"/><path d="M17 79C18 62 18 46 21 38C25 27 37 27 41 38C44 47 44 62 43 71C42 80 35 82 34 75C33 66 43 40 52 32C60 25 71 28 73 40C75 52 74 65 75 74C76 83 83 85 89 77" fill="none" stroke="#f5f1ee" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="marca">marc<i>ê</i></span></div>
          <p class="eyebrow">#{tipo == :disponivel ? 'atualização' : 'novidades'}</p>
          <h1>#{titulo}</h1><p class="sub">#{sub}</p>
          <div class="lista">#{lista.empty? ? '<p>Melhorias e correções.</p>' : lista}</div>
          <div class="botoes">#{botoes}</div>
          </body></html>
        HTML
      end

      def mostrar(tipo, dados)
        @janela.close if @janela && @janela.visible?
        d = UI::HtmlDialog.new(dialog_title: 'marcê', preferences_key: 'ArqLais_Marce_Aviso', width: 460, height: 520,
                               resizable: false, scrollable: false, style: UI::HtmlDialog::STYLE_DIALOG)
        d.set_html(html(tipo, dados))
        d.add_action_callback('fechar') { |_c, _j| d.close }
        d.add_action_callback('depois') do |_c, _j|
          Sketchup.write_default(CHAVE, 'ignorar_versao', dados['versao'].to_s)
          d.close
        end
        d.add_action_callback('atualizar') do |_c, _j|
          Atualizar.instalar(dados['info']) do |ok, msg|
            d.close
            if ok
              Aviso.novidades_se_houver || UI.messagebox(msg)
            else
              UI.messagebox(msg)
            end
          end
        end
        d.set_on_closed { @janela = nil if @janela.equal?(d) }
        d.center
        d.show
        @janela = d
      end
    end
  end
end
