FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy server code
COPY . .

# Start the server
EXPOSE 3001
CMD ["npm", "start"]
