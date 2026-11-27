# marcê — leitura do volume selecionado e detecção da cuba
#
# O volume é a "caixa" que a pessoa modela onde o móvel vai ficar.
# Daqui saem: comprimento (L), profundidade (D), altura (H) e a âncora
# (origem no canto frontal-esquerdo-inferior, x para a direita, y para o
# fundo, z para cima). A frente é o lado comprido voltado para a câmera.
module ArqLais
  module Marce
    module Volume
      PADRAO_CUBA = /cuba|pia|sink|tanque|lavat[oó]rio|basin|cuve|bacia/i.freeze

      module_function

      # Só confere se a seleção parece um volume (não mexe em nada; usado no botão direito)
      def provavel?(model)
        sel = model.selection.to_a
        return false if sel.empty?
        return false if sel.any? { |e| e.respond_to?(:get_attribute) && e.get_attribute(DICT, 'spec') }
        sel.any? { |e| e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance) || e.is_a?(Sketchup::Face) }
      end

      # Retorna hash { L:, D:, H:, origem:, xaxis:, yaxis:, entidade:, elevacao: } (mm) ou nil.
      # Se o volume estiver dentro de um grupo aberto em edição, fecha a edição antes
      # (o móvel é criado no nível do modelo, com a posição real no mundo).
      def ler(model)
        sel = model.selection.to_a
        return nil if sel.empty?
        cadeia = Geom::Transformation.new
        if model.active_path && !model.active_path.empty?
          cadeia = model.edit_transform
          guarda = 0
          while model.active_path && !model.active_path.empty? && guarda < 20
            model.close_active
            guarda += 1
          end
        end
        sel = sel.select { |e| e.valid? }
        return nil if sel.empty?
        # um único grupo/componente que não seja um móvel do marcê
        if sel.length == 1 && (sel[0].is_a?(Sketchup::Group) || sel[0].is_a?(Sketchup::ComponentInstance))
          e = sel[0]
          return nil if e.get_attribute(DICT, 'spec')
          bb = Util.definicao_de(e).bounds
          return nil if bb.empty?
          t = cadeia * e.transformation
          o = bb.min.transform(t)
          px = Geom::Point3d.new(bb.max.x, bb.min.y, bb.min.z).transform(t)
          py = Geom::Point3d.new(bb.min.x, bb.max.y, bb.min.z).transform(t)
          pz = Geom::Point3d.new(bb.min.x, bb.min.y, bb.max.z).transform(t)
          a = o.vector_to(px)
          b = o.vector_to(py)
          c = o.vector_to(pz)
          if c.valid? && c.normalize.z > 0.95 && a.valid? && b.valid?
            return montar(model, o, a, b, c, e)
          end
        end
        # geometria solta (faces/arestas): caixa alinhada aos eixos do contexto
        return nil if sel.any? { |x| x.respond_to?(:get_attribute) && x.get_attribute(DICT, 'spec') }
        bb = Geom::BoundingBox.new
        sel.each { |x| bb.add(x.bounds) if x.respond_to?(:bounds) }
        return nil if bb.empty? || bb.width < 1.mm || bb.height < 1.mm || bb.depth < 1.mm
        o = bb.min.transform(cadeia)
        a = Geom::Vector3d.new(bb.width, 0, 0).transform(cadeia)
        b = Geom::Vector3d.new(0, bb.height, 0).transform(cadeia)
        c = Geom::Vector3d.new(0, 0, bb.depth).transform(cadeia)
        montar(model, o, a, b, c, nil)
      end

      def montar(model, o, a, b, c, entidade)
        # comprimento = maior lado horizontal
        if b.length > a.length
          a, b = b, a
        end
        u = a.clone.normalize
        v = b.clone.normalize
        centro = o.offset(a, a.length / 2).offset(b, b.length / 2).offset(c, c.length / 2)
        olho = model.active_view.camera.eye
        frente_em_mais_v = centro.vector_to(olho).dot(v) > 0
        origem = frente_em_mais_v ? o.offset(b) : o.clone
        yaxis = frente_em_mais_v ? v.reverse : v.clone
        xaxis = u.clone
        if (xaxis * yaxis).z < 0
          xaxis = u.reverse
          origem = origem.offset(a)
        end
        {
          L: Util.para_mm(a.length), D: Util.para_mm(b.length), H: Util.para_mm(c.length),
          origem: origem, xaxis: xaxis, yaxis: yaxis,
          elevacao: Util.para_mm(origem.z), entidade: entidade
        }
      end

      def transformacao(ancora)
        z = ancora[:xaxis] * ancora[:yaxis]
        Geom::Transformation.axes(ancora[:origem], ancora[:xaxis], ancora[:yaxis], z)
      end

      # Sugere o tipo de móvel pelas proporções do volume
      def tipo_sugerido(v)
        return 'aereo' if v[:elevacao] > 1000
        if v[:H] >= 1800
          return 'torre' if v[:L] <= 900
          return v[:D] >= 520 ? 'roupeiro' : 'estante'
        end
        return 'estante' if v[:D] <= 400 && v[:H] >= 1200
        return 'gabinete' if v[:H] <= 650 && v[:elevacao] >= 150
        'balcao'
      end

      # Procura uma cuba/pia sobre o volume. t = transformação do móvel (local -> mundo)
      def detectar_cuba(model, t, l_mm, d_mm, h_mm)
        inv = t.inverse
        melhor = nil
        visitar = lambda do |ents, tr, nivel|
          ents.each do |e|
            next unless e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
            next if e.get_attribute(DICT, 'spec')
            next if e.hidden?
            tw = tr * e.transformation
            defi = Util.definicao_de(e)
            nome = "#{e.name} #{defi.name}"
            if nome =~ PADRAO_CUBA
              bb = defi.bounds
              xs = []
              ys = []
              zs = []
              8.times do |i|
                p = bb.corner(i).transform(tw).transform(inv)
                xs << Util.para_mm(p.x)
                ys << Util.para_mm(p.y)
                zs << Util.para_mm(p.z)
              end
              x0, x1 = xs.minmax
              y0, y1 = ys.minmax
              z0, z1 = zs.minmax
              sobre = x1 > 0 && x0 < l_mm && y1 > -150 && y0 < d_mm + 150 && z1 > h_mm - 400 && z0 < h_mm + 400
              if sobre
                cand = { 'centro' => ((x0 + x1) / 2).round, 'largura' => (x1 - x0).round, 'profundidade' => (y1 - y0).round }
                melhor = cand if melhor.nil? || cand['largura'] > melhor['largura']
              end
            elsif nivel < 4
              visitar.call(Util.entidades_de(e), tw, nivel + 1)
            end
          end
        end
        visitar.call(model.entities, Geom::Transformation.new, 0)
        if melhor
          melhor['centro'] = [[melhor['centro'], 0].max, l_mm].min.round
          melhor['largura'] = [[melhor['largura'], 200].max, 1200].min
          melhor['profundidade'] = [[melhor['profundidade'], 250].max, d_mm - 60].min.round
        end
        melhor
      end
    end
  end
end
