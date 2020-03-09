import { IVariableMethod, TemporalDimension, SlicedTime, PointWGS84, Time, Result, GeospatialForm, DependentResultFile } from "./../api/types"
import { getTimeSlices, run } from "./utils/merge-and-window";

@IVariableMethod.register
export class IntersectTiffsVariableMethod {

    private config : IntersectTiffConfig;

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

    getBool(value:any) : boolean {
        const t = typeof value;
        if (t == "string") return value.toLowerCase() == "true";
        if (t == "boolean") return value;
        return false;
    }

    async computeToFile(space:PointWGS84[],time:Time,outputDir:string,dependencies:DependentResultFile[],options?:any) : Promise<Result<GeospatialForm, string>> {
        const buffer = options == undefined ? 0 : this.getNumber(options.buffer);
        const resolution = options == undefined ? undefined : this.getNumber(options.resolution);
        const summaryOnly : boolean = options == undefined ? false : this.getBool(options.summarise);
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