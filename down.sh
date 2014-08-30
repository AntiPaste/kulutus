#!/bin/bash
ADDRESS="10.255.255.123"

networksetup -getinfo Kulutus > /dev/null 2>&1 || { echo "Network service does not exist, assuming that forwarding is already down and exiting." && exit 0; }

sed -i "" "/^$ADDRESS/d" /etc/hosts; echo "Removing domains from hosts..."
ifconfig lo0 $ADDRESS delete; echo "Removing local link..."
ipfw -f flush; echo "Flushing forwarding rules..."
networksetup -removenetworkservice Kulutus; echo "Removing network service..."

echo "Finished"
