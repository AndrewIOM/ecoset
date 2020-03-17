import { IVariableMethod, TemporalDimension, SlicedTime, PointWGS84, Time, Result, GeospatialForm, DependentResultFile } from "./../api/types"
import { timeSlices, temporalMatch } from "./utils/time-slices";
import { runCommand } from "./utils/run-command";
import fs from 'fs';
import JSONstream from 'jsonstream';
import path from 'path';
import { logger } from "../api/logger";

@IVariableMethod.register
export class IntersectShapeVariableMethod {

    private config : IntersectShapeConfig;

    constructor(deps:string[],conf:any) {
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

    async computeToFile(space:PointWGS84[],time:Time,outputDir:string,dependencies:DependentResultFile[],options:any) : Promise<Result<GeospatialForm, string>> {
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
    logger.info("Starting shapefile intersection");
    const times = timeSlices(shapefileDir);
    const timeSlice = temporalMatch(times, time);
    if (timeSlice == undefined) {
        logger.warn("There were no time slices that met the criteria");
        return { kind: "failure", message: "There were no time slices that met the criteria" };
    }
    if (timeSlice.Slice == undefined) {
        logger.warn("There were no time slices that met the criteria");
        return { kind: "failure", message: "There were no time slices that met the criteria" };
    }

    // 2. Load shapefile
    const shapefile =
        fs.readdirSync(timeSlice.Slice)
            .find(x => path.extname(x) === ".shp");
    if (shapefile == undefined) {
        logger.warn("There were no data in the time slice");
        return { kind: "failure", message: "There were no data in the time slice" };
    }

    // 3. Convert shapefile to geojson and select overlapping points
    const temporaryFile = outputFileTemplate + "_temp.json";
    const wktPolygon = "POLYGON ((" + (space.map(s => s.Longitude.toString() + " " + s.Latitude.toString()).join()) + "))"; // lon-lat format
    let commandOpts = ["-clipsrc", wktPolygon, temporaryFile, timeSlice.Slice + "/" + shapefile, "-f", "GeoJSON"];
    const success = await runCommand("ogr2ogr", commandOpts, false, false).then(_ => {
        if (!fs.existsSync(temporaryFile)) {
            logger.warn("ogr2ogr did not output anything.");
            return false;
        }
        return true;
    }).catch(err => {
        logger.error("Shape file intersection failed with error: " + err);
        return false;
    });
    if (!success) {
        return { kind: "failure", message: "Shape intersection did not complete successfully." };
    }

    // 4. Filter json to only desired properties
    const filter = new Promise<void>((resolve,reject) => {
        const outputFile = outputFileTemplate + "_output.json";
        const outputStream = fs.createWriteStream(outputFile);
        fs.appendFileSync(outputFile, "[");
        fs.createReadStream(temporaryFile)
            .pipe(JSONstream.parse(['features', true, 'properties']))
            .pipe(JSONstream.stringify())
            .pipe(outputStream)
            .on('finish', _ => {
                logger.info("Filtered data properties.");
                resolve();
            })
            .on('error', reject); 
    });
    await filter.catch(e => {
        logger.error("Error filtering data properties: " + JSON.stringify(e));
    })

    try { fs.unlinkSync(temporaryFile) } catch (e) {}
    logger.info("Finished shapefile intersection");
    return { kind: "ok", result: GeospatialForm.DataTable };
}