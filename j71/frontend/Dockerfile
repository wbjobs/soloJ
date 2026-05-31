FROM rust:1.75-alpine as wasm-builder
WORKDIR /app
RUN apk add --no-cache musl-dev
RUN cargo install wasm-pack
COPY dicom-parser/ ./dicom-parser/
WORKDIR /app/dicom-parser
RUN wasm-pack build --target web --release

FROM node:20-alpine as frontend-builder
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
COPY --from=wasm-builder /app/dicom-parser/pkg ./src/pkg
RUN npm run build

FROM nginx:alpine
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
