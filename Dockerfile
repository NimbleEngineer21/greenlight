FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback + API reverse proxies
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location /api/yahoo/ {\n\
    proxy_pass https://query1.finance.yahoo.com/;\n\
    proxy_set_header Host query1.finance.yahoo.com;\n\
    proxy_set_header User-Agent "Mozilla/5.0";\n\
    proxy_ssl_server_name on;\n\
  }\n\
  location /api/coingecko/ {\n\
    proxy_pass https://api.coingecko.com/;\n\
    proxy_set_header Host api.coingecko.com;\n\
    proxy_ssl_server_name on;\n\
    proxy_connect_timeout 5s;\n\
    proxy_read_timeout 10s;\n\
  }\n\
  location /api/finnhub/ {\n\
    proxy_pass https://finnhub.io/;\n\
    proxy_set_header Host finnhub.io;\n\
    proxy_ssl_server_name on;\n\
    proxy_connect_timeout 5s;\n\
    proxy_read_timeout 10s;\n\
  }\n\
  location /api/fred/ {\n\
    proxy_pass https://api.stlouisfed.org/;\n\
    proxy_set_header Host api.stlouisfed.org;\n\
    proxy_ssl_server_name on;\n\
    proxy_connect_timeout 5s;\n\
    proxy_read_timeout 10s;\n\
  }\n\
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
