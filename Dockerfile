# Use official Node.js LTS image
FROM node:22

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the API port
EXPOSE 5050

# Start the application
CMD ["node", "server.js"]
