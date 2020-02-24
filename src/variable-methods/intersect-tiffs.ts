import { IVariableMethod, TemporalDimension, SlicedTime, PointWGS84, Time, Result, GeospatialForm } from "./../api/types"
import { getTimeSlices, run } from "./utils/merge-and-window";

@IVariableMethod.register
export class IntersectTiffsVariableMethod {

    private config : IntersectTiffConfig;

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
            slices: getTimeSlices(this.config.TileDir)
        }
        return (slices);
    }

    availableForDate() { return true; }

    availableForSpace() { return true; }

    async computeToFile(space:PointWGS84[],time:Time,outputDir:string,options?:any) : Promise<Result<GeospatialForm, string>> {
        const buffer = options == undefined ? 0 : options.buffer;
        const resolution = options == undefined ? undefined : options.resolution;
        const summaryOnly : boolean = options == undefined ? false : options.summarise;
        try {
            return await run(space, time, this.config.TileDir, this.config.NoDataValue, outputDir, summaryOnly, buffer, resolution);
        }
        catch (e) {
            return { kind: "failure", message: e } as Result<GeospatialForm, string>;
        }
    }
}

type IntersectTiffConfig = {
    TileDir: string,
    NoDataValue: number
}

const validateConfig = (config:any) => {

    if (config.tiledir == null) throw Error("[tiledir] Tile directory must be set");
    if (isNaN(Number(config.nodata))) throw Error("[nodata] You must set a no-data value")

    const c : IntersectTiffConfig = {
        TileDir: config.tiledir,
        NoDataValue: Number(config.nodata)
    }
    return c;
}