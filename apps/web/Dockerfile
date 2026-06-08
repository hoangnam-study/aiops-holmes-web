FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm install

COPY apps/web apps/web
RUN npm run build -w apps/web

FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
RUN chgrp -R 0 /etc/nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /var/run && \
  chmod -R g=u /etc/nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /var/run

EXPOSE 8080
