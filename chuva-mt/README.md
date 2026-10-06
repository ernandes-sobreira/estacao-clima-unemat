# CHUVA MT

Painel público e pipeline de atualização de precipitação por satélite para Mato Grosso.

## Fluxo

1. Acesse `admin.html`.
2. Entre com a conta autorizada.
3. Arraste um GeoTIFF CHIRPS.
4. O navegador detecta ano/mês/versão, calcula a média zonal em cada município e publica apenas os resultados derivados.
5. O `index.html` incorpora o novo período automaticamente.

## Dados

- Histórico de referência: CHIRPS municipal 1996–2025.
- Novos períodos: tabela `public.chuva_mt_observacoes` no Supabase.
- Malha municipal: arquivo GeoJSON usado para o cálculo zonal.
- Versões preliminares e finais convivem; no painel, a versão final tem prioridade quando disponível.

## Estatísticas da V1

- precipitação municipal e estadual;
- média estadual ponderada pela área municipal;
- anomalia absoluta e percentual;
- ranking histórico;
- percentis e extremos;
- regressão linear e R²;
- Mann–Kendall;
- inclinação de Sen;
- coeficiente de variação;
- P10/P90;
- mapa coroplético e séries temporais.

## Segurança

Leitura do resultado é pública. Escrita no Supabase é protegida por RLS e vinculada ao usuário administrador autorizado. A chave presente no frontend é somente a chave publicável; nenhuma service role é exposta.

## Observação científica

O histórico 1996–2025 foi extraído do CHIRPS disponível no Google Earth Engine. Produtos preliminares mais recentes devem ser identificados como preliminares e substituídos pelo produto final quando disponível. Para publicação científica, registrar versão do produto e data de processamento.
