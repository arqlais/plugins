# marcê — construção do móvel no modelo
#
# Recebe as peças calculadas pelo motor (ui/engine.js) e cria:
#  - um grupo principal com a transformação da âncora (volume);
#  - um subgrupo por conjunto móvel (porta, gaveta, aramado), aninhados
#    quando há "pai" (gaveta interna dentro do gavetão);
#  - cada peça como componente (definições reaproveitadas), com material,
#    etiqueta (tag) e atributos de corte (compatível com OpenCutList).
module ArqLais
  module Marce
    module Construtor
      module_function

      # dados: hash vindo do JS ({ 'spec', 'modelo' => { 'pecas', 'conjuntos', ... }, 'lista' })
      # alvo: { grupo: existente } ou { ancora: {...}, volume: entidade }
      # operacao: false quando quem chama já abriu a operação (ex.: autoteste, que desfaz tudo no fim)
      def gerar(model, dados, alvo, operacao: true)
        spec = dados['spec']
        pecas = dados.dig('modelo', 'pecas') || []
        conjuntos = dados.dig('modelo', 'conjuntos') || []
        raise 'Nenhuma peça para gerar.' if pecas.empty?

        iniciou = false
        if operacao
          model.start_operation('marcê: gerar móvel', true)
          iniciou = true
        end
        grupo = alvo[:grupo]
        defs_antigas = []
        if grupo && grupo.valid?
          grupo.make_unique if grupo.is_a?(Sketchup::Group)
          defs_antigas = definicoes_usadas(Util.entidades_de(grupo))
          Util.entidades_de(grupo).clear!
        else
          t = alvo[:ancora] ? Volume.transformacao(alvo[:ancora]) : Geom::Transformation.new
          if alvo[:ancora].nil? && spec['base'] && spec['base']['tipo'] == 'suspenso'
            t = Geom::Transformation.translation([0, 0, Util.mm(spec['elevacao'])])
          end
          grupo = model.entities.add_group
          grupo.transformation = t
          esconder_volume(model, alvo[:volume], grupo) if alvo[:volume]
        end
        grupo.name = spec['nome'].to_s

        ents = Util.entidades_de(grupo)
        cache_mat = {}
        cache_tag = {}
        cache_def = {}

        # conjuntos (pais antes dos filhos)
        grupos_conj = {}
        pendentes = conjuntos.dup
        guarda = 0
        until pendentes.empty? || guarda > 20
          guarda += 1
          pendentes.reject! do |c|
            pai = c['pai']
            next false if pai && !grupos_conj.key?(pai)
            destino = pai ? grupos_conj[pai].entities : ents
            g = destino.add_group
            g.name = c['nome'].to_s
            g.set_attribute(DICT, 'mov_tipo', c['tipo'])
            g.set_attribute(DICT, 'mov_eixo', c['eixo']) if c['eixo']
            g.set_attribute(DICT, 'mov_angulo', c['angulo'].to_f)
            g.set_attribute(DICT, 'mov_curso', c['curso'].to_f)
            g.set_attribute(DICT, 'mov_id', c['id'].to_s)
            g.set_attribute(DICT, 'mov_requer', c['requer'].to_s) if c['requer']
            if c['pivot']
              g.set_attribute(DICT, 'mov_pivot', [c['pivot']['x'].to_f, c['pivot']['y'].to_f, c['pivot']['z'].to_f])
            end
            g.set_attribute(DICT, 'base', Geom::Transformation.new.to_a)
            g.layer = Materiais.tag(model, c['tipo'] == 'giro' ? 'frente' : 'gaveta', cache_tag)
            grupos_conj[c['id']] = g
            true
          end
        end

        erros = 0
        pecas.each do |p|
          destino = p['conj'] && grupos_conj[p['conj']] ? grupos_conj[p['conj']].entities : ents
          begin
            criar_peca(model, spec, destino, p, cache_def, cache_mat, cache_tag)
          rescue StandardError => e
            erros += 1
            puts "marcê: falha na peça #{p['nome']}: #{e.message}"
          end
        end

        grupo.set_attribute(DICT, 'versao', VERSAO)
        grupo.set_attribute(DICT, 'spec', Util.json(spec))
        grupo.set_attribute(DICT, 'resumo', Util.json(dados.dig('modelo', 'resumo') || {}))
        grupo.set_attribute(DICT, 'lista', Util.json(dados['lista'] || []))
        grupo.set_attribute(DICT, 'gerado_em', Time.now.strftime('%d/%m/%Y %H:%M'))
        limpar_definicoes(model, defs_antigas)
        model.commit_operation if iniciou
        [grupo, erros]
      rescue StandardError => e
        model.abort_operation if iniciou
        raise e
      end

      # definições de peças usadas dentro de um móvel (para limpar ao regenerar)
      def definicoes_usadas(ents, acc = [])
        ents.each do |e|
          if e.is_a?(Sketchup::ComponentInstance)
            acc << e.definition unless acc.include?(e.definition)
          elsif e.is_a?(Sketchup::Group)
            definicoes_usadas(e.entities, acc)
          end
        end
        acc
      end

      # remove as definições antigas que ficaram sem uso (o arquivo não incha a cada edição)
      def limpar_definicoes(model, defs)
        defs.each do |d|
          next unless d.valid? && d.instances.empty?
          next unless d.get_attribute(DICT, 'gerada') || d.get_attribute(DICT, 'corte') || d.name =~ /\A(Dobradiça|Corrediça|Puxador|Perfil|Pé|Tubo|Cesto|Grade|Quadro|Montante|Espelho|Pedra)/
          model.definitions.remove(d) if model.definitions.respond_to?(:remove)
        end
      rescue StandardError => e
        puts "marcê: não foi possível limpar definições antigas: #{e.message}"
      end

      def esconder_volume(model, volume, grupo)
        return unless volume && volume.valid?
        tag = model.layers['marcê · volumes'] || model.layers.add('marcê · volumes')
        volume.layer = tag
        volume.hidden = true
        grupo.set_attribute(DICT, 'volume_pid', volume.persistent_id) if volume.respond_to?(:persistent_id)
      end

      def chave_def(p)
        forma = p['forma'] ? p['forma']['pts'].flatten.map { |v| v.to_f.round(1) }.join(',') : ''
        [p['nome'], p['dx'].to_f.round(1), p['dy'].to_f.round(1), p['dz'].to_f.round(1), p['mat'], forma.hash].join('|')
      end

      def nome_def(p)
        c = p['corte']
        dims = c ? "#{c['c'].round}×#{c['l'].round}×#{c['e'].round}" : "#{p['dx'].to_f.round}×#{p['dy'].to_f.round}×#{p['dz'].to_f.round}"
        "#{p['nome']} #{dims}"
      end

      def criar_peca(model, spec, destino, p, cache_def, cache_mat, cache_tag)
        dx = p['dx'].to_f
        dy = p['dy'].to_f
        dz = p['dz'].to_f
        return if dx <= 0.05 || dy <= 0.05 || dz <= 0.05
        k = chave_def(p)
        defi = cache_def[k]
        unless defi
          defi = model.definitions.add(nome_def(p))
          defi.set_attribute(DICT, 'gerada', true) # do marcê: pode ser limpa quando sair de uso
          begin
            desenhar(defi.entities, p, dx, dy, dz)
          rescue StandardError
            model.definitions.remove(defi) if model.definitions.respond_to?(:remove)
            raise
          end
          if p['corte']
            defi.set_attribute(DICT, 'corte', [p['corte']['c'], p['corte']['l'], p['corte']['e']])
          end
          cache_def[k] = defi
        end
        tr = Geom::Transformation.translation([Util.mm(p['x']), Util.mm(p['y']), Util.mm(p['z'])])
        inst = destino.add_instance(defi, tr)
        inst.name = p['nome'].to_s
        inst.material = Materiais.para(model, spec, p['mat'], cache_mat)
        inst.layer = Materiais.tag(model, p['grupo'], cache_tag)
        inst.set_attribute(DICT, 'peca', p['nome'].to_s)
        inst.set_attribute(DICT, 'obs', p['obs'].to_s) unless p['obs'].to_s.empty?
        if p['corte']
          inst.set_attribute(DICT, 'fita', [p['fitaC'].to_i, p['fitaL'].to_i])
        end
        inst
      end

      # Desenha a peça na origem da definição
      def desenhar(ents, p, dx, dy, dz)
        forma = p['forma']
        if forma && forma['plano'] == 'yz'
          pts = forma['pts'].map { |q| Geom::Point3d.new(0, Util.mm(q[0]), Util.mm(q[1])) }
          extrudar(ents, pts, Geom::Vector3d.new(1, 0, 0), Util.mm(dx))
        elsif forma && forma['plano'] == 'xz'
          pts = forma['pts'].map { |q| Geom::Point3d.new(Util.mm(q[0]), 0, Util.mm(q[1])) }
          extrudar(ents, pts, Geom::Vector3d.new(0, 1, 0), Util.mm(dy))
        else
          pts = [[0, 0, 0], [dx, 0, 0], [dx, dy, 0], [0, dy, 0]].map { |q| Geom::Point3d.new(Util.mm(q[0]), Util.mm(q[1]), 0) }
          extrudar(ents, pts, Geom::Vector3d.new(0, 0, 1), Util.mm(dz))
        end
      end

      def extrudar(ents, pts, eixo, distancia)
        limpos = []
        pts.each { |q| limpos << q if limpos.empty? || limpos.last.distance(q) > 0.01.mm }
        limpos.pop if limpos.length > 2 && limpos.first.distance(limpos.last) <= 0.01.mm
        raise 'perfil degenerado' if limpos.length < 3
        face = ents.add_face(limpos)
        raise 'face não criada' unless face
        face.reverse! if face.normal.dot(eixo) < 0
        face.pushpull(distancia)
      end
    end
  end
end
