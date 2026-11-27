# marcê — abrir/fechar portas, basculantes, gavetas e aramados (com animação)
module ArqLais
  module Marce
    module AbrirFechar
      PASSOS = 14

      module_function

      def movel?(e)
        e.is_a?(Sketchup::Group) && e.get_attribute(DICT, 'mov_tipo')
      end

      # transformação de abertura (fração 0..1) no sistema do pai
      def movimento(g, fracao)
        tipo = g.get_attribute(DICT, 'mov_tipo')
        if tipo == 'giro'
          pv = g.get_attribute(DICT, 'mov_pivot') || [0, 0, 0]
          eixo = g.get_attribute(DICT, 'mov_eixo') == 'x' ? Geom::Vector3d.new(1, 0, 0) : Geom::Vector3d.new(0, 0, 1)
          ang = g.get_attribute(DICT, 'mov_angulo').to_f * fracao
          Geom::Transformation.rotation(Geom::Point3d.new(Util.mm(pv[0]), Util.mm(pv[1]), Util.mm(pv[2])), eixo, ang.degrees)
        else
          curso = g.get_attribute(DICT, 'mov_curso').to_f * fracao
          Geom::Transformation.translation(Geom::Vector3d.new(0, -Util.mm(curso), 0))
        end
      end

      def base(g)
        arr = g.get_attribute(DICT, 'base')
        return Geom::Transformation.new(arr) if arr.is_a?(Array) && arr.length == 16
        b = g.transformation # gravada na primeira vez, com o conjunto fechado
        g.set_attribute(DICT, 'base', b.to_a)
        b
      end

      def aplicar(g, fracao)
        g.move!(movimento(g, fracao) * base(g))
      end

      def alternar(g, view = nil)
        aberto = g.get_attribute(DICT, 'aberto') ? true : false
        base(g)
        de = aberto ? 1.0 : 0.0
        para = aberto ? 0.0 : 1.0
        passo = 0
        id = nil
        id = UI.start_timer(0.016, true) do
          passo += 1
          f = de + (para - de) * suavizar(passo.to_f / PASSOS)
          if g.valid?
            aplicar(g, f)
            (view || Sketchup.active_model.active_view).invalidate
          end
          if passo >= PASSOS || !g.valid?
            UI.stop_timer(id)
            g.set_attribute(DICT, 'aberto', !aberto) if g.valid?
          end
        end
      end

      def suavizar(t)
        t = [[t, 0.0].max, 1.0].min
        t * t * (3 - 2 * t)
      end

      # abre/fecha todos os conjuntos de um móvel (sem animação)
      def todos(movel, abrir)
        lista = []
        visitar = lambda do |ents|
          ents.each do |e|
            next unless e.is_a?(Sketchup::Group)
            lista << e if movel?(e)
            visitar.call(e.entities)
          end
        end
        visitar.call(Util.entidades_de(movel))
        lista.each do |g|
          base(g)
          aplicar(g, abrir ? 1.0 : 0.0)
          g.set_attribute(DICT, 'aberto', abrir)
        end
        Sketchup.active_model.active_view.invalidate
      end

      class Ferramenta
        def activate
          Sketchup.status_text = 'marcê: clique numa porta, gaveta ou aramado para abrir/fechar. Esc para sair.'
          @alvo = nil
        end

        def deactivate(view)
          view.invalidate
        end

        def onCancel(_reason, _view)
          Sketchup.active_model.select_tool(nil)
        end

        def achar(view, x, y)
          ph = view.pick_helper
          ph.do_pick(x, y)
          ph.count.times do |i|
            caminho = ph.path_at(i) || []
            achado = caminho.reverse.find { |e| AbrirFechar.movel?(e) }
            return achado if achado
          end
          nil
        end

        def onMouseMove(_flags, x, y, view)
          novo = achar(view, x, y)
          return if novo == @alvo
          @alvo = novo
          view.tooltip = @alvo ? @alvo.name.to_s : ''
          view.invalidate
        end

        def onLButtonDown(_flags, x, y, view)
          g = achar(view, x, y)
          AbrirFechar.alternar(g, view) if g
        end

        def draw(view)
          return unless @alvo && @alvo.valid?
          bb = @alvo.bounds
          return if bb.empty?
          # contorno do conjunto sob o cursor (em coordenadas do pai)
          tr = caminho_transformacao(view)
          pts = [0, 1, 3, 2, 0, 4, 5, 7, 6, 4].map { |i| bb.corner(i).transform(tr) }
          view.line_width = 2
          view.drawing_color = Sketchup::Color.new(168, 138, 128)
          view.draw(GL_LINE_STRIP, pts)
        end

        def caminho_transformacao(view)
          ph = view.pick_helper
          tr = Geom::Transformation.new
          (ph.path_at(0) || []).each do |e|
            break if e == @alvo
            tr *= e.transformation if e.respond_to?(:transformation)
          end
          tr
        rescue StandardError
          Geom::Transformation.new
        end
      end
    end
  end
end
