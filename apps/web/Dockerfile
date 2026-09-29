FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js otel.js /usr/share/nginx/html/
EXPOSE 80
