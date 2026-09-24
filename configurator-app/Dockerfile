FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 EYWA_DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["node","server.js"]
