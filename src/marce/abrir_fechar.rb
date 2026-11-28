# planê.mob — abrir/fechar portas, basculantes, gavetas e aramados (com animação)
#
# O estado aberto/fechado é lido da própria posição do conjunto (comparada com
# a posição fechada gravada na geração), então nada é escrito no modelo durante
# a animação: o Ctrl+Z do SketchUp não fica com passos soltos e o estado nunca
# "dessincroniza". A ferramenta informa a área do contorno (getExtents) para o
# desenho não sumir nem ser cortado ao dar zoom.
module ArqLais
  module Marce
    module AbrirFechar
      PASSOS = 14
      EPS = 1e-6
      @animando = {} unless instance_variable_defined?(:@animando)

      module_function

      def movel?(e)
        (e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)) && e.get_attribute(DICT, 'mov_tipo') ? true : false
      end

      # posição fechada (gravada na geração; identidade se não houver)
      def base(g)
        arr = g.get_attribute(DICT, 'base')
        arr.is_a?(Array) && arr.length == 16 ? Geom::Transformation.new(arr) : Geom::Transformation.new
      end

      # transformação de abertura (fração 0..1) no sistema do pai
      def movimento(g, fracao)
        if g.get_attribute(DICT, 'mov_tipo') == 'giro'
          pv = g.get_attribute(DICT, 'mov_pivot') || [0, 0, 0]
          eixo = g.get_attribute(DICT, 'mov_eixo') == 'x' ? Geom::Vector3d.new(1, 0, 0) : Geom::Vector3d.new(0, 0, 1)
          ang = g.get_attribute(DICT, 'mov_angulo').to_f * fracao
          Geom::Transformation.rotation(Geom::Point3d.new(Util.mm(pv[0]), Util.mm(pv[1]), Util.mm(pv[2])), eixo, ang.degrees)
        else
          curso = g.get_attribute(DICT, 'mov_curso').to_f * fracao
          Geom::Transformation.translation(Geom::Vector3d.new(0, -Util.mm(curso), 0))
        end
      end

      def mesma?(t1, t2)
        t1.to_a.zip(t2.to_a).all? { |a, b| (a - b).abs < EPS * 1000 }
      end

      def aberto?(g)
        !mesma?(g.transformation, base(g))
      end

      def aplicar(g, fracao)
        g.move!(movimento(g, fracao) * base(g))
        seguidores(g).each { |c| c.move!(movimento(c, fracao) * base(c)) }
      end

      # peças que acompanham o conjunto (ex.: perfil intermediário da corrediça, que anda a metade)
      def segue?(g)
        g.get_attribute(DICT, 'mov_segue') ? true : false
      end

      def seguidores(g)
        Util.entidades_de(g).select { |e| movel?(e) && segue?(e) }
      end

      # conjunto do mesmo nível com este mov_id (ex.: o gavetão de uma gaveta interna)
      def irmao(g, id)
        return nil if id.to_s.empty? || !g.parent.respond_to?(:entities)
        g.parent.entities.find { |e| e != g && movel?(e) && e.get_attribute(DICT, 'mov_id').to_s == id.to_s }
      end

      def dependentes(g)
        id = g.get_attribute(DICT, 'mov_id').to_s
        return [] if id.empty? || !g.parent.respond_to?(:entities)
        g.parent.entities.select { |e| e != g && movel?(e) && e.get_attribute(DICT, 'mov_requer').to_s == id }
      end

      def alternar(g, view = nil)
        return unless g && g.valid?
        return if @animando[g.entityID]
        abrir = !aberto?(g)
        # gaveta interna: abre o gavetão junto; fechar o gavetão fecha a interna antes
        req = irmao(g, g.get_attribute(DICT, 'mov_requer'))
        alternar(req, view) if abrir && req && !aberto?(req)
        dependentes(g).each { |d| alternar(d, view) if aberto?(d) } unless abrir
        de = abrir ? 0.0 : 1.0
        para = abrir ? 1.0 : 0.0
        eid = g.entityID
        @animando[eid] = true
        passo = 0
        id = nil
        id = UI.start_timer(0.016, true) do
          fim = false
          begin
            passo += 1
            fim = passo >= PASSOS || !g.valid?
            if g.valid?
              aplicar(g, fim ? para : de + (para - de) * suavizar(passo.to_f / PASSOS))
              (view || Sketchup.active_model.active_view).invalidate
            end
          rescue StandardError
            fim = true
          ensure
            if fim
              UI.stop_timer(id)
              @animando.delete(eid)
              begin
                registrar(g, de, para) if g.valid?
              rescue StandardError
                nil # modelo fechado ou peça apagada no meio da animação
              end
            end
          end
        end
        id
      end

      def suavizar(t)
        t = [[t, 0.0].max, 1.0].min
        t * t * (3 - 2 * t)
      end

      def conjuntos(movel)
        lista = []
        visitar = lambda do |ents|
          ents.each do |e|
            next unless e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
            lista << e if movel?(e)
            visitar.call(Util.entidades_de(e))
          end
        end
        visitar.call(Util.entidades_de(movel))
        lista
      end

      # abre/fecha todos os conjuntos de um móvel (sem animação)
      # operacao: false quando quem chama já está dentro de uma operação (autoteste)
      def todos(movel, abrir, operacao: true)
        model = Sketchup.active_model
        model.start_operation(abrir ? 'planê.mob: abrir tudo' : 'planê.mob: fechar tudo', true) if operacao
        conjuntos(movel).each { |g| g.transformation = movimento(g, abrir ? 1.0 : 0.0) * base(g) }
        model.commit_operation if operacao
        model.active_view.invalidate
      end

      # grava a posição final numa operação (o Ctrl+Z fecha/abre de volta); a animação usa move!
      def registrar(g, de, para)
        model = Sketchup.active_model
        aplicar(g, de)
        model.start_operation(para > de ? 'planê.mob: abrir' : 'planê.mob: fechar', true)
        g.transformation = movimento(g, para) * base(g)
        seguidores(g).each { |c| c.transformation = movimento(c, para) * base(c) }
        model.commit_operation
      rescue StandardError
        begin
          aplicar(g, para)
        rescue StandardError
          nil
        end
      end

      class Ferramenta
        COR = Sketchup::Color.new(168, 138, 128)

        def activate
          Sketchup.status_text = 'planê.mob: clique numa porta, gaveta ou aramado para abrir/fechar. Esc para sair.'
          @alvo = nil
          @tr = nil
        end

        def deactivate(view)
          @alvo = nil
          view.invalidate
        end

        def resume(view)
          view.invalidate
        end

        def onCancel(_reason, _view)
          Sketchup.active_model.select_tool(nil)
        end

        # devolve [conjunto, transformação do pai até o mundo]
        def achar(view, x, y)
          ph = view.pick_helper
          ph.do_pick(x, y)
          ph.count.times do |i|
            caminho = ph.path_at(i) || []
            idx = caminho.rindex { |e| AbrirFechar.movel?(e) && !AbrirFechar.segue?(e) }
            next unless idx
            tr = Geom::Transformation.new
            caminho[0...idx].each { |e| tr *= e.transformation if e.respond_to?(:transformation) }
            return [caminho[idx], tr]
          end
          [nil, nil]
        end

        def onMouseMove(_flags, x, y, view)
          alvo, tr = achar(view, x, y)
          if alvo != @alvo
            @alvo = alvo
            @tr = tr
            view.tooltip = @alvo ? "#{@alvo.name} · clique para #{AbrirFechar.aberto?(@alvo) ? 'fechar' : 'abrir'}" : ''
          else
            @tr = tr if tr
          end
          view.invalidate
        end

        def onLButtonDown(_flags, x, y, view)
          alvo, = achar(view, x, y)
          AbrirFechar.alternar(alvo, view) if alvo
        end

        def contorno
          return [] unless @alvo && @alvo.valid? && @tr
          bb = @alvo.bounds # no sistema do pai
          return [] if bb.empty?
          cantos = (0..7).map { |i| bb.corner(i).transform(@tr) }
          arestas = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
          arestas.flat_map { |a, b| [cantos[a], cantos[b]] }
        end

        def draw(view)
          pts = contorno
          return if pts.empty?
          view.line_width = 2
          view.line_stipple = ''
          view.drawing_color = COR
          view.draw(GL_LINES, pts)
        end

        # área do desenho: sem isto o SketchUp corta o contorno ao dar zoom
        def getExtents
          bb = Geom::BoundingBox.new
          contorno.each { |p| bb.add(p) }
          bb
        end
      end
    end
  end
end
