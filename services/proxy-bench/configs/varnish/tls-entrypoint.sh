#!/bin/sh
set -e

varnishd -P /tmp/varnish.pid "$@"

for i in 1 2 3 4 5 6 7 8 9 10; do
  if varnishadm ping 2>/dev/null; then
    break
  fi
  sleep 1
done

varnishadm tls.cert.load default /etc/varnish/combined.pem
varnishadm tls.cert.commit

tail -f /dev/null &
TAIL_PID=$!
trap "kill $TAIL_PID; kill $(cat /tmp/varnish.pid) 2>/dev/null" EXIT TERM INT
wait $TAIL_PID
