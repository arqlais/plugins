# marcê — atualização automática pelo GitHub
#
# Lê versao.json no repositório (branch main e branch de desenvolvimento),
# escolhe a versão mais nova, baixa o .rbz, confere o SHA-256, instala por
# cima com Sketchup.install_from_archive e recarrega o plugin sem precisar
# reiniciar o SketchUp.
require 'json'
require 'digest'

module ArqLais
  module Marce
    module Atualizar
      REPO = 'arqlais/plugins'.freeze
      RAMOS = ['main', 'claude/elegant-archimedes-k2hbjw'].freeze
      CHAVE = 'ArqLais_Marce'.freeze
      ARQUIVOS = %w[util materiais volume construtor abrir_fechar exportar atualizar aviso dialogo main].freeze
      @pedidos = []

      module_function

      def url(ramo, caminho)
        "https://raw.githubusercontent.com/#{REPO}/#{ramo}/#{caminho}?t=#{Time.now.to_i}"
      end

      def versao_maior?(a, b)
        Gem::Version.new(a.to_s) > Gem::Version.new(b.to_s)
      rescue ArgumentError
        false
      end

      # Baixa uma URL. Usa o HTTP do SketchUp e, se falhar, Net::HTTP.
      # bloco: |corpo_ou_nil, erro_ou_nil|
      def baixar(endereco, binario: false, &bloco)
        if defined?(Sketchup::Http::Request)
          req = Sketchup::Http::Request.new(endereco, Sketchup::Http::GET)
          @pedidos << req
          req.start do |_r, resp|
            @pedidos.delete(req)
            if resp && resp.status_code == 200 && resp.body && !resp.body.empty?
              corpo = resp.body
              corpo = corpo.dup.force_encoding(Encoding::BINARY) if binario
              bloco.call(corpo, nil)
            else
              baixar_net(endereco, binario, &bloco)
            end
          end
        else
          baixar_net(endereco, binario, &bloco)
        end
      rescue StandardError
        baixar_net(endereco, binario, &bloco)
      end

      def baixar_net(endereco, binario, &bloco)
        require 'net/http'
        require 'openssl'
        uri = URI(endereco)
        resp = nil
        3.times do
          resp = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 60) { |h| h.get(uri.request_uri) }
          break unless resp.is_a?(Net::HTTPRedirection)
          uri = URI(resp['location'])
        end
        if resp.is_a?(Net::HTTPSuccess)
          corpo = resp.body
          corpo = corpo.force_encoding(Encoding::BINARY) if binario
          bloco.call(corpo, nil)
        else
          bloco.call(nil, "HTTP #{resp.code}")
        end
      rescue StandardError => e
        bloco.call(nil, e.message)
      end

      # Consulta todos os ramos e devolve a melhor versão encontrada.
      # bloco: |info_ou_nil, erro_ou_nil|   info: { 'versao', 'rbz', 'sha256', 'notas', 'ramo', 'nova' }
      def verificar(&bloco)
        resultados = {}
        RAMOS.each do |ramo|
          baixar(url(ramo, 'versao.json')) do |corpo, erro|
            info = nil
            if corpo
              begin
                info = JSON.parse(corpo.to_s.dup.force_encoding('UTF-8'))
                info['ramo'] = ramo
              rescue JSON::ParserError
                info = nil
              end
            end
            resultados[ramo] = { info: info, erro: erro }
            if resultados.length == RAMOS.length
              infos = resultados.values.map { |r| r[:info] }.compact
              melhor = infos.max_by { |i| Gem::Version.new(i['versao'].to_s) rescue Gem::Version.new('0') }
              Sketchup.write_default(CHAVE, 'ultima_checagem', Time.now.to_i)
              if melhor
                melhor['nova'] = versao_maior?(melhor['versao'], VERSAO)
                melhor['atual'] = VERSAO
                bloco.call(melhor, nil)
              else
                bloco.call(nil, resultados.values.map { |r| r[:erro] }.compact.first || 'versao.json não encontrado')
              end
            end
          end
        end
      end

      # Baixa, confere e instala. bloco: |ok, mensagem|
      def instalar(info, &bloco)
        baixar(url(info['ramo'], info['rbz'] || 'dist/marce.rbz'), binario: true) do |corpo, erro|
          unless corpo
            bloco.call(false, "Não foi possível baixar a atualização (#{erro}).")
            next
          end
          if info['sha256'] && Digest::SHA256.hexdigest(corpo) != info['sha256']
            bloco.call(false, 'O arquivo baixado veio incompleto (assinatura não confere). Tente de novo.')
            next
          end
          arq = File.join(Sketchup.temp_dir, "marce-#{info['versao']}.rbz")
          File.open(arq, 'wb') { |f| f.write(corpo) }
          begin
            Sketchup.install_from_archive(arq, false)
            recarregar
            bloco.call(true, "marcê atualizado para a versão #{VERSAO}.")
          rescue Interrupt
            bloco.call(false, 'Instalação cancelada.')
          rescue StandardError => e
            bloco.call(false, "Falha ao instalar: #{e.message}")
          ensure
            File.delete(arq) rescue nil
          end
        end
      end

      # Recarrega os arquivos Ruby já instalados (menus não duplicam: estão protegidos)
      def recarregar
        verboso = $VERBOSE
        $VERBOSE = nil # evita avisos de constante redefinida
        load File.join(PASTA, 'versao.rb')
        ARQUIVOS.each do |f|
          caminho = File.join(PASTA, "#{f}.rb")
          load caminho if File.exist?(caminho)
        end
        true
      ensure
        $VERBOSE = verboso
      end

      # Fluxo completo do botão "atualizar" (fora da janela)
      def botao
        Sketchup.status_text = 'marcê: procurando atualização…'
        verificar do |info, erro|
          if erro || info.nil?
            UI.messagebox("Não foi possível verificar atualizações agora.\n#{erro}")
          elsif !info['nova']
            UI.messagebox("O marcê já está na versão mais nova (#{VERSAO}).")
          else
            Aviso.disponivel(info)
          end
        end
      end

      # Checagem silenciosa ao abrir o SketchUp (no máximo uma vez por dia)
      def checagem_automatica
        ultima = Sketchup.read_default(CHAVE, 'ultima_checagem', 0).to_i
        return if Time.now.to_i - ultima < 24 * 3600
        verificar do |info, _erro|
          next unless info && info['nova']
          next if Sketchup.read_default(CHAVE, 'ignorar_versao', '') == info['versao']
          Aviso.disponivel(info)
        end
      end
    end
  end
end
