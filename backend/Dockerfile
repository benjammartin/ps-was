FROM oven/bun:1

WORKDIR /app

COPY package.json .
COPY server.ts .

RUN bun install

EXPOSE 3001

CMD ["bun", "server.ts"] 