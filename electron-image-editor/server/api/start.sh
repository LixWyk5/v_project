#!/bin/sh
set -e

echo "🚀 Starting Image Editor API..."

echo "🔄 Generating Prisma Client..."
npx prisma generate

echo "📊 Initializing database schema..."
npx prisma db push --accept-data-loss

echo "🌱 Seeding database with sample images..."
# Seed script now checks for existing data, so it's safe to run
npx prisma db seed

echo "✅ Database ready!"
npm run dev
