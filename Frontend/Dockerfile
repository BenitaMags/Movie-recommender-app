FROM node:18-alpine

WORKDIR /app

# Copy package file and install dependencies
COPY package*.json ./
RUN npm install

# Install create-react-app globally and create app
RUN npx create-react-app . --template typescript
RUN npm install axios

# Copy our custom app code (we'll put it in package.json as inline)
COPY package.json ./

# Start the app
EXPOSE 3000
CMD ["npm", "start"]
