#!/bin/sh
# lcd ./web;

read -s -p "Password [ENTER]: " PWD
echo


lftp -c "set ftp:list-options -a;
open ftp://olivier.potonniee:$PWD@ftpperso.free.fr;
cd /wtracks.beta;
mirror --reverse --delete --use-cache --verbose --allow-chown --allow-suid --no-umask --parallel=2 --exclude-glob .git/** --exclude-glob .* --exclude-glob *.json --exclude-glob *.log --exclude-glob config.js"


#rsync -az --delete \
#  --exclude '.git/**' --exclude '.*' --exclude '*.json' --exclude '*.log' \
#  --exclude 'config.js' --exclude 'upload.sh' \
#  . ~/ftpperso.free.fr/wtracks.old

echo "Done."
