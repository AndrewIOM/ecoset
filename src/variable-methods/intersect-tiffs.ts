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

    getNumber(value:any) : number | undefined {
        const t = typeof value;
        if (t == "string") return isNaN(parseFloat(value)) ? undefined : parseFloat(value);
        if (t == "number") return value;
        return undefined;
    }

    async computeToFile(space:PointWGS84[],time:Time,outputDir:string,options?:any) : Promise<Result<GeospatialForm, string>> {
        const buffer = options == undefined ? 0 : this.getNumber(options.buffer);
        const resolution = options == undefined ? undefined : this.getNumber(options.resolution);
        const summaryOnly : boolean = options == undefined ? false : options.summarise;
        try {
            return await run(space, time, this.config.TileDir, this.config.NoDataValue, this.config.ScaleFactor, outputDir, summaryOnly, buffer, resolution);
        }
        catch (e) {
            return { kind: "failure", message: e } as Result<GeospatialForm, string>;
        }
    }
}

type IntersectTiffConfig = {
    TileDir: string,
    NoDataValue: number
    ScaleFactor: number | undefined
}

const validateConfig = (config:any) => {

    if (config.tiledir == null) throw Error("[tiledir] Tile directory must be set");
    if (isNaN(Number(config.nodata))) throw Error("[nodata] You must set a no-data value")

    const c : IntersectTiffConfig = {
        TileDir: config.tiledir,
        NoDataValue: parseFloat(config.nodata),
        ScaleFactor: config.scalefactor == undefined ? undefined : parseFloat(config.scalefactor)
    }
    return c;
}