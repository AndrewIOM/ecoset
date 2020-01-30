---
id: getting-started
title: Getting Started
sidebar_label: Getting Started
---

Ecoset is a queue-based system for simple processing and serving of geotemporal datasets. The Ecoset engine may be used with point, polygon and raster datasets.

You can run your own Ecoset instance directly (using yarn or npm), or within Docker containers.

## Option 1. Run directly

Ensure you have [yarn](https://yarnpkg.com) installed. In the ``src`` directory, run ``yarn install`` to install required dependencies. The following commands are then available:

* ``yarn run dev``. Start an instance of Ecoset with live Typescript transpiling, on the port specified in the configuration files. The default port is 5002.
* ``yarn run tsoa:gen``. Generates an API documentation website using Swagger. 
* ``yarn run prod``. Starts Ecoset with pre-compiled Typescript. Use in your production environment.

Before running ``yarn run dev``, you must have an available Redis instance. If you have Docker installed, the easiest way to do this is to run ``docker-compose -f docker-compose.dev.yml up -d`` within the ``src`` folder.

## Option 2. Run using Docker

Coming soon.

