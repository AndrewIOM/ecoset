FROM ubuntu:jammy

ENV ROOTDIR /usr/local/

# Install Node.js
RUN set -uex \
    && apt-get update \
    && apt-get install -y ca-certificates curl gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && NODE_MAJOR=20 \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
        | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install nodejs -y;

# Install GDAL
RUN apt-get install --yes software-properties-common
RUN add-apt-repository ppa:ubuntugis/ppa
RUN apt-get update
RUN apt-get install --yes gdal-bin python3-gdal

# Setup yarn
RUN corepack enable
RUN yarn set version stable

# Setup Directories
RUN mkdir -p /data
RUN mkdir -p /output
RUN mkdir -p /logs

RUN mkdir -p /usr/src/app
ADD ./src /usr/src/app

WORKDIR /usr/src/app
RUN yarn workspaces focus --production
RUN yarn install

EXPOSE 5001:5002
VOLUME /data/
VOLUME /output/

RUN yarn run tsoa:gen
RUN yarn tsc
RUN yarn run copy:assets

CMD [ "yarn", "node", "./build/api/app.js" ]