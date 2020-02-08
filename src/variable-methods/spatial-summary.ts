import { IVariableMethod, TemporalDimension, SlicedTime, PointWGS84, Time, Result } from "./../api/types"
import { getTimeSlices, run } from "./utils/merge-and-window";

// @IVariableMethod.register
// class SpatialSummaryVariableMethod {

//     // If dependencies have not been run, make them run
//     // as part of the SpatialSummary method.

//     // Can therefore be nested, so long as space-time are
//     // compatible with each other.

//     availableOutputTypes() {
//         return [ "json" ];
//     }

//     spatialDimension() {
//         let boundingBox = [
//             { Latitude: 90, Longitude: -180 },
//             { Latitude: -90, Longitude: -180 },
//             { Latitude: -90, Longitude: 180 },
//             { Latitude: 90, Longitude: 180 },
//             { Latitude: 90, Longitude: -180 }
//         ]
//         return boundingBox;
//     }

//     temporalDimension() : TemporalDimension {
//         let slices : SlicedTime = {
//             kind: "timeSlice",
//             slices: getTimeSlices(this.config.TileDir)
//         }
//         return (slices);
//     }

//     availableForDate() { return true; }

//     availableForSpace() { return true; }

//     computeToFile(space:PointWGS84[],time:Time,outputDir:string,options:any) : Promise<Result<void, string>> {
//         return run(space, time, this.config.TileDir, this.config.NoDataValue, outputDir, options.buffer, options.resolution);
//     }
// }