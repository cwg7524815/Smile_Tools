FROM node:20-alpine

WORKDIR /app
COPY server.js ./server.js

ENV PORT=8001
ENV DATA_DIR=/data
EXPOSE 8001

CMD ["node", "server.js"]
