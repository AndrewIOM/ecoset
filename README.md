# ecoset

![Docker](https://github.com/AndrewIOM/ecoset-vnext/workflows/Docker/badge.svg)

A flexible application for serving geospatial datasets. [See the documentation website here](http://acm.im/ecoset-vnext/).

## Features

Ecoset processes and serves geospatial information about environmental variables. Each environmental variable may be created through one or many methods, each of which can have its own technical implementation. 

- An API with Swagger definitions and user interface.
- In-built methods to process data from shapefiles, geotiffs and local biodiversity occurrence databases.
- Variables with multiple implementations.
- Handles feature, raster, and table data. 

## Development

Key requirements for local development:
- node v10+
- yarn v1 global install

## Things to do

- Implement filters for pre- and post-processing of datasets (e.g. buffer in pre-, summarise in post-).