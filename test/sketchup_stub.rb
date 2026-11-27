# Simulação mínima da API do SketchUp para testar o marcê fora do SketchUp.
# Não é completa: cobre só o que o plugin usa.
require 'json'

class Numeric
  def mm; self / 25.4; end
  def to_mm; self * 25.4; end
  def degrees; self * Math::PI / 180.0; end
end

$loaded = {}
def file_loaded?(f); $loaded[f]; end
def file_loaded(f); $loaded[f] = true; end

module Geom
  class Vector3d
    attr_accessor :x, :y, :z
    def initialize(x = 0, y = 0, z = 0); @x, @y, @z = x.to_f, y.to_f, z.to_f; end
    def length; Math.sqrt(x * x + y * y + z * z); end
    def valid?; length > 1e-9; end
    def normalize; l = length; Vector3d.new(x / l, y / l, z / l); end
    def reverse; Vector3d.new(-x, -y, -z); end
    def clone; Vector3d.new(x, y, z); end
    def dot(o); x * o.x + y * o.y + z * o.z; end
    alias % dot
    def *(o); Vector3d.new(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x); end
    def to_a; [x, y, z]; end
  end

  class Point3d
    attr_accessor :x, :y, :z
    def initialize(x = 0, y = 0, z = 0)
      x, y, z = x if x.is_a?(Array)
      @x, @y, @z = x.to_f, y.to_f, z.to_f
    end
    def offset(v, len = nil)
      v = v.normalize.tap { |n| n.x *= len; n.y *= len; n.z *= len } if len
      Point3d.new(x + v.x, y + v.y, z + v.z)
    end
    def vector_to(o); Vector3d.new(o.x - x, o.y - y, o.z - z); end
    def distance(o); vector_to(o).length; end
    def clone; Point3d.new(x, y, z); end
    def transform(t); t.aplicar(self); end
    def to_a; [x, y, z]; end
  end

  class Transformation
    attr_reader :m # 4x4 linha-maior
    def initialize(arg = nil)
      @m = if arg.is_a?(Array) && arg.length == 16 then arg.each_slice(4).to_a.transpose
           else [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]] end
      @m = @m.map { |r| r.map(&:to_f) }
    end
    def self.de(m); t = new; t.instance_variable_set(:@m, m); t; end
    def self.translation(v)
      v = Vector3d.new(*v) if v.is_a?(Array)
      de([[1, 0, 0, v.x], [0, 1, 0, v.y], [0, 0, 1, v.z], [0, 0, 0, 1]])
    end
    def self.axes(o, x, y, z)
      de([[x.x, y.x, z.x, o.x], [x.y, y.y, z.y, o.y], [x.z, y.z, z.z, o.z], [0, 0, 0, 1]])
    end
    def self.rotation(p, eixo, ang)
      a = eixo.normalize; c = Math.cos(ang); s = Math.sin(ang); t = 1 - c
      r = [[t * a.x * a.x + c, t * a.x * a.y - s * a.z, t * a.x * a.z + s * a.y],
           [t * a.x * a.y + s * a.z, t * a.y * a.y + c, t * a.y * a.z - s * a.x],
           [t * a.x * a.z - s * a.y, t * a.y * a.z + s * a.x, t * a.z * a.z + c]]
      rot = de([r[0] + [0], r[1] + [0], r[2] + [0], [0, 0, 0, 1]])
      translation([p.x, p.y, p.z]) * rot * translation([-p.x, -p.y, -p.z])
    end
    def *(o)
      Transformation.de((0..3).map { |i| (0..3).map { |j| (0..3).sum { |k| @m[i][k] * o.m[k][j] } } })
    end
    def aplicar(p)
      Point3d.new(@m[0][0] * p.x + @m[0][1] * p.y + @m[0][2] * p.z + @m[0][3],
                  @m[1][0] * p.x + @m[1][1] * p.y + @m[1][2] * p.z + @m[1][3],
                  @m[2][0] * p.x + @m[2][1] * p.y + @m[2][2] * p.z + @m[2][3])
    end
    def inverse
      r = (0..2).map { |i| (0..2).map { |j| @m[j][i] } } # supõe rotação pura
      t = (0..2).map { |i| -(0..2).sum { |k| r[i][k] * @m[k][3] } }
      Transformation.de([r[0] + [t[0]], r[1] + [t[1]], r[2] + [t[2]], [0, 0, 0, 1]])
    end
    def xaxis; Vector3d.new(@m[0][0], @m[1][0], @m[2][0]); end
    def yaxis; Vector3d.new(@m[0][1], @m[1][1], @m[2][1]); end
    def origin; Point3d.new(@m[0][3], @m[1][3], @m[2][3]); end
    def to_a; @m.transpose.flatten; end
  end

  class BoundingBox
    attr_reader :min, :max
    def initialize; @min = nil; @max = nil; end
    def add(*ps)
      ps.flatten.each do |p|
        if p.is_a?(BoundingBox)
          next if p.empty?
          add(p.min, p.max); next
        end
        @min = @min ? Point3d.new([@min.x, p.x].min, [@min.y, p.y].min, [@min.z, p.z].min) : p.clone
        @max = @max ? Point3d.new([@max.x, p.x].max, [@max.y, p.y].max, [@max.z, p.z].max) : p.clone
      end
      self
    end
    def empty?; @min.nil?; end
    def width; @max.x - @min.x; end
    def height; @max.y - @min.y; end
    def depth; @max.z - @min.z; end
    def center; Point3d.new((@min.x + @max.x) / 2, (@min.y + @max.y) / 2, (@min.z + @max.z) / 2); end
    def diagonal; @min.distance(@max); end
    def corner(i)
      Point3d.new(i & 1 == 0 ? @min.x : @max.x, i & 2 == 0 ? @min.y : @max.y, i & 4 == 0 ? @min.z : @max.z)
    end
  end
end

module Sketchup
  class Color; def initialize(*a); @a = a; end; end
  class Material
    COLORIZE_TINT = 1
    attr_accessor :name, :color, :alpha, :colorize_type
    attr_reader :texture
    def initialize(n); @name = n; end
    def texture=(f); @texture = f ? Struct.new(:file, :size).new(f, 1) : nil; end
  end
  class Materials
    def initialize; @h = {}; end
    def [](n); @h[n]; end
    def add(n); @h[n] = Material.new(n); end
    def length; @h.length; end
  end
  class Layer
    attr_accessor :name, :visible
    def initialize(n); @name = n; @visible = true; end
    def visible?; @visible; end
    def valid?; true; end
  end
  class Layers
    def initialize; @h = {}; end
    def [](n); @h[n]; end
    def add(n); @h[n] = Layer.new(n); end
    def length; @h.length; end
  end

  module Atributos
    def set_attribute(d, k, v); (@attr ||= {})[[d, k]] = v; end
    def get_attribute(d, k, padrao = nil); (@attr ||= {}).fetch([d, k], padrao); end
  end

  class Face
    attr_reader :normal, :pts
    def initialize(pts, ents)
      @pts = pts; @ents = ents
      a = pts[0].vector_to(pts[1]); b = pts[0].vector_to(pts[2])
      n = a * b
      @normal = n.valid? ? n.normalize : Geom::Vector3d.new(0, 0, 1)
      @normal = @normal.reverse if @normal.z < -0.99 # comportamento do SketchUp no plano z=0
    end
    def reverse!; @normal = @normal.reverse; self; end
    def pushpull(d)
      raise 'pushpull invertido' if d <= 0
      @ents.extrusoes << [@pts, @normal, d]
      @pts.each { |p| @ents.bb.add(p) }
      @pts.each { |p| @ents.bb.add(p.offset(@normal, d)) }
    end
  end

  class Entities
    include Enumerable
    attr_reader :itens, :extrusoes, :bb, :parent
    def initialize(parent = nil); @itens = []; @extrusoes = []; @bb = Geom::BoundingBox.new; @parent = parent; end
    def each(&b); @itens.each(&b); end
    def add_group; g = Group.new; @itens << g; g; end
    def add_instance(d, t); i = ComponentInstance.new(d, t); @itens << i; i; end
    def add_face(pts)
      raise 'face com pontos repetidos' if pts.uniq { |p| p.to_a.map { |v| v.round(6) } }.length != pts.length
      Face.new(pts, self)
    end
    def clear!; @itens.clear; @extrusoes.clear; end
    def length; @itens.length; end
  end

  class ComponentDefinition
    include Atributos
    attr_accessor :name
    attr_reader :entities
    attr_accessor :removida
    def initialize(n); @name = n; @entities = Entities.new(self); end
    def bounds; @entities.bb; end
    def valid?; !@removida; end
    def instances
      out = []
      busca = lambda { |ents| ents.each { |e| out << e if e.is_a?(ComponentInstance) && e.definition == self; busca.call(e.entities) if e.is_a?(Group) } }
      busca.call(Sketchup.active_model.entities)
      out
    end
  end
  class DefinitionList
    attr_reader :lista
    def initialize; @lista = []; end
    def add(n); d = ComponentDefinition.new(n); @lista << d; d; end
    def length; @lista.length; end
    def remove(d); @lista.delete(d); d.removida = true; true; end
  end

  class Drawingelement
    include Atributos
    attr_accessor :name, :material, :layer, :hidden, :transformation
    def hidden?; @hidden; end
    def valid?; true; end
    def move!(t); @transformation = t; end
    def persistent_id; object_id; end
    def entityID; object_id; end
  end
  class Group < Drawingelement
    attr_reader :entities
    def initialize; @entities = Entities.new(self); @transformation = Geom::Transformation.new; end
    def definition; @entities.parent; end
    def make_unique; self; end
    def bounds; Geom::BoundingBox.new.add(Geom::Point3d.new(0, 0, 0), Geom::Point3d.new(1, 1, 1)); end
  end
  class ComponentInstance < Drawingelement
    attr_reader :definition
    def initialize(d, t); @definition = d; @transformation = t; end
    def bounds
      bb = Geom::BoundingBox.new
      8.times { |i| bb.add(@definition.bounds.corner(i).transform(@transformation)) } unless @definition.bounds.empty?
      bb
    end
  end

  class Selection < Array; end
  Camera = Struct.new(:eye, :target, :up)
  class View
    attr_accessor :camera
    def initialize; @camera = Camera.new(Geom::Point3d.new(1000, -5000, 2000), Geom::Point3d.new(0, 0, 0), Geom::Vector3d.new(0, 0, 1)); end
    def invalidate; end
  end
  class Model
    attr_reader :entities, :definitions, :materials, :layers, :selection, :active_view, :ops
    def initialize
      @entities = Entities.new; @definitions = DefinitionList.new; @materials = Materials.new; @layers = Layers.new
      @selection = Selection.new; @active_view = View.new; @ops = []
    end
    attr_accessor :active_path, :edit_transform_teste
    def active_entities; @entities; end
    def edit_transform; @edit_transform_teste || Geom::Transformation.new; end
    def close_active; @active_path = nil; true; end
    def start_operation(n, *_); @ops << [:start, n]; end
    def commit_operation; @ops << [:commit]; end
    def abort_operation; @ops << [:abort]; end
    def path; ''; end
  end

  @model = Model.new
  def self.active_model; @model; end
  def self.reset!; @model = Model.new; end
  def self.temp_dir; Dir.tmpdir; end
  @defaults = {}
  def self.write_default(s, k, v); @defaults[[s, k]] = v; end
  def self.read_default(s, k, d = nil); @defaults.fetch([s, k], d); end
  @instalados = []
  def self.instalados; @instalados; end
  def self.install_from_archive(arq, _d = false); @instalados << [arq, File.size(arq)]; true; end
  def self.status_text=(t); end
end
require 'tmpdir'

module UI
  def self.start_timer(_s, _r, &b)
    @parar = false
    100.times { break if @parar; b.call }
    1
  end
  def self.stop_timer(_id); @parar = true; end
  def self.messagebox(m); puts "[messagebox] #{m}"; end
end
