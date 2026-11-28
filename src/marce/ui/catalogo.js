/*
 * planê.mob — catálogo de padrões de MDF por marca.
 * As cores são APROXIMADAS (servem para a prévia e para tingir a textura
 * no SketchUp). Confira sempre o mostruário físico do fornecedor.
 * Você pode adicionar padrões próprios pela janela (aba Acabamento).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarceCatalogo = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function m(marca, nome, cor, veio) {
    return { id: (marca + '-' + nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'), marca: marca, nome: nome, cor: cor, veio: !!veio };
  }
  var LISTA = [
    // Arauco
    m('Arauco', 'Branco', '#f3f2ee'), m('Arauco', 'Preto', '#262626'), m('Arauco', 'Grafite', '#4a4b4d'),
    m('Arauco', 'Carvalho', '#b8946a', 1), m('Arauco', 'Canelato', '#8a5f3c', 1), m('Arauco', 'Carvalho Dakar', '#3f3631', 1),
    m('Arauco', 'Authentic', '#b9a88e'), m('Arauco', 'Azul', '#233a5e'), m('Arauco', 'Baltic', '#b7b7ad'),
    m('Arauco', 'Freijó', '#a7804f', 1), m('Arauco', 'Nogueira', '#6e4b33', 1), m('Arauco', 'Cinza Cristal', '#bdbdb8'),
    // Duratex
    m('Duratex', 'Branco Diamante', '#f5f5f2'), m('Duratex', 'Carvalho Hanover', '#a98a66', 1), m('Duratex', 'Freijó Puro', '#b48a58', 1),
    m('Duratex', 'Louro Freijó', '#9c7246', 1), m('Duratex', 'Nogueira Cadiz', '#5f4130', 1), m('Duratex', 'Gianduia', '#7a5b45'),
    m('Duratex', 'Cinza Cristal', '#c1c1bc'), m('Duratex', 'Grafite', '#46484b'), m('Duratex', 'Preto', '#232323'),
    m('Duratex', 'Areia', '#cdbb9d'), m('Duratex', 'Carvalho Malva', '#8b6c4a', 1), m('Duratex', 'Itapuã', '#c09a6c', 1),
    // Berneck
    m('Berneck', 'Branco Ártico', '#f4f4f1'), m('Berneck', 'Freijó Dourado', '#b98d55', 1), m('Berneck', 'Nogueira Boreal', '#6b4c37', 1),
    m('Berneck', 'Carvalho Avelã', '#a3815e', 1), m('Berneck', 'Cinza Sagrado', '#9d9b96'), m('Berneck', 'Grafite', '#4b4c4f'),
    m('Berneck', 'Ébano', '#2d2622', 1), m('Berneck', 'Terracota', '#a65a3e'),
    // Guararapes
    m('Guararapes', 'Branco', '#f3f3ef'), m('Guararapes', 'Cedro', '#9a6844', 1), m('Guararapes', 'Carvalho Nórdico', '#c7a986', 1),
    m('Guararapes', 'Freijó', '#ae8456', 1), m('Guararapes', 'Cinza Urbano', '#8f8f8c'), m('Guararapes', 'Preto', '#252525'),
    m('Guararapes', 'Verde Oliva', '#6b6b4a'),
    // Genéricos
    m('Genérico', 'Branco TX', '#f2f1ec'), m('Genérico', 'HDF Branco', '#ecebe6'), m('Genérico', 'Laca Branca', '#fbfaf7'),
    m('Genérico', 'Off-white', '#ece6da'), m('Genérico', 'Bordô', '#6d1f2e'), m('Genérico', 'Rosa Seco', '#c9a19a'),
    m('Genérico', 'Verde Floresta', '#2f4a3a'), m('Genérico', 'Azul Marinho', '#1f2c45'), m('Genérico', 'Amarelo Mostarda', '#c79a2b'),
    m('Genérico', 'Lâmina Natural Carvalho', '#c2a079', 1), m('Genérico', 'Lâmina Natural Nogueira', '#6a4a35', 1)
  ];
  var MARCAS = ['Arauco', 'Berneck', 'Duratex', 'Guararapes', 'Genérico'];
  return { LISTA: LISTA, MARCAS: MARCAS };
});
