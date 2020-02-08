FROM ubuntu:xenial

ENV ROOTDIR /usr/local/

# Setup Directories
RUN mkdir -p /data
RUN mkdir -p /output

# Install Node.js
RUN apt-get update
RUN apt-get install --yes curl
RUN apt-get install --yes sudo
RUN curl --silent --location https://deb.nodesource.com/setup_10.x | sudo bash -
RUN apt-get install --yes nodejs
RUN apt-get install --yes build-essential

# Install GDALRUN 
RUN apt-get install --yes software-properties-common
RUN add-apt-repository ppa:ubuntugis/ubuntugis-unstable
RUN apt-get update
RUN apt-get install --yes gdal-bin python-gdal

# Ecoset
# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Bundle app source
ADD ./src /usr/src/app

# Install app dependencies
RUN npm install
WORKDIR /usr/src/app/api
RUN npm install
WORKDIR /usr/src/app/executables
RUN npm install

WORKDIR /usr/src/app

EXPOSE 5001:5002
VOLUME /data
VOLUME /output

CMD [ "npm", "start" ]