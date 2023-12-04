<img alt="ecoset" src="docs/images/ecoset-logo.png" width=200>

<a href="https://github.com/AndrewIOM/ecoset/pkgs/container/ecoset-vnext%2Fimage">![GitHub release (with filter)](https://img.shields.io/github/v/release/AndrewIOM/ecoset?label=Container%20registry&color=%2351BB93)</a>
![Docker](https://github.com/AndrewIOM/ecoset-vnext/workflows/Docker/badge.svg)

A flexible application for serving geospatial datasets.

## Features

Ecoset processes and serves geospatial information about environmental variables. Each environmental variable may be created through one or many methods, each of which can have its own technical implementation. 

- An API with Swagger definitions and user interface.
- In-built methods to process data from shapefiles, geotiffs and local biodiversity occurrence databases.
- Variables with multiple implementations.
- Handles feature, raster, and table data. 

## Documentation

Table of contents

* [Getting started](/docs/gettting-started.md)
* [Configuration files](/docs/configuration.md)
* [Geotemporal Variables and Methods](/docs/variables.md)
* [Creating Custom Variable Methods](/docs/custom-methods.md)
* [Spatial and temporal dimensionality](/docs/dimensions.md)

## Development

Local development and testing can be done either inside or outside of Docker containers. A small amount of sample data is included in ``/test/sample-data`` so that some basic functions may be tested easily.

### Using Docker

Ecoset can be tested - alongside redis and gbif server dependencies - by using the docker-compose files in the root directory. Run ``docker-compose -f docker-compose.yml -f docker-compose.dev.yml build`` then ``docker-compose -f docker-compose.yml -f docker-compose.dev.yml up`` to test using Docker.

### Locally

If not using Docker, ensure you have at least Node 20 LTS installed. 

1. Setup an available redis instance and - if not localhost - set the cache host and port in ``/src/config/default.yml``.
2. Navigate to ``src``, then run ``yarn`` to restore packages.
3. Run ``yarn run tsoa:gen`` to generate route definitions.
4. Run ``yarn run dev`` to start ecoset and watch for file changes.

To work on and test GBIF plugins, an available mysql database with a mirrored copy of gbif is required. 

### Proposed features TODO list

- Filters for pre- and post-processing of datasets (e.g. buffer in pre-, summarise in post-).