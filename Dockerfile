FROM node:20-alpine

WORKDIR /app

# Install ts-node and typescript globally
RUN npm install -g ts-node typescript

# Copy package.json and package-lock.json if present
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Default command to run the app with ts-node
CMD ["ts-node", "src/indexer.ts"]