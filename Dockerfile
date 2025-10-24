FROM node:20.19.0-alpine as builder

LABEL stage=builder

WORKDIR /app

COPY package*.json /.

RUN npm ci

COPY ./ /.

RUN npm run build


FROM nginx:1.29.2 as stage

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --chmod=444 nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
