# Dockerfile for Sybil Server
FROM node:18-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./
RUN npm install --only=production

# Copy server source code
COPY server/ ./

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
