FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production FOLIO_HOST=0.0.0.0 FOLIO_DATA_DIR=/var/data/folio PORT=10000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
# The service imports typed domain/demo contracts through tsx at runtime.
COPY --from=build /app/src ./src
EXPOSE 10000
CMD ["npm", "start"]
