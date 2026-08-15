#!/usr/bin/env bash
set -e

# NetLink Minecraft Wings Daemon Service Control Helper
SERVICE_NAME="${SERVICE_NAME:-netlink-mc-wings}"

ACTION="${1:-status}"

case "$ACTION" in
    start)
        echo "Starting $SERVICE_NAME..."
        systemctl start "$SERVICE_NAME"
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    stop)
        echo "Stopping $SERVICE_NAME..."
        systemctl stop "$SERVICE_NAME"
        ;;
    restart)
        echo "Restarting $SERVICE_NAME..."
        systemctl restart "$SERVICE_NAME"
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    status)
        systemctl status "$SERVICE_NAME" --no-pager
        ;;
    logs)
        if [ "$2" == "-f" ] || [ "$2" == "--follow" ]; then
            journalctl -u "$SERVICE_NAME" -f
        else
            journalctl -u "$SERVICE_NAME" -n 100 --no-pager
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs [-f]}"
        exit 1
        ;;
esac
