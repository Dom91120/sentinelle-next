# Conteneur cron : busybox crond + curl — appelle /api/cron/tous toutes les 5 minutes.
# L'app applique elle-même les horaires de chaque tâche (hérités de app/scheduler.py).
#
# L'image embarque aussi backup.sh (export MANUEL en ligne de commande, hors crontab) :
#   docker compose exec --user 10001:10001 cron backup.sh
# → dump direct depuis Postgres, utilisable même si le conteneur app est HS.
FROM alpine:3.24
RUN apk add --no-cache curl tzdata postgresql18-client
ENV TZ=Europe/Paris
COPY crontab /etc/crontabs/root
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
CMD ["crond", "-f", "-l", "2"]
