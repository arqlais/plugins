/*
 * planê.mob — ilustrações técnicas das opções (traço, sem emojis).
 * Cada desenho é um SVG 64×48 em linha, usando currentColor e o rosé de destaque.
 * Usadas nos cartões de opção, na ajuda "?" e nos ícones de status.
 */
(function (root) {
  'use strict';
  var R = '#d6b3ab';   // rosé (destaque)
  var C = 'currentColor';
  function svg(inner) { return '<svg class="ilus" viewBox="0 0 64 48" fill="none" stroke="' + C + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
  function piso(y) { return '<path d="M4 ' + (y || 44) + 'H60" stroke-width="1"/><path d="M6 ' + ((y || 44) + 2) + 'l3-2M14 ' + ((y || 44) + 2) + 'l3-2M22 ' + ((y || 44) + 2) + 'l3-2M30 ' + ((y || 44) + 2) + 'l3-2M38 ' + ((y || 44) + 2) + 'l3-2M46 ' + ((y || 44) + 2) + 'l3-2M54 ' + ((y || 44) + 2) + 'l3-2" stroke-width=".8"/>'; }
  function parede() { return '<path d="M58 4V44" stroke-width="1"/><path d="M58 8l3-3M58 16l3-3M58 24l3-3M58 32l3-3M58 40l3-3" stroke-width=".8"/>'; }

  var I = {
    // --- base (vista lateral: frente à esquerda, parede à direita)
    base_rodape: svg(parede() + piso() + '<rect x="14" y="10" width="40" height="26"/><path d="M20 36V44M20 44H54" /><rect x="20" y="36" width="34" height="8" fill="' + R + '" fill-opacity=".35" stroke="' + R + '"/><path d="M14 40h4" stroke="' + R + '" stroke-dasharray="1.5 1.5"/>'),
    base_suspenso: svg(parede() + piso() + '<rect x="14" y="8" width="40" height="22"/><path d="M54 14h4M54 24h4" stroke="' + R + '" stroke-width="2.5"/><path d="M34 32v10M31 39l3 3 3-3" stroke-width="1"/>'),
    base_pes: svg(parede() + piso() + '<rect x="14" y="10" width="40" height="26"/><path d="M20 36v8M48 36v8" stroke="' + R + '" stroke-width="2.5"/><path d="M15 38h37" stroke-dasharray="2 2" stroke-width="1"/>'),
    base_nenhum: svg(parede() + piso() + '<rect x="14" y="10" width="40" height="34"/><path d="M14 36h40" stroke-dasharray="2 2" stroke="' + R + '"/>'),
    // --- topo (corte frontal)
    topo_travessas: svg('<rect x="8" y="10" width="48" height="4" fill="' + R + '" fill-opacity=".35" stroke="' + R + '"/><path d="M10 16V42M54 16V42M10 42H54"/><rect x="12" y="16" width="8" height="3"/><rect x="44" y="16" width="8" height="3"/><path d="M24 17.5h16" stroke-dasharray="2 2" stroke-width="1"/>'),
    topo_chapa: svg('<path d="M10 14V42M54 14V42M10 42H54"/><rect x="10" y="12" width="44" height="4" fill="' + R + '" fill-opacity=".35" stroke="' + R + '"/>'),
    // --- fundo (vista superior em corte: frente embaixo)
    fundo_sobreposto: svg('<path d="M12 8V40M52 8V40"/><rect x="12" y="6" width="40" height="2.5" fill="' + R + '" fill-opacity=".5" stroke="' + R + '"/><path d="M12 40H52" stroke-dasharray="3 2"/><text x="32" y="46" font-size="5" text-anchor="middle" fill="' + C + '" stroke="none">frente</text>'),
    fundo_encaixado: svg('<path d="M12 6V40M52 6V40"/><rect x="11" y="10" width="42" height="2.5" fill="' + R + '" fill-opacity=".5" stroke="' + R + '"/><path d="M12 40H52" stroke-dasharray="3 2"/><text x="32" y="46" font-size="5" text-anchor="middle" fill="' + C + '" stroke="none">frente</text>'),
    fundo_nenhum: svg('<path d="M12 6V40M52 6V40"/><path d="M14 8H50" stroke-dasharray="1.5 2.5" stroke="' + R + '"/><path d="M12 40H52" stroke-dasharray="3 2"/><text x="32" y="46" font-size="5" text-anchor="middle" fill="' + C + '" stroke="none">frente</text>'),
    // --- montagem das frentes (planta de um canto)
    mont_sobreposta: svg('<path d="M14 6V34"/><path d="M14 34h34" stroke-dasharray="3 2"/><rect x="10" y="34" width="40" height="4" fill="' + R + '" fill-opacity=".45" stroke="' + R + '"/><path d="M10 42h4M10 40v4M14 40v4" stroke-width=".8"/>'),
    mont_embutida: svg('<path d="M14 6V38"/><rect x="16" y="34" width="34" height="4" fill="' + R + '" fill-opacity=".45" stroke="' + R + '"/><path d="M14 38h2" stroke-width=".8"/>'),
    // --- divisórias (elevação com portas)
    div_cada: svg('<rect x="6" y="8" width="52" height="32"/><path d="M19 8V40M32 8V40M45 8V40" stroke="' + R + '" stroke-width="2"/><path d="M6 8l13 16-13 16M19 8l13 16-13 16M32 8l13 16-13 16M45 8l13 16-13 16" stroke-dasharray="1.5 2" stroke-width=".8"/>'),
    div_par: svg('<rect x="6" y="8" width="52" height="32"/><path d="M32 8V40" stroke="' + R + '" stroke-width="2"/><path d="M19 8V40M45 8V40" stroke-width=".8"/><path d="M6 8l13 16-13 16M32 8l-13 16 13 16M32 8l13 16-13 16M58 8l-13 16 13 16" stroke-dasharray="1.5 2" stroke-width=".8"/>'),
    div_nenhuma: svg('<rect x="6" y="8" width="52" height="32"/><path d="M19 8V40M32 8V40M45 8V40" stroke-width=".8"/><path d="M6 8l13 16-13 16M58 8l-13 16 13 16" stroke-dasharray="1.5 2" stroke-width=".8"/><path d="M30 20l4 8M34 20l-4 8" stroke="' + R + '" stroke-width="1.6"/>'),
    // --- corrediças (corte frontal da gaveta)
    corr_telescopica: svg('<path d="M8 8V42M56 8V42"/><rect x="14" y="18" width="36" height="18"/><rect x="9" y="24" width="4" height="6" fill="' + R + '" fill-opacity=".5" stroke="' + R + '"/><rect x="51" y="24" width="4" height="6" fill="' + R + '" fill-opacity=".5" stroke="' + R + '"/>'),
    corr_oculta: svg('<path d="M8 8V42M56 8V42"/><rect x="10" y="16" width="44" height="18"/><rect x="11" y="35" width="6" height="3" fill="' + R + '" fill-opacity=".5" stroke="' + R + '"/><rect x="47" y="35" width="6" height="3" fill="' + R + '" fill-opacity=".5" stroke="' + R + '"/>'),
    // --- tipo de porta (elevação)
    porta_lisa: svg('<rect x="20" y="4" width="24" height="40"/><path d="M39 22v4" stroke="' + R + '" stroke-width="2"/>'),
    porta_ripada: svg('<rect x="20" y="4" width="24" height="40"/><path d="M23.5 4v40M27 4v40M30.5 4v40M34 4v40M37.5 4v40M41 4v40" stroke="' + R + '" stroke-width="1.2"/>'),
    porta_moldura: svg('<rect x="20" y="4" width="24" height="40"/><rect x="24" y="8" width="16" height="32" stroke="' + R + '"/><path d="M20 4l4 4M44 4l-4 4M20 44l4-4M44 44l-4-4" stroke-width=".8"/>'),
    porta_palhinha: svg('<rect x="20" y="4" width="24" height="40"/><rect x="25" y="9" width="14" height="30" fill="' + R + '" fill-opacity=".18"/><path d="M25 13l14 0M25 17h14M25 21h14M25 25h14M25 29h14M25 33h14M27 9v30M31 9v30M35 9v30" stroke="' + R + '" stroke-width=".6"/><path d="M25 9l14 30M39 9L25 39" stroke="' + R + '" stroke-width=".5"/>'),
    porta_vidro: svg('<rect x="20" y="4" width="24" height="40" stroke-width="2"/><rect x="23" y="7" width="18" height="34" fill="' + R + '" fill-opacity=".2" stroke="none"/><path d="M26 7v34M29 7v34M32 7v34M35 7v34M38 7v34" stroke="' + R + '" stroke-width=".8"/>'),
    // --- LED (corte lateral do aéreo; frente à esquerda)
    led_frente: svg(parede() + '<rect x="12" y="8" width="44" height="24"/><rect x="16" y="32" width="6" height="2" fill="' + R + '" stroke="' + R + '"/><path d="M19 35l-6 9M19 35l6 9" stroke="' + R + '" stroke-dasharray="1.5 1.5" stroke-width="1"/>'),
    led_meio: svg(parede() + '<rect x="12" y="8" width="44" height="24"/><rect x="31" y="32" width="6" height="2" fill="' + R + '" stroke="' + R + '"/><path d="M34 35l-6 9M34 35l6 9" stroke="' + R + '" stroke-dasharray="1.5 1.5" stroke-width="1"/>'),
    led_fundo: svg(parede() + '<rect x="12" y="8" width="44" height="24"/><rect x="47" y="32" width="6" height="2" fill="' + R + '" stroke="' + R + '"/><path d="M50 35l-5 9M50 35l6 9" stroke="' + R + '" stroke-dasharray="1.5 1.5" stroke-width="1"/>'),
    led_embutido: svg('<path d="M8 20H56"/><path d="M8 28H26V24H38V28H56" /><rect x="27" y="24" width="10" height="3" fill="' + R + '" stroke="' + R + '"/><path d="M32 30v8M28 36l4 4 4-4" stroke="' + R + '" stroke-width="1"/>'),
    led_sobreposto: svg('<path d="M8 20H56M8 28H56"/><rect x="26" y="28" width="12" height="4" fill="' + R + '" stroke="' + R + '"/><path d="M32 34v6M28 38l4 4 4-4" stroke="' + R + '" stroke-width="1"/>'),
    nicho_led: svg('<rect x="10" y="6" width="44" height="36"/><path d="M10 18h44M10 30h44"/><rect x="14" y="18" width="36" height="2" fill="' + R + '" stroke="' + R + '"/><rect x="14" y="30" width="36" height="2" fill="' + R + '" stroke="' + R + '"/><path d="M20 21l-3 6M44 21l3 6M20 33l-3 6M44 33l3 6" stroke="' + R + '" stroke-dasharray="1.5 1.5" stroke-width="1"/>'),
    // --- itens de gaveta
    gav_gaveta: svg('<rect x="12" y="14" width="40" height="18"/><path d="M28 20h8" stroke="' + R + '" stroke-width="2"/>'),
    gav_gavetao: svg('<rect x="12" y="6" width="40" height="34"/><path d="M28 12h8" stroke="' + R + '" stroke-width="2"/>'),
    gav_interna: svg('<rect x="12" y="6" width="40" height="34"/><rect x="16" y="10" width="32" height="8" stroke="' + R + '" stroke-dasharray="2 1.5"/><path d="M28 24h8" stroke-width="2"/>'),
    // --- status (conferência)
    st_erro: '<svg class="st" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#9a5b53"/><path d="M8 4.2v4.6M8 11.2v.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
    st_aviso: '<svg class="st" viewBox="0 0 16 16"><path d="M8 1.6 15 14H1z" fill="#d6b3ab" stroke="#d6b3ab" stroke-linejoin="round"/><path d="M8 6v3.6M8 11.6v.4" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>',
    st_info: '<svg class="st" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="4" fill="#4f6475"/><path d="M8 7v4.6M8 4.6v.3" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>',
    st_dica: '<svg class="st" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="4" fill="#6b8a72"/><path d="M4.6 8.2 7 10.6l4.4-4.8" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    st_ok: '<svg class="st" viewBox="0 0 16 16"><path d="M3.5 8.4 6.6 11.4 12.6 4.8" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    seta: '<svg class="seta-ic" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  root.MarceIlustra = I;
})(typeof self !== 'undefined' ? self : this);
