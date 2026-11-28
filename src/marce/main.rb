# planê.mob — menus, barra de ferramentas e menu de contexto
require 'sketchup.rb'
require 'json'

module ArqLais
  module Marce
    PASTA_UI = File.join(PASTA, 'ui').freeze unless const_defined?(:PASTA_UI, false)
    PASTA_ICONES = File.join(PASTA, 'icons').freeze unless const_defined?(:PASTA_ICONES, false)
    DICT = 'marce'.freeze unless const_defined?(:DICT, false)

    require File.join(PASTA, 'util')
    require File.join(PASTA, 'materiais')
    require File.join(PASTA, 'volume')
    require File.join(PASTA, 'biblioteca')
    require File.join(PASTA, 'construtor')
    require File.join(PASTA, 'abrir_fechar')
    require File.join(PASTA, 'exportar')
    require File.join(PASTA, 'atualizar')
    require File.join(PASTA, 'aviso')
    require File.join(PASTA, 'dialogo')
    require File.join(PASTA, 'autoteste')

    # ------------------------------------------------------------ comandos
    def self.cmd_novo
      Dialogo.abrir_novo(Sketchup.active_model)
    end

    def self.cmd_editar
      grupo = Util.movel_selecionado(Sketchup.active_model)
      if grupo
        Dialogo.abrir_edicao(grupo)
      else
        UI.messagebox('Selecione um móvel gerado pela planê.mob para editar.')
      end
    end

    def self.cmd_relatorio
      grupo = Util.movel_selecionado(Sketchup.active_model)
      if grupo
        Dialogo.abrir_edicao(grupo, relatorio: true)
      else
        UI.messagebox('Selecione um móvel gerado pela planê.mob para gerar o relatório.')
      end
    end

    def self.cmd_atualizar_prancha
      model = Sketchup.active_model
      grupo = Util.movel_selecionado(model)
      return UI.messagebox('Selecione um móvel gerado pela planê.mob.') unless grupo
      if Exportar.atualizar_prancha(model, grupo)
        Sketchup.status_text = 'planê.mob: prancha atualizada (a página aberta no navegador se redesenha sozinha)'
      else
        UI.messagebox('Este móvel ainda não tem prancha salva. Gere o relatório uma vez para ligar a prancha ao móvel; depois ela acompanha as mudanças.')
      end
    end

    def self.cmd_abrir_fechar
      Sketchup.active_model.select_tool(AbrirFechar::Ferramenta.new)
    end

    def self.cmd_tudo(abrir)
      grupo = Util.movel_selecionado(Sketchup.active_model)
      if grupo
        AbrirFechar.todos(grupo, abrir)
      else
        UI.messagebox('Selecione um móvel gerado pela planê.mob.')
      end
    end

    def self.cmd_lista_projeto
      Exportar.lista_do_projeto(Sketchup.active_model)
    end

    def self.cmd_sobre
      UI.messagebox("planê.mob #{VERSAO}\nmarcenaria paramétrica para SketchUp\n\n" \
                    "1. Modele um volume (caixa) onde vai o móvel e selecione.\n" \
                    "2. Extensões → planê.mob → Novo móvel.\n" \
                    "3. Configure e clique em Gerar armário.\n\n" \
                    "Selecione o móvel e use Editar para alterar depois.\n\n" \
                    'Para atualizar: botão "Atualizar planê.mob" (barra ou menu).')
    end

    def self.icone(nome)
      svg = File.join(PASTA_ICONES, "#{nome}.svg")
      png = File.join(PASTA_ICONES, "#{nome}.png")
      File.exist?(svg) ? svg : png
    end

    def self.comando(texto, dica, icone_nome, &bloco)
      c = UI::Command.new(texto, &bloco)
      c.tooltip = texto
      c.status_bar_text = dica
      if icone_nome
        c.small_icon = icone(icone_nome)
        c.large_icon = icone(icone_nome)
      end
      c
    end

    unless file_loaded?(__FILE__) || @menus_criados
      @menus_criados = true
      c_novo = comando('Novo móvel', 'Cria um móvel a partir do volume selecionado', 'novo') { cmd_novo }
      c_editar = comando('Editar móvel', 'Abre o móvel selecionado para editar', 'editar') { cmd_editar }
      c_abrir = comando('Abrir/fechar portas e gavetas', 'Clique numa porta, gaveta ou aramado para abrir/fechar', 'abrir') { cmd_abrir_fechar }
      c_rel = comando('Relatório executivo', 'Gera o relatório executivo do móvel selecionado', 'relatorio') { cmd_relatorio }
      c_abrir_tudo = comando('Abrir tudo', 'Abre todas as portas e gavetas do móvel selecionado', nil) { cmd_tudo(true) }
      c_fechar_tudo = comando('Fechar tudo', 'Fecha todas as portas e gavetas do móvel selecionado', nil) { cmd_tudo(false) }
      c_atualizar = comando('Atualizar planê.mob', 'Procura a versão nova no GitHub e instala sem reinstalar', 'atualizar') { Atualizar.botao }
      c_lista = comando('Lista de peças do projeto (CSV)', 'Soma as peças de todos os móveis da planê.mob no modelo', nil) { cmd_lista_projeto }

      menu = UI.menu('Extensions').add_submenu('planê.mob')
      menu.add_item(c_novo)
      menu.add_item(c_editar)
      menu.add_separator
      menu.add_item(c_abrir)
      menu.add_item(c_abrir_tudo)
      menu.add_item(c_fechar_tudo)
      menu.add_separator
      menu.add_item(c_rel)
      menu.add_item('Atualizar prancha do móvel') { cmd_atualizar_prancha }
      menu.add_item(c_lista)
      menu.add_separator
      menu.add_item('Autoteste (confere o plugin neste SketchUp)') { Autoteste.abrir }
      menu.add_item(c_atualizar)
      menu.add_item('Sobre a planê.mob') { cmd_sobre }

      tb = UI::Toolbar.new('planê.mob')
      tb.add_item(c_novo)
      tb.add_item(c_editar)
      tb.add_item(c_abrir)
      tb.add_item(c_rel)
      tb.add_separator
      tb.add_item(c_atualizar)
      tb.restore

      # a busca de atualização acontece só quando a janela da planê.mob abre (nada ao abrir o SketchUp)

      UI.add_context_menu_handler do |ctx|
        model = Sketchup.active_model
        grupo = Util.movel_selecionado(model)
        if grupo
          sub = ctx.add_submenu('planê.mob')
          sub.add_item(c_editar)
          sub.add_item(c_abrir_tudo)
          sub.add_item(c_fechar_tudo)
          sub.add_item(c_rel)
        elsif Volume.provavel?(model)
          ctx.add_submenu('planê.mob').add_item('Criar móvel neste volume') { cmd_novo }
        end
      end

      file_loaded(__FILE__)
    end
  end
end
