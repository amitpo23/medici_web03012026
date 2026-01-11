#!/bin/bash

echo "🚀 Medici Backend - Azure App Service Deployment"
echo "==============================================="
echo ""

# Configuration
APP_NAME="medici-backend-dev"
RESOURCE_GROUP="Medici-RG-Dev"
BACKEND_DIR="/workspaces/medici_web03012026/medici-backend-node"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null
then
    echo "❌ Azure CLI לא מותקן"
    exit 1
fi

echo "✅ Azure CLI מותקן"
echo ""

# Check if logged in
echo "🔐 בודק התחברות ל-Azure..."
az account show &> /dev/null

if [ $? -ne 0 ]; then
    echo "❌ לא מחובר ל-Azure"
    echo "מתחבר ל-Azure..."
    az login
else
    echo "✅ מחובר ל-Azure"
    ACCOUNT=$(az account show --query name -o tsv)
    echo "   חשבון: $ACCOUNT"
fi

echo ""
echo "📦 מכין את הקוד ל-deployment..."

# Navigate to backend directory
cd $BACKEND_DIR

# Create deployment package
echo "   יוצר deployment package..."
rm -rf node_modules
npm install --production

# Create .deployment file for Azure
cat > .deployment << EOF
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true
EOF

# Verify App Service exists
echo ""
echo "🔍 בודק שה-App Service קיים..."
az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null

if [ $? -ne 0 ]; then
    echo "❌ App Service '$APP_NAME' לא נמצא"
    echo "   ודא שהשם נכון או צור אותו ב-Azure Portal"
    exit 1
fi

echo "✅ App Service '$APP_NAME' נמצא"
echo ""

# Deploy using ZIP deployment
echo "🚀 מעלה קוד ל-Azure..."
echo "   זה עשוי לקחת מספר דקות..."

# Create zip file
zip -r deploy.zip . -x "*.git*" "node_modules/*" "*.log" ".env"

# Upload to Azure
az webapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --src deploy.zip

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment הצליח!"
    echo ""
    echo "📊 פרטי האפליקציה:"
    echo "   App Name: $APP_NAME"
    echo "   URL: https://$APP_NAME.azurewebsites.net"
    echo ""
    echo "🧪 בודק שהשרת עובד..."
    sleep 5
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://$APP_NAME.azurewebsites.net/)
    
    if [ "$RESPONSE" == "200" ]; then
        echo "✅ השרת עובד!"
        echo ""
        echo "🎉 Deployment הושלם בהצלחה!"
        echo ""
        echo "📝 קישורים שימושיים:"
        echo "   • API Root: https://$APP_NAME.azurewebsites.net/"
        echo "   • Health Check: https://$APP_NAME.azurewebsites.net/"
        echo "   • Hotels: https://$APP_NAME.azurewebsites.net/Opportunity/Hotels"
        echo "   • Azure Portal: https://portal.azure.com"
        echo ""
        echo "💡 טיפ: עדכן את environment.prod.ts בפרונט עם:"
        echo "   baseUrl: 'https://$APP_NAME.azurewebsites.net/'"
    else
        echo "⚠️  השרת עדיין מתחמם... (HTTP $RESPONSE)"
        echo "   המתן דקה ובדוק שוב"
    fi
    
    # Clean up
    rm -f deploy.zip
    
else
    echo ""
    echo "❌ Deployment נכשל"
    echo "   בדוק את הלוגים ב-Azure Portal"
    exit 1
fi
