# Como rodar este projeto localmente

Este é um projeto React moderno construído com Vite e Tailwind CSS.

## Pré-requisitos

Você precisará ter o **Node.js** instalado em seu computador. Você pode baixá-lo em [nodejs.org](https://nodejs.org/).

## Passos para rodar

1. **Baixe o projeto**: Use a opção de download/exportar do AI Studio para baixar os arquivos como um arquivo `.zip`.
2. **Extraia o arquivo**: Extraia o conteúdo do `.zip` em uma pasta de sua preferência.
3. **Abra o CMD (Terminal)**:
   - No Windows: Vá até a pasta, clique na barra de endereço, digite `cmd` e aperte Enter.
   - Ou abra o CMD e use o comando `cd caminho/da/pasta`.
4. **Instale as dependências**:
   No CMD, digite o seguinte comando e aperte Enter:
   ```bash
   npm install
   ```
5. **Inicie o aplicativo**:
   Após a instalação terminar, digite:
   ```bash
   npm run dev
   ```
6. **Acesse no navegador**:
   O CMD mostrará um link como `http://0.0.0.0:3000`. 
   **IMPORTANTE**: No seu navegador, você deve digitar:
   ```
   http://localhost:3000
   ```
   O endereço `0.0.0.0` é apenas um aviso técnico de que o servidor está pronto, mas para acessar no seu computador, o endereço correto é `localhost`.

## Comandos úteis

- `npm run dev`: Inicia o servidor de desenvolvimento.
- `npm run build`: Cria uma versão otimizada para produção na pasta `dist`.
- `npm run lint`: Verifica erros no código TypeScript.
