#!/usr/bin/env bash
# Gera dist/marce.rbz (instalável pelo Gerenciador de Extensões do SketchUp)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
saida="$(pwd)/dist/marce.rbz"
rm -f "$saida"
(cd src && zip -qr -X "$saida" marce.rb marce -x '*/_*' -x '*.DS_Store')
echo "Pacote: $saida"
unzip -l "$saida" | tail -1
