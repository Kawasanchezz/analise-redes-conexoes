# Política de Segurança

## Escopo
Este é um projeto acadêmico de análise de redes (notebook Jupyter em Python). Ele **não** possui servidor, API, autenticação, banco de dados nem deploy. A superfície de risco se resume a:
- dependências Python (cadeia de suprimentos);
- vazamento acidental de dados, caminhos locais ou credenciais em arquivos publicados (código, notebook, saídas);
- leitura de arquivos CSV de entrada.

## Versões suportadas
Apenas a versão mais recente da branch `main`.

## Como reportar uma vulnerabilidade
Use o **GitHub Security Advisories** do repositório (aba *Security* → *Report a vulnerability*). Não abra issue pública com detalhes de vulnerabilidade. Se esse recurso estiver desativado, abra uma issue pedindo um canal privado, sem descrever o problema.

## Medidas adotadas
- Dependências com versões fixadas em `requirements.txt` e auditadas com `pip-audit`.
- Análise estática do código do notebook com `bandit`.
- `.gitignore` cobre `.env`, chaves, ambientes virtuais, caches e arquivos de IDE.
- **Bots de segurança:** o Dependabot (`.github/dependabot.yml`) atualiza dependências e alerta sobre vulnerabilidades; o workflow `.github/workflows/seguranca.yml` roda `pip-audit`, `bandit` e os testes a cada push, a cada pull request e semanalmente, com token somente leitura e sem ações de terceiros.
- Teste automatizado (`tests/test_publicacao.py`) que falha se o notebook ou os CSVs contiverem caminhos locais ou e-mails, se as dependências deixarem de ser fixadas ou se o `.gitignore` perder as regras de segredos.
- O `dashboard.html` é gerado sem CDN externa (biblioteca embutida em `dashboard/vendor/`), com *Content-Security-Policy* restritiva (`default-src 'none'`), dados escapados no JSON e conteúdo inserido na página só via `textContent` (sem `innerHTML`).
- O notebook não usa `eval`, `exec`, `pickle`, `subprocess` nem acesso à rede; os dados vêm de arquivos locais.

## Limitações conhecidas
- Os resultados de segurança refletem as versões e as ferramentas da data da última auditoria; vulnerabilidades novas podem surgir. Mantenha o Dependabot ativo e rode `pip-audit` periodicamente.
- Se o notebook for adaptado para ler **CSVs de terceiros**, valide colunas, tipos e tamanho; ao exportar tabelas com texto livre para abrir no Excel, trate valores iniciados por `=`, `+`, `-` ou `@` (CSV injection). Hoje nenhum arquivo do projeto tem esse padrão.
- A análise é exploratória e não foi pensada para dados pessoais reais. Se usar dados de pessoas, anonimize-os antes (LGPD).
- Este documento não garante que o projeto esteja livre de vulnerabilidades.
