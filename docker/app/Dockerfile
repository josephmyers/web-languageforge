# ENVIRONMENT value can be either "production" or "development"
ARG ENVIRONMENT=${ENVIRONMENT:-'production'}

# UI-BUILDER
FROM node:14.16.1-alpine3.11 AS ui-builder-base

# install npm globally
RUN npm config set unsafe-perm true && npm install -g npm@7.6.3

RUN mkdir -p /data
WORKDIR /data

# copy npm cache directory; as optimization for npm install
COPY --from=sillsdev/web-languageforge:npm-cache /root/.npm /root/.npm

# Copy in files needed for compilation, located in the repo root
COPY typings ./typings/
COPY package.json package-lock.json webpack.config.js webpack-dev.config.js webpack-prd.config.js tsconfig.json tslint.json ./

# unsafe-perm true is required to work around an npm bug since we are running as root, have a git+HTTPS repo source and it has a `prepare` script (perfect storm).
# see https://github.com/npm/npm/issues/17346
RUN npm config set unsafe-perm true && npm install --legacy-peer-deps

# copy in src local files
# Note: *.html files in src/angular-app aren't necessary for webpack compilation, however changes to HTML files will invalidate this layer
COPY src/angular-app ./src/angular-app
COPY src/sass ./src/sass
COPY src/Site/views/languageforge/theme/default/sass/ ./src/Site/views/languageforge/theme/default/sass
COPY src/Site/views/shared/*.scss ./src/Site/views/shared/

FROM ui-builder-base AS production-ui-builder
ENV NPM_BUILD_SUFFIX=prd

FROM ui-builder-base AS development-ui-builder
ENV NPM_BUILD_SUFFIX=dev

FROM ${ENVIRONMENT}-ui-builder AS ui-builder
# artifacts built to /data/src/dist
RUN npm run build:${NPM_BUILD_SUFFIX}

# COMPOSER-BUILDER
# download composer app dependencies
# git - needed for composer install
FROM sillsdev/web-languageforge:base-php AS composer-builder
WORKDIR /composer
COPY src/composer.json src/composer.lock /composer/
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/* \
    && install-php-extensions @composer && composer install

# PRODUCTION IMAGE
FROM sillsdev/web-languageforge:base-php AS production-app
RUN rm /usr/local/bin/install-php-extensions
RUN apt-get remove -y gnupg2
RUN mv $PHP_INI_DIR/php.ini-production $PHP_INI_DIR/php.ini
# had to add /wait into prod image so the prod image could be run through E2E tests.
COPY --from=sillsdev/web-languageforge:wait-latest /wait /wait

# DEVELOPMENT IMAGE
FROM sillsdev/web-languageforge:base-php AS development-app
RUN install-php-extensions xdebug
COPY docker/app/docker-php-ext-xdebug.ini /usr/local/etc/php/conf.d
RUN mv $PHP_INI_DIR/php.ini-development $PHP_INI_DIR/php.ini
COPY --from=sillsdev/web-languageforge:wait-latest /wait /wait

FROM ${ENVIRONMENT}-app AS languageforge-app
ARG BUILD_VERSION=${BUILD_VERSION:-'9.9.9'}

# copy app into image
COPY src /var/www/html/
RUN ln -s /var/www/html /var/www/src

# grab the built assets from the ui image
COPY --from=ui-builder /data/src/dist /var/www/html/dist

# ensure correct write permissions for assets folders,
RUN    chown -R www-data:www-data /var/www/html/assets /var/www/html/cache \
    && chmod -R g+ws /var/www/html/assets /var/www/html/cache

COPY docker/app/entrypoint.sh /

COPY --from=composer-builder /composer/vendor /var/www/html/vendor

# patch exception handling from Symfony to actually show exceptions instead of swallowing them
COPY docker/app/symfony-exceptions.patch /
RUN patch -p4 -i /symfony-exceptions.patch

RUN echo "${BUILD_VERSION}" > /var/www/html/build-version.txt \
 && sed -i /var/www/html/version.php -e "s/^\\(define('VERSION', '\\).*;\$/\\1${BUILD_VERSION}'\\);/"

ENTRYPOINT [ "/entrypoint.sh" ]
CMD [ "apache2-foreground" ]
