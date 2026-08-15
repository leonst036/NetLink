FROM node:22-alpine

# Install git for repository and branch inspection
RUN apk add --no-cache git

WORKDIR /repo

# Copy the server script
COPY debug-server.js /app/debug-server.js

ENV PORT=4540
ENV GIT_DIR=/repo

EXPOSE 4540

CMD ["node", "/app/debug-server.js"]
