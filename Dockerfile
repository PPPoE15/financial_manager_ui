FROM node:22.22.2-alpine AS builder

LABEL stage=builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY ./ /app/

RUN npm run build


FROM nginx:1.29.2 AS stage

COPY --from=builder /app/dist /usr/share/nginx/html
# Убираем стандартный HTTP virtual host, чтобы все Host обслуживало приложение.
RUN rm /etc/nginx/conf.d/default.conf
COPY --chmod=444 nginx/*.conf /etc/nginx/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
