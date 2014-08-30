#!/bin/bash
ADDRESS="10.255.255.123"

networksetup -getinfo Kulutus > /dev/null 2>&1 && echo "Network service exists, assuming that forwarding is already up and exiting" && exit 0

networksetup -createnetworkservice Kulutus en0; echo "Creating network service..."
networksetup -setmanualwithdhcprouter Kulutus $ADDRESS; echo "Configuring network service..."
ipfw add fwd 127.0.0.1,8080 tcp from me to $ADDRESS dst-port 80 > /dev/null 2>&1; echo "Adding forwarding rules..."
ifconfig lo0 $ADDRESS alias; echo "Adding local link..."
echo -e "$ADDRESS\tkulutus.dev" >> /etc/hosts; echo "Adding domains to hosts..."

echo "Finished"
