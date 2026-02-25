# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

COPY --from=frontend-build /app/frontend/dist ./static

RUN mkdir -p uploads data

ENV PORT=8000

EXPOSE 8000

# Run worker in background, web server in foreground
CMD ["sh", "-c", "python -u worker.py & exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
