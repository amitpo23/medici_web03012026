#!/bin/bash

echo "🚀 Medici Hotels - Vercel Deployment Script"
echo "============================================"
echo ""

# Check if vercel is installed
if ! command -v vercel &> /dev/null
then
    echo "❌ Vercel CLI לא מותקן"
    echo "מתקין Vercel CLI..."
    npm install -g vercel
fi

echo "✅ Vercel CLI מותקן"
echo ""

# Login to Vercel
echo "📝 התחבר ל-Vercel..."
echo "אם אתה לא מחובר, תפתח דפדפן לכניסה"
vercel login

echo ""
echo "🎯 בחר מה לעשות Deploy:"
echo "1) Frontend בלבד"
echo "2) Backend בלבד"
echo "3) שניהם (Frontend + Backend)"
read -p "בחירה (1/2/3): " choice

case $choice in
  1)
    echo ""
    echo "🌐 מבצע Deploy לפרונט..."
    cd /workspaces/medici_web03012026
    vercel --prod
    ;;
  2)
    echo ""
    echo "⚙️ מבצע Deploy לבקאנד..."
    cd /workspaces/medici_web03012026/medici-backend-node
    vercel --prod
    ;;
  3)
    echo ""
    echo "🌐 מבצע Deploy לפרונט..."
    cd /workspaces/medici_web03012026
    vercel --prod
    
    echo ""
    echo "⚙️ מבצע Deploy לבקאנד..."
    cd medici-backend-node
    vercel --prod
    ;;
  *)
    echo "❌ בחירה לא חוקית"
    exit 1
    ;;
esac

echo ""
echo "✅ Deploy הושלם!"
echo ""
echo "📋 שלבים נוספים:"
echo "1. לך ל-Vercel Dashboard: https://vercel.com/dashboard"
echo "2. הגדר Environment Variables לבקאנד:"
echo "   - DB_SERVER"
echo "   - DB_DATABASE"
echo "   - DB_USER"
echo "   - DB_PASSWORD"
echo "   - JWT_SECRET"
echo "3. עדכן את environment.prod.ts עם כתובת הבקאנד"
echo "4. Redeploy את הפרונט"
echo ""
echo "🎉 מזל טוב! האפליקציה שלך LIVE!"
