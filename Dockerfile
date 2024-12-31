# Use the official Bun image
FROM oven/bun:latest

# Set the working directory
WORKDIR /app

# Copy the backend code
COPY . .

# Install dependencies and build the project
RUN bun run inst
RUN bun run build

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]
