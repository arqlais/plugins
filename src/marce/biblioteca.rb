# planê.mob — minha biblioteca de ferragens (puxadores, corrediças, dobradiças...)
#
# Cada pessoa monta a própria biblioteca com arquivos do SketchUp (.skp): anexa um arquivo, uma pasta
# inteira ou o componente selecionado no modelo. Os arquivos ficam copiados na pasta de configurações
# (marce/biblioteca), com uma ficha em biblioteca.json (nome, marca, categoria, medidas e miniatura).
#
# Na geração, a peça do motor que tem "biblio" vira uma instância do componente do arquivo, encaixada
# na caixa calculada pelo motor: o eixo mais comprido do componente vai no eixo mais comprido da caixa
# (e assim por diante). "esticar" ajusta só o comprimento (perfil, corrediça); "real" mantém o tamanho
# do fabricante e centraliza. Se o arquivo sumir, a peça volta a ser desenhada pelo motor.
module ArqLais
  module Marce
    module Biblioteca
      CATEGORIAS = %w[puxador corredica dobradica aramado outro].freeze
      @cache = {} unless instance_variable_defined?(:@cache)

      module_function

      def pasta
        dir = File.join(Util.pasta_usuario, 'biblioteca')
        Dir.mkdir(dir) unless File.directory?(dir)
        dir
      end

      def arquivo_fichas
        File.join(pasta, 'biblioteca.json')
      end

      def itens
        return [] unless File.exist?(arquivo_fichas)
        lista = Util.ler_json(File.read(arquivo_fichas, encoding: 'UTF-8'))
        lista.is_a?(Array) ? lista : []
      rescue StandardError
        []
      end

      def gravar(lista)
        tmp = arquivo_fichas + '.tmp'
        File.open(tmp, 'wb') { |f| f.write(Util.json(lista)) }
        File.rename(tmp, arquivo_fichas)
      end

      def item(id)
        itens.find { |i| i['id'] == id.to_s }
      end

      def caminho(it)
        File.join(pasta, it['arquivo'].to_s)
      end

      # lista para a janela, com a miniatura embutida (data:image/png)
      def para_janela
        itens.map do |i|
          png = File.join(pasta, i['id'].to_s + '.png')
          mini = File.exist?(png) ? 'data:image/png;base64,' + Util.base64(File.binread(png)) : nil
          i.merge('mini' => mini, 'existe' => File.exist?(caminho(i)))
        end
      end

      def novo_id
        "b#{Time.now.strftime('%y%m%d%H%M%S')}#{rand(1000).to_s.rjust(3, '0')}"
      end

      def adivinhar_categoria(nome)
        n = nome.to_s.downcase
        return 'corredica' if n =~ /corredi|trilho|tandem|telesc/
        return 'dobradica' if n =~ /dobradi|caneco|articulador/
        return 'aramado' if n =~ /tempero|lixeira|cesto|aramad|fruteira|organizador/
        return 'puxador' if n =~ /puxador|pux|alça|alca|perfil|botão|botao/
        'outro'
      end

      # medidas (mm) do componente, da maior para a menor
      def medidas(defi)
        b = defi.bounds
        [b.width, b.height, b.depth].map { |v| v.to_mm.round(1) }.sort.reverse
      end

      # carrega um .skp como definição; diz se ela já existia no modelo antes (para não apagar a da pessoa)
      def carregar(model, arq)
        antes = model.definitions.to_a
        defi = model.definitions.load(arq)
        [defi, antes.include?(defi)]
      end

      def descartar(model, defi, existia)
        return if existia || !defi || !defi.valid? || !defi.instances.empty?
        model.definitions.remove(defi) if model.definitions.respond_to?(:remove)
      rescue StandardError
        nil
      end

      # partes de primeiro nível de um arquivo (componentes e grupos), para escolher quando há várias
      def partes_de(defi)
        defi.entities.select { |e| e.is_a?(Sketchup::ComponentInstance) || e.is_a?(Sketchup::Group) }
      end

      def nome_parte(e, k)
        n = e.name.to_s
        n = e.definition.name.to_s if n.empty? && e.respond_to?(:definition)
        n = "parte #{k + 1}" if n.empty? || n =~ /\AGrupo#|\AGroup#/
        n
      end

      # Anexa um arquivo .skp. Se ele tiver várias peças soltas (ex.: puxador + logotipo), devolve as
      # partes para a pessoa escolher em vez de anexar tudo junto.
      def anexar_arquivo(arq, categoria = nil, escolher: true)
        model = Sketchup.active_model
        defi, existia = carregar(model, arq)
        raise 'o arquivo não tem nenhum desenho' unless defi && defi.valid?
        partes = partes_de(defi)
        soltas = defi.entities.grep(Sketchup::Face).length
        if escolher && partes.length > 1 && soltas.zero?
          lista = partes.each_with_index.map do |e, k|
            { 'indice' => k, 'nome' => nome_parte(e, k), 'medidas' => medidas(e.respond_to?(:definition) ? e.definition : e.entities.parent) }
          end
          descartar(model, defi, existia)
          return { 'partes' => lista, 'arquivo' => arq, 'nome' => File.basename(arq, '.skp'), 'categoria' => categoria }
        end
        it = registrar(defi, File.basename(arq, '.skp'), categoria, origem_arquivo: arq)
        descartar(model, defi, existia)
        { 'itens' => [it] }
      end

      # anexa só as partes escolhidas de um arquivo (cada uma vira uma ficha)
      def anexar_partes(arq, indices, categoria = nil)
        model = Sketchup.active_model
        defi, existia = carregar(model, arq)
        partes = partes_de(defi)
        novos = indices.map(&:to_i).uniq.map do |k|
          e = partes[k]
          next nil unless e
          d = e.respond_to?(:definition) ? e.definition : e.entities.parent
          registrar(d, nome_parte(e, k), categoria)
        end.compact
        descartar(model, defi, existia)
        { 'itens' => novos }
      end

      def anexar_pasta(dir, categoria = nil)
        novos = []
        erros = []
        Dir.glob(File.join(dir.to_s.tr('\\', '/'), '*.skp')).sort.first(60).each do |arq|
          begin
            r = anexar_arquivo(arq, categoria, escolher: false)
            novos.concat(r['itens'] || [])
          rescue StandardError => e
            erros << "#{File.basename(arq)}: #{e.message}"
          end
        end
        { 'itens' => novos, 'erros' => erros }
      end

      # componente ou grupo selecionado no modelo
      def anexar_selecao(categoria = nil)
        model = Sketchup.active_model
        e = model.selection.find { |s| s.is_a?(Sketchup::ComponentInstance) || s.is_a?(Sketchup::Group) }
        raise 'selecione no modelo o componente (ou grupo) da ferragem' unless e
        raise 'esse é um móvel da planê.mob; selecione só a ferragem' if Util.movel_de(e)
        d = e.respond_to?(:definition) ? e.definition : e.entities.parent
        nome = e.name.to_s.empty? ? d.name.to_s : e.name.to_s
        { 'itens' => [registrar(d, nome, categoria)] }
      end

      # grava o .skp da definição na biblioteca, com miniatura e ficha
      def registrar(defi, nome, categoria, origem_arquivo: nil)
        id = novo_id
        destino = File.join(pasta, id + '.skp')
        if origem_arquivo && File.exist?(origem_arquivo)
          File.binwrite(destino, File.binread(origem_arquivo))
        else
          ok = defi.save_as(destino)
          raise 'não foi possível gravar o componente' unless ok && File.exist?(destino)
        end
        begin
          defi.refresh_thumbnail if defi.respond_to?(:refresh_thumbnail)
          defi.save_thumbnail(File.join(pasta, id + '.png')) if defi.respond_to?(:save_thumbnail)
        rescue StandardError
          nil
        end
        cat = CATEGORIAS.include?(categoria.to_s) ? categoria.to_s : adivinhar_categoria(nome)
        it = {
          'id' => id, 'nome' => nome.to_s.strip.empty? ? 'ferragem' : nome.to_s.strip, 'marca' => '',
          'categoria' => cat, 'arquivo' => id + '.skp', 'medidas' => medidas(defi),
          'encaixe' => cat == 'puxador' || cat == 'dobradica' ? 'real' : 'esticar', 'virar' => false,
          'criado' => Time.now.strftime('%d/%m/%Y')
        }
        gravar(itens + [it])
        it
      end

      def editar(dados)
        lista = itens
        it = lista.find { |i| i['id'] == dados['id'].to_s }
        return nil unless it
        %w[nome marca categoria encaixe notas].each { |k| it[k] = dados[k].to_s if dados.key?(k) }
        it['virar'] = dados['virar'] ? true : false if dados.key?('virar')
        it['categoria'] = 'outro' unless CATEGORIAS.include?(it['categoria'])
        gravar(lista)
        it
      end

      def remover(id)
        lista = itens
        it = lista.find { |i| i['id'] == id.to_s }
        return false unless it
        [caminho(it), File.join(pasta, it['id'].to_s + '.png')].each { |f| File.delete(f) if File.exist?(f) }
        gravar(lista - [it])
        @cache.delete(it['id'])
        true
      end

      # ------------------------------------------------------------ na geração
      def definicao(model, id)
        d = @cache[id]
        return d if d && d.valid? && d.model == model
        it = item(id)
        return nil unless it && File.exist?(caminho(it))
        d = model.definitions.load(caminho(it))
        @cache[id] = d
        d
      rescue StandardError => e
        puts "planê.mob: não foi possível carregar a ferragem #{id}: #{e.message}"
        nil
      end

      # Transformação que leva o componente para dentro da caixa da peça (mm, origem na caixa)
      # b: { 'encaixe' => 'esticar'|'real', 'virar' => bool }
      def encaixe(bounds, caixa, b)
        mn = [bounds.min.x, bounds.min.y, bounds.min.z]
        d = [bounds.width, bounds.height, bounds.depth].map(&:to_f)
        t = caixa.map { |v| Util.mm(v).to_f }
        si = [0, 1, 2].sort_by { |k| [-d[k], k] }
        ti = [0, 1, 2].sort_by { |k| [-t[k], k] }
        # o motor diz em que eixo vai o comprimento (x, y ou z): vale mesmo quando esticar encolhe a peça
        eixo = %w[x y z].index(b['longo'].to_s)
        ti = [eixo] + ti.reject { |k| k == eixo } if eixo
        esc = [1.0, 1.0, 1.0]
        esc[0] = t[ti[0]] / d[si[0]] if b['encaixe'] == 'esticar' && d[si[0]] > 0
        sg = [1, 1, 1]
        # permutação ímpar espelharia o componente: gira 180° no eixo menor em vez disso
        sg[2] = -1 if paridade(si.zip(ti).sort_by(&:first).map(&:last)).odd?
        if b['virar']
          sg[1] = -sg[1]
          sg[2] = -sg[2]
        end
        m = Array.new(16, 0.0)
        o = [0.0, 0.0, 0.0]
        3.times do |k|
          s = esc[k] * sg[k]
          m[si[k] * 4 + ti[k]] = s # coluna si[k] (imagem do eixo de origem), linha ti[k]
          largura = esc[k] * d[si[k]]
          folga = (t[ti[k]] - largura) / 2.0
          folga = 0.0 if b['apoiar'] && %w[x y z].index(b['apoiar'].to_s) == ti[k] # apoiado (ex.: na base do vão)
          o[ti[k]] = sg[k] > 0 ? folga - esc[k] * mn[si[k]] : folga + esc[k] * (mn[si[k]] + d[si[k]])
        end
        m[12] = o[0]
        m[13] = o[1]
        m[14] = o[2]
        m[15] = 1.0
        Geom::Transformation.new(m)
      end

      def paridade(perm)
        p = perm.dup
        n = 0
        p.length.times do |i|
          while p[i] != i
            j = p[i]
            p[i], p[j] = p[j], p[i]
            n += 1
          end
        end
        n
      end

      # coloca a ferragem da biblioteca no lugar da peça; nil se não der (a peça é desenhada pelo motor)
      def colocar(model, destino, p)
        b = p['biblio'] || {}
        defi = definicao(model, b['id'].to_s)
        return nil unless defi
        caixa = [p['dx'].to_f, p['dy'].to_f, p['dz'].to_f]
        tr = Geom::Transformation.translation([Util.mm(p['x']), Util.mm(p['y']), Util.mm(p['z'])]) * encaixe(defi.bounds, caixa, b)
        inst = destino.add_instance(defi, tr)
        inst.set_attribute(DICT, 'biblio', b['id'].to_s)
        inst
      rescue StandardError => e
        puts "planê.mob: ferragem da biblioteca não encaixou (#{p['nome']}): #{e.message}"
        nil
      end
    end

    # Minhas texturas: imagens (jpg/png) anexadas pela usuária, organizadas em pastas. Ficam copiadas em
    # marce/texturas, com a ficha em texturas.json; a janela mostra cada pasta como um botãozinho de filtro.
    module Texturas
      EXTENSOES = %w[.jpg .jpeg .png .bmp .tif .tiff .webp].freeze

      module_function

      def pasta
        dir = File.join(Util.pasta_usuario, 'texturas')
        Dir.mkdir(dir) unless File.directory?(dir)
        dir
      end

      def arquivo_fichas
        File.join(pasta, 'texturas.json')
      end

      def itens
        return [] unless File.exist?(arquivo_fichas)
        l = Util.ler_json(File.read(arquivo_fichas, encoding: 'UTF-8'))
        l.is_a?(Array) ? l : []
      rescue StandardError
        []
      end

      def gravar(lista)
        tmp = arquivo_fichas + '.tmp'
        File.open(tmp, 'wb') { |f| f.write(Util.json(lista)) }
        File.rename(tmp, arquivo_fichas)
      end

      def caminho(id)
        it = itens.find { |i| i['id'] == id.to_s }
        return nil unless it
        c = File.join(pasta, it['arquivo'].to_s)
        File.exist?(c) ? c : nil
      end

      # endereço file:/// da imagem para a miniatura na janela
      def url(caminho)
        partes = caminho.to_s.tr('\\', '/').sub(%r{\A/+}, '').split('/')
        seguras = partes.each_with_index.map do |p, i|
          next p if i.zero? && p =~ /\A[A-Za-z]:\z/
          p.bytes.map { |b| (b.chr =~ /[A-Za-z0-9._~\-]/) ? b.chr : format('%%%02X', b) }.join
        end
        'file:///' + seguras.join('/')
      end

      def para_janela
        itens.map do |i|
          c = File.join(pasta, i['arquivo'].to_s)
          i.merge('img' => File.exist?(c) ? url(c) : nil, 'existe' => File.exist?(c))
        end
      end

      def nome_de(arq)
        File.basename(arq, '.*').tr('_-', '  ').squeeze(' ').strip
      end

      def anexar(arquivos, nome_pasta)
        lista = itens
        novos = []
        arquivos.each do |arq|
          next unless EXTENSOES.include?(File.extname(arq).downcase) && File.file?(arq)
          id = "t#{Time.now.strftime('%y%m%d%H%M%S')}#{rand(10_000).to_s.rjust(4, '0')}"
          destino = id + File.extname(arq).downcase
          File.binwrite(File.join(pasta, destino), File.binread(arq))
          it = { 'id' => id, 'nome' => nome_de(arq), 'pasta' => nome_pasta.to_s.strip.empty? ? 'minhas texturas' : nome_pasta.to_s.strip,
                 'arquivo' => destino, 'largura' => 1200, 'cor' => nil }
          lista << it
          novos << it
        end
        gravar(lista)
        novos
      end

      def anexar_arquivo
        arq = UI.openpanel('Escolha a imagem da textura (jpg ou png)', '', 'Imagens|*.jpg;*.jpeg;*.png;*.bmp;*.tif;*.webp||')
        arq ? anexar([arq], 'minhas texturas') : nil
      end

      # uma pasta inteira vira uma pasta da biblioteca (com o mesmo nome)
      def anexar_pasta
        dir = UI.select_directory(title: 'Pasta com as imagens das texturas')
        return nil unless dir
        arqs = Dir.glob(File.join(dir.to_s.tr('\\', '/'), '*')).select { |a| EXTENSOES.include?(File.extname(a).downcase) }.sort.first(200)
        anexar(arqs, File.basename(dir.to_s))
      end

      def editar(dados)
        lista = itens
        it = lista.find { |i| i['id'] == dados['id'].to_s }
        return nil unless it
        %w[nome pasta cor].each { |k| it[k] = dados[k].to_s if dados.key?(k) && !dados[k].to_s.empty? }
        it['largura'] = dados['largura'].to_f if dados['largura'].to_f > 50
        gravar(lista)
        it
      end

      def remover(id)
        lista = itens
        it = lista.find { |i| i['id'] == id.to_s }
        return false unless it
        c = File.join(pasta, it['arquivo'].to_s)
        File.delete(c) if File.exist?(c)
        gravar(lista - [it])
        true
      end
    end
  end
end
