import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { logger } from './logger';
import { EcosetJobRequest, PointWGS84, TemporalDimension, IVariableMethod, Result, JobState } from "./types";
import { listVariables, getDependencies } from "./registry";
import { tryEstablishCache } from "./output-cache";
import { redisStateCache, stateCache } from './state-cache';

const variables = listVariables();

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

type VariableToRun = {
    Name: string
    Method: {
        Id: string;
        Name: string;
        License: string;
        LicenseUrl: string;
        Time: TemporalDimension;
        Space: PointWGS84[];
        Imp: IVariableMethod;
    }
    Options: Map<string,any>
}

type Node = {
    Variable: VariableToRun,
    Dependencies: Node[]
}

// Returns a jagged array of the running heirarchy of a particular plugin.
const getNodeTree = (variable:VariableToRun, variablesToRun:VariableToRun[]) : Node => {
    const dependencies = getDependencies(variable.Name, variable.Method.Id);
    if (dependencies.length > 0) {
        const node =
            dependencies
            .map(d => variablesToRun.find(v => v.Name == d))
            .filter(notEmpty)
            .map(d => getNodeTree(d, variablesToRun));
        return { Variable: variable, Dependencies: node };
    }
    return { Variable: variable, Dependencies: []};
}

const kahn = (nodes:Node[]) => {
    let L = Array<Node>();
    let S = nodes.filter(n => n.Dependencies.length == 0);

    let graph = nodes;
    while (S.length > 0) {
        let n = S.pop() as Node;
        L.push(n);
        for (let index = 0; index < graph.length; index++) {
            // For each (node m with edge e from n to m) do
            if (graph[index].Dependencies.filter(m => m.Variable.Name == n.Variable.Name).length > 0) {
                // Remove edge mathed from graph.
                graph[index] = { Variable: graph[index].Variable, Dependencies: graph[index].Dependencies.filter(x => x.Variable.Name !== n.Variable.Name) };
                
                if (graph[index].Dependencies.length == 0) {
                    S.push(graph[index]);
                }
            }
        }
    }

    if (graph.filter(m => m.Dependencies.length > 0).length > 0) {
        throw "Dependency tree has at least one circularity.";
    }
    return L;
}

const writeData = (fileReader:readline.Interface, finalOutputFile:string) => {
    return new Promise(resolve => {
        fileReader.on('line', function(line) {
            fs.appendFileSync(finalOutputFile, line);
        }).on("close", () => {
            return resolve();
        });
    });
}


export async function processJob(job:EcosetJobRequest, jobId:number) : Promise<Result<void,string>> {

    logger.info("Starting processing of analysis: " + JSON.stringify(job));
    redisStateCache.setState(stateCache, jobId, JobState.Processing);

    const cacheDir = tryEstablishCache(jobId.toString());
    if (cacheDir == null) {
        return { kind: "failure", message: "Cache directory does not exist" };
    }

    const variablesToRun = 
        job.Executables.map(vto => {
            const v = variables.find(variable => variable.Id == vto.Name);
            if (v !== undefined) {
                const m = v.Methods.find(method => method?.Id == vto.Method);
                if (m == undefined) return null;
                return { Name: vto.Name, Method: m, Options: vto.Options };
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

    const nodes = variablesToRun.map(v => getNodeTree(v, variablesToRun));
    const orderedNodes = kahn(nodes);

    const workloads = 
        orderedNodes.map(node => {
            const fileTemplate = cacheDir + node.Variable.Name + "_" + node.Variable.Method.Id;
            const v = node.Variable.Method.Imp.computeToFile(boundingBox, job.TimeMode, fileTemplate, node.Variable.Options);
            return v;
        });

    // TODO Group nodes into levels to run using Promise.All
    const runInSequence = async (functions: Promise<Result<void, string>>[]) => {
        const allResults = [];
        for (const fn of functions) { allResults.push(await fn); }
        return allResults;
    }

    const results = await runInSequence(workloads).then(x => {
        logger.info("All workloads completed");
        return x;
    });

    if (results.find(r => r.kind == "failure")) {
        return { kind: "failure", message: "There was an internal error with your analysis"};
    }

    logger.info("All workloads complete for analysis: " + jobId);

    // Merge all outputs into a single output (for sending all at once)
    const finalOutputFile = cacheDir + "/output.json";
    fs.writeFileSync(finalOutputFile, "{\"north\": " + job.LatitudeNorth + ",\"south\":" + job.LatitudeSouth + ",\"east\":" + job.LongitudeEast + ",\"west\":" + job.LongitudeWest + ",\"output\":[");
    
    for (let index = 0; index < variablesToRun.length; index++) {

        const variableResult = path.join(cacheDir, variablesToRun[index].Name + "_" + variablesToRun[index].Method.Id + "_output.json");
        logger.debug("File is: " + variableResult);
        if (!fs.existsSync(variableResult)) {
            logger.warn("file doesn't exist");
            logger.warn("No data in result: " + variablesToRun[index].Name + "; method: " + variablesToRun[index].Method.Id);
            return { kind: "failure", message: "No data in result: " + variablesToRun[index].Name + "; method: " + variablesToRun[index].Method.Id };
        }
        logger.info("Synthesising results: " + variablesToRun[index].Name + " - " + variablesToRun[index].Method.Id);
        fs.appendFileSync(finalOutputFile, "{ \"name\":\""
            + variablesToRun[index].Name + "\",\"implementation\":\"" + variablesToRun[index].Method.Id
            + "\",\"output_format\":\"" + "UNKNOWN" + "\",\"stat\":\""
            + "UNKNOWN" + "\",\"data\":");

        const fileReader = readline.createInterface( {input: fs.createReadStream(variableResult) });

        await writeData(fileReader, finalOutputFile);
        if (index < variablesToRun.length - 1) {
            fs.appendFileSync(finalOutputFile, "},");
        } else {
            fs.appendFileSync(finalOutputFile, "}]}");
        }
    }

    redisStateCache.setState(stateCache, jobId, JobState.Ready);
    logger.info("Analysis complete");
    return { kind: "ok", result: undefined };
}