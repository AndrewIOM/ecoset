FROM node:20.9.0-bookworm

ENV ROOTDIR /usr/local/

# Install GDAL
RUN apt-get install --yes software-properties-common
RUN add-apt-repository ppa:ubuntugis/ppa
RUN apt-get update
RUN apt-get install --yes gdal-bin python3-gdal

# Setup yarn
RUN yarn set version stable

# Setup Directories
RUN mkdir -p /data
RUN mkdir -p /output
RUN mkdir -p /logs

RUN mkdir -p /usr/src/app
ADD ./src /usr/src/app

WORKDIR /usr/src/app
RUN yarn install

EXPOSE 5001:5002
VOLUME /data/
VOLUME /output/

RUN yarn run tsoa:gen
RUN yarn tsc
RUN yarn run copy:assets
CMD [ "yarn", "node", "./build/api/app.js" ]