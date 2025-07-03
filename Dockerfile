# Use official Node.js LTS image
FROM node:23

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install dependencies (omit dev for smaller image)
RUN npm install --omit=dev

# Copy rest of the source code
COPY . .

# Expose the port (default 3000, but Socket Mode doesn't require public endpoint)
EXPOSE 3000

# Run the app
CMD ["node", "app.js"]
