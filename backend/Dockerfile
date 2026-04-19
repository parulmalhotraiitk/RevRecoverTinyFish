# Use Node 18 Alpine for a lightweight secure baseline
FROM node:18-alpine

WORKDIR /usr/src/app

# Copy dependency files first for layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose backend port
EXPOSE 8080

# Command to run the service
CMD ["npm", "start"]
