# Usando uma imagem leve do Nginx para servir arquivos estaticos
FROM nginx:alpine

# Copia todos os arquivos do app Dito para a pasta do servidor
COPY . /usr/share/nginx/html

# Exposicao da porta padrao
EXPOSE 80

# Inicia o servidor
CMD ["nginx", "-g", "daemon off;"]
