FROM oven/bun:1.4-alpine
WORKDIR /app
COPY server.ts .
EXPOSE 3000
HEALTHCHECK --interval=2s --timeout=2s --retries=10 CMD wget -qO- http://localhost:3000/_health || exit 1
CMD ["bun", "run", "server.ts"]
