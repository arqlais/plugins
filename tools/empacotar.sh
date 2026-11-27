#!/usr/bin/env bash
# Gera dist/marce.rbz e versao.json (lido pelo botão "Atualizar marcê")
# Para lançar uma versão: troque VERSAO em src/marce/versao.rb, escreva as
# novidades no topo do CHANGELOG.md, rode este script, faça commit e push.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
saida="$(pwd)/dist/marce.rbz"
rm -f "$saida"
python3 - <<'PY'
# novidades.json (todas as versões do CHANGELOG) vai dentro do pacote
import json, re
versoes, atual = [], None
for linha in open('CHANGELOG.md', encoding='utf-8'):
    if linha.startswith('## '):
        atual = {'versao': linha[3:].strip(), 'notas': []}; versoes.append(atual)
    elif atual and linha.startswith('- '):
        atual['notas'].append(linha[2:].strip())
json.dump(versoes, open('src/marce/novidades.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
PY
(cd src && zip -qr -X "$saida" marce.rb marce -x '*/_*' -x '*.DS_Store')
python3 - <<'PY'
import hashlib, json, re
versao = re.search(r"VERSAO = '([^']+)'", open('src/marce/versao.rb', encoding='utf-8').read()).group(1)
notas, dentro = [], False
for linha in open('CHANGELOG.md', encoding='utf-8'):
    if linha.startswith('## '):
        if dentro: break
        dentro = linha[3:].strip() == versao
    elif dentro and linha.startswith('- '):
        notas.append(linha[2:].strip())
sha = hashlib.sha256(open('dist/marce.rbz', 'rb').read()).hexdigest()
json.dump({'versao': versao, 'rbz': 'dist/marce.rbz', 'sha256': sha, 'notas': notas}, open('versao.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('versão', versao, '· sha256', sha[:12], '·', len(notas), 'novidades')
PY
echo "Pacote: $saida"
