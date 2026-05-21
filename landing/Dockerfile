FROM node:22-alpine AS build
ENV npm_config_cache=/tmp/npm-cache
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS run
ENV npm_config_cache=/tmp/npm-cache
WORKDIR /app
RUN npm install -g serve@14.2.4
COPY --from=build /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "serve dist -s -l ${PORT:-8080}"]
