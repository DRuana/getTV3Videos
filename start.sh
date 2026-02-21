#!/bin/bash
# Instal·la les dependències si cal
if [ ! -d "node_modules/.bin" ]; then
  echo "Instal·lant dependències..."
  bun install
fi

# Arrenca el servidor de desenvolupament
echo "Arrencant 3Cat Downloader a http://localhost:3000"
NEXT_TELEMETRY_DISABLED=1 bun run dev
