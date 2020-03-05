# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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