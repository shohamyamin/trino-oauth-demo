#!/bin/bash
set -e

# Find Java home if not set
if [ -z "$JAVA_HOME" ]; then
    JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
fi

# Generate self-signed certificate if it doesn't exist
if [ ! -f /etc/trino/trino.jks ]; then
    echo "Generating self-signed certificate..."
    keytool -genkeypair \
        -alias trino \
        -keyalg RSA \
        -keysize 2048 \
        -validity 365 \
        -keystore /etc/trino/trino.jks \
        -storepass changeit \
        -keypass changeit \
        -dname "CN=trino, OU=Development, O=TrinoDemo, L=City, ST=State, C=US" \
        -ext "SAN=DNS:trino,DNS:localhost,IP:127.0.0.1"
    echo "Self-signed certificate generated at /etc/trino/trino.jks"
    
    # Export the certificate
    echo "Exporting certificate..."
    keytool -exportcert \
        -alias trino \
        -keystore /etc/trino/trino.jks \
        -storepass changeit \
        -file /tmp/trino.crt
    
    # Import into Java's default truststore
    echo "Importing certificate into Java truststore..."
    echo "Java Home: $JAVA_HOME"
    
    # Try different possible locations for cacerts
    if [ -f "$JAVA_HOME/lib/security/cacerts" ]; then
        CACERTS_PATH="$JAVA_HOME/lib/security/cacerts"
    elif [ -f "/usr/lib/jvm/java-17-openjdk-amd64/lib/security/cacerts" ]; then
        CACERTS_PATH="/usr/lib/jvm/java-17-openjdk-amd64/lib/security/cacerts"
    elif [ -f "/usr/lib/jvm/java-11-openjdk-amd64/lib/security/cacerts" ]; then
        CACERTS_PATH="/usr/lib/jvm/java-11-openjdk-amd64/lib/security/cacerts"
    else
        CACERTS_PATH=$(find /usr -name cacerts 2>/dev/null | head -n 1)
    fi
    
    echo "Using cacerts at: $CACERTS_PATH"
    
    # Delete existing alias if it exists
    keytool -delete -alias trino -keystore "$CACERTS_PATH" -storepass changeit 2>/dev/null || true
    
    keytool -importcert \
        -alias trino \
        -keystore "$CACERTS_PATH" \
        -storepass changeit \
        -file /tmp/trino.crt \
        -noprompt
    
    echo "Certificate imported into Java truststore"
    rm /tmp/trino.crt
fi

# Substitute environment variables in rules.json
if [ -f /etc/trino/rules.json ]; then
    echo "Substituting environment variables in rules.json..."
    # Use sed to replace environment variables in the JSON file
    sed "s/\$TRINO_ADMIN_USERNAME/${TRINO_ADMIN_USERNAME}/g" /etc/trino/rules.json > /etc/trino/rules.json.tmp
    mv /etc/trino/rules.json.tmp /etc/trino/rules.json
    echo "Admin username configured: ${TRINO_ADMIN_USERNAME}"
fi

# Start Trino
exec /usr/lib/trino/bin/run-trino
