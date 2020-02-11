import { IVariableMethod, TemporalDimension, SlicedTime, PointWGS84, Time, Result } from "./../api/types"
import { getTimeSlices, run } from "./utils/merge-and-window";

@IVariableMethod.register
class IntersectTiffsVariableMethod {

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

    computeToFile(space:PointWGS84[],time:Time,outputDir:string,options?:any) : Promise<Result<void, string>> {
        const buffer = options == undefined ? 0 : options.buffer;
        const resolution = options == undefined ? undefined : options.resolution;
        return run(space, time, this.config.TileDir, this.config.NoDataValue, outputDir, buffer, resolution);
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
