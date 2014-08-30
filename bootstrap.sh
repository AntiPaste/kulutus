#!/bin/bash

HOSTNAME="hashable.dev"
VAGRANT=true

MYSQL_ROOT_PASSWORD=""
HASHABLE_PASSWORD=""


# --- Work around sudo removing this env variable by default ---
if [ $VAGRANT = true ]; then
	SOCKET=$(ls -1 --sort t /tmp/ssh-*/agent.* | head -1)
	export SSH_AUTH_SOCK="${SOCKET}"
	mkdir -p ~/.ssh
	echo -e "Host github.com\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config

	MYSQL_ROOT_PASSWORD="vagrant"
	HASHABLE_PASSWORD="vagrant"
fi

# --- Setting up git ---
apt-get -qq -y install git
git config --global user.name "AntiPaste"
git config --global user.email "antipaste@gmail.com"
git clone git@github.com:AntiPaste/hashable-config.git

# --- Setting up users ---
useradd -m hashable -s /bin/bash
echo "hashable:$HASHABLE_PASSWORD" | chpasswd
mkdir -p /home/hashable/.ssh
chmod 700 /home/hashable/.ssh
mv hashable-config/ssh/* /home/hashable/.ssh/
chmod 600 /home/hashable/.ssh/git_id_rsa
chmod 644 /home/hashable/.ssh/git_id_rsa.pub

echo -e "hashable\t\tALL=(ALL:ALL) ALL" >> /etc/sudoers
echo -e "www-data\t\tALL=(hashable) NOPASSWD: /usr/bin/git pull" >> /etc/sudoers

# --- Setting up apt --

# HTTPS transport
apt-get -qq -y install apt-transport-https

# Sources
mv hashable-config/apt/pinning /etc/apt/preferences.d/pinning

# Package pinning
mv hashable-config/apt/sources.list /etc/apt/sources.list

# Sign nginx repo
wget -q http://nginx.org/keys/nginx_signing.key
apt-key add nginx_signing.key

# Sign Node.js repo
wget -q https://deb.nodesource.com/gpgkey/nodesource.gpg.key
apt-key add nodesource.gpg.key

# Update and upgrade
apt-get -qq update
apt-get -qq -y upgrade

# --- Setting up LEMP ---

# MySQL pops up stupid windows
debconf-set-selections <<< "mysql-server mysql-server/root_password password '$MYSQL_ROOT_PASSWORD'"
debconf-set-selections <<< "mysql-server mysql-server/root_password_again password '$MYSQL_ROOT_PASSWORD'"

# libc6 pops up more stupid windows
debconf-set-selections <<< "libc6 libraries/restart-without-asking boolean true"

# Installing packages
apt-get -qq -y install nodejs npm curl expect mysql-server nginx php5-fpm/testing libc6/testing libc6-dev/testing libjemalloc-dev libonig2/testing libxml2/testing php5-common/testing php5-cli/testing php5-mysql/testing

# Set up MySQL
mysql_install_db > /dev/null

expect -c '
set timeout 10
spawn mysql_secure_installation

expect "Enter current password for root (enter for none):"
send "'$MYSQL_ROOT_PASSWORD'\r"

expect "Change the root password?"
send "n\r"

expect "Remove anonymous users?"
send "y\r"

expect "Disallow root login remotely?"
send "y\r"

expect "Remove test database and access to it?"
send "y\r"

expect "Reload privilege tables now?"
send "y\r"

expect eof
'

mysql -u root -p"$MYSQL_ROOT_PASSWORD" < hashable-config/mysql/hashable.sql

# Set up PHP
sed -i 's/;cgi.fix_pathinfo=1/cgi.fix_pathinfo=0/' /etc/php5/fpm/php.ini
sed -i 's/listen.owner = www-data/listen.owner = nginx/' /etc/php5/fpm/pool.d/www.conf
sed -i 's/listen.group = www-data/listen.group = nginx/' /etc/php5/fpm/pool.d/www.conf

# Set up nginx
mv hashable-config/nginx/*.conf /etc/nginx/conf.d/
sed -i "s/hashable.io/$HOSTNAME/g" /etc/nginx/conf.d/*

# Set up Redis
wget -q http://download.redis.io/releases/redis-2.8.13.tar.gz
tar -zxf redis-2.8.13.tar.gz
make -C redis-2.8.13
make install -C redis-2.8.13
mkdir /etc/redis
mkdir /var/redis
cp redis-2.8.13/utils/redis_init_script /etc/init.d/redis_6379
cp redis-2.8.13/redis.conf /etc/redis/6379.conf
mkdir /var/redis/6379
sed -i 's/daemonize no/daemonize yes/' /etc/redis/6379.conf
sed -i 's/pidfile \/var\/run\/redis.pid/pidfile \/var\/run\/redis_6379.pid/' /etc/redis/6379.conf
sed -i 's/logfile ""/logfile \/var\/log\/redis_6379.log/' /etc/redis/6379.conf
sed -i 's/dir .\//dir \/var\/redis\/6379/' /etc/redis/6379.conf
update-rc.d redis_6379 defaults

# Set up Node.js
ln -s /usr/bin/nodejs /usr/bin/node

# Set up Golang
wget -q https://storage.googleapis.com/golang/go1.3.1.linux-amd64.tar.gz
tar -C /usr/local -zxf go1.3.1.linux-amd64.tar.gz
mv hashable-config/golang/golang.sh /etc/profile.d/
source /etc/profile

# --- Setting up project ---
git clone git@github.com:AntiPaste/hashable.git /home/hashable/git
mv /home/hashable/git/* /home/hashable/
mv /home/hashable/git/.git/ /home/hashable/
mkdir -p /home/hashable/node/node_modules/
mkdir -p /home/hashable/go/{bin,pkg,src}
mkdir -p /home/hashable/{logs,tmp}
go get github.com/fzzy/radix/redis
go get github.com/go-sql-driver/mysql
(cd /home/hashable/node/ && npm install)
chmod 777 /home/hashable/tmp/
rm -rf /home/hashable/git/

mysql -u root -pvagrant -D hashable < /home/hashable/structure.sql

# --- Chowning ---
chown -R hashable:hashable /home/hashable

# Restart services
/etc/init.d/nginx restart
/etc/init.d/php5-fpm restart
/etc/init.d/mysql restart
/etc/init.d/redis_6379 start

# Clean up
rm -rf *