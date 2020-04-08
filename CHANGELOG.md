# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.11]
### Fixed
- Aggregator now returns mean of data values and exlcudes nodata

## [2.1.10]
### Fixed
- Fixed nodata handling in aggregator

## [2.1.9]
### Changed
- Raster data cubes are now formatted as numbers (in line with JSON spec) rather than string. No data values are now null.

## [2.1.8]
### Fixed
- Fixed issue where area calulation and intersection methods would have reversed lat/lon.
- Fixed logging when running commands or shapefile intersection to log to log files.

## [2.1.7]
### Fixed
- Fixed lockfile issue on docker online build

## [2.1.6]
### Fixed
- GBIF queries get temporal dimension only when requested
- Area calculation method .reduce function has default zero for when no data is returned
- GBIF queries correctly return failure when counting fails
- Jobs queued return queued status from API rather than nonexistent
- Jobs with no valid variables fail

## [2.1.5]
### Fixed
- Fixed crash when empty row passed into aggregator

## [2.1.2]
### Aded
- Geotiffs: maxresolution option

### Changed
- Geotiffs: resolution option now interpolates to specified resolution

### Fixed
- Bug where aggregator method returned null instead of NaN when calculation parameters contained one or more NaN.

## [2.1.1]
### Fixed
- Bug in 2.1 caused by out-of-date yarn lockfile.

## [2.1.0]
### Added
- Method: aggregate many spatial outputs by a custom equation

## [2.0.3]
### Fixed
- Parsing of boolean options in IntersectTiff works for string representation

## [2.0.2]
### Added
- Method: total areas by categories (uses shapefiles)

## [2.0.1]
### Added
- Documentation website using Docusaurus.
- Swagger API interface.
- Method: intersect shapefile.
- Method: intersect geotiffs.
- Single configuration file as .yml.

### Changed
- Dependency structure of variable methods now defined in central config.yml.
- Moved to Bull from Kue for queueing mechanism.