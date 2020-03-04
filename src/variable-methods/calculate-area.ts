import { IVariableMethod, TemporalDimension, SlicedTime, PointWGS84, Time, Result, GeospatialForm } from "./../api/types"
import { timeSlices, temporalMatch } from "./utils/time-slices";
import { runCommand } from "./utils/run-command";
import fs from 'fs';
import path from 'path';
import winston = require("winston");
import { logger } from "../api/logger";
import { polygon, buffer, area, featureEach } from '@turf/turf';

@IVariableMethod.register
export class CalculateAreaVariableMethod {

    private config : CalculateAreaConfig;

    constructor(conf:any) {
        this.config = (validateConfig(conf));
    }

    availableOutputTypes() {
        return [ "json" ];
    }

    spatialDimension() {
        let boundingBox = [
            { Latitude: 90, Longitude: -180 },
            { Latitude: -90, Longitude: -180 },
            { Latitude: -90, Longitude: 180 },
            { Latitude: 90, Longitude: 180 },
            { Latitude: 90, Longitude: -180 }
        ]
        return boundingBox;
    }

    temporalDimension() : TemporalDimension {
        let slices : SlicedTime = {
            kind: "timeSlice",
            slices: Array.from(timeSlices(this.config.ShapefileDir).keys())
        }
        return (slices);
    }

    availableForDate() { return true; }

    availableForSpace() { return true; }

    async computeToFile(space:PointWGS84[],time:Time,outputDir:string,options:any) : Promise<Result<GeospatialForm, string>> {
        return await getAreaByCategory(space, time, this.config.ShapefileDir, this.config.Field, outputDir);
    }
}

type CalculateAreaConfig = {
    ShapefileDir: string
    Field: string
}

const validateConfig = (config:any) => {
    if (config.shapefileDir == null) throw Error("[shapefile] Shapefile location must be set");
    if (config.field == null) throw Error("[shapefile] Field to calculate area from must be set");
    const c : CalculateAreaConfig = {
        ShapefileDir: config.shapefileDir,
        Field: config.field
    }
    return c;
}

const getAreaByCategory = async (space:PointWGS84[], time:Time, shapefileDir:string, field:string, outputFileTemplate:string) : Promise<Result<GeospatialForm,string>> => {

    // 1. Find the shapefile for the time.
    logger.info("Starting shapefile area query");
    const times = timeSlices(shapefileDir);
    const timeSlice = temporalMatch(times, time);
    if (timeSlice == undefined) {
        winston.warn("There were no time slices that met the criteria");
        return { kind: "failure", message: "There were no time slices that met the criteria" };
    }
    if (timeSlice.Slice == undefined) {
        winston.warn("There were no time slices that met the criteria");
        return { kind: "failure", message: "There were no time slices that met the criteria" };
    }

    // 2. Buffer polygon if required.
    const poly = polygon([space.map(s => [s.Latitude, s.Longitude])]);
    const bufferedPoly = buffer(poly, 3, { units: 'degrees' });

    let wkt = "POLYGON ((";
    bufferedPoly.geometry?.coordinates[0].forEach(pos => {
        wkt = wkt + pos[0] + " " + pos[1] + ",";
    });
    wkt = wkt.substr(0, wkt.length - 1) + "))";
    logger.info("WKT is: " + wkt);

    // 3. Load shapefile
    const shapefile =
        fs.readdirSync(timeSlice.Slice)
            .find(x => path.extname(x) === ".shp");
    if (shapefile == undefined) {
        winston.warn("There were no data in the time slice");
        return { kind: "failure", message: "There were no data in the time slice" };
    }

    // 4. Clip shapefile to area
    const clippedFile = outputFileTemplate + "_clipped.json";
    let commandOpts = ["-clipsrc", wkt, clippedFile, timeSlice.Slice + "/" + shapefile, "-f", "GeoJSON" ];
    await runCommand("ogr2ogr", commandOpts, false, false);
    if (!fs.existsSync(clippedFile)) {
        winston.warn("ogr2ogr did not output anything.");
        return { kind: "failure", message: "Shape clip did not complete successfully." };
    }
    
    // 5. Spatial statistics
    const clippedGeojson = JSON.parse(fs.readFileSync(clippedFile, 'UTF8'));
    let areas = new Map<string,number>();
    featureEach(clippedGeojson, (f,i) => {
        const a = area(f);
        if (f.properties == null) return;
        if (areas.has(f.properties[field])) {
            const currentArea = areas.get(f.properties[field]);
            if (currentArea) areas.set(f.properties[field], a + currentArea);
        } else {
            areas.set(f.properties[field], a);
        }
    });
    const filledArea = Array.from(areas.values()).reduce((a, b) => a + b);
    areas.set('none', area(bufferedPoly) - filledArea);
    
    const output = Array.from(areas).map(x => {
        return { MetreSquared: x[1], Category: x[0] };
    });

    const json = JSON.stringify(output);
    fs.writeFileSync(outputFileTemplate + '_output.json', json);
    try { fs.unlinkSync(clippedFile) } catch (e) {}
    return { kind: "ok", result: GeospatialForm.DataTable };    
}