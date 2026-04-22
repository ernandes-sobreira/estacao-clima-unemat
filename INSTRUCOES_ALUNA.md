# Instruções para atualizar os dados da Estação Climatológica UNEMAT

**Plataforma:** https://ernandes-sobreira.github.io/estacao-clima-unemat/
**Repositório:** https://github.com/ernandes-sobreira/estacao-clima-unemat
**Ferramenta de conversão:** conversor.html (arquivo local)

---

## O que você vai precisar

1. O arquivo `.xlsx` exportado do HOBOlink (dados de 5 em 5 minutos)
2. Acesso à conta do Ernandes no GitHub (login e senha)
3. O arquivo `conversor.html` salvo no seu computador

---

## Passo a passo

### 1. Abrir o conversor

Dê duplo clique no arquivo `conversor.html`. Ele abre no navegador (Chrome, Edge, Firefox). É uma página local, não envia nada para nenhum servidor.

### 2. Carregar o banco de dados atual

Na **Etapa 1**, clique em **"Buscar do GitHub"**. O conversor baixa automaticamente o `daily.json` mais recente do repositório e mostra quantos registros já existem (algo como "1606 registros").

Se o botão falhar por algum motivo, clique em **"Ou carregar do computador"** e selecione um `daily.json` baixado manualmente.

### 3. Processar a planilha do HOBOlink

Na **Etapa 2**, arraste o arquivo `.xlsx` exportado do HOBOlink para a caixa tracejada, ou clique nela e selecione o arquivo.

O conversor vai:
- Ler todas as linhas (cada 5 minutos tem uma leitura)
- Agrupar por dia
- Calcular médias, mínimas, máximas, totais
- Mostrar uma tabela com os dias novos que serão adicionados

Confira a tabela. As datas devem fazer sentido (período real da coleta).

### 4. Baixar o daily.json atualizado

Na **Etapa 3**, clique em **"Baixar daily.json atualizado"**. O arquivo é salvo na pasta Downloads do seu computador com o nome `daily.json`.

Este arquivo contém **todos** os dados antigos mais os dias novos, ordenados por data.

### 5. Substituir o arquivo no GitHub

1. Abra https://github.com/ernandes-sobreira/estacao-clima-unemat/blob/main/daily.json
2. Entre na conta do Ernandes (se ainda não estiver logada)
3. Clique no ícone de lápis no canto superior direito (Edit this file)
4. Apague todo o conteúdo atual: clique dentro da área de texto, depois `Ctrl+A` e `Delete`
5. Abra o `daily.json` que você baixou (ex.: com o Bloco de Notas), selecione tudo (`Ctrl+A`) e copie (`Ctrl+C`)
6. Volte ao GitHub e cole (`Ctrl+V`) na área de texto vazia
7. Role até o final da página
8. Deixe a mensagem padrão ou escreva algo como: `Atualização: dados de março e abril 2026`
9. Clique no botão verde **"Commit changes"**

### 6. Verificar

Espere uns 2 minutos. Abra https://ernandes-sobreira.github.io/estacao-clima-unemat/ e veja se os dados novos aparecem na Visão Geral. A data da última atualização no cabeçalho deve refletir o dia mais recente da nova planilha.

---

## Observações importantes

- **O HOBOlink exporta as datas no formato americano** (mês/dia/ano). O conversor já sabe disso e interpreta corretamente. Não edite a planilha antes de usar.
- **Não apague o daily.json do GitHub antes de ter o novo pronto.** Se algo der errado, a plataforma deixa de funcionar até voltar um arquivo válido.
- **Se o botão "Buscar do GitHub" falhar** com erro de rede, tente novamente. Em caso de falha persistente, baixe o arquivo manualmente pela opção "Raw" no GitHub e use "carregar do computador".
- **Nunca edite o daily.json à mão.** Use sempre o conversor.

---

## Em caso de dúvida

Contato: Ernandes Sobreira — (65) 99932-3724

Estação Climatológica UNEMAT Pantanal Norte
CELBE · LIPAN/LEFA · UNEMAT Cáceres-MT
