import { IVariableMethod, TemporalDimension, SlicedTime, PointWGS84, Time, Result, GeospatialForm } from "./../api/types"
import { timeSlices, temporalMatch } from "./utils/time-slices";
import { runCommand } from "./utils/run-command";
import fs from 'fs';
import JSONstream from 'jsonstream';
import path from 'path';
import winston = require("winston");

@IVariableMethod.register
class IntersectShapeVariableMethod {

    private config : IntersectShapeConfig;

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
        return await cutShapefile(space, time, this.config.ShapefileDir, outputDir);
    }
}

type IntersectShapeConfig = {
    ShapefileDir: string
}

const validateConfig = (config:any) => {
    if (config.shapefileDir == null) throw Error("[shapefile] Shapefile location must be set");
    const c : IntersectShapeConfig = {
        ShapefileDir: config.shapefileDir
    }
    return c;
}

const cutShapefile = async (space:PointWGS84[], time:Time, shapefileDir:string, outputFileTemplate:string) : Promise<Result<GeospatialForm,string>> => {

    // 1. Find the shapefile for the time.
    console.log("Starting shapefile intersection");
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

    // 2. Load shapefile
    const shapefile =
        fs.readdirSync(timeSlice.Slice)
            .find(x => path.extname(x) === ".shp");
    if (shapefile == undefined) {
        winston.warn("There were no data in the time slice");
        return { kind: "failure", message: "There were no data in the time slice" };
    }

    // 3. Convert shapefile to geojson and select overlapping points
    const temporaryFile = outputFileTemplate + "_temp.json";
    const wktPolygon = "POLYGON ((" + (space.map(s => s.Latitude.toString() + " " + s.Longitude.toString()).join()) + "))";
    let commandOpts = ["-clipsrc", wktPolygon, temporaryFile, timeSlice.Slice + "/" + shapefile, "-f", "GeoJSON"];
    await runCommand("ogr2ogr", commandOpts, false, false);

    if (!fs.existsSync(temporaryFile)) {
        winston.warn("ogr2ogr did not output anything.");
        return { kind: "failure", message: "Shape intersection did not complete successfully." };
    }

    // 4. Filter json to only desired properties
    const outputFile = outputFileTemplate + "_output.json";
    const outputStream = fs.createWriteStream(outputFile)

    fs.appendFileSync(outputFile, "[");
    fs.createReadStream(temporaryFile)
        .pipe(JSONstream.parse(['features', true, 'properties']))
        .pipe(JSONstream.stringify())
        .pipe(outputStream);

    // Remove temporary files
    try { fs.unlinkSync(temporaryFile) } catch (e) {}
    console.log("Finished shapefile intersection");

    return { kind: "ok", result: GeospatialForm.DataTable };
}