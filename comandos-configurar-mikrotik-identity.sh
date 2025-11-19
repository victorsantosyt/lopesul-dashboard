#!/bin/bash
# Script com comandos para configurar o identity em cada Mikrotik
# Execute estes comandos em cada Mikrotik (via SSH ou Winbox)

echo "🔧 Comandos para configurar identity em cada Mikrotik"
echo ""
echo "⚠️  Execute estes comandos em cada Mikrotik:"
echo ""

IPS=("10.200.200.2" "10.200.200.3" "10.200.200.4" "10.200.200.5" "10.200.200.6" "10.200.200.7")
MIKIDS=("LOPESUL-HOTSPOT-01" "LOPESUL-HOTSPOT-02" "LOPESUL-HOTSPOT-03" "LOPESUL-HOTSPOT-04" "LOPESUL-HOTSPOT-05" "LOPESUL-HOTSPOT-06")

for i in "${!IPS[@]}"; do
  IP="${IPS[$i]}"
  MIKID="${MIKIDS[$i]}"
  
  echo "📡 Mikrotik $IP:"
  echo "   ssh relay@$IP"
  echo "   /system identity set name=\"$MIKID\""
  echo "   /system identity print"
  echo ""
done

echo "💡 Ou execute via SSH direto:"
echo ""

for i in "${!IPS[@]}"; do
  IP="${IPS[$i]}"
  MIKID="${MIKIDS[$i]}"
  
  echo "sshpass -p 'api2025' ssh relay@$IP '/system identity set name=\"$MIKID\" && /system identity print'"
done

