FROM ubuntu:xenial

ENV ROOTDIR /usr/local/

# Install Node.js
RUN apt-get update
RUN apt-get install --yes curl
RUN apt-get install --yes sudo
RUN curl --silent --location https://deb.nodesource.com/setup_10.x | sudo bash -
RUN apt-get install --yes nodejs
RUN apt-get install --yes build-essential

# Install GDAL
RUN apt-get install --yes software-properties-common
RUN add-apt-repository ppa:ubuntugis/ubuntugis-unstable
RUN apt-get update
RUN apt-get install --yes gdal-bin python-gdal

# Install yarn 1.2
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update
RUN apt-get install --yes yarn

# Setup Directories
RUN mkdir -p /data
RUN mkdir -p /output

RUN mkdir -p /usr/src/app
ADD ./src /usr/src/app

WORKDIR /usr/src/app
RUN yarn install

EXPOSE 5001:5002
VOLUME /data
VOLUME /output

CMD [ "yarn", "run", "prod" ]