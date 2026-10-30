#!/bin/sh
# Docker DNAT bypasses UFW INPUT; filter original public ports before Docker accepts.
set -eu
external_interface=${1:-eth0}
for firewall in iptables ip6tables; do
  "$firewall" -w -N AVA-DOCKER 2>/dev/null || "$firewall" -w -S AVA-DOCKER >/dev/null
  "$firewall" -w -F AVA-DOCKER
  "$firewall" -w -A AVA-DOCKER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  for port in 80 443; do
    "$firewall" -w -A AVA-DOCKER -i "$external_interface" -p tcp -m conntrack --ctorigdstport "$port" -j RETURN
  done
  "$firewall" -w -A AVA-DOCKER -i "$external_interface" -p udp -m conntrack --ctorigdstport 443 -j RETURN
  "$firewall" -w -A AVA-DOCKER -i "$external_interface" -j DROP
  "$firewall" -w -A AVA-DOCKER -j RETURN
  "$firewall" -w -N DOCKER-USER 2>/dev/null || "$firewall" -w -S DOCKER-USER >/dev/null
  "$firewall" -w -C DOCKER-USER -j AVA-DOCKER 2>/dev/null || "$firewall" -w -I DOCKER-USER 1 -j AVA-DOCKER
  "$firewall" -w -C FORWARD -j DOCKER-USER 2>/dev/null || "$firewall" -w -I FORWARD 1 -j DOCKER-USER
done
