#!/bin/bash
set -e

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
