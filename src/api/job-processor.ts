import fs from 'fs';
import winston = require("winston");
import { EcosetJobRequest, Time, PointWGS84 } from "./types";
import { listVariables } from "./registry";
import { tryEstablishCache } from "./output-cache";

const variables = listVariables();

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

export async function processJob(job:EcosetJobRequest, jobId:string|number) {

    winston.info("Starting processing of analysis: " + JSON.stringify(job));
    
    const cacheDir = tryEstablishCache(jobId.toString());
    if (cacheDir == null) {
        return "Error";
    }

    const variablesToRun = 
        job.Executables.map(vto => {
            const v = variables.find(v => v.Id == vto.Name);
            if (v !== undefined) {
                const m = v.Methods.find(m => m?.Id == vto.Method);
                if (m == undefined) return null;
                return { Name: vto.Name, Method: m };
            }
            return null;
        }).filter(notEmpty);

    const boundingBox : PointWGS84[] = [
        { Latitude: job.LatitudeNorth, Longitude: job.LongitudeWest },
        { Latitude: job.LatitudeSouth, Longitude: job.LongitudeWest },
        { Latitude: job.LatitudeSouth, Longitude: job.LongitudeEast },
        { Latitude: job.LatitudeNorth, Longitude: job.LongitudeEast },
        { Latitude: job.LatitudeNorth, Longitude: job.LongitudeWest }
    ]

    console.log(boundingBox);

    const time : Time = { kind: "latest" }

    const workloads = 
        variablesToRun.map(v => {
            const fileTemplate = cacheDir + "/" + v.Name + "_" + v.Method.Id;
            return v.Method.Imp.computeToFile(boundingBox, time, fileTemplate, null);
        });
    
    const results = await Promise.all(workloads)
        .catch(e => console.log(e));

    winston.info("All workloads complete for analysis: " + jobId);

    // Merge all outputs into a single output (for sending all at once)
    const finalOutputFile = cacheDir + "/output.json";
    fs.writeFileSync(finalOutputFile, "{\"north\": " + job.LatitudeNorth + ",\"south\":" + job.LatitudeSouth + ",\"east\":" + job.LongitudeEast + ",\"west\":" + job.LongitudeWest + ",\"output\":[");
    
    variablesToRun.map(v => {
        const fileTemplate = cacheDir + "/" + v.Name + "_" + v.Method;

        if (!fs.existsSync(fileTemplate)) {
            winston.warn("No data in result: " + v.Name + "; method: " + v.Method);
            return;
        }

        winston.info("Synthesising results: " + v.Name + " - " + v.Method);
        fs.appendFileSync(finalOutputFile, "{ \"name\":\"" 
            + v.Name + "\",\"implementation\":\"" + v.Method
            + "\",\"output_format\":\"" + "UNKNOWN" + "\",\"stat\":\"" 
            + "UNKNOWN" + "\",\"data\":");
        

    })

    return results;
}

// for (var x = 0; x < variableMethods.length; x++) {
//     console.log("Loaded variable method: " + variableMethods[x].name);
//     // const panel = new variableMethods[x]();
//     // panel.computeToFile();
// }

// Determines available variables based on contraints.
// export function listVariables(time?: Date, space?: PointWGS84[]) {

//     let filtered = variableMethods;

//     if (time != null) {
//         filtered =
//             filtered.filter(v => {
//                 v.
//             })
//     }
// }