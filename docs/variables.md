---
id: variables
title: Geotemporal Variables and Methods
sidebar_label: Geotemporal Variables
---

The Ecoset engine is configured to serve environmental *variables*, each of which may have been generated using one or more *methods*. 

## Variables

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque elementum dignissim ultricies. Fusce rhoncus ipsum tempor eros aliquam consequat. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus elementum massa eget nulla aliquet sagittis. Proin odio tortor, vulputate ut odio in, ultrices ultricies augue. Cras ornare ultrices lorem malesuada iaculis. Etiam sit amet libero tempor, pulvinar mauris sed, sollicitudin sapien.

## Methods

There could be many plausable methods for calculating any given environmental variable (e.g. transpiration). Ecoset represents these as **methods**. 

## Included Methods

The following methods are included within a basic Ecoset instance:

### ``intersect-tiff``

This method extracts a subset from geospatial data stored as GeoTIFF tiles. 

### ``gbif-query``

This method runs spatial-temporal queries over a MySQL database that contains Global Biodiversity Information Facility (GBIF) data. 