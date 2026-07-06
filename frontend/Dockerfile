# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (for Docker layer caching — faster rebuilds)
COPY package*.json ./
RUN npm ci --legacy-peer-deps              # 'ci' is faster and more reliable than 'install' in Docker

# Copy source code and build
COPY . .
RUN npm run build             # Creates the 'dist/' folder with static files

# Stage 2: Serve static files with Nginx (tiny image, no Node.js)
FROM nginx:alpine

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy built React app
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]