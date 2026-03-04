FROM node:20-slim

# Install Playwright system dependencies + VNC/Display dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libx11-6 libx11-xcb1 libxcb1 libxext6 fonts-liberation \
    # VNC + Display dependencies
    xvfb x11vnc fluxbox novnc websockify procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

# Install Playwright browsers
RUN npx playwright install chromium

COPY . .

RUN mkdir -p uploads data
RUN chmod +x start.sh

EXPOSE 4000 6080

CMD ["./start.sh"]
