FROM node:20-alpine

WORKDIR /app

# Install ts-node and typescript globally
RUN npm install -g ts-node typescript

# Copy source files
COPY src ./src
COPY tsconfig.json ./
COPY package*.json ./

# Install dependencies
RUN npm ci

# Default command to run the app with ts-node
CMD ["ts-node", "src/indexer.ts"]